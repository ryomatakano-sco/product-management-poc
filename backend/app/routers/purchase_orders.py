"""Purchase order CRUD with full lifecycle: draft → ordered → received/cancelled."""

from __future__ import annotations

import csv
import io
from datetime import datetime, timedelta, timezone
from decimal import Decimal

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import func, select
from sqlalchemy.orm import selectinload

from app.deps import DB, StoreId, CurrentUserName
from app.models.inventory import AdjustmentReason, InventoryAdjustment, InventoryField
from app.models.product import Product, ProductStatus, ProductVariant
from app.models.purchase_order import POComment, POStatus, PurchaseOrder, PurchaseOrderItem, PurchaseOrderTag
from app.models.tag import Tag
from sqlalchemy import insert as sa_insert
from app.services.lots import receive_into_lot
from app.services.notifier import notify
from app.services.stock import StockError, apply_stock_delta
from app.schemas.base import PaginatedResponse
from app.schemas.purchase_order import (
    POItemRead,
    PurchaseOrderCreate,
    PurchaseOrderRead,
    PurchaseOrderReceive,
    PurchaseOrderUpdate,
)

router = APIRouter(prefix="/purchase-orders", tags=["purchase-orders"])

_JST = timezone(timedelta(hours=9))


def _to_naive_jst(dt: datetime) -> datetime:
    """PO created_at values come from MySQL NOW() — naive JST on the dev box.
    Convert an (aware) query datetime into that space; pass naive through.
    """
    if dt.tzinfo is None:
        return dt
    return dt.astimezone(_JST).replace(tzinfo=None)


def _item_to_read(item: PurchaseOrderItem) -> POItemRead:
    variant = item.variant
    product = variant.product if variant else None
    return POItemRead(
        id=item.id,
        purchase_order_id=item.purchase_order_id,
        store_id=item.store_id,
        variant_id=item.variant_id,
        quantity_ordered=item.quantity_ordered,
        quantity_received=item.quantity_received,
        unit_cost=item.unit_cost,
        line_total=item.line_total,
        product_name=product.name if product else None,
        sku=variant.sku if variant else None,
    )


def _po_to_read(po: PurchaseOrder) -> PurchaseOrderRead:
    return PurchaseOrderRead(
        id=po.id,
        store_id=po.store_id,
        supplier_vendor_id=po.supplier_vendor_id,
        destination_branch_id=po.destination_branch_id,
        status=po.status,
        payment_terms=po.payment_terms,
        estimated_arrival=po.estimated_arrival,
        shipping_carrier=po.shipping_carrier,
        tracking_number=po.tracking_number,
        reference_number=po.reference_number,
        note=po.note,
        subtotal=po.subtotal,
        shipping_cost=po.shipping_cost,
        total=po.total,
        ordered_at=po.ordered_at,
        received_at=po.received_at,
        items=[_item_to_read(i) for i in po.items],
        tags=[t.name for t in po.tags],
        supplier_name=po.supplier.company_name if po.supplier else None,
        branch_name=po.destination_branch.name if po.destination_branch else None,
        created_by=po.created_by,
        created_at=po.created_at,
        updated_at=po.updated_at,
    )


def _po_load_options():
    return [
        selectinload(PurchaseOrder.items)
            .selectinload(PurchaseOrderItem.variant)
            .selectinload(ProductVariant.product),
        selectinload(PurchaseOrder.tags),
        selectinload(PurchaseOrder.supplier),
        selectinload(PurchaseOrder.destination_branch),
    ]


async def _get_po(po_id: int, store_id: int, db) -> PurchaseOrder:
    po = (
        await db.execute(
            select(PurchaseOrder)
            .where(PurchaseOrder.id == po_id, PurchaseOrder.store_id == store_id)
            .options(*_po_load_options())
        )
    ).scalar_one_or_none()
    if not po:
        raise HTTPException(404, detail="Purchase order not found")
    return po


def _compute_totals(items: list[PurchaseOrderItem], shipping_cost: Decimal) -> tuple[Decimal, Decimal]:
    subtotal = sum((i.line_total for i in items), Decimal("0"))
    return subtotal, subtotal + shipping_cost


