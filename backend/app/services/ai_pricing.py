"""OpenAI token pricing estimates for dev cost reporting.

Rates are USD per 1M tokens (standard tier). Update when OpenAI changes
pricing — used by the model arena only, not billing.
"""

from __future__ import annotations

import os
import re

# (input_usd_per_1m, output_usd_per_1m) — longest keys matched first
_MODEL_PRICING_USD: dict[str, tuple[float, float]] = {
    "gpt-4.1-nano": (0.10, 0.40),
    "gpt-4.1-mini": (0.40, 1.60),
    "gpt-4.1": (2.00, 8.00),
    "gpt-4o-mini": (0.15, 0.60),
    "gpt-4o": (2.50, 10.00),
    "o4-mini": (1.10, 4.40),
    "o3-mini": (1.10, 4.40),
    "gpt-5-nano": (0.10, 0.40),
    "gpt-5-mini": (0.40, 1.60),
    "gpt-5": (1.25, 10.00),
}


def usd_jpy_rate() -> float:
    raw = os.environ.get("USD_JPY_RATE", "150").strip()
    try:
        rate = float(raw)
        return rate if rate > 0 else 150.0
    except ValueError:
        return 150.0


def _normalize_model_id(model: str) -> str:
    return re.sub(r"\s+", "", model.strip().lower())


def resolve_model_rates(model: str) -> tuple[float, float, bool]:
    """Return (input_per_1m_usd, output_per_1m_usd, pricing_known)."""
    m = _normalize_model_id(model)
    if m in _MODEL_PRICING_USD:
        inp, out = _MODEL_PRICING_USD[m]
        return inp, out, True
    for key in sorted(_MODEL_PRICING_USD, key=len, reverse=True):
        if m == key or m.startswith(f"{key}-"):
            inp, out = _MODEL_PRICING_USD[key]
            return inp, out, True
    return 0.0, 0.0, False


def estimate_token_cost_usd(
    model: str,
    *,
    input_tokens: int,
    output_tokens: int,
    cached_input_tokens: int = 0,
) -> tuple[float, bool]:
    """Estimate USD cost from token counts. Cached input billed at 50%."""
    inp_rate, out_rate, known = resolve_model_rates(model)
    if not known:
        return 0.0, False
    cached = max(0, min(cached_input_tokens, input_tokens))
    non_cached = input_tokens - cached
    cost = (
        non_cached * inp_rate
        + cached * inp_rate * 0.5
        + output_tokens * out_rate
    ) / 1_000_000
    return round(cost, 6), True
