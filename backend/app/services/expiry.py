"""Effective expiry — single source of truth for 期限間近 logic.

`products.expiry_date` is a manually-typed field, while receiving captures
real per-lot expiries (migration 014). The two never synced, so expiry alerts
could be stale the moment a new lot arrived (warehouse review 2026-07-15).

Rule: a product's effective expiry = the EARLIEST expiry among its ACTIVE
lots (qty_on_hand > 0), falling back to the manual product.expiry_date for
items without lot data. Every alert/KPI/list should use these helpers rather
than reading Product.expiry_date directly.
"""

from __future__ import annotations

from datetime import date

from sqlalchemy import func, select

from app.models.lot import ProductLot
from app.models.product import Product, ProductVariant


def effective_expiry_expr():
    """Correlated SQL expression usable in WHERE/SELECT against Product.
    Lots key on variant_id, so the subquery joins through product_variants."""
    lot_min = (
        select(func.min(ProductLot.expiry_date))
        .join(ProductVariant, ProductVariant.id == ProductLot.variant_id)
        .where(
            ProductVariant.product_id == Product.id,
            ProductLot.qty_on_hand > 0,
            ProductLot.expiry_date.is_not(None),
        )
        .correlate(Product)
        .scalar_subquery()
    )
    return func.coalesce(lot_min, Product.expiry_date)


async def effective_expiry_map(db, store_id: int) -> dict[int, date]:
    """{product_id: earliest active-lot expiry} for one store — merge with
    product.expiry_date via `map.get(p.id) or p.expiry_date`."""
    rows = (await db.execute(
        select(ProductVariant.product_id, func.min(ProductLot.expiry_date))
        .join(ProductVariant, ProductVariant.id == ProductLot.variant_id)
        .where(
            ProductLot.store_id == store_id,
            ProductLot.qty_on_hand > 0,
            ProductLot.expiry_date.is_not(None),
        )
        .group_by(ProductVariant.product_id)
    )).all()
    return {pid: d for pid, d in rows}
