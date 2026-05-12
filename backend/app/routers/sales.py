from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException
from sqlalchemy import select

from app.deps import DB, StoreId
from app.models.inventory import AdjustmentReason, InventoryAdjustment, InventoryField
from app.models.product import ProductVariant
from app.models.sale import SalesRecord
from app.schemas.sale import SaleCreate, SaleRead

router = APIRouter(prefix="/sales", tags=["sales"])


@router.post("", response_model=SaleRead, status_code=201)
async def create_sale(body: SaleCreate, db: DB, store_id: StoreId):
    """Record a sale and decrement on_hand inventory."""
    variant = (
        await db.execute(
            select(ProductVariant).where(
                ProductVariant.id == body.variant_id, ProductVariant.store_id == store_id
            )
        )
    ).scalar_one_or_none()
    if not variant:
        raise HTTPException(404, detail="Variant not found")

    sold_at = body.sold_at or datetime.now(timezone.utc)

    sale = SalesRecord(
        store_id=store_id,
        branch_id=body.branch_id,
        variant_id=body.variant_id,
        quantity=body.quantity,
        unit_price=body.unit_price,
        sold_at=sold_at,
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