@router.get("", response_model=PaginatedResponse[PurchaseOrderRead])
async def list_purchase_orders(
    db: DB,
    store_id: StoreId,
    limit: int = Query(20, ge=1, le=500),
    offset: int = Query(0, ge=0),
    status: POStatus | None = Query(None),
    supplier_vendor_id: int | None = Query(None),
    destination_branch_id: int | None = Query(None),
    date_from: datetime | None = Query(None, description="created_at >= (aware datetimes compared in JST)"),
    date_to: datetime | None = Query(None, description="created_at < (aware datetimes compared in JST)"),
    q: str | None = Query(None, description="Search by PO number, reference, tracking, or note"),
):
    stmt = select(PurchaseOrder).where(PurchaseOrder.store_id == store_id).options(*_po_load_options())
    if status:
        stmt = stmt.where(PurchaseOrder.status == status)
    if supplier_vendor_id:
        stmt = stmt.where(PurchaseOrder.supplier_vendor_id == supplier_vendor_id)
    if destination_branch_id:
        stmt = stmt.where(PurchaseOrder.destination_branch_id == destination_branch_id)
    if date_from is not None:
        stmt = stmt.where(PurchaseOrder.created_at >= _to_naive_jst(date_from))
    if date_to is not None:
        stmt = stmt.where(PurchaseOrder.created_at < _to_naive_jst(date_to))
    if q and q.strip():
        like = f"%{q.strip()}%"
        from sqlalchemy import or_ as _or
        # The PO model historically used `po_number` as a short identifier;
        # fall back to the integer id for older PoC data without a po_number.
        clauses = []
        if hasattr(PurchaseOrder, "po_number"):
            clauses.append(PurchaseOrder.po_number.ilike(like))
        if hasattr(PurchaseOrder, "reference_number"):
            clauses.append(PurchaseOrder.reference_number.ilike(like))
        if hasattr(PurchaseOrder, "tracking_number"):
            clauses.append(PurchaseOrder.tracking_number.ilike(like))
        if hasattr(PurchaseOrder, "note"):
            clauses.append(PurchaseOrder.note.ilike(like))
        if clauses:
            stmt = stmt.where(_or(*clauses))
    total = (await db.execute(select(func.count()).select_from(stmt.subquery()))).scalar_one()
    rows = (await db.execute(stmt.order_by(PurchaseOrder.id.desc()).offset(offset).limit(limit))).scalars().unique().all()
    return PaginatedResponse(items=[_po_to_read(po) for po in rows], total=total)


# NOTE: declared before /{po_id} — "auto-draft" must not be parsed as a po_id.
@router.post("/auto-draft", summary="低在庫から発注書ドラフトを自動作成")
async def auto_draft_purchase_orders(db: DB, store_id: StoreId, user_name: CurrentUserName = None):
    """One draft PO per vendor covering every active product whose default
    variant sits at/below its low-stock threshold, has a vendor, and is not
    already on an open (draft/ordered/partially_received) PO.

    Quantity heuristic (documented): threshold*2 − available, min 1.
    unit_cost = the variant's cost (0 when unset — editable on the draft).
    """
    variants = (await db.execute(
        select(ProductVariant)
        .join(Product, Product.id == ProductVariant.product_id)
        .where(
            ProductVariant.store_id == store_id,
            ProductVariant.is_default.is_(True),
            Product.status == ProductStatus.active,
            Product.vendor_id.is_not(None),
        )
        .options(selectinload(ProductVariant.product))
    )).scalars().all()

    # Variants already covered by an open PO.
    open_variant_ids = set((await db.execute(
        select(PurchaseOrderItem.variant_id)
        .join(PurchaseOrder, PurchaseOrder.id == PurchaseOrderItem.purchase_order_id)
        .where(
            PurchaseOrder.store_id == store_id,
            PurchaseOrder.status.in_([POStatus.draft, POStatus.ordered, POStatus.partially_received]),
        )
    )).scalars().all())

    from collections import defaultdict
    by_vendor: dict[int, list] = defaultdict(list)
    for v in variants:
        threshold = v.low_stock_threshold if v.low_stock_threshold is not None else 10
        available = (v.on_hand or 0) - (v.committed or 0) - (v.unavailable or 0)
        if available > threshold or v.id in open_variant_ids:
            continue
        qty = max(1, threshold * 2 - available)
        by_vendor[v.product.vendor_id].append((v, qty))

    if not by_vendor:
        return {"created": [], "message": "自動作成の対象がありません（低在庫かつ未発注の商品なし）"}

    # Destination = the store's main branch.
    from app.models.branch import Branch
    main_branch = (await db.execute(
        select(Branch.id).where(Branch.store_id == store_id)
        .order_by((Branch.branch_type != "main"), Branch.id).limit(1)
    )).scalar_one_or_none()
    if main_branch is None:
        raise HTTPException(400, detail="拠点が登録されていません")

    created = []
    for vendor_id, lines in by_vendor.items():
        po = PurchaseOrder(
        created_by=user_name,
            store_id=store_id,
            supplier_vendor_id=vendor_id,
            destination_branch_id=main_branch,
            status=POStatus.draft,
            note="低在庫からの自動作成ドラフト",
            shipping_cost=Decimal("0"),
            subtotal=Decimal("0"),
            total=Decimal("0"),
        )
        db.add(po)
        await db.flush()
        items = []
        for v, qty in lines:
            cost = v.cost if v.cost is not None else Decimal("0")
            item = PurchaseOrderItem(
                purchase_order_id=po.id, store_id=store_id, variant_id=v.id,
                quantity_ordered=qty, unit_cost=cost, line_total=cost * qty,
            )
            db.add(item)
            items.append(item)
        po.subtotal, po.total = _compute_totals(items, po.shipping_cost)
        created.append(po.id)

    await db.commit()
    return {"created": created}


