from __future__ import annotations

from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, field_serializer

from app.models.product import ProductStatus, WeightUnit


# --- Variant schemas ---

class VariantCreate(BaseModel):
    sku: str | None = None
    barcode: str | None = None
    option1_name: str | None = None
    option1_value: str | None = None
    option2_name: str | None = None
    option2_value: str | None = None
    option3_name: str | None = None
    option3_value: str | None = None
    price: Decimal | None = None
    cost: Decimal | None = None
    weight_value: Decimal | None = None
    weight_unit: WeightUnit = WeightUnit.g
    on_hand: int = 0
    committed: int = 0
    unavailable: int = 0
    is_default: bool = False


class VariantUpdate(BaseModel):
    sku: str | None = None
    barcode: str | None = None
    option1_name: str | None = None
    option1_value: str | None = None
    option2_name: str | None = None
    option2_value: str | None = None
    option3_name: str | None = None
    option3_value: str | None = None
    price: Decimal | None = None
    cost: Decimal | None = None
    weight_value: Decimal | None = None
    weight_unit: WeightUnit | None = None
    is_default: bool | None = None


class VariantRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    product_id: int
    store_id: int
    sku: str | None
    barcode: str | None
    option1_name: str | None
    option1_value: str | None
    option2_name: str | None
    option2_value: str | None
    option3_name: str | None
    option3_value: str | None
    price: Decimal | None
    cost: Decimal | None
    weight_value: Decimal | None
    weight_unit: WeightUnit
    on_hand: int
    committed: int
    unavailable: int
    available: int
    is_default: bool
    created_at: datetime
    updated_at: datetime

    @field_serializer("price", "cost", "weight_value")
    @classmethod
    def ser_decimal(cls, v: Decimal | None) -> str | None:
        return str(v) if v is not None else None


# --- Image schemas ---

class ImageCreate(BaseModel):
    url: str
    alt_text: str | None = None
    position: int = 0


class ImageUpdate(BaseModel):
    alt_text: str | None = None
    position: int | None = None


class ImageRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    product_id: int
    store_id: int
    url: str
    alt_text: str | None
    position: int
    created_at: datetime
    updated_at: datetime


# --- Product schemas ---

class SalesSummary(BaseModel):
    last_90_days_quantity: int
    last_90_days_revenue: Decimal

    @field_serializer("last_90_days_revenue")
    @classmethod
    def ser_decimal(cls, v: Decimal) -> str:
        return str(v)


class ProductCreate(BaseModel):
    name: str
    name_kana: str | None = None
    category_id: int | None = None
    vendor_id: int | None = None
    description: str | None = None
    country_of_origin: str | None = None
    default_amount_at_payment: Decimal | None = None
    is_insurable: bool = False
    is_pinned: bool = False
    default_insurance_point_at_payment: Decimal | None = None
    status: ProductStatus = ProductStatus.active
    ai_session_id: int | None = None
    variants: list[VariantCreate] = []
    images: list[ImageCreate] = []
    tags: list[str] = []  # tag names — auto-create missing


class ProductUpdate(BaseModel):
    name: str | None = None
    name_kana: str | None = None
    category_id: int | None = None
    vendor_id: int | None = None
    description: str | None = None
    country_of_origin: str | None = None
    default_amount_at_payment: Decimal | None = None
    is_insurable: bool | None = None
    is_pinned: bool | None = None
    default_insurance_point_at_payment: Decimal | None = None
    status: ProductStatus | None = None


class ProductListItem(BaseModel):
    """Lightweight product for list view.

    Includes derived fields (default variant SKU/price, total available stock)
    so the table can render without an extra round-trip per row.
    """
    model_config = ConfigDict(from_attributes=True)

    id: int
    store_id: int
    name: str
    name_kana: str | None
    category_name: str | None = None
    vendor_name: str | None = None
    tags: list[str] = []
    total_on_hand: int = 0
    total_available: int = 0          # sum(on_hand - committed - unavailable) across variants
    default_sku: str | None = None    # SKU of the default variant (or first if none flagged)
    default_price: Decimal | None = None  # price of the default variant
    thumbnail_url: str | None = None
    status: ProductStatus
    default_amount_at_payment: Decimal | None

    @field_serializer("default_amount_at_payment", "default_price")
    @classmethod
    def ser_decimal(cls, v: Decimal | None) -> str | None:
        return str(v) if v is not None else None


class ProductDetail(BaseModel):
    """Full product detail view."""
    model_config = ConfigDict(from_attributes=True)

    id: int
    store_id: int
    name: str
    name_kana: str | None
    description: str | None
    category_id: int | None
    category_name: str | None = None
    vendor_id: int | None
    vendor_name: str | None = None
    country_of_origin: str | None
    default_amount_at_payment: Decimal | None
    is_insurable: bool
    is_pinned: bool
    default_insurance_point_at_payment: Decimal | None
    status: ProductStatus
    ai_session_id: int | None
    variants: list[VariantRead] = []
    images: list[ImageRead] = []
    tags: list[str] = []
    sales_summary: SalesSummary | None = None
    created_at: datetime
    updated_at: datetime

    @field_serializer("default_amount_at_payment", "default_insurance_point_at_payment")
    @classmethod
    def ser_decimal(cls, v: Decimal | None) -> str | None:
        return str(v) if v is not None else None


class ProductSearchResult(BaseModel):
    """Lightweight result for AJAX product search (PO page)."""
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    default_variant: VariantSearchResult | None = None


class VariantSearchResult(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    sku: str | None
    price: Decimal | None
    on_hand: int

    @field_serializer("price")
    @classmethod
    def ser_decimal(cls, v: Decimal | None) -> str | None:
        return str(v) if v is not None else None


# Rebuild to resolve forward ref
ProductSearchResult.model_rebuild()
