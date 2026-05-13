from __future__ import annotations

import enum

from sqlalchemy import BigInteger, Enum, ForeignKey, Index, Integer, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin


class CategoryAppliesTo(str, enum.Enum):
    """Which item_type a category is relevant for. Drives the create form
    filter — when a user picks 物販品, only `retail`/`both` categories show."""

    retail = "retail"          # for 物販品
    consumable = "consumable"  # for 消耗品
    both = "both"


class Category(Base, TimestampMixin):
    __tablename__ = "categories"
    __table_args__ = (
        Index("ix_categories_store_id", "store_id"),
        Index("ix_categories_store_parent", "store_id", "parent_id"),
        Base.__table_args__,
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    store_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("stores.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    name_kana: Mapped[str | None] = mapped_column(String(255), nullable=True)
    parent_id: Mapped[int | None] = mapped_column(
        BigInteger, ForeignKey("categories.id"), nullable=True
    )

    # Migration 003 — paylight X design system additions (brief §2.1)
    color_hex: Mapped[str | None] = mapped_column(String(7), nullable=True,
        comment="Hex like #16A36C — drives the colored circle on カテゴリ page")
    icon_name: Mapped[str | None] = mapped_column(String(48), nullable=True,
        comment="Lucide icon name (e.g., Brush, Sparkle, ShieldCheck)")
    applies_to: Mapped[CategoryAppliesTo] = mapped_column(
        Enum(CategoryAppliesTo, name="cat_applies_enum"),
        default=CategoryAppliesTo.both, nullable=False,
    )
    default_tax_rate: Mapped[float] = mapped_column(
        Numeric(4, 2), default=10.00, nullable=False,
        comment="Default consumption-tax % used when a product in this category is created"
    )
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    store: Mapped["Store"] = relationship(back_populates="categories")  # noqa: F821
    parent: Mapped["Category | None"] = relationship(
        remote_side="Category.id", back_populates="children"
    )
    children: Mapped[list["Category"]] = relationship(back_populates="parent")
    products: Mapped[list["Product"]] = relationship(back_populates="category")  # noqa: F821
