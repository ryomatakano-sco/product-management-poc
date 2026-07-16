"""AI lookup data shapes (C6 split of ai_agent.py — pure move, no logic
change): candidate/result Pydantic models and the usage/outcome dataclasses.
"""

from __future__ import annotations

from dataclasses import dataclass, field

from pydantic import BaseModel

# --- Pydantic model for extraction (internal, not persisted directly) ---

class FieldCandidate(BaseModel):
    field_name: str
    value: str
    source_url: str | None = None
    source_title: str | None = None
    confidence: float | None = None
    # Set True when a refresh (re-search) surfaces a candidate that wasn't in
    # the prior cached result. Lets the UI label what's newly found after a
    # merge. Default False; the extraction agent never sets it.
    is_new: bool = False


class ExtractionResult(BaseModel):
    found: bool
    candidates: list[FieldCandidate] = []
    raw_search_notes: str = ""


@dataclass
class LookupStepUsage:
    step: str  # "search" | "extraction"
    model: str
    input_tokens: int = 0
    output_tokens: int = 0
    cached_input_tokens: int = 0
    requests: int = 0
    cost_usd: float = 0.0
    pricing_known: bool = False


@dataclass
class ProductLookupOutcome:
    """Lookup result plus token/cost telemetry for dev tooling."""

    result: ExtractionResult
    is_mock: bool = False
    total_cost_usd: float = 0.0
    total_cost_jpy: float = 0.0
    cost_breakdown: list[LookupStepUsage] = field(default_factory=list)
    # True when this outcome was returned from the per-process cache without a
    # fresh web search. Set at the call site (the cached object itself stays
    # from_cache=False so it can be reused).
    from_cache: bool = False


