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
    # Wave 1 (no-fetch) JAN-presence verification: True when the queried JAN
    # appears as a substring of source_url. Catches the Matsukiyo / Welcia /
    # Rakuten / Hands case where retailers put the JAN directly in the URL
    # path. Manufacturer-tier slug URLs won't pass this — that's the Wave 2
    # fetch-based verifier's job.
    #
    # Importantly: false here does NOT mean the candidate is bad. It just
    # means we couldn't independently confirm the JAN match cheaply.
    jan_verified: bool = False


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


# ---------------------------------------------------------------------------
# Model arena (dev-only): POST /ai-suggestions/compare
# Runs the same lookup against N models in parallel and returns side-by-side
# results so we can A/B which model produces the best recall/quality for a
# given JAN. Used by the DevPanel "🧪 AI モデル比較" tool. Not user-facing.
# ---------------------------------------------------------------------------


class AiSuggestionCompareRequest(BaseModel):
    jan: str | None = None
    title: str | None = None
    # Up to ~6 models in one call. Each model id is passed through to
    # run_product_lookup(model=...) untouched. Free-text on purpose so dev
    # can try newly-released models without a backend change.
    models: list[str]


class AiSuggestionCompareResult(BaseModel):
    """One model's lookup result. Mirrors AiSuggestionDebug per-model so the
    frontend can reuse the same column renderer."""

    model: str
    found: bool
    wall_time_ms: int
    raw_search_notes: str | None = None
    candidates: list[AiDebugCandidate] = []
    dropped_candidates: list[AiDebugDropped] = []
    error_message: str | None = None


class AiSuggestionCompare(BaseModel):
    """Top-level response for the model arena."""

    jan: str | None
    title: str | None
    strict_citation_fields: list[str]
    results: list[AiSuggestionCompareResult]
