from __future__ import annotations

from fastapi import APIRouter, HTTPException
from sqlalchemy import func, select

from app.deps import DB, StoreId
from app.models.product import Product, ProductVariant
from app.schemas.product import VariantCreate, VariantRead, VariantUpdate

router = APIRouter(tags=["variants"])


@router.post("/products/{product_id}/variants", response_model=VariantRead, status_code=201)
async def create_variant(product_id: int, body: VariantCreate, db: DB, store_id: StoreId):
    product = (
        await db.execute(
            select(Product).where(Product.id == product_id, Product.store_id == store_id)
        )
    ).scalar_one_or_none()
    if not product:
        raise HTTPException(404, detail="Product not found")
    variant = ProductVariant(product_id=product_id, store_id=store_id, **body.model_dump())
    db.add(variant)
    await db.commit()
    await db.refresh(variant)
    return variant


@router.patch("/variants/{variant_id}", response_model=VariantRead)
async def update_variant(variant_id: int, body: VariantUpdate, db: DB, store_id: StoreId):
    variant = (
        await db.execute(
            select(ProductVariant).where(
                ProductVariant.id == variant_id, ProductVariant.store_id == store_id
            )
        )
    ).scalar_one_or_none()
    if not variant:
        raise HTTPException(404, detail="Variant not found")
    for key, val in body.model_dump(exclude_unset=True).items():
        setattr(variant, key, val)
    await db.commit()
    await db.refresh(variant)
    return variant


@router.delete("/variants/{variant_id}", status_code=204)
async def delete_variant(variant_id: int, db: DB, store_id: StoreId):
    variant = (
        await db.execute(
            select(ProductVariant).where(
                ProductVariant.id == variant_id, ProductVariant.store_id == store_id
            )
        )
    ).scalar_one_or_none()
    if not variant:
        raise HTTPException(404, detail="Variant not found")
    # Disallow deleting the only variant
    count = (
        await db.execute(
            select(func.count(ProductVariant.id)).where(
                ProductVariant.product_id == variant.product_id
            )
        )
    ).scalar_one()
    if count <= 1:
        raise HTTPException(400, detail="Cannot delete the only variant of a product")
    await db.delete(variant)
    await db.commit()