# NOTE: declared before /{po_id} — "summary" must not be parsed as a po_id.
@router.get("/summary", summary="発注KPIサマリー（今月/先月 + 現在の入荷待ち）")
async def purchase_orders_summary(db: DB, store_id: StoreId):
    """Month vs last-month PO count/amount (JST calendar months on created_at,
    cancelled excluded) plus current pipeline counts — powers the list page's
    KPI tiles and their 先月比 delta chips.
    """
    jst = timezone(timedelta(hours=9))
    now_jst = datetime.now(jst)
    month_start = now_jst.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    last_month_start = (month_start - timedelta(days=1)).replace(day=1)
    # created_at comes from MySQL NOW() (server-local = JST on the dev box),
    # so compare against naive JST boundaries — NOT UTC-converted ones.
    m_utc  = month_start.replace(tzinfo=None)
    lm_utc = last_month_start.replace(tzinfo=None)

    base = select(
        func.count(PurchaseOrder.id),
        func.coalesce(func.sum(PurchaseOrder.total), 0),
    ).where(
        PurchaseOrder.store_id == store_id,
        PurchaseOrder.status != POStatus.cancelled,
    )

    month_count, month_total = (await db.execute(
        base.where(PurchaseOrder.created_at >= m_utc)
    )).one()
    last_month_count, last_month_total = (await db.execute(
        base.where(PurchaseOrder.created_at >= lm_utc, PurchaseOrder.created_at < m_utc)
    )).one()

    status_rows = (await db.execute(
        select(PurchaseOrder.status, func.count(PurchaseOrder.id))
        .where(PurchaseOrder.store_id == store_id)
        .group_by(PurchaseOrder.status)
    )).all()
    by_status = {s.value if hasattr(s, "value") else str(s): c for s, c in status_rows}

    return {
        "month_count": month_count or 0,
        "month_total": str(month_total or 0),
        "last_month_count": last_month_count or 0,
        "last_month_total": str(last_month_total or 0),
        "ordered_count": by_status.get("ordered", 0),
        "partially_received_count": by_status.get("partially_received", 0),
    }


