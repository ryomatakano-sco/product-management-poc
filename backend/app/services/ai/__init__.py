"""AI lookup package (C6 split of the former 770-line ai_agent.py)."""

from app.services.ai.agents import (  # noqa: F401
    DEFAULT_MODEL,
    EXTRACTION_MODEL,
    FALLBACK_SEARCH_MODEL,
    SEARCH_MODEL,
    model_can_search,
)
from app.services.ai.lookup import run_product_lookup  # noqa: F401
from app.services.ai.schemas import (  # noqa: F401
    ExtractionResult,
    FieldCandidate,
    LookupStepUsage,
    ProductLookupOutcome,
)
