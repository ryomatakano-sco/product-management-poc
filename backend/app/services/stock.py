"""Single choke point for stock mutations (per-branch, atomic).

Every write path (sale, refund, manual adjust, PO receive) calls
``apply_stock_delta`` instead of mutating counters directly. It:

  1. Validates the branch belongs to the store (fixes audit M2/M3-style
     cross-tenant writes at the stock layer).
  2. Upserts the (variant, branch) row in ``variant_branch_stock``.
  3. Applies the delta ATOMICALLY with a non-negative guard in SQL
     (``UPDATE ... SET x = x + :d WHERE x + :d >= 0`` + rowcount check) —
     fixing the audit's C3 read-modify-write oversell race.
  4. Applies the same delta to the variant's denormalized store-wide total
     with the same guard, so totals and branch rows never diverge.

Callers run this inside their own transaction and commit afterwards; on a
StockError they should surface a 400 to the client (nothing was committed).
"""

from __future__ import annotations

from sqlalchemy import select, text

from app.models.branch import Branch
from app.models.inventory import InventoryField, VariantBranchStock
from app.models.product import ProductVariant

_FIELDS = {f.value for f in InventoryField}


class StockError(Exception):
    """Raised when a delta cannot be applied (insufficient stock, bad branch)."""

    def __init__(self, message: str):
        self.message = message
        super().__init__(message)


async def resolve_branch_id(db, store_id: int, branch_id: int | None) -> int:
    """Return a validated branch id for the store.

    None → the store's main branch (lowest-id 'main', else lowest-id branch).
    Given id → verified to belong to the store, else StockError.
    """
    if branch_id is not None:
        ok = (await db.execute(
            select(Branch.id).where(Branch.id == branch_id, Branch.store_id == store_id)
        )).scalar_one_or_none()
        if ok is None:
            raise StockError("指定された拠点がこの店舗に存在しません")
        return branch_id
    main = (await db.execute(
        select(Branch.id)
        .where(Branch.store_id == store_id)
        .order_by((Branch.branch_type != "main"), Branch.id)
        .limit(1)
    )).scalar_one_or_none()
    if main is None:
        raise StockError("店舗に拠点が登録されていません")
    return main


async def apply_stock_delta(
    db,
    *,
    store_id: int,
    variant_id: int,
    branch_id: int | None,
    field: InventoryField,
    delta: int,
) -> int:
    """Apply ``delta`` to one counter at one branch + the variant total.

    Returns the resolved branch_id (for audit rows). Raises StockError when
    the branch is invalid or the result would go negative at either level.
    Does NOT commit — the caller owns the transaction.
    """
    fname = field.value if hasattr(field, "value") else str(field)
    if fname not in _FIELDS:
        raise StockError(f"不正な在庫フィールドです: {fname}")

    resolved_branch = await resolve_branch_id(db, store_id, branch_id)

    # Ensure the (variant, branch) row exists. INSERT IGNORE keeps this safe
    # under concurrency (unique constraint absorbs the race).
    await db.execute(text(
        "INSERT IGNORE INTO variant_branch_stock (store_id, variant_id, branch_id) "
        "VALUES (:s, :v, :b)"
    ), {"s": store_id, "v": variant_id, "b": resolved_branch})

    if delta == 0:
        return resolved_branch

    # Branch-level atomic update with non-negative guard.
    res = await db.execute(text(
        f"UPDATE variant_branch_stock SET {fname} = {fname} + :d "
        f"WHERE store_id = :s AND variant_id = :v AND branch_id = :b AND {fname} + :d >= 0"
    ), {"d": delta, "s": store_id, "v": variant_id, "b": resolved_branch})
    if res.rowcount != 1:
        cur = (await db.execute(
            select(getattr(VariantBranchStock, fname)).where(
                VariantBranchStock.store_id == store_id,
                VariantBranchStock.variant_id == variant_id,
                VariantBranchStock.branch_id == resolved_branch,
            )
        )).scalar_one_or_none() or 0
        raise StockError(f"この拠点の在庫が不足しています（現在: {cur}, 調整量: {delta:+d}）")

    # Store-wide denormalized total, same atomic guard.
    res = await db.execute(text(
        f"UPDATE product_variants SET {fname} = {fname} + :d "
        f"WHERE id = :v AND store_id = :s AND {fname} + :d >= 0"
    ), {"d": delta, "v": variant_id, "s": store_id})
    if res.rowcount != 1:
        # Should be unreachable when branch rows and totals are in sync;
        # raising (→ rollback) keeps them consistent if they ever drift.
        raise StockError("在庫の更新に失敗しました（合計在庫が不足）")

    # Cross-field invariant (audit M6): moves on committed/unavailable must
    # not push the branch's AVAILABLE (= on_hand - committed - unavailable)
    # negative — a per-field non-negative guard alone can't catch that.
    if fname != "on_hand":
        avail = (await db.execute(
            select(
                VariantBranchStock.on_hand
                - VariantBranchStock.committed
                - VariantBranchStock.unavailable
            ).where(
                VariantBranchStock.store_id == store_id,
                VariantBranchStock.variant_id == variant_id,
                VariantBranchStock.branch_id == resolved_branch,
            )
        )).scalar_one_or_none()
        if avail is not None and avail < 0:
            raise StockError(
                f"この調整で利用可能在庫がマイナスになります（利用可能: {avail}）"
            )

    return resolved_branch