# NOTE: declared before /{po_id} — "export.csv" must not be parsed as a po_id.
@router.get("/export.csv")
async def export_purchase_orders_csv(
    db: DB,
    store_id: StoreId,
    status: POStatus | None = Query(None),
    supplier_vendor_id: int | None = Query(None),
    destination_branch_id: int | None = Query(None),
    date_from: datetime | None = Query(None),
    date_to: datetime | None = Query(None),
    q: str | None = Query(None),
):
    """CSV of the same rows the list endpoint returns, minus pagination."""
    STATUS_JA = {
        POStatus.draft: "下書き",
        POStatus.ordered: "送信済み",
        POStatus.partially_received: "一部入荷",
        POStatus.received: "入荷済み",
        POStatus.cancelled: "キャンセル",
    }
    stmt = select(PurchaseOrder).where(PurchaseOrder.store_id == store_id).options(*_po_load_options())
    if status:
        stmt = stmt.where(PurchaseOrder.status == status)
    if supplier_vendor_id:
        stmt = stmt.where(PurchaseOrder.supplier_vendor_id == supplier_vendor_id)
    if destination_branch_id:
        stmt = stmt.where(PurchaseOrder.destination_branch_id == destination_branch_id)
    if date_from is not None:
        stmt = stmt.where(PurchaseOrder.created_at >= _to_naive_jst(date_from))
    if date_to is not None:
        stmt = stmt.where(PurchaseOrder.created_at < _to_naive_jst(date_to))
    if q and q.strip():
        like = f"%{q.strip()}%"
        from sqlalchemy import or_ as _or
        clauses = []
        for attr in ("po_number", "reference_number", "tracking_number", "note"):
            if hasattr(PurchaseOrder, attr):
                clauses.append(getattr(PurchaseOrder, attr).ilike(like))
        if clauses:
            stmt = stmt.where(_or(*clauses))
    rows = (await db.execute(stmt.order_by(PurchaseOrder.id.desc()))).scalars().unique().all()

    buf = io.StringIO()
    buf.write("﻿")  # UTF-8 BOM so Excel opens Japanese correctly
    writer = csv.writer(buf)
    writer.writerow([
        "発注番号", "仕入先", "拠点", "状態", "発注日", "納品予定日",
        "品目数", "小計", "送料", "合計 (税込)", "備考",
    ])
    for po in rows:
        writer.writerow([
            f"PO-{po.id:06d}",
            po.supplier.company_name if po.supplier else "",
            po.destination_branch.name if po.destination_branch else "",
            STATUS_JA.get(po.status, str(po.status)),
            po.ordered_at.strftime("%Y/%m/%d") if po.ordered_at else po.created_at.strftime("%Y/%m/%d"),
            po.estimated_arrival.strftime("%Y/%m/%d") if po.estimated_arrival else "",
            len(po.items),
            f"{float(po.subtotal):.0f}",
            f"{float(po.shipping_cost):.0f}",
            f"{float(po.total):.0f}",
            po.note or "",
        ])

    filename = f"purchase_orders_{datetime.now(timezone(timedelta(hours=9))).strftime('%Y%m%d_%H%M')}.csv"
    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/{po_id}", response_model=PurchaseOrderRead)
async def get_purchase_order(po_id: int, db: DB, store_id: StoreId):
    return _po_to_read(await _get_po(po_id, store_id, db))


