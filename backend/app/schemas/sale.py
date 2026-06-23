from __future__ import annotations

from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, field_serializer

from app.models.sale import PaymentMethod


class SaleCreate(BaseModel):
    branch_id: int
    variant_id: int
    quantity: int
    unit_price: Decimal
    payment_method: PaymentMethod = PaymentMethod.cash
    sold_at: datetime | None = None
    patient_ref: str | None = None
    note: str | None = None


class SaleRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    store_id: int
    branch_id: int
    variant_id: int
    quantity: int
    unit_price: Decimal
    payment_method: PaymentMethod
    sold_at: datetime
    patient_ref: str | None
    note: str | None
    created_at: datetime
    # Denormalized for the list view — populated by the GET handler.
    product_name: str | None = None
    sku: str | None = None

    @field_serializer("unit_price")
    @classmethod
    def ser_decimal(cls, v: Decimal) -> str:
        return str(v)


class SaleListResponse(BaseModel):
    items: list[SaleRead]
    total: int


class SalesSummary(BaseModel):
    today_count: int
    today_revenue: str
    month_count: int
    month_revenue: str
