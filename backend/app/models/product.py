from __future__ import annotations

import enum

from sqlalchemy import (
    BigInteger,
    Boolean,
    DateTime,
    Enum,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin


class ProductStatus(str, enum.Enum):
    active = "active"
    draft = "draft"
    archived = "archived"


class WeightUnit(str, enum.Enum):
    g = "g"
    kg = "kg"


class Product(Base, TimestampMixin):
    """Product table — superset of the client's existing `goods` table.

    Legacy columns are kept with their original names for compatibility:
    - default_amount_at_payment: semantically this is the product's default price
    - is_insurable: whether the product is covered by insurance
    - is_pinned: whether the product is pinned in the clinic's UI
    - default_insurance_point_at_payment: insurance point value
    """

    __tablename__ = "products"
    __table_args__ = (
        Index("ix_products_store_status", "store_id", "status"),
        Index("ix_products_store_vendor", "store_id", "vendor_id"),
        Index("ix_products_store_category", "store_id", "category_id"),
        Base.__table_args__,
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    store_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("stores.id"), nullable=False)
    category_id: Mapped[int | None] = mapped_column(
        BigInteger, ForeignKey("categories.id"), nullable=True
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)

    # Legacy columns from the `goods` table — DO NOT RENAME
    default_amount_at_payment: Mapped[float | None] = mapped_column(
        Numeric(10, 2), nullable=True, comment="Legacy: default price (税込)"
    )
    is_insurable: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_pinned: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    default_insurance_point_at_payment: Mapped[float | None] = mapped_column(
        Numeric(10, 2), nullable=True, comment="Legacy: insurance point value"
    )

    # New columns
    name_kana: Mapped[str | None] = mapped_column(String(255), nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    vendor_id: Mapped[int | None] = mapped_column(
        BigInteger, ForeignKey("vendors.id"), nullable=True
    )
    country_of_origin: Mapped[str | None] = mapped_column(String(100), nullable=True)
    status: Mapped[ProductStatus] = mapped_column(
        Enum(ProductStatus), default=ProductStatus.active, nullable=False
    )
    ai_session_id: Mapped[int | None] = mapped_column(
        BigInteger, ForeignKey("ai_suggestion_sessions.id"), nullable=True
    )

    # Relationships
    store: Mapped["Store"] = relationship(back_populates="products")  # noqa: F821
    category: Mapped["Category | None"] = relationship(back_populates="products")  # noqa: F821
    vendor: Mapped["Vendor | None"] = relationship(back_populates="products")  # noqa: F821
    variants: Mapped[list["ProductVariant"]] = relationship(
        back_populates="product", cascade="all, delete-orphan"
    )
    images: Mapped[list["ProductImage"]] = relationship(
        back_populates="product", cascade="all, delete-orphan"
    )
    tags: Mapped[list["Tag"]] = relationship(  # noqa: F821
        secondary="product_tags", back_populates="products"
    )
    ai_session: Mapped["AiSuggestionSession | None"] = relationship(  # noqa: F821
        foreign_keys=[ai_session_id],
    )


class ProductVariant(Base, TimestampMixin):
    """Every product has at least one variant (the 'default' variant).

    All inventory and SKU data lives here, NOT on the product.
    `available` is computed as `on_hand - committed - unavailable` (not stored).
    """

    __tablename__ = "product_variants"
    __table_args__ = (
        Index("ix_variants_store_sku", "store_id", "sku", unique=True),
        Index("ix_variants_store_barcode", "store_id", "barcode", unique=True),
        Index("ix_variants_product", "product_id"),
        Base.__table_args__,
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    product_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("products.id"), nullable=False)
    store_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("stores.id"), nullable=False,
        comment="Denormalized for tenancy queries",
    )
    sku: Mapped[str | None] = mapped_column(String(100), nullable=True)
    barcode: Mapped[str | None] = mapped_column(
        String(100), nullable=True, comment="JAN code goes here"
    )
    option1_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    option1_value: Mapped[str | None] = mapped_column(String(255), nullable=True)
    option2_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    option2_value: Mapped[str | None] = mapped_column(String(255), nullable=True)
    option3_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    option3_value: Mapped[str | None] = mapped_column(String(255), nullable=True)
    price: Mapped[float | None] = mapped_column(Numeric(10, 2), nullable=True)
    cost: Mapped[float | None] = mapped_column(Numeric(10, 2), nullable=True)
    weight_value: Mapped[float | None] = mapped_column(Numeric(10, 3), nullable=True)
    weight_unit: Mapped[WeightUnit] = mapped_column(
        Enum(WeightUnit), default=WeightUnit.g, nullable=False
    )
    on_hand: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    committed: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    unavailable: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    is_default: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    product: Mapped["Product"] = relationship(back_populates="variants")
    store: Mapped["Store"] = relationship()  # noqa: F821
    inventory_adjustments: Mapped[list["InventoryAdjustment"]] = relationship(  # noqa: F821
        back_populates="variant"
    )
    sales_records: Mapped[list["SalesRecord"]] = relationship(  # noqa: F821
        back_populates="variant"
    )

    @property
    def available(self) -> int:
        return self.on_hand - self.committed - self.unavailable


class ProductImage(Base, TimestampMixin):
    __tablename__ = "product_images"
    __table_args__ = (
        Index("ix_product_images_product", "product_id"),
        Base.__table_args__,
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    product_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("products.id"), nullable=False)
    store_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("stores.id"), nullable=False)
    url: Mapped[str] = mapped_column(String(2000), nullable=False)
    alt_text: Mapped[str | None] = mapped_column(String(500), nullable=True)
    position: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    product: Mapped["Product"] = relationship(back_populates="images")
