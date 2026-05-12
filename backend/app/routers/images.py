from __future__ import annotations

from fastapi import APIRouter, HTTPException
from sqlalchemy import select

from app.deps import DB, StoreId
from app.models.product import Product, ProductImage
from app.schemas.product import ImageCreate, ImageRead, ImageUpdate

router = APIRouter(tags=["images"])


@router.post("/products/{product_id}/images", response_model=ImageRead, status_code=201)
async def create_image(product_id: int, body: ImageCreate, db: DB, store_id: StoreId):
    product = (
        await db.execute(
            select(Product).where(Product.id == product_id, Product.store_id == store_id)
        )
    ).scalar_one_or_none()
    if not product:
        raise HTTPException(404, detail="Product not found")
    image = ProductImage(product_id=product_id, store_id=store_id, **body.model_dump())
    db.add(image)
    await db.commit()
    await db.refresh(image)
    return image


@router.patch("/images/{image_id}", response_model=ImageRead)
async def update_image(image_id: int, body: ImageUpdate, db: DB, store_id: StoreId):
    image = (
        await db.execute(
            select(ProductImage).where(
                ProductImage.id == image_id, ProductImage.store_id == store_id
            )
        )
    ).scalar_one_or_none()
    if not image:
        raise HTTPException(404, detail="Image not found")
    for key, val in body.model_dump(exclude_unset=True).items():
        setattr(image, key, val)
    await db.commit()
    await db.refresh(image)
    return image


@router.delete("/images/{image_id}", status_code=204)
async def delete_image(image_id: int, db: DB, store_id: StoreId):
    image = (
        await db.execute(
            select(ProductImage).where(
                ProductImage.id == image_id, ProductImage.store_id == store_id
            )
        )
    ).scalar_one_or_none()
    if not image:
        raise HTTPException(404, detail="Image not found")
    await db.delete(image)
    await db.commit()
