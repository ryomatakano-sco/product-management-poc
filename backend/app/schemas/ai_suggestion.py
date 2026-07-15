from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.models.ai_session import AiSessionStatus


class AiSuggestionRequest(BaseModel):
    jan: str | None = None
    title: str | None = None
    # Opt-in escalation to FALLBACK_SEARCH_MODEL (gpt-5-mini) when the primary
    # result looks unhelpful. Defaults False: the always-on fallback re-ran the
    # whole search and added ~2min to every weak lookup. Callers that want the
    # long-tail recall (and accept the latency) can set this True.
    allow_fallback: bool = False
    # Force a fresh lookup, bypassing the per-process cache. Used by the
    # "再検索する" (search again) button so a previously cached result — including
    # a cached "not found" — can be re-run. New candidates are merged into the
    # prior ones and flagged is_new in the response.
    refresh: bool = False


class AiFieldOptionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    value: str  # mapped from value_text
    source_url: str | None
    source_title: str | None
    confidence: float | None
    position: int
    was_applied: bool
    # True when this candidate first appeared in a refresh (re-search) and was
    # NOT present in the prior cached result. Transient (not stored in the DB) —
    # set only on the create response.
    is_new: bool = False


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
    # True when this result was served from the per-process cache without a
    # fresh web search (so the UI can show a "previously searched" label + a
    # 再検索 button). Transient — set on the create response only.
    from_cache: bool = False


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


class AiSuggestionCompareRequest(BaseModel):
    jan: str | None = None
    title: str | None = None
    # Up to ~6 models in one call. Each model id is passed through to
    # run_product_lookup(model=...) untouched. Free-text on purpose so dev
    # can try newly-released models without a backend change.
    models: list[str]


class AiCompareStepCost(BaseModel):
    """Per-agent-step cost (search + extraction) for one compare column."""

    step: str
    model: str
    input_tokens: int = 0
    output_tokens: int = 0
    cached_input_tokens: int = 0
    requests: int = 0
    cost_usd: float = 0
    pricing_known: bool = True


class AiSuggestionCompareResult(BaseModel):
    """One model's lookup result. One-model mirror of the removed /debug shape so the
    frontend can reuse the same column renderer."""

    model: str
    found: bool
    wall_time_ms: int
    raw_search_notes: str | None = None
    candidates: list[AiDebugCandidate] = []
    dropped_candidates: list[AiDebugDropped] = []
    error_message: str | None = None
    is_mock: bool = False
    total_cost_usd: float | None = None
    total_cost_jpy: float | None = None
    cost_breakdown: list[AiCompareStepCost] = []


class AiSuggestionCompare(BaseModel):
    """Top-level response for the model arena."""

    jan: str | None
    title: str | None
    strict_citation_fields: list[str]
    results: list[AiSuggestionCompareResult]