@router.post("", response_model=PurchaseOrderRead, status_code=201)
async def create_purchase_order(body: PurchaseOrderCreate, db: DB, store_id: StoreId, user_name: CurrentUserName = None):
    # Tenancy validation (audit M3): vendor, branch and every line-item
    # variant must belong to this store.
    from app.models.branch import Branch
    from app.models.vendor import Vendor
    vendor_ok = (await db.execute(
        select(Vendor.id).where(Vendor.id == body.supplier_vendor_id, Vendor.store_id == store_id)
    )).scalar_one_or_none()
    if vendor_ok is None:
        raise HTTPException(400, detail="指定された仕入先がこの店舗に存在しません")
    branch_ok = (await db.execute(
        select(Branch.id).where(Branch.id == body.destination_branch_id, Branch.store_id == store_id)
    )).scalar_one_or_none()
    if branch_ok is None:
        raise HTTPException(400, detail="指定された拠点がこの店舗に存在しません")
    if body.items:
        wanted = {i.variant_id for i in body.items}
        found = set((await db.execute(
            select(ProductVariant.id).where(
                ProductVariant.id.in_(wanted), ProductVariant.store_id == store_id
            )
        )).scalars().all())
        missing = wanted - found
        if missing:
            raise HTTPException(400, detail=f"この店舗に存在しない商品が含まれています (variant {sorted(missing)})")

    po = PurchaseOrder(
        created_by=user_name,
        store_id=store_id,
        supplier_vendor_id=body.supplier_vendor_id,
        destination_branch_id=body.destination_branch_id,
        status=body.status,
        payment_terms=body.payment_terms,
        estimated_arrival=body.estimated_arrival,
        shipping_carrier=body.shipping_carrier,
        tracking_number=body.tracking_number,
        reference_number=body.reference_number,
        note=body.note,
        shipping_cost=body.shipping_cost,
        subtotal=Decimal("0"),
        total=Decimal("0"),
    )
    db.add(po)
    await db.flush()

    items_for_total = []
    for item_data in body.items:
        line_total = item_data.unit_cost * item_data.quantity_ordered
        item = PurchaseOrderItem(
            purchase_order_id=po.id,
            store_id=store_id,
            variant_id=item_data.variant_id,
            quantity_ordered=item_data.quantity_ordered,
            unit_cost=item_data.unit_cost,
            line_total=line_total,
        )
        db.add(item)
        items_for_total.append(item)

    subtotal = sum((i.line_total for i in items_for_total), Decimal("0"))
    po.subtotal = subtotal
    po.total = subtotal + po.shipping_cost

    # Tags — use direct insert to avoid lazy load
    for tag_name in body.tags:
        tag = (
            await db.execute(select(Tag).where(Tag.store_id == store_id, Tag.name == tag_name))
        ).scalar_one_or_none()
        if not tag:
            tag = Tag(store_id=store_id, name=tag_name)
            db.add(tag)
            await db.flush()
        await db.execute(
            sa_insert(PurchaseOrderTag).values(purchase_order_id=po.id, tag_id=tag.id)
        )

    if body.status == POStatus.ordered:
        po.ordered_at = datetime.now(timezone.utc)

    await db.commit()
    return _po_to_read(await _get_po(po.id, store_id, db))


@router.patch("/{po_id}", response_model=PurchaseOrderRead)
async def update_purchase_order(po_id: int, body: PurchaseOrderUpdate, db: DB, store_id: StoreId):
    po = await _get_po(po_id, store_id, db)
    if po.status in (POStatus.received, POStatus.cancelled):
        raise HTTPException(400, detail=f"Cannot edit a {po.status.value} purchase order")

    update_data = body.model_dump(exclude_unset=True)
    items_data = update_data.pop("items", None)
    tags_data = update_data.pop("tags", None)

    for key, val in update_data.items():
        setattr(po, key, val)

    if items_data is not None:
        # Preserve quantity_received from existing items by variant_id before wiping.
        received_by_variant = {it.variant_id: it.quantity_received for it in po.items}
        for old_item in list(po.items):
            await db.delete(old_item)
        await db.flush()

        new_items = []
        for item_data in body.items:
            line_total = item_data.unit_cost * item_data.quantity_ordered
            preserved_received = min(
                received_by_variant.get(item_data.variant_id, 0),
                item_data.quantity_ordered,
            )
            item = PurchaseOrderItem(
                purchase_order_id=po.id,
                store_id=store_id,
                variant_id=item_data.variant_id,
                quantity_ordered=item_data.quantity_ordered,
                quantity_received=preserved_received,
                unit_cost=item_data.unit_cost,
                line_total=line_total,
            )
            db.add(item)
            new_items.append(item)

        subtotal = sum((i.line_total for i in new_items), Decimal("0"))
        po.subtotal = subtotal
        po.total = subtotal + po.shipping_cost
    else:
        po.subtotal, po.total = _compute_totals(po.items, po.shipping_cost)

    if tags_data is not None:
        # Clear and re-add tags via direct table operations
        await db.execute(
            PurchaseOrderTag.__table__.delete().where(
                PurchaseOrderTag.purchase_order_id == po.id
            )
        )
        for tag_name in body.tags:
            tag = (
                await db.execute(select(Tag).where(Tag.store_id == store_id, Tag.name == tag_name))
            ).scalar_one_or_none()
            if not tag:
                tag = Tag(store_id=store_id, name=tag_name)
                db.add(tag)
                await db.flush()
            await db.execute(
                sa_insert(PurchaseOrderTag).values(purchase_order_id=po.id, tag_id=tag.id)
            )

    await db.commit()
    return _po_to_read(await _get_po(po.id, store_id, db))


