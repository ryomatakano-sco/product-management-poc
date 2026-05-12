from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.models.inventory import AdjustmentReason, InventoryField


class InventoryAdjustRequest(BaseModel):
    field: InventoryField
    delta: int
    reason: AdjustmentReason
    note: str | None = None


class InventoryAdjustmentRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    store_id: int
    variant_id: int
    field: InventoryField
    delta: int
    reason: AdjustmentReason
    reference_type: str | None
    reference_id: int | None
    note: str | None
    created_at: datetime
