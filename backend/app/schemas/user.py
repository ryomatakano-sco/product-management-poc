from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.models.user import UserRole, UserStatus


class LoginRequest(BaseModel):
    email: str
    password: str


class UserRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    store_id: int
    email: str
    display_name: str
    role: UserRole
    status: UserStatus
    created_at: datetime


class UserCreate(BaseModel):
    email: str
    password: str = Field(min_length=4)  # PoC-lenient; tighten in production
    display_name: str
    role: UserRole = UserRole.staff


class UserUpdate(BaseModel):
    display_name: str | None = None
    role: UserRole | None = None
    status: UserStatus | None = None
    password: str | None = Field(default=None, min_length=4)
