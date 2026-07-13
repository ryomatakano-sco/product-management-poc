from __future__ import annotations

import csv
import io
from datetime import datetime, timedelta, timezone
from decimal import Decimal

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import func, or_, select
from sqlalchemy.orm import selectinload

from app.deps import DB, StoreId
from app.models.inventory import AdjustmentReason, InventoryAdjustment, InventoryField
from app.models.product import Product, ProductStatus, ProductVariant, TaxRate
from app.models.sale import PaymentMethod, SalesRecord
from app.models.settings_kv import SettingsKV
from app.services.lots import consume_fefo, restock_newest
from app.services.notifier import check_low_stock
from app.services.stock import StockError, apply_stock_delta
from app.services.tz import any_to_utc_naive, jst_to_utc_naive
from app.schemas.sale import (
    ReceiptData, ReceiptLine, ReceiptStore,
    SaleCreate, SaleListResponse, SaleRead, SalesSummary,
    RefundRequest,
)

router = APIRouter(prefix="/sales", tags=["sales"])


def _apply_sale_filters(
    stmt,
    *,
    store_id: int,
    branch_id: int | None,
    payment_method: PaymentMethod | None,
    date_from: datetime | None,
    date_to: datetime | None,
    q: str | None,
    has_patient: bool | None,
    sold_by: str | None = None,
):
    """Shared WHERE clauses used by list_sales() and export_sales_csv()."""
    stmt = stmt.where(SalesRecord.store_id == store_id)
    if branch_id is not None:
        stmt = stmt.where(SalesRecord.branch_id == branch_id)
    if payment_method is not None:
        stmt = stmt.where(SalesRecord.payment_method == payment_method)
    if sold_by:
        stmt = stmt.where(SalesRecord.sold_by == sold_by)
    # sold_at is stored UTC-naive — normalize aware inputs (audit M9).
    if date_from is not None:
        stmt = stmt.where(SalesRecord.sold_at >= any_to_utc_naive(date_from))
    if date_to is not None:
        stmt = stmt.where(SalesRecord.sold_at <= any_to_utc_naive(date_to))
    if has_patient is True:
        stmt = stmt.where(SalesRecord.patient_ref.is_not(None))
    elif has_patient is False:
        stmt = stmt.where(SalesRecord.patient_ref.is_(None))
    if q:
        needle = f"%{q.strip()}%"
        stmt = (
            stmt.join(ProductVariant, ProductVariant.id == SalesRecord.variant_id)
                .join(Product, Product.id == ProductVariant.product_id)
                .where(or_(
                    Product.name.ilike(needle),
                    ProductVariant.sku.ilike(needle),
                    SalesRecord.transaction_id.ilike(needle),
                ))
        )
    return stmt


async def _next_transaction_id(db, store_id: int, sold_at_utc: datetime) -> str:
    """Generate SL-YYYYMMDD-#### for the given sale.

    Counter starts at (day's row count + 1) but then PROBES for a free id
    (audit C4): counts drift from the real max whenever rows are deleted or
    refunds inflate the day, which previously produced duplicate ids and an
    unhandled IntegrityError 500. Single-worker PoC — a cross-process race
    remains theoretical; a real build would use a DB sequence.
    """
    sold_at_jst = sold_at_utc.astimezone(JST) if sold_at_utc.tzinfo else sold_at_utc.replace(tzinfo=timezone.utc).astimezone(JST)
    ymd = sold_at_jst.strftime("%Y%m%d")
    day_start_utc = sold_at_jst.replace(hour=0, minute=0, second=0, microsecond=0).astimezone(timezone.utc)
    next_day_start_utc = day_start_utc + timedelta(days=1)
    count = (await db.execute(
        select(func.count(SalesRecord.id))
        .where(SalesRecord.store_id == store_id)
        .where(SalesRecord.sold_at >= day_start_utc)
        .where(SalesRecord.sold_at < next_day_start_utc)
    )).scalar_one()

    n = count + 1
    for _ in range(200):  # generous headroom; bails to a 409 below
        candidate = f"SL-{ymd}-{n:04d}"
        exists = (await db.execute(
            select(SalesRecord.id).where(SalesRecord.transaction_id == candidate).limit(1)
        )).scalar_one_or_none()
        if exists is None:
            return candidate
        n += 1
    raise HTTPException(409, detail="取引IDの採番に失敗しました。もう一度お試しください。")


