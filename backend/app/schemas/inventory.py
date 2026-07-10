from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.models.inventory import AdjustmentReason, InventoryField


class InventoryAdjustRequest(BaseModel):
    field: InventoryField
    delta: int
    reason: AdjustmentReason
    note: str | None = None
    # Per-branch inventory (migration 012). None = the store's main branch,
    # so every pre-existing caller keeps working unchanged.
    branch_id: int | None = None


class InventoryAdjustmentRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    store_id: int
    variant_id: int
    branch_id: int | None = None
    field: InventoryField
    delta: int
    reason: AdjustmentReason
    reference_type: str | None
    reference_id: int | None
    note: str | None
    created_at: datetime
