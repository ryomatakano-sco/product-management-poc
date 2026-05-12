from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict


class VendorCreate(BaseModel):
    company_name: str
    country: str | None = None
    address: str | None = None
    contact_name: str | None = None
    email: str | None = None
    phone: str | None = None
    website: str | None = None


class VendorUpdate(BaseModel):
    company_name: str | None = None
    country: str | None = None
    address: str | None = None
    contact_name: str | None = None
    email: str | None = None
    phone: str | None = None
    website: str | None = None


class VendorRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    store_id: int
    company_name: str
    country: str | None
    address: str | None
    contact_name: str | None
    email: str | None
    phone: str | None
    website: str | None
    created_at: datetime
    updated_at: datetime
