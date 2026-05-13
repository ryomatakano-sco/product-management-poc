"""Categories CRUD with tree view + delete guard.

Hierarchy uses self-referential `parent_id` (already in the model). The tree
endpoint returns the two top-level groups (物販品 / 消耗品) with their
children inline so the カテゴリ page can render the left-pane tree without
N round-trips.

Delete is FK-safe: if any product still references the category we return
409 with the count so the frontend can ask the user to move products first.
"""

from __future__ import annotations

from collections import defaultdict

from fastapi import APIRouter, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.orm import selectinload

from app.deps import DB, StoreId
from app.models.category import Category
from app.models.product import Product
from app.schemas.base import PaginatedResponse
from app.schemas.category import (
    CategoryCreate,
    CategoryRead,
    CategoryTreeNode,
    CategoryUpdate,
)

router = APIRouter(prefix="/categories", tags=["categories"])


async def _category_product_counts(db, store_id: int) -> dict[int, int]:
    """Single GROUP BY query returning {category_id: product_count}.

    Used by both the list endpoint and the tree endpoint to fill in
    `product_count` without N+1 fetches.
    """
    rows = (await db.execute(
        select(Product.category_id, func.count(Product.id))
        .where(Product.store_id == store_id, Product.category_id.is_not(None))
        .group_by(Product.category_id)
    )).all()
    return {cid: cnt for cid, cnt in rows}


def _attach_count(model: Category, counts: dict[int, int]) -> CategoryRead:
    """Copy ORM row into a CategoryRead with the computed product_count."""
    read = CategoryRead.model_validate(model)
    read.product_count = counts.get(model.id, 0)
    return read


@router.get("", response_model=PaginatedResponse[CategoryRead], summary="カテゴリ一覧を取得")
async def list_categories(
    db: DB,
    store_id: StoreId,
    limit: int = Query(100, ge=1, le=200),
    offset: int = Query(0, ge=0),
):
    """Flat list of all categories in the store, sorted by `sort_order` then id."""
    stmt = (
        select(Category)
        .where(Category.store_id == store_id)
        .order_by(Category.sort_order.asc(), Category.id.asc())
    )
    total = (await db.execute(select(func.count()).select_from(stmt.subquery()))).scalar_one()
    rows = (await db.execute(stmt.offset(offset).limit(limit))).scalars().all()
    counts = await _category_product_counts(db, store_id)
    return PaginatedResponse(
        items=[_attach_count(r, counts) for r in rows],
        total=total,
    )


@router.get("/tree", response_model=list[CategoryTreeNode], summary="カテゴリツリーを取得")
async def list_categories_tree(db: DB, store_id: StoreId):
    """Returns the hierarchy as nested nodes.

    Top-level = nodes where `parent_id IS NULL`. The PoC depth is 2 levels;
    the implementation supports arbitrary depth via recursion.
    """
    all_cats: list[Category] = (await db.execute(
        select(Category)
        .where(Category.store_id == store_id)
        .order_by(Category.sort_order.asc(), Category.id.asc())
    )).scalars().all()
    counts = await _category_product_counts(db, store_id)

    by_parent: dict[int | None, list[Category]] = defaultdict(list)
    for c in all_cats:
        by_parent[c.parent_id].append(c)

    def build(parent_id: int | None) -> list[CategoryTreeNode]:
        # Build from explicit fields to avoid Pydantic triggering a lazy load
        # on the ORM `children` relationship (would crash in async context).
        result = []
        for c in by_parent.get(parent_id, []):
            node = CategoryTreeNode(
                id=c.id,
                name=c.name,
                name_kana=c.name_kana,
                color_hex=c.color_hex,
                icon_name=c.icon_name,
                applies_to=c.applies_to,
                default_tax_rate=c.default_tax_rate,
                description=c.description,
                sort_order=c.sort_order,
                product_count=counts.get(c.id, 0),
                children=build(c.id),
            )
            result.append(node)
        return result

    return build(None)


@router.get("/{category_id}", response_model=CategoryRead, summary="カテゴリ詳細を取得")
async def get_category(category_id: int, db: DB, store_id: StoreId):
    cat = (await db.execute(
        select(Category).where(Category.id == category_id, Category.store_id == store_id)
    )).scalar_one_or_none()
    if not cat:
        raise HTTPException(404, detail={"detail": "カテゴリが見つかりません", "code": "RESOURCE_NOT_FOUND"})
    counts = await _category_product_counts(db, store_id)
    return _attach_count(cat, counts)


@router.post("", response_model=CategoryRead, status_code=201, summary="カテゴリを作成")
async def create_category(body: CategoryCreate, db: DB, store_id: StoreId):
    cat = Category(store_id=store_id, **body.model_dump())
    db.add(cat)
    await db.commit()
    await db.refresh(cat)
    return _attach_count(cat, {})


@router.patch("/{category_id}", response_model=CategoryRead, summary="カテゴリを更新")
async def update_category(category_id: int, body: CategoryUpdate, db: DB, store_id: StoreId):
    cat = (await db.execute(
        select(Category).where(Category.id == category_id, Category.store_id == store_id)
    )).scalar_one_or_none()
    if not cat:
        raise HTTPException(404, detail={"detail": "カテゴリが見つかりません", "code": "RESOURCE_NOT_FOUND"})
    for key, val in body.model_dump(exclude_unset=True).items():
        setattr(cat, key, val)
    await db.commit()
    await db.refresh(cat)
    counts = await _category_product_counts(db, store_id)
    return _attach_count(cat, counts)


@router.delete("/{category_id}", status_code=204, summary="カテゴリを削除")
async def delete_category(category_id: int, db: DB, store_id: StoreId):
    """Reject delete if any product still references this category.

    The design's UX is "move products first, then delete" — we surface the
    product count in the error body so the frontend can render a useful
    message instead of a generic FK failure.
    """
    cat = (await db.execute(
        select(Category).where(Category.id == category_id, Category.store_id == store_id)
    )).scalar_one_or_none()
    if not cat:
        raise HTTPException(404, detail={"detail": "カテゴリが見つかりません", "code": "RESOURCE_NOT_FOUND"})
    product_count = (await db.execute(
        select(func.count(Product.id)).where(Product.category_id == category_id)
    )).scalar_one()
    if product_count > 0:
        raise HTTPException(
            409,
            detail={
                "detail": f"このカテゴリは {product_count} 件の商品に使われているため削除できません",
                "code": "CONFLICT_HAS_DEPENDENTS",
                "product_count": product_count,
            },
        )
    # Also block if children exist — avoid orphans.
    child_count = (await db.execute(
        select(func.count(Category.id)).where(Category.parent_id == category_id)
    )).scalar_one()
    if child_count > 0:
        raise HTTPException(
            409,
            detail={
                "detail": f"このカテゴリには {child_count} 件のサブカテゴリがあるため削除できません",
                "code": "CONFLICT_HAS_DEPENDENTS",
                "child_count": child_count,
            },
        )
    await db.delete(cat)
    await db.commit()
