from __future__ import annotations

from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, field_serializer

from app.models.category import CategoryAppliesTo


class CategoryBase(BaseModel):
    """Fields shared by create / update / read.

    `applies_to` and `default_tax_rate` are the May-12 design-system additions.
    """
    name: str
    name_kana: str | None = None
    parent_id: int | None = None
    color_hex: str | None = None
    icon_name: str | None = None
    applies_to: CategoryAppliesTo = CategoryAppliesTo.both
    default_tax_rate: Decimal = Decimal("10.00")
    description: str | None = None
    sort_order: int = 0


class CategoryCreate(CategoryBase):
    pass


class CategoryUpdate(BaseModel):
    """All fields optional — PATCH semantics."""
    name: str | None = None
    name_kana: str | None = None
    parent_id: int | None = None
    color_hex: str | None = None
    icon_name: str | None = None
    applies_to: CategoryAppliesTo | None = None
    default_tax_rate: Decimal | None = None
    description: str | None = None
    sort_order: int | None = None


class CategoryRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    store_id: int
    name: str
    name_kana: str | None
    parent_id: int | None
    color_hex: str | None
    icon_name: str | None
    applies_to: CategoryAppliesTo
    default_tax_rate: Decimal
    description: str | None
    sort_order: int
    product_count: int = 0  # filled in by router
    created_at: datetime
    updated_at: datetime

    @field_serializer("default_tax_rate")
    @classmethod
    def ser_decimal(cls, v: Decimal) -> str:
        return str(v)


class CategoryTreeNode(BaseModel):
    """One node in the GET /categories/tree response.

    Children are recursive references to the same shape. Keeps name_kana
    etc. so the design's two-pane detail view can render off this single
    fetch without a second round-trip.
    """
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    name_kana: str | None
    color_hex: str | None
    icon_name: str | None
    applies_to: CategoryAppliesTo
    default_tax_rate: Decimal
    description: str | None
    sort_order: int
    product_count: int = 0
    children: list["CategoryTreeNode"] = []

    @field_serializer("default_tax_rate")
    @classmethod
    def ser_decimal(cls, v: Decimal) -> str:
        return str(v)


CategoryTreeNode.model_rebuild()
