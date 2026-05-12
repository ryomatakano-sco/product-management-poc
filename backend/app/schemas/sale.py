from __future__ import annotations

from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, field_serializer


class SaleCreate(BaseModel):
    branch_id: int
    variant_id: int
    quantity: int
    unit_price: Decimal
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
    sold_at: datetime
    patient_ref: str | None
    note: str | None
    created_at: datetime

    @field_serializer("unit_price")
    @classmethod
    def ser_decimal(cls, v: Decimal) -> str:
        return str(v)
