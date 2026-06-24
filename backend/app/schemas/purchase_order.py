from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field, field_serializer

from app.models.purchase_order import POStatus


# --- PO Item schemas ---

class POItemCreate(BaseModel):
    variant_id: int
    quantity_ordered: int = Field(gt=0, description="Must be at least 1")
    unit_cost: Decimal = Field(ge=0)


class POItemRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    purchase_order_id: int
    store_id: int
    variant_id: int
    quantity_ordered: int
    quantity_received: int
    unit_cost: Decimal
    line_total: Decimal

    @field_serializer("unit_cost", "line_total")
    @classmethod
    def ser_decimal(cls, v: Decimal) -> str:
        return str(v)


class POItemReceive(BaseModel):
    item_id: int
    quantity_received: int = Field(gt=0, description="Must be at least 1")


# --- PO schemas ---

class PurchaseOrderCreate(BaseModel):
    supplier_vendor_id: int
    destination_branch_id: int
    status: POStatus = POStatus.draft
    payment_terms: str | None = None
    estimated_arrival: date | None = None
    shipping_carrier: str | None = None
    tracking_number: str | None = None
    reference_number: str | None = None
    note: str | None = None
    shipping_cost: Decimal = Decimal("0")
    items: list[POItemCreate] = []
    tags: list[str] = []


class PurchaseOrderUpdate(BaseModel):
    supplier_vendor_id: int | None = None
    destination_branch_id: int | None = None
    payment_terms: str | None = None
    estimated_arrival: date | None = None
    shipping_carrier: str | None = None
    tracking_number: str | None = None
    reference_number: str | None = None
    note: str | None = None
    shipping_cost: Decimal | None = None
    items: list[POItemCreate] | None = None
    tags: list[str] | None = None


class PurchaseOrderReceive(BaseModel):
    items: list[POItemReceive]


class PurchaseOrderRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    store_id: int
    supplier_vendor_id: int
    destination_branch_id: int
    status: POStatus
    payment_terms: str | None
    estimated_arrival: date | None
    shipping_carrier: str | None
    tracking_number: str | None
    reference_number: str | None
    note: str | None
    subtotal: Decimal
    shipping_cost: Decimal
    total: Decimal
    ordered_at: datetime | None
    received_at: datetime | None
    items: list[POItemRead] = []
    tags: list[str] = []
    supplier_name: str | None = None
    branch_name: str | None = None
    created_at: datetime
    updated_at: datetime

    @field_serializer("subtotal", "shipping_cost", "total")
    @classmethod
    def ser_decimal(cls, v: Decimal) -> str:
        return str(v)
