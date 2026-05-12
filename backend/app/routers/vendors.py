from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query
from sqlalchemy import func, select

from app.deps import DB, StoreId
from app.models.vendor import Vendor
from app.schemas.base import PaginatedResponse
from app.schemas.vendor import VendorCreate, VendorRead, VendorUpdate

router = APIRouter(prefix="/vendors", tags=["vendors"])


@router.get("", response_model=PaginatedResponse[VendorRead])
async def list_vendors(
    db: DB,
    store_id: StoreId,
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    q: str | None = Query(None, description="Search by company name"),
):
    stmt = select(Vendor).where(Vendor.store_id == store_id)
    if q:
        stmt = stmt.where(Vendor.company_name.ilike(f"%{q}%"))
    total = (await db.execute(select(func.count()).select_from(stmt.subquery()))).scalar_one()
    rows = (await db.execute(stmt.order_by(Vendor.id).offset(offset).limit(limit))).scalars().all()
    return PaginatedResponse(items=rows, total=total)


@router.post("", response_model=VendorRead, status_code=201)
async def create_vendor(body: VendorCreate, db: DB, store_id: StoreId):
    vendor = Vendor(store_id=store_id, **body.model_dump())
    db.add(vendor)
    await db.commit()
    await db.refresh(vendor)
    return vendor


@router.get("/{vendor_id}", response_model=VendorRead)
async def get_vendor(vendor_id: int, db: DB, store_id: StoreId):
    vendor = (
        await db.execute(
            select(Vendor).where(Vendor.id == vendor_id, Vendor.store_id == store_id)
        )
    ).scalar_one_or_none()
    if not vendor:
        raise HTTPException(404, detail="Vendor not found")
    return vendor


@router.patch("/{vendor_id}", response_model=VendorRead)
async def update_vendor(vendor_id: int, body: VendorUpdate, db: DB, store_id: StoreId):
    vendor = (
        await db.execute(
            select(Vendor).where(Vendor.id == vendor_id, Vendor.store_id == store_id)
        )
    ).scalar_one_or_none()
    if not vendor:
        raise HTTPException(404, detail="Vendor not found")
    for key, val in body.model_dump(exclude_unset=True).items():
        setattr(vendor, key, val)
    await db.commit()
    await db.refresh(vendor)
    return vendor
