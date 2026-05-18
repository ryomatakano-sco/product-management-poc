from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.models.ai_session import AiSessionStatus


class AiSuggestionRequest(BaseModel):
    jan: str | None = None
    title: str | None = None


class AiFieldOptionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    value: str  # mapped from value_text
    source_url: str | None
    source_title: str | None
    confidence: float | None
    position: int
    was_applied: bool


class AiSuggestionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    store_id: int
    input_jan: str | None
    input_title: str | None
    status: AiSessionStatus
    model_name: str
    options: dict[str, list[AiFieldOptionRead]] = {}
    raw_agent_log: str | None
    error_message: str | None
    created_at: datetime
    completed_at: datetime | None
    applied_to_product_id: int | None


class AiOptionApply(BaseModel):
    was_applied: bool


# ---------------------------------------------------------------------------
# Tier 2: debug endpoint — read-only inspection of the AI pipeline.
# ---------------------------------------------------------------------------


class AiDebugCandidate(BaseModel):
    """A single field candidate as returned by the extraction agent."""

    field_name: str
    value: str
    source_url: str | None
    source_title: str | None
    confidence: float | None


class AiDebugDropped(BaseModel):
    """A candidate rejected by the router's citation filter."""

    field_name: str
    value: str
    reason: str  # e.g. "missing source_url for strict-citation field"


class AiSuggestionDebug(BaseModel):
    """Response for POST /ai-suggestions/debug. Nothing persisted to DB."""

    model_used: str
    found: bool
    raw_search_notes: str | None
    candidates: list[AiDebugCandidate]
    dropped_candidates: list[AiDebugDropped]
    strict_citation_fields: list[str]
    error_message: str | None = None