@router.post("/{po_id}/submit", response_model=PurchaseOrderRead)
async def submit_purchase_order(po_id: int, db: DB, store_id: StoreId):
    """Transition draft → ordered."""
    po = await _get_po(po_id, store_id, db)
    if po.status != POStatus.draft:
        raise HTTPException(400, detail=f"Can only submit draft orders, current status: {po.status.value}")
    if not po.items:
        raise HTTPException(400, detail="明細のない発注書は送信できません")
    po.status = POStatus.ordered
    po.ordered_at = datetime.now(timezone.utc)
    await notify(
        db, store_id, "po_status",
        f"発注書 PO-{po.id:06d} を送信しました",
        f"仕入先: {po.supplier.company_name if po.supplier else '—'}　合計 ¥{po.total}",
        link_path=f"/purchase-orders/{po.id}",
    )
    await db.commit()
    return _po_to_read(await _get_po(po.id, store_id, db))


@router.post("/{po_id}/receive", response_model=PurchaseOrderRead)
async def receive_purchase_order(po_id: int, body: PurchaseOrderReceive, db: DB, store_id: StoreId, user_name: CurrentUserName = None):
    """Receive items on a PO: updates quantity_received, bumps on_hand inventory."""
    po = await _get_po(po_id, store_id, db)
    if po.status not in (POStatus.ordered, POStatus.partially_received):
        raise HTTPException(400, detail=f"Cannot receive on a {po.status.value} purchase order")

    item_map = {i.id: i for i in po.items}
    for recv in body.items:
        item = item_map.get(recv.item_id)
        if not item:
            raise HTTPException(400, detail=f"Item {recv.item_id} not found on this PO")
        if recv.quantity_received <= 0:
            raise HTTPException(400, detail=f"Item {recv.item_id}: 入荷数は1以上を指定してください")
        if item.quantity_received + recv.quantity_received > item.quantity_ordered:
            raise HTTPException(
                400,
                detail=f"Item {recv.item_id}: receiving {recv.quantity_received} would exceed ordered quantity",
            )

        item.quantity_received += recv.quantity_received

        # Bump on_hand at the PO's destination branch — atomic + store-scoped
        # (services/stock.py; fixes the audit's M4 cross-tenant receive).
        variant = (
            await db.execute(
                select(ProductVariant).where(
                    ProductVariant.id == item.variant_id,
                    ProductVariant.store_id == store_id,
                ).options(selectinload(ProductVariant.product))
            )
        ).scalar_one_or_none()
        if variant is None:
            raise HTTPException(400, detail=f"明細の商品がこの店舗に存在しません (variant {item.variant_id})")
        # Archived products are out of catalog — no stock movements (audit M8).
        if variant.product is not None and str(variant.product.status.value) == "archived":
            raise HTTPException(400, detail=f"アーカイブ済み商品には入荷できません: {variant.product.name}")
        try:
            recv_branch = await apply_stock_delta(
                db, store_id=store_id, variant_id=item.variant_id,
                branch_id=po.destination_branch_id, field=InventoryField.on_hand,
                delta=recv.quantity_received,
            )
        except StockError as e:
            await db.rollback()
            raise HTTPException(400, detail=e.message)

        # Per-lot capture (migration 014) — only when the receiver typed a
        # lot number or expiry for this line.
        await receive_into_lot(
            db, store_id=store_id, variant_id=item.variant_id, branch_id=recv_branch,
            qty=recv.quantity_received, lot_number=recv.lot_number,
            expiry_date=recv.expiry_date, po_id=po.id,
        )

        # The reorder is fulfilled — clear the product's 再発注済 flag so the
        # 商品一覧 chip stops surfacing it.
        product = (
            await db.execute(
                select(Product).where(
                    Product.id == variant.product_id,
                    Product.store_id == store_id,
                )
            )
        ).scalar_one_or_none()
        if product is not None and product.reorder_requested_at is not None:
            product.reorder_requested_at = None

        # Log adjustment
        adj = InventoryAdjustment(
        created_by=user_name,
            store_id=store_id,
            variant_id=item.variant_id,
            branch_id=recv_branch,
            field=InventoryField.on_hand,
            delta=recv.quantity_received,
            reason=AdjustmentReason.purchase_order_received,
            reference_type="purchase_order",
            reference_id=po.id,
        )
        db.add(adj)

    # Determine new status
    all_received = all(i.quantity_received >= i.quantity_ordered for i in po.items)
    if all_received:
        po.status = POStatus.received
        po.received_at = datetime.now(timezone.utc)
    else:
        po.status = POStatus.partially_received

    await notify(
        db, store_id, "po_status",
        f"発注書 PO-{po.id:06d} が{'入荷済み' if all_received else '一部入荷'}になりました",
        f"納品先: {po.destination_branch.name if po.destination_branch else '—'}",
        link_path=f"/purchase-orders/{po.id}",
    )
    await db.commit()
    return _po_to_read(await _get_po(po.id, store_id, db))


