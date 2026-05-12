from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict


class BranchCreate(BaseModel):
    name: str
    country: str | None = None
    address: str | None = None
    contact_name: str | None = None
    email: str | None = None
    phone: str | None = None
    website: str | None = None
    is_default: bool = False


class BranchUpdate(BaseModel):
    name: str | None = None
    country: str | None = None
    address: str | None = None
    contact_name: str | None = None
    email: str | None = None
    phone: str | None = None
    website: str | None = None
    is_default: bool | None = None


class BranchRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    store_id: int
    name: str
    country: str | None
    address: str | None
    contact_name: str | None
    email: str | None
    phone: str | None
    website: str | None
    is_default: bool
    created_at: datetime
    updated_at: datetime
