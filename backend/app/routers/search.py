"""Global cross-resource search — powers the Ctrl+K command palette.

One endpoint, ``GET /search/global?q=<text>``, fans out to every searchable
resource (products / vendors / purchase orders / categories / branches) and
returns a small, unified envelope so the frontend can render mixed result
groups without making five separate requests.

This is deliberately a thin aggregation layer over the existing per-resource
queries — no new search logic. If a resource's individual filter changes,
this endpoint inherits the improvement automatically.

Result limits are intentionally tight (5 per resource, 25 total) so the
palette stays responsive on a typed-as-you-go input. The frontend can deep-
link to the resource's full list page for "show all matches".
"""

from __future__ import annotations

from fastapi import APIRouter, Query
from pydantic import BaseModel
from sqlalchemy import or_, select
from sqlalchemy.orm import selectinload

from app.deps import DB, StoreId
from app.models.branch import Branch
from app.models.category import Category
from app.models.product import Product, ProductStatus
from app.models.purchase_order import PurchaseOrder
from app.models.vendor import Vendor

router = APIRouter(prefix="/search", tags=["search"])


# ─── response shape ──────────────────────────────────────────────────────────
class SearchHit(BaseModel):
    """One row in the palette. Kept resource-agnostic so the same renderer
    can show every type. ``href`` is the hash-route to deep-link into."""

    kind: str                # "product" | "vendor" | "po" | "category" | "branch"
    id: int
    title: str               # primary label (e.g. product name)
    subtitle: str | None = None  # secondary line (e.g. SKU, vendor name)
    href: str                # hash route — e.g. "/products/42"


class GlobalSearchResponse(BaseModel):
    q: str
    total: int
    hits: list[SearchHit]


# ─── helpers ─────────────────────────────────────────────────────────────────
_PER_RESOURCE_LIMIT = 5


async def _search_products(db, store_id: int, q: str) -> list[SearchHit]:
    """Local lookup. Imports the helper from products.py lazily to avoid a
    circular import (search → products → ...)."""
    from app.routers.products import _build_product_search
    filter_clause, _reasons = _build_product_search(q)
    stmt = (
        select(Product)
        .where(
            Product.store_id == store_id,
            Product.status != ProductStatus.archived,
            filter_clause,
        )
        .options(selectinload(Product.variants))
        .order_by(Product.id.desc())
        .limit(_PER_RESOURCE_LIMIT)
    )
    rows = (await db.execute(stmt)).scalars().unique().all()
    hits: list[SearchHit] = []
    for p in rows:
        dv = next((v for v in p.variants if v.is_default), None) or (p.variants[0] if p.variants else None)
        subtitle_parts = []
        if dv and dv.sku:
            subtitle_parts.append(f"SKU: {dv.sku}")
        if dv and dv.barcode:
            subtitle_parts.append(f"JAN: {dv.barcode}")
        hits.append(SearchHit(
            kind="product",
            id=p.id,
            title=p.name,
            subtitle=" / ".join(subtitle_parts) or None,
            href=f"/products/{p.id}",
        ))
    return hits


async def _search_vendors(db, store_id: int, q: str) -> list[SearchHit]:
    like = f"%{q}%"
    clauses = [Vendor.company_name.ilike(like)]
    if hasattr(Vendor, "contact_name"):
        clauses.append(Vendor.contact_name.ilike(like))
    stmt = (
        select(Vendor)
        .where(Vendor.store_id == store_id, or_(*clauses))
        .order_by(Vendor.id.desc())
        .limit(_PER_RESOURCE_LIMIT)
    )
    rows = (await db.execute(stmt)).scalars().all()
    return [
        SearchHit(
            kind="vendor",
            id=v.id,
            title=v.company_name,
            subtitle=getattr(v, "contact_name", None) or None,
            href=f"/vendors/{v.id}",
        )
        for v in rows
    ]


async def _search_pos(db, store_id: int, q: str) -> list[SearchHit]:
    like = f"%{q}%"
    clauses = []
    for attr in ("po_number", "reference_number", "tracking_number"):
        if hasattr(PurchaseOrder, attr):
            clauses.append(getattr(PurchaseOrder, attr).ilike(like))
    if not clauses:
        return []
    stmt = (
        select(PurchaseOrder)
        .where(PurchaseOrder.store_id == store_id, or_(*clauses))
        .order_by(PurchaseOrder.id.desc())
        .limit(_PER_RESOURCE_LIMIT)
    )
    rows = (await db.execute(stmt)).scalars().all()
    return [
        SearchHit(
            kind="po",
            id=po.id,
            title=getattr(po, "po_number", None) or f"PO-{str(po.id).zfill(6)}",
            subtitle=getattr(po, "reference_number", None) or None,
            href=f"/purchase-orders/{po.id}",
        )
        for po in rows
    ]


async def _search_categories(db, store_id: int, q: str) -> list[SearchHit]:
    stmt = (
        select(Category)
        .where(Category.store_id == store_id, Category.name.ilike(f"%{q}%"))
        .order_by(Category.sort_order.asc(), Category.id.asc())
        .limit(_PER_RESOURCE_LIMIT)
    )
    rows = (await db.execute(stmt)).scalars().all()
    return [
        SearchHit(
            kind="category",
            id=c.id,
            title=c.name,
            subtitle=None,
            # Categories don't have a detail page yet — deep-link to the
            # category-filtered product list so the user sees what's in it.
            href=f"/products?category_id={c.id}",
        )
        for c in rows
    ]


async def _search_branches(db, store_id: int, q: str) -> list[SearchHit]:
    like = f"%{q}%"
    clauses = [Branch.name.ilike(like)]
    if hasattr(Branch, "manager_name"):
        clauses.append(Branch.manager_name.ilike(like))
    stmt = (
        select(Branch)
        .where(Branch.store_id == store_id, or_(*clauses))
        .order_by(Branch.id.asc())
        .limit(_PER_RESOURCE_LIMIT)
    )
    rows = (await db.execute(stmt)).scalars().all()
    return [
        SearchHit(
            kind="branch",
            id=b.id,
            title=b.name,
            subtitle=getattr(b, "manager_name", None) or None,
            href=f"/branches/{b.id}",
        )
        for b in rows
    ]


# ─── endpoint ────────────────────────────────────────────────────────────────
@router.get("/global", response_model=GlobalSearchResponse, summary="横断検索")
async def global_search(
    db: DB,
    store_id: StoreId,
    q: str = Query(..., min_length=1, max_length=120, description="Search query"),
):
    """Search every resource at once. Used by the Ctrl+K command palette.

    Returns up to 5 hits per resource (25 total) so the dropdown stays
    fast. Order: products → vendors → POs → categories → branches.
    """
    q = q.strip()
    # The five resource queries are independent — could parallelise with
    # asyncio.gather, but with sub-50ms latency per query the overhead of
    # gather (extra task scheduling) is often higher than the win on a
    # PoC database. Sequential is fine.
    products = await _search_products(db, store_id, q)
    vendors = await _search_vendors(db, store_id, q)
    pos = await _search_pos(db, store_id, q)
    categories = await _search_categories(db, store_id, q)
    branches = await _search_branches(db, store_id, q)
    hits = products + vendors + pos + categories + branches
    return GlobalSearchResponse(q=q, total=len(hits), hits=hits)
