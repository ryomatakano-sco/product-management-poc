from __future__ import annotations

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.orm import selectinload

from app.deps import DB, StoreId
from app.models.inventory import AdjustmentReason, InventoryAdjustment, InventoryField
from app.models.product import Product, ProductVariant
from app.models.sale import PaymentMethod, SalesRecord
from app.schemas.sale import SaleCreate, SaleListResponse, SaleRead, SalesSummary

router = APIRouter(prefix="/sales", tags=["sales"])


@router.get("", response_model=SaleListResponse)
async def list_sales(
    db: DB,
    store_id: StoreId,
    branch_id: int | None = None,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    payment_method: PaymentMethod | None = None,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
):
    """List sales records (newest first) with denormalized product name + sku."""
    base = select(SalesRecord).where(SalesRecord.store_id == store_id)
    if branch_id is not None:
        base = base.where(SalesRecord.branch_id == branch_id)
    if payment_method is not None:
        base = base.where(SalesRecord.payment_method == payment_method)
    if date_from is not None:
        base = base.where(SalesRecord.sold_at >= date_from)
    if date_to is not None:
        base = base.where(SalesRecord.sold_at <= date_to)

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
    """Today / month transaction counts and revenue (JST day boundaries).

    Boundaries are computed in JST so sales recorded early morning JST
    (which fall into the previous UTC day) still count toward today's KPIs.
    The DB stores sold_at as a tz-aware UTC timestamp; SQLAlchemy converts
    the JST cutoff back to UTC at query time, so the comparison is correct.
    """
    now_jst = datetime.now(JST)
    today_start = now_jst.replace(hour=0, minute=0, second=0, microsecond=0)
    tomorrow_start = today_start + timedelta(days=1)
    month_start = today_start.replace(day=1)

    revenue_expr = func.coalesce(
        func.sum(SalesRecord.quantity * SalesRecord.unit_price), 0
    )
    count_expr = func.count(SalesRecord.id)

    base = select(count_expr, revenue_expr).where(SalesRecord.store_id == store_id)

    today_count, today_revenue = (
        await db.execute(
            base.where(SalesRecord.sold_at >= today_start, SalesRecord.sold_at < tomorrow_start)
        )
    ).one()
    month_count, month_revenue = (
        await db.execute(base.where(SalesRecord.sold_at >= month_start))
    ).one()

    return SalesSummary(
        today_count=today_count or 0,
        today_revenue=str(today_revenue or 0),
        month_count=month_count or 0,
        month_revenue=str(month_revenue or 0),
    )


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
        payment_method=body.payment_method,
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
