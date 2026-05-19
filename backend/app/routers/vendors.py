"""Vendors CRUD + computed product_count and YTD purchase totals.

The list view's right-hand columns (取扱商品数, YTD仕入額) are computed
inline so the frontend doesn't have to fan out — a single GET /vendors
fills the entire 仕入先 list view.
"""

from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal

from fastapi import APIRouter, HTTPException, Query
from sqlalchemy import func, select

from app.deps import DB, StoreId
from app.models.product import Product
from app.models.purchase_order import POStatus, PurchaseOrder
from app.models.vendor import Vendor, VendorStatus
from app.schemas.base import PaginatedResponse
from app.schemas.vendor import VendorCreate, VendorRead, VendorUpdate

router = APIRouter(prefix="/vendors", tags=["vendors"])


async def _vendor_aggregates(db, store_id: int) -> tuple[dict[int, int], dict[int, Decimal]]:
    """Pre-compute {vendor_id: product_count} and {vendor_id: ytd_purchase_total}
    for every vendor in the store. One query each — far cheaper than per-row.
    """
    # product_count: active products only.
    prod_rows = (await db.execute(
        select(Product.vendor_id, func.count(Product.id))
        .where(Product.store_id == store_id, Product.vendor_id.is_not(None))
        .group_by(Product.vendor_id)
    )).all()
    product_counts = {vid: cnt for vid, cnt in prod_rows}

    # ytd_purchase_total: sum of PO totals for received POs this calendar year.
    year_start = date(datetime.utcnow().year, 1, 1)
    po_rows = (await db.execute(
        select(PurchaseOrder.supplier_vendor_id, func.coalesce(func.sum(PurchaseOrder.total), 0))
        .where(
            PurchaseOrder.store_id == store_id,
            PurchaseOrder.status.in_([POStatus.received, POStatus.partially_received]),
            PurchaseOrder.received_at.is_not(None),
            PurchaseOrder.received_at >= year_start,
        )
        .group_by(PurchaseOrder.supplier_vendor_id)
    )).all()
    ytd_totals: dict[int, Decimal] = {vid: Decimal(str(tot)) for vid, tot in po_rows}

    return product_counts, ytd_totals


def _attach(model: Vendor, counts: dict[int, int], ytd: dict[int, Decimal]) -> VendorRead:
    read = VendorRead.model_validate(model)
    read.product_count = counts.get(model.id, 0)
    read.ytd_purchase_total = ytd.get(model.id, Decimal("0"))
    return read


@router.get("", response_model=PaginatedResponse[VendorRead], summary="仕入先一覧を取得")
async def list_vendors(
    db: DB,
    store_id: StoreId,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    q: str | None = Query(None, description="Search by company name (会社名) or contact name"),
    status: VendorStatus | None = Query(None, description="Filter by status (active/inactive)"),
):
    stmt = select(Vendor).where(Vendor.store_id == store_id)
    if q and q.strip():
        from sqlalchemy import or_ as _or
        like = f"%{q.strip()}%"
        clauses = [Vendor.company_name.ilike(like)]
        if hasattr(Vendor, "contact_name"):
            clauses.append(Vendor.contact_name.ilike(like))
        stmt = stmt.where(_or(*clauses))
    if status is not None:
        stmt = stmt.where(Vendor.status == status)
    total = (await db.execute(select(func.count()).select_from(stmt.subquery()))).scalar_one()
    rows = (await db.execute(stmt.order_by(Vendor.id).offset(offset).limit(limit))).scalars().all()
    counts, ytd = await _vendor_aggregates(db, store_id)
    return PaginatedResponse(
        items=[_attach(v, counts, ytd) for v in rows],
        total=total,
    )


@router.post("", response_model=VendorRead, status_code=201, summary="仕入先を作成")
async def create_vendor(body: VendorCreate, db: DB, store_id: StoreId):
    vendor = Vendor(store_id=store_id, **body.model_dump())
    db.add(vendor)
    await db.commit()
    await db.refresh(vendor)
    return _attach(vendor, {}, {})


@router.get("/{vendor_id}", response_model=VendorRead, summary="仕入先詳細を取得")
async def get_vendor(vendor_id: int, db: DB, store_id: StoreId):
    vendor = (await db.execute(
        select(Vendor).where(Vendor.id == vendor_id, Vendor.store_id == store_id)
    )).scalar_one_or_none()
    if not vendor:
        raise HTTPException(404, detail={"detail": "仕入先が見つかりません", "code": "RESOURCE_NOT_FOUND"})
    counts, ytd = await _vendor_aggregates(db, store_id)
    return _attach(vendor, counts, ytd)


@router.patch("/{vendor_id}", response_model=VendorRead, summary="仕入先を更新")
async def update_vendor(vendor_id: int, body: VendorUpdate, db: DB, store_id: StoreId):
    vendor = (await db.execute(
        select(Vendor).where(Vendor.id == vendor_id, Vendor.store_id == store_id)
    )).scalar_one_or_none()
    if not vendor:
        raise HTTPException(404, detail={"detail": "仕入先が見つかりません", "code": "RESOURCE_NOT_FOUND"})
    for key, val in body.model_dump(exclude_unset=True).items():
        setattr(vendor, key, val)
    await db.commit()
    await db.refresh(vendor)
    counts, ytd = await _vendor_aggregates(db, store_id)
    return _attach(vendor, counts, ytd)


@router.delete("/{vendor_id}", status_code=204, summary="仕入先を削除（取扱商品があれば inactive 化）")
async def delete_vendor(vendor_id: int, db: DB, store_id: StoreId):
    """Soft-delete pattern (brief §3.7).

    If any product still references this vendor, we flip `status` to
    inactive rather than rejecting the request — the design's UX expects
    the row to disappear from the default list view either way.
    """
    vendor = (await db.execute(
        select(Vendor).where(Vendor.id == vendor_id, Vendor.store_id == store_id)
    )).scalar_one_or_none()
    if not vendor:
        raise HTTPException(404, detail={"detail": "仕入先が見つかりません", "code": "RESOURCE_NOT_FOUND"})
    product_count = (await db.execute(
        select(func.count(Product.id)).where(Product.vendor_id == vendor_id)
    )).scalar_one()
    if product_count > 0:
        vendor.status = VendorStatus.inactive
        await db.commit()
        return
    await db.delete(vendor)
    await db.commit()
