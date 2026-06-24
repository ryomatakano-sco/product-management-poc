from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field, field_serializer

from app.models.sale import PaymentMethod


def _utc_iso(v: datetime) -> str:
    """Serialize a datetime as a UTC ISO string with explicit timezone.

    MySQL stores DateTime(timezone=True) as a naive DATETIME column, and
    SQLAlchemy returns it tz-naive even though we wrote it as UTC. Without
    an explicit tz suffix, JS `new Date(...)` interprets the string as
    *local* time and shifts it by the browser offset.
    """
    if v.tzinfo is None:
        v = v.replace(tzinfo=timezone.utc)
    return v.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")


class SaleCreate(BaseModel):
    branch_id: int
    variant_id: int
    quantity: int = Field(gt=0, description="Must be at least 1")
    unit_price: Decimal = Field(ge=0, description="Must be 0 or greater")
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

    @field_serializer("sold_at", "created_at")
    @classmethod
    def ser_datetime(cls, v: datetime) -> str:
        return _utc_iso(v)


class SaleListResponse(BaseModel):
    items: list[SaleRead]
    total: int


class SalesSummary(BaseModel):
    today_count: int
    today_revenue: str
    month_count: int
    month_revenue: str
