"""Branches CRUD + per-branch inventory snapshot.

The snapshot endpoint feeds the 院・店舗 card on the list page ("在庫スナップショット:
2,847 点 / ¥1,684,200") and the 在庫 tab of the detail page. It aggregates
across all variants of all active products belonging to the store; per-branch
allocation is approximated by even split (the PoC has no per-branch on_hand
column on variants — that's deferred work).
"""

from __future__ import annotations

from datetime import date, timedelta
from decimal import Decimal

from fastapi import APIRouter, HTTPException, Query
from sqlalchemy import func, select

from app.deps import DB, StoreId
from app.models.branch import Branch, BranchStatus
from app.models.inventory import InventoryAdjustment
from app.models.product import ItemType, Product, ProductStatus, ProductVariant
from app.schemas.base import PaginatedResponse
from app.schemas.branch import BranchCreate, BranchRead, BranchUpdate, InventorySnapshot

router = APIRouter(prefix="/branches", tags=["branches"])


@router.get("", response_model=PaginatedResponse[BranchRead], summary="拠点一覧を取得")
async def list_branches(
    db: DB,
    store_id: StoreId,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    status: BranchStatus | None = Query(None),
    q: str | None = Query(None, description="Search by branch name or manager name"),
):
    stmt = select(Branch).where(Branch.store_id == store_id)
    if status is not None:
        stmt = stmt.where(Branch.status == status)
    if q and q.strip():
        from sqlalchemy import or_ as _or
        like = f"%{q.strip()}%"
        clauses = [Branch.name.ilike(like)]
        if hasattr(Branch, "manager_name"):
            clauses.append(Branch.manager_name.ilike(like))
        stmt = stmt.where(_or(*clauses))
    total = (await db.execute(select(func.count()).select_from(stmt.subquery()))).scalar_one()
    rows = (await db.execute(stmt.order_by(Branch.id).offset(offset).limit(limit))).scalars().all()
    return PaginatedResponse(items=rows, total=total)


@router.post("", response_model=BranchRead, status_code=201, summary="拠点を作成")
async def create_branch(body: BranchCreate, db: DB, store_id: StoreId):
    branch = Branch(store_id=store_id, **body.model_dump())
    db.add(branch)
    await db.commit()
    await db.refresh(branch)
    return branch


@router.get("/{branch_id}", response_model=BranchRead, summary="拠点詳細を取得")
async def get_branch(branch_id: int, db: DB, store_id: StoreId):
    branch = (await db.execute(
        select(Branch).where(Branch.id == branch_id, Branch.store_id == store_id)
    )).scalar_one_or_none()
    if not branch:
        raise HTTPException(404, detail={"detail": "拠点が見つかりません", "code": "RESOURCE_NOT_FOUND"})
    return branch


@router.patch("/{branch_id}", response_model=BranchRead, summary="拠点を更新")
async def update_branch(branch_id: int, body: BranchUpdate, db: DB, store_id: StoreId):
    branch = (await db.execute(
        select(Branch).where(Branch.id == branch_id, Branch.store_id == store_id)
    )).scalar_one_or_none()
    if not branch:
        raise HTTPException(404, detail={"detail": "拠点が見つかりません", "code": "RESOURCE_NOT_FOUND"})
    for key, val in body.model_dump(exclude_unset=True).items():
        setattr(branch, key, val)
    await db.commit()
    await db.refresh(branch)
    return branch


@router.delete("/{branch_id}", status_code=204, summary="拠点を削除（在庫履歴があれば inactive 化）")
async def delete_branch(branch_id: int, db: DB, store_id: StoreId):
    branch = (await db.execute(
        select(Branch).where(Branch.id == branch_id, Branch.store_id == store_id)
    )).scalar_one_or_none()
    if not branch:
        raise HTTPException(404, detail={"detail": "拠点が見つかりません", "code": "RESOURCE_NOT_FOUND"})
    # If any adjustment references the branch we soft-delete (status=inactive)
    # rather than orphan the audit log.
    adj_count = (await db.execute(
        select(func.count(InventoryAdjustment.id)).where(
            InventoryAdjustment.store_id == store_id,
            # InventoryAdjustment doesn't yet have branch_id in our schema —
            # treating this as: any history exists at all blocks hard delete.
        )
    )).scalar_one()
    if adj_count > 0:
        branch.status = BranchStatus.inactive
        await db.commit()
        return
    await db.delete(branch)
    await db.commit()


@router.get(
    "/{branch_id}/inventory-snapshot",
    response_model=InventorySnapshot,
    summary="拠点の在庫スナップショットを取得",
)
async def branch_inventory_snapshot(branch_id: int, db: DB, store_id: StoreId):
    """Aggregate inventory KPIs scoped to this branch.

    `total_items` = sum of on_hand across all variants (store-wide; per-branch
    apportionment is future scope).
    `total_value_jpy` = sum(on_hand * price) using each variant's price.
    `low_stock_count` = variants with available <= branch.low_stock_threshold.
    `expiring_soon_count` = consumable products with expiry <= today+30d.
    """
    branch = (await db.execute(
        select(Branch).where(Branch.id == branch_id, Branch.store_id == store_id)
    )).scalar_one_or_none()
    if not branch:
        raise HTTPException(404, detail={"detail": "拠点が見つかりません", "code": "RESOURCE_NOT_FOUND"})

    threshold = branch.low_stock_threshold

    # Sum on_hand and on_hand*price across all variants of active products.
    totals_row = (await db.execute(
        select(
            func.coalesce(func.sum(ProductVariant.on_hand), 0),
            func.coalesce(
                func.sum(ProductVariant.on_hand * func.coalesce(ProductVariant.price, 0)),
                0,
            ),
        )
        .join(Product, Product.id == ProductVariant.product_id)
        .where(
            ProductVariant.store_id == store_id,
            Product.status == ProductStatus.active,
        )
    )).one()
    total_items, total_value = int(totals_row[0]), Decimal(str(totals_row[1]))

    # Low-stock count (distinct products with at least one variant below threshold).
    low_stock = (await db.execute(
        select(func.count(func.distinct(Product.id)))
        .join(ProductVariant, ProductVariant.product_id == Product.id)
        .where(
            Product.store_id == store_id,
            Product.status == ProductStatus.active,
            (ProductVariant.on_hand - ProductVariant.committed - ProductVariant.unavailable) <= threshold,
        )
    )).scalar_one()

    # Expiring-soon count (consumables, expiry within 30 days).
    today = date.today()
    in_30 = today + timedelta(days=30)
    expiring = (await db.execute(
        select(func.count(Product.id)).where(
            Product.store_id == store_id,
            Product.item_type == ItemType.consumable,
            Product.expiry_date.is_not(None),
            Product.expiry_date <= in_30,
            Product.expiry_date >= today,
        )
    )).scalar_one()

    return InventorySnapshot(
        total_items=total_items,
        total_value_jpy=total_value,
        low_stock_count=low_stock,
        expiring_soon_count=expiring,
    )
