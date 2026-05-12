from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query
from sqlalchemy import func, select

from app.deps import DB, StoreId
from app.models.inventory import InventoryAdjustment
from app.models.product import ProductVariant
from app.schemas.base import PaginatedResponse
from app.schemas.inventory import InventoryAdjustmentRead, InventoryAdjustRequest

router = APIRouter(tags=["inventory"])


@router.post("/variants/{variant_id}/inventory-adjust", response_model=InventoryAdjustmentRead, status_code=201)
async def adjust_inventory(variant_id: int, body: InventoryAdjustRequest, db: DB, store_id: StoreId):
    """Atomically adjust a variant's inventory counter and log the adjustment."""
    variant = (
        await db.execute(
            select(ProductVariant).where(
                ProductVariant.id == variant_id, ProductVariant.store_id == store_id
            )
        )
    ).scalar_one_or_none()
    if not variant:
        raise HTTPException(404, detail="Variant not found")

    # Update counter
    current = getattr(variant, body.field.value)
    setattr(variant, body.field.value, current + body.delta)

    # Log adjustment
    adj = InventoryAdjustment(
        store_id=store_id,
        variant_id=variant_id,
        field=body.field,
        delta=body.delta,
        reason=body.reason,
        note=body.note,
    )
    db.add(adj)
    await db.commit()
    await db.refresh(adj)
    return adj


@router.get("/variants/{variant_id}/inventory-history", response_model=PaginatedResponse[InventoryAdjustmentRead])
async def inventory_history(
    variant_id: int,
    db: DB,
    store_id: StoreId,
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
):
    stmt = select(InventoryAdjustment).where(
        InventoryAdjustment.variant_id == variant_id,
        InventoryAdjustment.store_id == store_id,
    )
    total = (await db.execute(select(func.count()).select_from(stmt.subquery()))).scalar_one()
    rows = (
        await db.execute(stmt.order_by(InventoryAdjustment.created_at.desc()).offset(offset).limit(limit))
    ).scalars().all()
    return PaginatedResponse(items=rows, total=total)
