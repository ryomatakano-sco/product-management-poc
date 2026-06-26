"""Purchase order CRUD with full lifecycle: draft → ordered → received/cancelled."""

from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal

from fastapi import APIRouter, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.orm import selectinload

from app.deps import DB, StoreId
from app.models.inventory import AdjustmentReason, InventoryAdjustment, InventoryField
from app.models.product import ProductVariant
from app.models.purchase_order import POStatus, PurchaseOrder, PurchaseOrderItem, PurchaseOrderTag
from app.models.tag import Tag
from sqlalchemy import insert as sa_insert
from app.schemas.base import PaginatedResponse
from app.schemas.purchase_order import (
    POItemRead,
    PurchaseOrderCreate,
    PurchaseOrderRead,
    PurchaseOrderReceive,
    PurchaseOrderUpdate,
)

router = APIRouter(prefix="/purchase-orders", tags=["purchase-orders"])


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
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    status: POStatus | None = Query(None),
    supplier_vendor_id: int | None = Query(None),
    destination_branch_id: int | None = Query(None),
    q: str | None = Query(None, description="Search by PO number, reference, tracking, or note"),
):
    stmt = select(PurchaseOrder).where(PurchaseOrder.store_id == store_id).options(*_po_load_options())
    if status:
        stmt = stmt.where(PurchaseOrder.status == status)
    if supplier_vendor_id:
        stmt = stmt.where(PurchaseOrder.supplier_vendor_id == supplier_vendor_id)
    if destination_branch_id:
        stmt = stmt.where(PurchaseOrder.destination_branch_id == destination_branch_id)
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


@router.get("/{po_id}", response_model=PurchaseOrderRead)
async def get_purchase_order(po_id: int, db: DB, store_id: StoreId):
    return _po_to_read(await _get_po(po_id, store_id, db))


@router.post("", response_model=PurchaseOrderRead, status_code=201)
async def create_purchase_order(body: PurchaseOrderCreate, db: DB, store_id: StoreId):
    po = PurchaseOrder(
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
    po.status = POStatus.ordered
    po.ordered_at = datetime.now(timezone.utc)
    await db.commit()
    return _po_to_read(await _get_po(po.id, store_id, db))


@router.post("/{po_id}/receive", response_model=PurchaseOrderRead)
async def receive_purchase_order(po_id: int, body: PurchaseOrderReceive, db: DB, store_id: StoreId):
    """Receive items on a PO: updates quantity_received, bumps on_hand inventory."""
    po = await _get_po(po_id, store_id, db)
    if po.status not in (POStatus.ordered, POStatus.partially_received):
        raise HTTPException(400, detail=f"Cannot receive on a {po.status.value} purchase order")

    item_map = {i.id: i for i in po.items}
    for recv in body.items:
        item = item_map.get(recv.item_id)
        if not item:
            raise HTTPException(400, detail=f"Item {recv.item_id} not found on this PO")
        if item.quantity_received + recv.quantity_received > item.quantity_ordered:
            raise HTTPException(
                400,
                detail=f"Item {recv.item_id}: receiving {recv.quantity_received} would exceed ordered quantity",
            )

        item.quantity_received += recv.quantity_received

        # Bump on_hand on the variant
        variant = (
            await db.execute(
                select(ProductVariant).where(ProductVariant.id == item.variant_id)
            )
        ).scalar_one()
        variant.on_hand += recv.quantity_received

        # Log adjustment
        adj = InventoryAdjustment(
            store_id=store_id,
            variant_id=item.variant_id,
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

    await db.commit()
    return _po_to_read(await _get_po(po.id, store_id, db))


@router.post("/{po_id}/cancel", response_model=PurchaseOrderRead)
async def cancel_purchase_order(po_id: int, db: DB, store_id: StoreId):
    po = await _get_po(po_id, store_id, db)
    if po.status == POStatus.received:
        raise HTTPException(400, detail="Cannot cancel a fully received purchase order")
    if po.status == POStatus.cancelled:
        raise HTTPException(400, detail="Purchase order is already cancelled")
    po.status = POStatus.cancelled
    await db.commit()
    return _po_to_read(await _get_po(po.id, store_id, db))
