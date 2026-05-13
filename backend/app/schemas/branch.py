from __future__ import annotations

from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, field_serializer

from app.models.branch import BranchStatus, BranchType


class BranchCreate(BaseModel):
    name: str
    branch_type: BranchType = BranchType.main
    country: str | None = None
    postal_code: str | None = None
    address: str | None = None
    contact_name: str | None = None
    manager_name: str | None = None
    email: str | None = None
    phone: str | None = None
    website: str | None = None
    is_default: bool = False
    operating_hours_json: dict | None = None
    default_tax_rate: Decimal = Decimal("10.00")
    low_stock_threshold: int = 10
    status: BranchStatus = BranchStatus.active


class BranchUpdate(BaseModel):
    name: str | None = None
    branch_type: BranchType | None = None
    country: str | None = None
    postal_code: str | None = None
    address: str | None = None
    contact_name: str | None = None
    manager_name: str | None = None
    email: str | None = None
    phone: str | None = None
    website: str | None = None
    is_default: bool | None = None
    operating_hours_json: dict | None = None
    default_tax_rate: Decimal | None = None
    low_stock_threshold: int | None = None
    status: BranchStatus | None = None


class BranchRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    store_id: int
    name: str
    branch_type: BranchType
    country: str | None
    postal_code: str | None
    address: str | None
    contact_name: str | None
    manager_name: str | None
    email: str | None
    phone: str | None
    website: str | None
    is_default: bool
    operating_hours_json: dict | None
    default_tax_rate: Decimal
    low_stock_threshold: int
    status: BranchStatus
    created_at: datetime
    updated_at: datetime

    @field_serializer("default_tax_rate")
    @classmethod
    def ser_decimal(cls, v: Decimal) -> str:
        return str(v)


class InventorySnapshot(BaseModel):
    """Aggregated inventory KPIs scoped to a branch — drives the 院・店舗 card
    `在庫スナップショット: 2,847 点 / ¥1,684,200` and the detail page.
    """
    total_items: int
    total_value_jpy: Decimal
    low_stock_count: int
    expiring_soon_count: int

    @field_serializer("total_value_jpy")
    @classmethod
    def ser_decimal(cls, v: Decimal) -> str:
        return str(v)
