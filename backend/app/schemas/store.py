from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict


class StoreCreate(BaseModel):
    name: str


class StoreRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    created_at: datetime
    updated_at: datetime
