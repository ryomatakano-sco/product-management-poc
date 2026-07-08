from __future__ import annotations

import csv
import io
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import func, or_, select
from sqlalchemy.orm import selectinload

from app.deps import DB, StoreId
from app.models.inventory import AdjustmentReason, InventoryAdjustment, InventoryField
from app.models.product import Product, ProductStatus, ProductVariant
from app.models.sale import PaymentMethod, SalesRecord
from app.schemas.sale import SaleCreate, SaleListResponse, SaleRead, SalesSummary

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
    if date_from is not None:
        stmt = stmt.where(SalesRecord.sold_at >= date_from)
    if date_to is not None:
        stmt = stmt.where(SalesRecord.sold_at <= date_to)
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

    Counter is per (store_id, JST-date). Race under high concurrency is
    theoretically possible; the unique index will surface a duplicate as an
    IntegrityError which the caller could retry (not implemented — PoC).
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
    return f"SL-{ymd}-{count + 1:04d}"


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
        stmt = base.where(SalesRecord.sold_at >= start)
        if end is not None:
            stmt = stmt.where(SalesRecord.sold_at < end)
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
async def refund_sale(sale_id: int, db: DB, store_id: StoreId):
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

    now = datetime.now(timezone.utc)
    transaction_id = await _next_transaction_id(db, store_id, now)

    refund = SalesRecord(
        store_id=store_id,
        branch_id=original.branch_id,
        variant_id=original.variant_id,
        transaction_id=transaction_id,
        quantity=-original.quantity,
        unit_price=original.unit_price,
        payment_method=original.payment_method,
        sold_at=now,
        sold_by=original.sold_by,
        patient_ref=original.patient_ref,
        note=f"返品: {original.transaction_id}",
        refund_of_sale_id=original.id,
    )
    db.add(refund)

    original.refunded_at = now
    variant.on_hand += original.quantity

    db.add(InventoryAdjustment(
        store_id=store_id,
        variant_id=original.variant_id,
        field=InventoryField.on_hand,
        delta=original.quantity,
        reason=AdjustmentReason.refund,
        reference_type="sales_record",
        reference_id=original.id,
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

    # Only active products are sellable. Draft items are still being onboarded
    # (invisible on the inventory page); archived items are out of catalog.
    if variant.product and variant.product.status != ProductStatus.active:
        raise HTTPException(
            status_code=400,
            detail="この商品はまだ販売可能ではありません（商品ステータスが「公開中」ではありません）",
        )

    if body.quantity > variant.on_hand:
        raise HTTPException(
            status_code=400,
            detail=(
                f"在庫が不足しています（残り {variant.on_hand}個）"
                if variant.on_hand > 0
                else "在庫切れのため販売できません"
            ),
        )

    sold_at = body.sold_at or datetime.now(timezone.utc)
    transaction_id = await _next_transaction_id(db, store_id, sold_at)

    sale = SalesRecord(
        store_id=store_id,
        branch_id=body.branch_id,
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

    # Decrement on_hand
    variant.on_hand -= body.quantity

    # Log inventory adjustment
    adj = InventoryAdjustment(
        store_id=store_id,
        variant_id=body.variant_id,
        field=InventoryField.on_hand,
        delta=-body.quantity,
        reason=AdjustmentReason.sale,
        reference_type="sales_record",
        reference_id=sale.id,
    )
    db.add(adj)
    await db.commit()
    await db.refresh(sale)
    return sale
