"""Shared Pydantic utilities: pagination, Decimal serialization, timestamps."""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import Generic, TypeVar

from pydantic import BaseModel, ConfigDict

T = TypeVar("T")


class PaginatedResponse(BaseModel, Generic[T]):
    """Standard list response wrapper."""

    items: list[T]
    total: int


class PaginationParams(BaseModel):
    limit: int = 20
    offset: int = 0

    def clamped_limit(self) -> int:
        return min(max(self.limit, 1), 100)


# Reusable config for ORM models
ORM_CONFIG = ConfigDict(from_attributes=True)


def decimal_ser(v: Decimal | None) -> str | None:
    """Serialize Decimal as string to avoid JS precision issues."""
    if v is None:
        return None
    return str(v)
