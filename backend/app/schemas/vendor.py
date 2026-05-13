from __future__ import annotations

from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, field_serializer

from app.models.vendor import VendorStatus


class VendorCreate(BaseModel):
    company_name: str
    country: str | None = None
    address: str | None = None
    postal_code: str | None = None
    contact_name: str | None = None
    email: str | None = None
    phone: str | None = None
    website: str | None = None
    payment_terms: str | None = None
    notes: str | None = None
    status: VendorStatus = VendorStatus.active


class VendorUpdate(BaseModel):
    company_name: str | None = None
    country: str | None = None
    address: str | None = None
    postal_code: str | None = None
    contact_name: str | None = None
    email: str | None = None
    phone: str | None = None
    website: str | None = None
    payment_terms: str | None = None
    notes: str | None = None
    status: VendorStatus | None = None


class VendorRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    store_id: int
    company_name: str
    country: str | None
    address: str | None
    postal_code: str | None
    contact_name: str | None
    email: str | None
    phone: str | None
    website: str | None
    payment_terms: str | None
    notes: str | None
    status: VendorStatus
    # Computed by the router — saves the frontend from extra fetches.
    product_count: int = 0
    ytd_purchase_total: Decimal = Decimal("0")
    created_at: datetime
    updated_at: datetime

    @field_serializer("ytd_purchase_total")
    @classmethod
    def ser_decimal(cls, v: Decimal) -> str:
        return str(v)
