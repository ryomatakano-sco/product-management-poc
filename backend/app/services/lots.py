"""FEFO lot movements (heavy-tier item 4).

Lots track WHICH stock sits on the shelf; variant_branch_stock stays the stock
source of truth. All functions here are best-effort companions to a stock
mutation and never raise — a lot-tracking hiccup must not break a sale.

Rules:
  • receive_into_lot(): merge into an existing (variant, branch, lot_number)
    row or create one. Called by PO receive when the user typed a lot number
    (or an expiry — an auto lot number is generated then).
  • consume_fefo(): decrement lots earliest-expiry-first (NULL expiry LAST),
    at the given branch, up to `qty`. Under-coverage (unlotted stock) is fine —
    whatever remains simply isn't lot-tracked.
  • restock_newest(): refunds add back to the newest still-known lot at the
    branch (best guess without per-sale lot linkage — documented PoC choice).
"""

from __future__ import annotations

import logging

from sqlalchemy import select

from app.models.lot import ProductLot

log = logging.getLogger("plx.lots")


async def receive_into_lot(
    db, *, store_id: int, variant_id: int, branch_id: int, qty: int,
    lot_number: str | None, expiry_date, po_id: int | None = None,
) -> None:
    try:
        if qty <= 0 or (not lot_number and expiry_date is None):
            return  # nothing to track
        if not lot_number:
            from datetime import datetime
            lot_number = f"LOT-{datetime.now().strftime('%Y%m%d')}-PO{po_id or 0}"
        existing = (await db.execute(
            select(ProductLot).where(
                ProductLot.store_id == store_id,
                ProductLot.variant_id == variant_id,
                ProductLot.branch_id == branch_id,
                ProductLot.lot_number == lot_number,
            )
        )).scalar_one_or_none()
        if existing is not None:
            existing.qty_on_hand += qty
            if expiry_date is not None:
                existing.expiry_date = expiry_date
        else:
            db.add(ProductLot(
                store_id=store_id, variant_id=variant_id, branch_id=branch_id,
                lot_number=lot_number.strip(), expiry_date=expiry_date,
                qty_on_hand=qty, po_id=po_id,
            ))
    except Exception as e:  # noqa: BLE001
        log.warning("receive_into_lot suppressed: %s", e)


async def consume_fefo(db, *, store_id: int, variant_id: int, branch_id: int, qty: int) -> None:
    try:
        if qty <= 0:
            return
        lots = (await db.execute(
            select(ProductLot).where(
                ProductLot.store_id == store_id,
                ProductLot.variant_id == variant_id,
                ProductLot.branch_id == branch_id,
                ProductLot.qty_on_hand > 0,
            ).order_by(ProductLot.expiry_date.is_(None), ProductLot.expiry_date, ProductLot.id)
        )).scalars().all()
        remaining = qty
        for lot in lots:
            if remaining <= 0:
                break
            take = min(lot.qty_on_hand, remaining)
            lot.qty_on_hand -= take
            remaining -= take
        # remaining > 0 → the rest was unlotted stock; nothing to do.
    except Exception as e:  # noqa: BLE001
        log.warning("consume_fefo suppressed: %s", e)


async def restock_newest(db, *, store_id: int, variant_id: int, branch_id: int, qty: int) -> None:
    try:
        if qty <= 0:
            return
        lot = (await db.execute(
            select(ProductLot).where(
                ProductLot.store_id == store_id,
                ProductLot.variant_id == variant_id,
                ProductLot.branch_id == branch_id,
            ).order_by(ProductLot.received_at.desc(), ProductLot.id.desc()).limit(1)
        )).scalar_one_or_none()
        if lot is not None:
            lot.qty_on_hand += qty
        # No lots known → the refunded stock stays unlotted (consistent).
    except Exception as e:  # noqa: BLE001
        log.warning("restock_newest suppressed: %s", e)
