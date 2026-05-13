"""Support ticket model — backs the お問い合わせ form on サポート page.

Tickets are append-only from the user's side; an internal admin tool would
flip `status` from open → in_progress → resolved. The PoC just persists
incoming form submissions so the demo's POST /support/tickets has somewhere
to go.
"""

from __future__ import annotations

import enum
from datetime import datetime

from sqlalchemy import BigInteger, DateTime, Enum, ForeignKey, Index, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class SupportSubject(str, enum.Enum):
    bug = "bug"          # 不具合報告
    feature = "feature"  # 機能要望
    howto = "howto"      # 操作方法
    other = "other"      # その他


class TicketStatus(str, enum.Enum):
    open = "open"
    in_progress = "in_progress"
    resolved = "resolved"


class SupportTicket(Base):
    __tablename__ = "support_tickets"
    __table_args__ = (
        Index("ix_support_tickets_store_id", "store_id"),
        Base.__table_args__,
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    store_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("stores.id"), nullable=False)

    subject_category: Mapped[SupportSubject] = mapped_column(
        Enum(SupportSubject, name="support_subject_enum"), nullable=False,
    )
    related_page: Mapped[str | None] = mapped_column(String(64), nullable=True,
        comment="One of the 12 page slugs (dashboard, products, …) or null.")
    body: Mapped[str] = mapped_column(Text, nullable=False)
    email: Mapped[str] = mapped_column(String(255), nullable=False)
    contact_window: Mapped[str | None] = mapped_column(String(64), nullable=True,
        comment="Free-text like 「平日 10:00–17:00」.")
    status: Mapped[TicketStatus] = mapped_column(
        Enum(TicketStatus, name="ticket_status_enum"),
        default=TicketStatus.open, nullable=False,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False,
    )
    resolved_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True,
    )
