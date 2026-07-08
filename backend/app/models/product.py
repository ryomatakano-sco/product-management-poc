from __future__ import annotations

import enum
from datetime import date

from sqlalchemy import (
    BigInteger,
    Boolean,
    Date,
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


class ItemType(str, enum.Enum):
    """Yoshioka (2026-05-11): retail products vs treatment consumables.

    Consumables (paper cups, anesthetic agents, etc.) get expiry tracking
    on the product list and dashboard; retail products don't.
    """

    product = "product"      # 物販品
    consumable = "consumable"  # 消耗品


class WeightUnit(str, enum.Enum):
    g = "g"
    kg = "kg"


class TaxRate(str, enum.Enum):
    """Japanese consumption tax bracket for the product.

    * ``standard`` = 10% (default; adult retail, most consumables)
    * ``reduced``  = 8%  (軽減税率 — food-adjacent items like children's
                          fluoride gel or edible dental candies)

    Used by the receipt-issue page to compute the tax-breakdown block on
    qualified invoices (適格請求書).
    """
    standard = "standard"
    reduced = "reduced"


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
    tax_rate: Mapped[TaxRate] = mapped_column(
        Enum(TaxRate), nullable=False, server_default="standard",
    )
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

    # Yoshioka spec additions (2026-05-11). See CHANGES.md section 11.
    # - item_type: product/consumable classification. Drives list filter,
    #   detail badge, and which fields show in the create form.
    # - expiry_date / lot_number / unit: only meaningful for consumables, but
    #   not enforced at the schema level so retail items can also use unit if
    #   they want to.
    # - reorder_url: one-click supplier reorder link.
    item_type: Mapped[ItemType] = mapped_column(
        Enum(ItemType), default=ItemType.product, nullable=False,
        comment="物販品 (product) or 消耗品 (consumable)",
    )
    expiry_date: Mapped[date | None] = mapped_column(
        Date, nullable=True,
        comment="Expiry date for consumables (Yoshioka 2026-05-11)",
    )
    lot_number: Mapped[str | None] = mapped_column(String(100), nullable=True)
    unit: Mapped[str | None] = mapped_column(
        String(20), nullable=True,
        comment="Counting unit: 個, 箱, mL, g, 本, etc.",
    )
    reorder_url: Mapped[str | None] = mapped_column(
        String(2000), nullable=True,
        comment="Supplier URL for one-click reordering (Yoshioka 2026-05-11)",
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
    # Per-variant "running low" cutoff. Default 10 matches the previous
    # hardcoded frontend behavior. Tunable via the product edit form.
    # See migration 005_low_stock_threshold.
    low_stock_threshold: Mapped[int] = mapped_column(Integer, default=10, nullable=False)
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
