from __future__ import annotations

from fastapi import APIRouter, Query
from sqlalchemy import func, select

from app.deps import DB, StoreId
from app.models.tag import Tag
from app.schemas.base import PaginatedResponse
from app.schemas.tag import TagCreate, TagRead

router = APIRouter(prefix="/tags", tags=["tags"])


@router.get("", response_model=PaginatedResponse[TagRead])
async def list_tags(
    db: DB,
    store_id: StoreId,
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    q: str | None = Query(None, description="Search by tag name"),
):
    stmt = select(Tag).where(Tag.store_id == store_id)
    if q:
        stmt = stmt.where(Tag.name.ilike(f"%{q}%"))
    total = (await db.execute(select(func.count()).select_from(stmt.subquery()))).scalar_one()
    rows = (await db.execute(stmt.order_by(Tag.name).offset(offset).limit(limit))).scalars().all()
    return PaginatedResponse(items=rows, total=total)


@router.post("", response_model=TagRead, status_code=201)
async def create_tag(body: TagCreate, db: DB, store_id: StoreId):
    tag = Tag(store_id=store_id, name=body.name)
    db.add(tag)
    await db.commit()
    await db.refresh(tag)
    return tag
