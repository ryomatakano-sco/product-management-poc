"""Shared dashboard/notification aggregation queries (review C1).

These counts appear in three places — the dashboard KPIs, the daily-summary
notification tick, and (indirectly) the low-stock auto-draft flow. One
definition here keeps them agreeing; they diverged once before (a hardcoded
threshold of 10 vs per-variant thresholds).
"""

from __future__ import annotations

from datetime import date, timedelta

from sqlalchemy import func, select

from app.models.product import ItemType, Product, ProductStatus, ProductVariant


async def count_low_stock_products(db, store_id: int) -> int:
    """Active products with ANY variant at/below its own low-stock threshold
    (available = on_hand − committed − unavailable; threshold COALESCEs to 10)."""
    return (await db.execute(
        select(func.count(func.distinct(Product.id)))
        .join(ProductVariant, ProductVariant.product_id == Product.id)
        .where(
            Product.store_id == store_id,
            Product.status == ProductStatus.active,
            (ProductVariant.on_hand - ProductVariant.committed - ProductVariant.unavailable)
                <= func.coalesce(ProductVariant.low_stock_threshold, 10),
        )
    )).scalar_one()


async def count_expiring_consumables(db, store_id: int, today: date, days: int = 30) -> int:
    """Consumables whose effective expiry (earliest active lot, falling back
    to the manual field — services/expiry.py) is within ``days`` from today."""
    from app.services.expiry import effective_expiry_expr

    eff = effective_expiry_expr()
    return (await db.execute(
        select(func.count(Product.id)).where(
            Product.store_id == store_id,
            Product.item_type == ItemType.consumable,
            eff.is_not(None),
            eff <= (today + timedelta(days=days)),
            eff >= today,
        )
    )).scalar_one()
