"""Back-compat shim (C6): the 770-line module now lives in
app/services/ai/ (agents.py / lookup.py / mock.py / schemas.py). Existing
imports keep working through this re-export; new code should import from
app.services.ai directly.
"""

from app.services.ai import (  # noqa: F401
    DEFAULT_MODEL,
    EXTRACTION_MODEL,
    FALLBACK_SEARCH_MODEL,
    SEARCH_MODEL,
    ExtractionResult,
    FieldCandidate,
    LookupStepUsage,
    ProductLookupOutcome,
    model_can_search,
    run_product_lookup,
)
from app.services.ai.lookup import _LOOKUP_CACHE  # noqa: F401 — dev/testing hook
from app.services.ai.mock import _MOCK_CANDIDATES, _mock_lookup  # noqa: F401