@router.get("", response_model=SaleListResponse)
async def list_sales(
    db: DB,
    store_id: StoreId,
    branch_id: int | None = None,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    payment_method: PaymentMethod | None = None,
    sold_by: str | None = None,
    q: str | None = Query(None, description="Search product name, SKU, or transaction ID"),
    has_patient: bool | None = Query(None, description="true = only linked to a patient, false = only unlinked"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
):
    """List sales records (newest first) with denormalized product name + sku."""
    base = _apply_sale_filters(
        select(SalesRecord),
        store_id=store_id, branch_id=branch_id, payment_method=payment_method,
        sold_by=sold_by, date_from=date_from, date_to=date_to, q=q,
        has_patient=has_patient,
    )

    total = (await db.execute(select(func.count()).select_from(base.subquery()))).scalar_one()

    rows = (
        await db.execute(
            base.options(selectinload(SalesRecord.variant).selectinload(ProductVariant.product))
            .order_by(SalesRecord.sold_at.desc(), SalesRecord.id.desc())
            .limit(limit)
            .offset(offset)
        )
    ).scalars().all()

    items = []
    for s in rows:
        variant = s.variant
        product = variant.product if variant else None
        items.append(
            SaleRead.model_validate(s).model_copy(
                update={
                    "product_name": product.name if product else None,
                    "sku": variant.sku if variant else None,
                }
            )
        )
    return SaleListResponse(items=items, total=total)


JST = timezone(timedelta(hours=9))


@router.get("/summary", response_model=SalesSummary)
async def sales_summary(db: DB, store_id: StoreId):
    """Today / month transaction counts + revenue, plus yesterday and last-month
    figures so the KPI tiles can render "+X 昨日比 / +Y% 先月比" deltas.

    Boundaries are computed in JST so sales recorded early morning JST
    (which fall into the previous UTC day) still count toward today's KPIs.
    """
    now_jst = datetime.now(JST)
    today_start     = now_jst.replace(hour=0, minute=0, second=0, microsecond=0)
    tomorrow_start  = today_start + timedelta(days=1)
    yesterday_start = today_start - timedelta(days=1)
    month_start     = today_start.replace(day=1)
    last_month_start = (month_start - timedelta(days=1)).replace(day=1)

    revenue_expr = func.coalesce(
        func.sum(SalesRecord.quantity * SalesRecord.unit_price), 0
    )
    count_expr = func.count(SalesRecord.id)

    base = select(count_expr, revenue_expr).where(SalesRecord.store_id == store_id)

    async def in_range(start, end=None):
        # sold_at is UTC-naive; the JST boundaries must be converted or every
        # KPI is skewed by 9 hours at day/month edges (audit C1).
        stmt = base.where(SalesRecord.sold_at >= jst_to_utc_naive(start))
        if end is not None:
            stmt = stmt.where(SalesRecord.sold_at < jst_to_utc_naive(end))
        return (await db.execute(stmt)).one()

    today_count, today_revenue         = await in_range(today_start, tomorrow_start)
    yesterday_count, yesterday_revenue = await in_range(yesterday_start, today_start)
    month_count, month_revenue         = await in_range(month_start)
    last_month_count, last_month_revenue = await in_range(last_month_start, month_start)

    return SalesSummary(
        today_count=today_count or 0,
        today_revenue=str(today_revenue or 0),
        yesterday_count=yesterday_count or 0,
        yesterday_revenue=str(yesterday_revenue or 0),
        month_count=month_count or 0,
        month_revenue=str(month_revenue or 0),
        last_month_count=last_month_count or 0,
        last_month_revenue=str(last_month_revenue or 0),
    )


@router.get("/staff", response_model=list[str])
async def list_sales_staff(db: DB, store_id: StoreId):
    """Distinct non-null sold_by values for this store — feeds the 担当者 filter."""
    rows = (await db.execute(
        select(SalesRecord.sold_by)
        .where(SalesRecord.store_id == store_id, SalesRecord.sold_by.is_not(None))
        .distinct()
        .order_by(SalesRecord.sold_by)
    )).scalars().all()
    return [r for r in rows if r]


@router.get("/export.csv")
async def export_sales_csv(
    db: DB,
    store_id: StoreId,
    branch_id: int | None = None,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    payment_method: PaymentMethod | None = None,
    sold_by: str | None = None,
    q: str | None = None,
    has_patient: bool | None = None,
):
    """CSV export of the same rows the list endpoint would return, minus pagination.

    Streams so a large export doesn't buffer the whole table in memory.
    """
    PM_JA = {
        PaymentMethod.cash: "現金",
        PaymentMethod.card: "カード",
        PaymentMethod.paypay: "PayPay",
        PaymentMethod.bank_transfer: "銀行振込",
    }

    stmt = _apply_sale_filters(
        select(SalesRecord),
        store_id=store_id, branch_id=branch_id, payment_method=payment_method,
        sold_by=sold_by, date_from=date_from, date_to=date_to, q=q,
        has_patient=has_patient,
    ).options(
        selectinload(SalesRecord.variant).selectinload(ProductVariant.product)
    ).order_by(SalesRecord.sold_at.desc(), SalesRecord.id.desc())

    rows = (await db.execute(stmt)).scalars().unique().all()

    buf = io.StringIO()
    buf.write("﻿")  # UTF-8 BOM so Excel opens Japanese correctly
    writer = csv.writer(buf)
    writer.writerow([
        "日時", "取引ID", "商品", "SKU", "数量", "単価", "合計 (税込)",
        "支払方法", "担当者", "患者", "メモ",
    ])
    for s in rows:
        variant = s.variant
        product = variant.product if variant else None
        total = float(s.unit_price) * s.quantity
        writer.writerow([
            s.sold_at.strftime("%Y/%m/%d %H:%M") if s.sold_at else "",
            s.transaction_id or "",
            product.name if product else f"#{s.variant_id}",
            variant.sku if variant else "",
            s.quantity,
            f"{float(s.unit_price):.0f}",
            f"{total:.0f}",
            PM_JA.get(s.payment_method, s.payment_method),
            s.sold_by or "",
            s.patient_ref or "",
            s.note or "",
        ])

    filename = f"sales_{datetime.now(JST).strftime('%Y%m%d_%H%M')}.csv"
    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


PM_LABEL_JA = {
    PaymentMethod.cash:          "現金",
    PaymentMethod.card:          "カード",
    PaymentMethod.paypay:        "PayPay",
    PaymentMethod.bank_transfer: "銀行振込",
}


@router.get("/{sale_id}/receipt-data", response_model=ReceiptData)
async def get_receipt_data(sale_id: int, db: DB, store_id: StoreId):
    """Aggregated data used by the receipt-issue page.

    Combines the sale, its variant + product (for the product name and tax
    rate), and the store's general settings (company name, address, phone,
    qualified-invoice registration number). Computes the 8% / 10% tax
    breakdown so the frontend doesn't have to.

    unit_price is stored 税込 in this PoC. Tax-excl subtotal is derived by
    dividing by (1 + rate); the small rounding gap goes into the tax line
    so 内税 always sums to 税込 subtotal.
    """
    sale = (await db.execute(
        select(SalesRecord)
        .where(SalesRecord.id == sale_id, SalesRecord.store_id == store_id)
        .options(selectinload(SalesRecord.variant).selectinload(ProductVariant.product))
    )).scalar_one_or_none()
    if not sale:
        raise HTTPException(404, detail="Sale not found")

    variant = sale.variant
    product = variant.product if variant else None
    if not product:
        raise HTTPException(400, detail="商品情報が取得できません")

    is_reduced = product.tax_rate == TaxRate.reduced
    rate_pct = 8 if is_reduced else 10
    rate = Decimal("0.08") if is_reduced else Decimal("0.10")

    unit_price = Decimal(str(sale.unit_price))
    qty = int(sale.quantity)
    line_total = unit_price * qty

    subtotal_excl = (line_total / (Decimal("1") + rate)).quantize(Decimal("1"))
    tax = line_total - subtotal_excl

    def yen(d: Decimal) -> str:
        return str(int(d))

    line = ReceiptLine(
        name=product.name,
        quantity=qty,
        unit_price=yen(unit_price),
        line_total=yen(line_total),
        tax_rate=product.tax_rate.value,
        tax_rate_pct=rate_pct,
        is_reduced=is_reduced,
    )

    kv = (await db.execute(
        select(SettingsKV).where(
            SettingsKV.store_id == store_id, SettingsKV.namespace == "general"
        )
    )).scalar_one_or_none()
    general = (kv.data_json if kv and kv.data_json else {})

    store_info = ReceiptStore(
        company_name=general.get("company_name") or "ペイライト歯科クリニック",
        address=general.get("address"),
        phone=general.get("phone"),
        registration_no=general.get("company_registration_no"),
    )

    sold_at_iso = (
        sale.sold_at.replace(tzinfo=timezone.utc) if sale.sold_at.tzinfo is None else sale.sold_at
    ).astimezone(timezone.utc).isoformat().replace("+00:00", "Z")

    return ReceiptData(
        transaction_id=sale.transaction_id,
        sold_at=sold_at_iso,
        payment_method=sale.payment_method.value,
        payment_method_label=PM_LABEL_JA.get(sale.payment_method, sale.payment_method.value),
        lines=[line],
        subtotal_10_tax_excl=yen(subtotal_excl if not is_reduced else Decimal(0)),
        tax_10=yen(tax if not is_reduced else Decimal(0)),
        subtotal_10_tax_incl=yen(line_total if not is_reduced else Decimal(0)),
        subtotal_8_tax_excl=yen(subtotal_excl if is_reduced else Decimal(0)),
        tax_8=yen(tax if is_reduced else Decimal(0)),
        subtotal_8_tax_incl=yen(line_total if is_reduced else Decimal(0)),
        total=yen(line_total),
        store=store_info,
    )


@router.get("/{sale_id}", response_model=SaleRead)
async def get_sale(sale_id: int, db: DB, store_id: StoreId):
    """Sale detail — used by the 詳細 link in the sales table.

    NOTE: this route lives *after* /staff, /summary, and /export.csv so
    FastAPI matches those literal paths first (they'd otherwise try to
    parse as sale_id=int and 422).
    """
    sale = (await db.execute(
        select(SalesRecord)
        .where(SalesRecord.id == sale_id, SalesRecord.store_id == store_id)
        .options(selectinload(SalesRecord.variant).selectinload(ProductVariant.product))
    )).scalar_one_or_none()
    if not sale:
        raise HTTPException(404, detail="Sale not found")
    variant = sale.variant
    product = variant.product if variant else None
    return SaleRead.model_validate(sale).model_copy(update={
        "product_name": product.name if product else None,
        "sku": variant.sku if variant else None,
    })


@router.post("/{sale_id}/refund", response_model=SaleRead, status_code=201)
async def refund_sale(sale_id: int, db: DB, store_id: StoreId, body: RefundRequest | None = None):
    """Reverse a sale: create a negative-quantity refund row, mark the original
    as refunded, add the stock back on the variant, and log an audit adjustment.
    """
    original = (await db.execute(
        select(SalesRecord)
        .where(SalesRecord.id == sale_id, SalesRecord.store_id == store_id)
        .options(selectinload(SalesRecord.variant).selectinload(ProductVariant.product))
    )).scalar_one_or_none()
    if not original:
        raise HTTPException(404, detail="Sale not found")
    if original.refunded_at is not None:
        raise HTTPException(400, detail="この販売は既に返品済みです")
    if original.refund_of_sale_id is not None:
        raise HTTPException(400, detail="返品行は返品できません")
    if original.quantity <= 0:
        raise HTTPException(400, detail="この販売は返品できません（数量が0以下）")

    variant = original.variant
    if not variant:
        raise HTTPException(400, detail="商品バリアントが見つかりません")
    # Fail closed when the product record is gone (orphaned variant — audit C5).
    if variant.product is None:
        raise HTTPException(400, detail="商品情報が見つからないため返品できません")

    now = datetime.now(timezone.utc)
    transaction_id = await _next_transaction_id(db, store_id, now)

    # Restore stock at the branch the sale happened at (atomic; services/stock.py).
    try:
        refund_branch = await apply_stock_delta(
            db, store_id=store_id, variant_id=original.variant_id,
            branch_id=original.branch_id, field=InventoryField.on_hand,
            delta=original.quantity,
        )
    except StockError as e:
        await db.rollback()
        raise HTTPException(400, detail=e.message)

    # Return the stock to the newest known lot at that branch (tracking layer).
    await restock_newest(
        db, store_id=store_id, variant_id=original.variant_id,
        branch_id=refund_branch, qty=original.quantity,
    )

    refund = SalesRecord(
        store_id=store_id,
        branch_id=refund_branch,
        variant_id=original.variant_id,
        transaction_id=transaction_id,
        quantity=-original.quantity,
        unit_price=original.unit_price,
        payment_method=original.payment_method,
        sold_at=now,
        sold_by=original.sold_by,
        patient_ref=original.patient_ref,
        note=(
            f"返品: {original.transaction_id}"
            + (f"｜理由: {reason}" if (reason := (body.reason or "").strip() if body else "") else "")
        ),
        refund_of_sale_id=original.id,
    )
    db.add(refund)

    original.refunded_at = now

    db.add(InventoryAdjustment(
        store_id=store_id,
        variant_id=original.variant_id,
        branch_id=refund_branch,
        field=InventoryField.on_hand,
        delta=original.quantity,
        reason=AdjustmentReason.refund,
        reference_type="sales_record",
        reference_id=original.id,
        note=(f"理由: {reason}" if reason else None),
    ))

    await db.commit()
    await db.refresh(refund)
    product = variant.product if variant else None
    return SaleRead.model_validate(refund).model_copy(update={
        "product_name": product.name if product else None,
        "sku": variant.sku if variant else None,
    })


@router.post("", response_model=SaleRead, status_code=201)
async def create_sale(body: SaleCreate, db: DB, store_id: StoreId):
    """Record a sale and decrement on_hand inventory."""
    variant = (
        await db.execute(
            select(ProductVariant)
            .where(
                ProductVariant.id == body.variant_id, ProductVariant.store_id == store_id
            )
            .options(selectinload(ProductVariant.product))
        )
    ).scalar_one_or_none()
    if not variant:
        raise HTTPException(404, detail="Variant not found")

    # Only active products are sellable — fail CLOSED when the variant has no
    # product (orphaned variant; audit M7).
    if variant.product is None or variant.product.status != ProductStatus.active:
        raise HTTPException(
            status_code=400,
            detail="この商品はまだ販売可能ではありません（商品ステータスが「公開中」ではありません）",
        )

    sold_at = body.sold_at or datetime.now(timezone.utc)
    transaction_id = await _next_transaction_id(db, store_id, sold_at)

    # Decrement stock at the sale's branch — atomic, branch-validated
    # (services/stock.py; fixes the C3 oversell race and M2 branch tenancy).
    try:
        branch_id = await apply_stock_delta(
            db, store_id=store_id, variant_id=body.variant_id,
            branch_id=body.branch_id, field=InventoryField.on_hand,
            delta=-body.quantity,
        )
    except StockError as e:
        await db.rollback()
        raise HTTPException(400, detail=e.message)

    # FEFO lot consumption (tracking layer; never raises).
    await consume_fefo(
        db, store_id=store_id, variant_id=body.variant_id,
        branch_id=branch_id, qty=body.quantity,
    )

    sale = SalesRecord(
        store_id=store_id,
        branch_id=branch_id,
        variant_id=body.variant_id,
        transaction_id=transaction_id,
        quantity=body.quantity,
        unit_price=body.unit_price,
        payment_method=body.payment_method,
        sold_at=sold_at,
        sold_by=(body.sold_by or None),
        patient_ref=body.patient_ref,
        note=body.note,
    )
    db.add(sale)
    await db.flush()

    # Log inventory adjustment
    adj = InventoryAdjustment(
        store_id=store_id,
        variant_id=body.variant_id,
        branch_id=branch_id,
        field=InventoryField.on_hand,
        delta=-body.quantity,
        reason=AdjustmentReason.sale,
        reference_type="sales_record",
        reference_id=sale.id,
    )
    db.add(adj)

    # Low-stock notification when the sale drops available below the threshold
    # (rides in the same transaction; never raises).
    await check_low_stock(db, store_id, body.variant_id, variant.product)

    await db.commit()
    await db.refresh(sale)
    return sale