@router.post("/{po_id}/cancel", response_model=PurchaseOrderRead)
async def cancel_purchase_order(po_id: int, db: DB, store_id: StoreId, user_name: CurrentUserName = None):
    po = await _get_po(po_id, store_id, db)
    if po.status == POStatus.received:
        raise HTTPException(400, detail="Cannot cancel a fully received purchase order")
    if po.status == POStatus.cancelled:
        raise HTTPException(400, detail="Purchase order is already cancelled")

    # Reverse any stock already received on a partially-received PO — otherwise
    # cancelling leaves the received units in inventory with no PO backing them.
    if po.status == POStatus.partially_received:
        for item in po.items:
            if item.quantity_received > 0:
                try:
                    rev_branch = await apply_stock_delta(
                        db, store_id=store_id, variant_id=item.variant_id,
                        branch_id=po.destination_branch_id, field=InventoryField.on_hand,
                        delta=-item.quantity_received,
                    )
                except StockError as e:
                    await db.rollback()
                    raise HTTPException(
                        400,
                        detail=f"キャンセルできません（入荷済み在庫を戻せません）: {e.message}",
                    )
                db.add(InventoryAdjustment(
                    created_by=user_name,
                    store_id=store_id, variant_id=item.variant_id, branch_id=rev_branch,
                    field=InventoryField.on_hand, delta=-item.quantity_received,
                    reason=AdjustmentReason.correction,
                    reference_type="purchase_order", reference_id=po.id,
                    note=f"PO-{po.id:06d} キャンセルによる入荷戻し",
                ))
                item.quantity_received = 0

    po.status = POStatus.cancelled
    await notify(
        db, store_id, "po_status",
        f"発注書 PO-{po.id:06d} をキャンセルしました",
        None,
        link_path=f"/purchase-orders/{po.id}",
    )
    await db.commit()
    return _po_to_read(await _get_po(po.id, store_id, db))

# ── Comments (feedback batch C) ─────────────────────────────────────

@router.get("/{po_id}/comments", summary="発注書のコメント一覧")
async def list_po_comments(po_id: int, db: DB, store_id: StoreId):
    await _get_po(po_id, store_id, db)  # 404 + tenancy check
    rows = (await db.execute(
        select(POComment)
        .where(POComment.purchase_order_id == po_id, POComment.store_id == store_id)
        .order_by(POComment.created_at.asc(), POComment.id.asc())
    )).scalars().all()
    return {"items": [{
        "id": c.id,
        "author": c.author,
        "body": c.body,
        "created_at": c.created_at.isoformat() if c.created_at else None,
    } for c in rows]}


@router.post("/{po_id}/comments", status_code=201, summary="発注書にコメントを追加")
async def add_po_comment(po_id: int, body: dict, db: DB, store_id: StoreId, user_name: CurrentUserName = None):
    await _get_po(po_id, store_id, db)
    text = str(body.get("body") or "").strip()
    if not text:
        raise HTTPException(400, detail="コメントを入力してください")
    if len(text) > 1000:
        raise HTTPException(400, detail="コメントは1000文字以内で入力してください")
    c = POComment(store_id=store_id, purchase_order_id=po_id, author=user_name, body=text)
    db.add(c)
    await db.commit()
    await db.refresh(c)
    return {"id": c.id, "author": c.author, "body": c.body,
            "created_at": c.created_at.isoformat() if c.created_at else None}

