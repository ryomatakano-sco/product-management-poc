"""Support page schemas — FAQ + ticket form + system status."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict
# Brief §0.4.2 forbids new deps and `email-validator` isn't in pyproject —
# so we accept `email` as a plain str. The frontend's HTML5 input[type=email]
# does the client-side check; we don't validate further here.

from app.models.support import SupportSubject, TicketStatus


class FaqItem(BaseModel):
    """Static FAQ entry — hard-coded in app/data/faq.py."""
    id: int
    question: str
    answer: str
    category: str
    updated_at: datetime


class SupportTicketCreate(BaseModel):
    """POST /support/tickets body."""
    subject_category: SupportSubject
    related_page: str | None = None
    body: str
    email: str  # see header note: plain str to avoid email-validator dep
    contact_window: str | None = None


class SupportTicketRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    store_id: int
    subject_category: SupportSubject
    related_page: str | None
    body: str
    email: str
    contact_window: str | None
    status: TicketStatus
    created_at: datetime
    resolved_at: datetime | None


class SystemStatus(BaseModel):
    status: str
    checked_at: datetime


class VersionInfo(BaseModel):
    app: str
    paylight_x: str
    released_at: datetime
