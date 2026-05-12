from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query
from sqlalchemy import func, select

from app.deps import DB, StoreId
from app.models.category import Category
from app.schemas.base import PaginatedResponse
from app.schemas.category import CategoryCreate, CategoryRead, CategoryUpdate

router = APIRouter(prefix="/categories", tags=["categories"])


@router.get("", response_model=PaginatedResponse[CategoryRead])
async def list_categories(
    db: DB,
    store_id: StoreId,
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
):
    stmt = select(Category).where(Category.store_id == store_id)
    total = (await db.execute(select(func.count()).select_from(stmt.subquery()))).scalar_one()
    rows = (await db.execute(stmt.order_by(Category.id).offset(offset).limit(limit))).scalars().all()
    return PaginatedResponse(items=rows, total=total)


@router.post("", response_model=CategoryRead, status_code=201)
async def create_category(body: CategoryCreate, db: DB, store_id: StoreId):
    cat = Category(store_id=store_id, **body.model_dump())
    db.add(cat)
    await db.commit()
    await db.refresh(cat)
    return cat


@router.patch("/{category_id}", response_model=CategoryRead)
async def update_category(category_id: int, body: CategoryUpdate, db: DB, store_id: StoreId):
    cat = (
        await db.execute(
            select(Category).where(Category.id == category_id, Category.store_id == store_id)
        )
    ).scalar_one_or_none()
    if not cat:
        raise HTTPException(404, detail="Category not found")
    for key, val in body.model_dump(exclude_unset=True).items():
        setattr(cat, key, val)
    await db.commit()
    await db.refresh(cat)
    return cat
