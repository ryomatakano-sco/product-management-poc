from __future__ import annotations

from fastapi import APIRouter, Query
from sqlalchemy import func, select

from app.deps import DB
from app.models.store import Store
from app.schemas.base import PaginatedResponse
from app.schemas.store import StoreCreate, StoreRead

router = APIRouter(prefix="/stores", tags=["stores"])


@router.get("", response_model=PaginatedResponse[StoreRead])
async def list_stores(
    db: DB,
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
):
    total = (await db.execute(select(func.count(Store.id)))).scalar_one()
    rows = (
        await db.execute(select(Store).order_by(Store.id).offset(offset).limit(limit))
    ).scalars().all()
    return PaginatedResponse(items=rows, total=total)


@router.post("", response_model=StoreRead, status_code=201)
async def create_store(body: StoreCreate, db: DB):
    store = Store(name=body.name)
    db.add(store)
    await db.commit()
    await db.refresh(store)
    return store
