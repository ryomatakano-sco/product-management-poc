from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict


class CategoryCreate(BaseModel):
    name: str
    name_kana: str | None = None
    parent_id: int | None = None


class CategoryUpdate(BaseModel):
    name: str | None = None
    name_kana: str | None = None
    parent_id: int | None = None


class CategoryRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    store_id: int
    name: str
    name_kana: str | None
    parent_id: int | None
    created_at: datetime
    updated_at: datetime
