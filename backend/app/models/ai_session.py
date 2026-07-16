from __future__ import annotations

import enum
from datetime import datetime

from sqlalchemy import (
    BigInteger,
    Boolean,
    DateTime,
    Enum,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class AiSessionStatus(str, enum.Enum):
    pending = "pending"
    completed = "completed"
    failed = "failed"


class AiSuggestionSession(Base):
    """Audit trail for AI product suggestions.

    Records what the AI was asked, what it found, and which product (if any)
    was ultimately created from the suggestions.
    """

    __tablename__ = "ai_suggestion_sessions"
    __table_args__ = (
        Index("ix_ai_sessions_store", "store_id"),
        Base.__table_args__,
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    store_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("stores.id"), nullable=False)
    input_jan: Mapped[str | None] = mapped_column(String(50), nullable=True)
    input_title: Mapped[str | None] = mapped_column(String(500), nullable=True)
    status: Mapped[AiSessionStatus] = mapped_column(
        Enum(AiSessionStatus), default=AiSessionStatus.pending, nullable=False
    )
    model_name: Mapped[str] = mapped_column(String(100), nullable=False)
    raw_agent_log: Mapped[str | None] = mapped_column(Text, nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    completed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    applied_to_product_id: Mapped[int | None] = mapped_column(
        BigInteger, ForeignKey("products.id"), nullable=True
    )

    field_options: Mapped[list["AiSuggestionFieldOption"]] = relationship(
        back_populates="session", cascade="all, delete-orphan"
    )
    applied_to_product: Mapped["Product | None"] = relationship(  # noqa: F821
        foreign_keys=[applied_to_product_id],
    )


class AiSuggestionFieldOption(Base):
    """Individual AI-suggested field values with sources.

    The frontend renders these as 'AI found N candidates for [field], pick one.'
    `was_applied` is set to true when the user clicks 'apply' on a suggestion.
    """

    __tablename__ = "ai_suggestion_field_options"
    __table_args__ = (
        Index("ix_ai_options_session", "session_id"),
        Base.__table_args__,
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    session_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("ai_suggestion_sessions.id"), nullable=False
    )
    field_name: Mapped[str] = mapped_column(
        String(50), nullable=False,
        comment="e.g. title, description, brand, category, indications, weight, image_url",
    )
    value_text: Mapped[str] = mapped_column(
        Text, nullable=False,
        comment="Always stored as text; JSON-encode lists like indications or image_urls",
    )
    source_url: Mapped[str | None] = mapped_column(String(2000), nullable=True)
    source_title: Mapped[str | None] = mapped_column(String(500), nullable=True)
    confidence: Mapped[float | None] = mapped_column(Float, nullable=True)
    position: Mapped[int] = mapped_column(
        Integer, nullable=False, comment="Display order, lower = better candidate"
    )
    was_applied: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    session: Mapped["AiSuggestionSession"] = relationship(back_populates="field_options")


class AiCorrection(Base):
    """AI-vs-final telemetry (mig 020, review A5).

    One row per (product-save, AI-suggested field): the AI's top candidate vs
    what the user actually saved. `accepted` = the values agree after
    normalization. Written best-effort on product create — a telemetry failure
    must never block a save (see products.record_ai_corrections).
    """

    __tablename__ = "ai_corrections"
    __table_args__ = (
        Index("ix_ai_corrections_store_created", "store_id", "created_at"),
        Index("ix_ai_corrections_store_field", "store_id", "field_name"),
        Base.__table_args__,
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    store_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("stores.id"), nullable=False)
    session_id: Mapped[int | None] = mapped_column(
        BigInteger, ForeignKey("ai_suggestion_sessions.id"), nullable=True
    )
    product_id: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    input_jan: Mapped[str | None] = mapped_column(String(50), nullable=True)
    input_title: Mapped[str | None] = mapped_column(String(500), nullable=True)
    field_name: Mapped[str] = mapped_column(String(50), nullable=False)
    ai_value: Mapped[str | None] = mapped_column(String(500), nullable=True)
    final_value: Mapped[str | None] = mapped_column(String(500), nullable=True)
    accepted: Mapped[bool] = mapped_column(Boolean, nullable=False)
    model_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
