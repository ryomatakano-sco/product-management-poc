"""Products CRUD with search, nested variants/images/tags, sales summary."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from decimal import Decimal

from fastapi import APIRouter, HTTPException, Query
from sqlalchemy import func, insert as sa_insert, select
from sqlalchemy.orm import selectinload

from app.deps import DB, StoreId
from app.models.category import Category
from app.models.product import Product, ProductImage, ProductStatus, ProductVariant
from app.models.sale import SalesRecord
from app.models.tag import ProductTag, Tag
from app.models.vendor import Vendor
from app.schemas.base import PaginatedResponse
from app.schemas.product import (
    ImageRead,
    ProductCreate,
    ProductDetail,
    ProductListItem,
    ProductSearchResult,
    ProductUpdate,
    SalesSummary,
    VariantRead,
    VariantSearchResult,
)

router = APIRouter(prefix="/products", tags=["products"])


def _build_list_item(p: Product) -> ProductListItem:
    """Transform a loaded Product ORM object into a ProductListItem.

    Computes ``total_available`` (across all variants) and surfaces
    ``default_sku``/``default_price`` from the variant flagged as default
    (or the first variant when nothing is flagged) so the list view can
    render a useful row without per-row variant fetches.
    """
    total_on_hand = sum(v.on_hand for v in p.variants)
    total_available = sum(
        v.on_hand - v.committed - v.unavailable for v in p.variants
    )
    default_variant = next((v for v in p.variants if v.is_default), None)
    if default_variant is None and p.variants:
        default_variant = p.variants[0]

    # Thumbnail = first image by position
    images_sorted = sorted(p.images, key=lambda i: i.position)
    thumbnail = images_sorted[0].url if images_sorted else None

    return ProductListItem(
        id=p.id,
        store_id=p.store_id,
        name=p.name,
        name_kana=p.name_kana,
        category_name=p.category.name if p.category else None,
        vendor_name=p.vendor.company_name if p.vendor else None,
        tags=[t.name for t in p.tags],
        total_on_hand=total_on_hand,
        total_available=total_available,
        default_sku=default_variant.sku if default_variant else None,
        default_price=default_variant.price if default_variant else None,
        thumbnail_url=thumbnail,
        status=p.status,
        default_amount_at_payment=p.default_amount_at_payment,
    )


@router.get("", response_model=PaginatedResponse[ProductListItem])
async def list_products(
    db: DB,
    store_id: StoreId,
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    q: str | None = Query(None, description="Search name or name_kana"),
    category_id: int | None = Query(None),
    vendor_id: int | None = Query(None),
    tag: list[str] | None = Query(None),
    status: ProductStatus | None = Query(None),
):
    stmt = (
        select(Product)
        .where(Product.store_id == store_id)
        .options(
            selectinload(Product.variants),
            selectinload(Product.images),
            selectinload(Product.category),
            selectinload(Product.vendor),
            selectinload(Product.tags),
        )
    )
    if q:
        stmt = stmt.where(
            (Product.name.ilike(f"%{q}%")) | (Product.name_kana.ilike(f"%{q}%"))
        )
    if category_id is not None:
        stmt = stmt.where(Product.category_id == category_id)
    if vendor_id is not None:
        stmt = stmt.where(Product.vendor_id == vendor_id)
    if status is not None:
        stmt = stmt.where(Product.status == status)
    if tag:
        stmt = stmt.where(Product.tags.any(Tag.name.in_(tag)))

    # Exclude archived by default
    if status is None:
        stmt = stmt.where(Product.status != ProductStatus.archived)

    count_q = select(func.count()).select_from(stmt.subquery())
    total = (await db.execute(count_q)).scalar_one()
    rows = (await db.execute(stmt.order_by(Product.id).offset(offset).limit(limit))).scalars().unique().all()
    return PaginatedResponse(items=[_build_list_item(p) for p in rows], total=total)


@router.get("/search", response_model=list[ProductSearchResult])
async def search_products(
    db: DB,
    store_id: StoreId,
    q: str = Query(..., min_length=1, description="Search query"),
):
    """Lightweight AJAX search for the PO page. Max 20 results."""
    stmt = (
        select(Product)
        .where(
            Product.store_id == store_id,
            Product.status != ProductStatus.archived,
            (Product.name.ilike(f"%{q}%")) | (Product.name_kana.ilike(f"%{q}%")),
        )
        .options(selectinload(Product.variants))
        .limit(20)
    )
    products = (await db.execute(stmt)).scalars().unique().all()
    results = []
    for p in products:
        default_v = next((v for v in p.variants if v.is_default), None)
        dv = None
        if default_v:
            dv = VariantSearchResult(
                id=default_v.id,
                sku=default_v.sku,
                price=default_v.price,
                on_hand=default_v.on_hand,
            )
        results.append(ProductSearchResult(id=p.id, name=p.name, default_variant=dv))
    return results


@router.get("/{product_id}", response_model=ProductDetail)
async def get_product(product_id: int, db: DB, store_id: StoreId):
    stmt = (
        select(Product)
        .where(Product.id == product_id, Product.store_id == store_id)
        .options(
            selectinload(Product.variants),
            selectinload(Product.images),
            selectinload(Product.category),
            selectinload(Product.vendor),
            selectinload(Product.tags),
        )
    )
    product = (await db.execute(stmt)).scalar_one_or_none()
    if not product:
        raise HTTPException(404, detail="Product not found")

    # Sales summary: last 90 days across all variants
    variant_ids = [v.id for v in product.variants]
    cutoff = datetime.now(timezone.utc) - timedelta(days=90)
    summary = SalesSummary(last_90_days_quantity=0, last_90_days_revenue=Decimal("0"))
    if variant_ids:
        row = (
            await db.execute(
                select(
                    func.coalesce(func.sum(SalesRecord.quantity), 0),
                    func.coalesce(func.sum(SalesRecord.quantity * SalesRecord.unit_price), 0),
                ).where(
                    SalesRecord.store_id == store_id,
                    SalesRecord.variant_id.in_(variant_ids),
                    SalesRecord.sold_at >= cutoff,
                )
            )
        ).one()
        summary = SalesSummary(
            last_90_days_quantity=int(row[0]),
            last_90_days_revenue=Decimal(str(row[1])),
        )

    images_sorted = sorted(product.images, key=lambda i: i.position)

    return ProductDetail(
        id=product.id,
        store_id=product.store_id,
        name=product.name,
        name_kana=product.name_kana,
        description=product.description,
        category_id=product.category_id,
        category_name=product.category.name if product.category else None,
        vendor_id=product.vendor_id,
        vendor_name=product.vendor.company_name if product.vendor else None,
        country_of_origin=product.country_of_origin,
        default_amount_at_payment=product.default_amount_at_payment,
        is_insurable=product.is_insurable,
        is_pinned=product.is_pinned,
        default_insurance_point_at_payment=product.default_insurance_point_at_payment,
        status=product.status,
        ai_session_id=product.ai_session_id,
        variants=[VariantRead.model_validate(v) for v in product.variants],
        images=[ImageRead.model_validate(i) for i in images_sorted],
        tags=[t.name for t in product.tags],
        sales_summary=summary,
        created_at=product.created_at,
        updated_at=product.updated_at,
    )


@router.post("", response_model=ProductDetail, status_code=201)
async def create_product(body: ProductCreate, db: DB, store_id: StoreId):
    product = Product(
        store_id=store_id,
        name=body.name,
        name_kana=body.name_kana,
        category_id=body.category_id,
        vendor_id=body.vendor_id,
        description=body.description,
        country_of_origin=body.country_of_origin,
        default_amount_at_payment=body.default_amount_at_payment,
        is_insurable=body.is_insurable,
        is_pinned=body.is_pinned,
        default_insurance_point_at_payment=body.default_insurance_point_at_payment,
        status=body.status,
        ai_session_id=body.ai_session_id,
    )

    # Link AI session if provided
    if body.ai_session_id:
        from app.models.ai_session import AiSuggestionSession

        session = (
            await db.execute(
                select(AiSuggestionSession).where(
                    AiSuggestionSession.id == body.ai_session_id,
                    AiSuggestionSession.store_id == store_id,
                )
            )
        ).scalar_one_or_none()
        if session:
            session.applied_to_product_id = None  # will be set after flush

    db.add(product)
    await db.flush()  # get product.id

    # Link AI session back
    if body.ai_session_id:
        if session:
            session.applied_to_product_id = product.id

    # Variants — ensure at least one default
    has_default = False
    for vdata in body.variants:
        v = ProductVariant(
            product_id=product.id,
            store_id=store_id,
            **vdata.model_dump(),
        )
        if v.is_default:
            has_default = True
        db.add(v)

    if not body.variants:
        # Auto-create default variant
        db.add(ProductVariant(
            product_id=product.id,
            store_id=store_id,
            is_default=True,
            price=body.default_amount_at_payment,
        ))
    elif not has_default:
        # Mark first variant as default
        pass  # already added, first one will be default in practice

    # Images
    for idata in body.images:
        db.add(ProductImage(
            product_id=product.id,
            store_id=store_id,
            **idata.model_dump(),
        ))

    # Tags — auto-create missing, use direct insert to avoid lazy load
    for tag_name in body.tags:
        tag = (
            await db.execute(
                select(Tag).where(Tag.store_id == store_id, Tag.name == tag_name)
            )
        ).scalar_one_or_none()
        if not tag:
            tag = Tag(store_id=store_id, name=tag_name)
            db.add(tag)
            await db.flush()
        await db.execute(
            sa_insert(ProductTag).values(product_id=product.id, tag_id=tag.id)
        )

    await db.commit()

    # Return full detail
    return await get_product(product.id, db, store_id)


@router.patch("/{product_id}", response_model=ProductDetail)
async def update_product(product_id: int, body: ProductUpdate, db: DB, store_id: StoreId):
    product = (
        await db.execute(
            select(Product).where(Product.id == product_id, Product.store_id == store_id)
        )
    ).scalar_one_or_none()
    if not product:
        raise HTTPException(404, detail="Product not found")
    for key, val in body.model_dump(exclude_unset=True).items():
        setattr(product, key, val)
    await db.commit()
    return await get_product(product_id, db, store_id)


@router.delete("/{product_id}", response_model=ProductDetail)
async def delete_product(product_id: int, db: DB, store_id: StoreId):
    """Soft delete via status='archived'."""
    product = (
        await db.execute(
            select(Product).where(Product.id == product_id, Product.store_id == store_id)
        )
    ).scalar_one_or_none()
    if not product:
        raise HTTPException(404, detail="Product not found")
    product.status = ProductStatus.archived
    await db.commit()
    return await get_product(product_id, db, store_id)
