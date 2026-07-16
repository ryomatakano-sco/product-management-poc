"""Agent construction + model policy (C6 split of ai_agent.py).

Model constants, the can-this-model-web-search allow-list, per-model tool /
settings shims, the master-list prompt block, and the search / extraction
agent factories. The OpenAI Agents SDK is imported inside the factories so
mock-mode never pays the import.
"""

from __future__ import annotations

import logging
import os

logger = logging.getLogger(__name__)

# Model selection — kept split so we can use a cheap model for the trivial
# extraction step without compromising search quality.
#
# - SEARCH_MODEL drives the WebSearchTool agent. It needs decent reasoning and
#   solid Japanese to follow the prompt; gpt-4.1-mini is the sweet spot
#   (~5x cheaper than gpt-4.1 with no observable quality drop for this PoC).
# - EXTRACTION_MODEL does plain text -> JSON at temperature 0. That's the
#   easiest possible LLM task, so gpt-4.1-nano (cheapest of the 4.1 family)
#   is enough.
#
# DEFAULT_MODEL is kept as an alias so the existing import in
# routers/ai_suggestions.py (which records it as the session's `model_name`)
# keeps working without changes.
# Default ladder picked from the 2026-05-21 dev-arena data:
#   - Interactive default: gpt-4.1 — allow-list compliant, finds every easy
#     JAN we tested, ~$0.05 / ~38s. The right balance for live "AI lookup"
#     clicks where Yoshioka-grade demo correctness matters.
#   - Fallback: gpt-5-mini — kicks in when gpt-4.1 returns nothing useful.
#     Cheaper than full gpt-5 (~$0.029 vs ~$0.167) with the same honest
#     "this JAN is the discontinued sibling, here's what I actually found"
#     reasoning that wins on rare/long-tail SKUs. Allow-list compliant too.
#   - Extraction: gpt-4.1-nano — pure text→JSON at temp=0, model choice is
#     irrelevant beyond "cheap and reliable JSON output".
# Override at runtime via the dev-arena "+ 任意のモデル ID" box or the
# `model`/`extraction_model` kwargs on run_product_lookup.
SEARCH_MODEL = "gpt-4.1"
FALLBACK_SEARCH_MODEL = "gpt-5-mini"
EXTRACTION_MODEL = "gpt-4.1-nano"
DEFAULT_MODEL = SEARCH_MODEL



# `MODEL_NO_WEB_SEARCH` lists models that can't act as a search agent at all.
# `MODEL_NO_TEMPERATURE` lists models that reject ModelSettings(temperature=...).
# `MODEL_NO_SEARCH_FILTERS` lists models that accept web search but not the
#   GA `filters` parameter (so we fall back to bare WebSearchTool — no allow-
#   list, but at least the tool runs).
# ---------------------------------------------------------------------------
MODEL_NO_WEB_SEARCH: frozenset[str] = frozenset({
    # nano variants and the o3-mini reasoning model can't use any web search.
    # Discovered via arena runs 2026-05-21:
    #   o3-mini  → "Tool 'web_search_preview' is not supported with o3-mini"
    "gpt-4.1-nano",
    "gpt-5-nano",
    "o3-mini",
})
MODEL_NO_SEARCH_FILTERS: frozenset[str] = frozenset({
    # mini variants accept WebSearchTool() but reject the `filters` parameter
    # that promotes it to the GA tool. They run on the preview tool with no
    # allow-list. Discovered 2026-05-21 via arena:
    #   gpt-4o-mini  → "Parameter 'filters' not supported with model 'gpt-4o-mini'"
    "gpt-4.1-mini",
    "gpt-4o-mini",
    "gpt-5-mini",
})
MODEL_NO_TEMPERATURE: frozenset[str] = frozenset({
    # GPT-5 family reject ModelSettings(temperature=…).
    # o4-mini accepts temperature (verified via arena, it ran successfully
    # with our default temperature=0.1). o3-mini probably does too, but
    # it can't web-search so we never construct a search agent for it.
    "gpt-5",
    "gpt-5-mini",
    "gpt-5-nano",
})


def model_can_search(model: str) -> bool:
    """True when this model can be used as the search-agent's LLM."""
    return model not in MODEL_NO_WEB_SEARCH


def _search_tool_for(model: str):
    """Build the WebSearchTool with the right kwargs for this model.

    Returns ``None`` when the model can't do web search at all — callers
    should refuse to construct a search agent in that case.
    """
    from agents import WebSearchTool
    from agents.tool import WebSearchToolFilters
    if model in MODEL_NO_WEB_SEARCH:
        return None
    if model in MODEL_NO_SEARCH_FILTERS:
        # The mini variants can't take filters → fall back to the preview
        # tool. The agent will still search the open web; just no allow-list.
        return WebSearchTool()
    # Full 4.1 / gpt-5 / future models that accept the GA tool surface.
    return WebSearchTool(
        filters=WebSearchToolFilters(allowed_domains=_ALLOWED_DOMAINS),
        user_location={
            "type": "approximate",
            "country": "JP",
            "city": "Tokyo",
            "timezone": "Asia/Tokyo",
        },
        search_context_size="high",
    )


def _model_settings_for(model: str, temperature: float):
    """ModelSettings with temperature omitted for models that reject it."""
    from agents import ModelSettings
    if model in MODEL_NO_TEMPERATURE:
        return ModelSettings()  # use the model's own defaults
    return ModelSettings(temperature=temperature)


# Search allow-list — hostnames only (subdomains included automatically per
# OpenAI's web_search guide). Sourced verbatim from the 2026-05-20 research
# report `jan-lookup-upgrade.md` Deliverable 1. Tiered by trust:
#   T1 manufacturer official → T2 dental dealers → T3 e-commerce
#   → T4 drugstore chains → T5 wholesale aggregators
#
# Passing this via WebSearchTool(filters={"allowed_domains": [...]}) switches
# the underlying tool from the legacy `web_search_preview` (which silently
# ignores filters) to the GA `web_search` (which enforces them). Limit is
# 100; we currently use 36, well within budget for adding more later.
#
# When updating: keep order T1 → T5 so the model's first-result preference
# correlates with our trust ordering.
_ALLOWED_DOMAINS: list[str] = [
    # Tier 1 — Manufacturer official sites
    "jp.sunstar.com",
    "jp.sunstargum.com",
    "clinica.lion.co.jp",
    "systema.lion.co.jp",
    "www.lion.co.jp",
    "www.lion-dent.co.jp",
    "www.gc.dental",
    "www.gcdental.co.jp",
    "www.shofu.co.jp",
    "www.tokuyama-dental.co.jp",
    "www.morita.com",
    "japan.morita.com",
    "www.dental-plaza.com",
    # Tier 2 — Authorised dental dealers
    "www.ci-medical.com",
    "ci-medical.co.jp",
    "www.dental-fit.com",
    "www.yoshida-dental.co.jp",
    "www.tanakadental.co.jp",
    # Tier 3 — Major Japanese e-commerce (URL often contains JAN).
    # Bare "rakuten.co.jp" covers *.rakuten.co.jp subdomains (per OpenAI web
    # search docs, subdomains are included automatically). Specific Rakuten
    # subdomains kept for clarity but are redundant under the bare entry.
    "rakuten.co.jp",
    "item.rakuten.co.jp",
    "netsuper.rakuten.co.jp",
    "search.rakuten.co.jp",
    "www.amazon.co.jp",
    "shopping.yahoo.co.jp",
    "store.shopping.yahoo.co.jp",
    "paypay.ne.jp",                        # PayPay Mall — major Tier 3a hit source
    "www.yodobashi.com",
    "www.biccamera.com",                   # Bic Camera — verified Tier 3a hit
    "www.ec-current.com",                  # EC Current (Joshin) — verified Tier 3a hit
    "hands.net",
    "www.askul.co.jp",
    "www.lohaco.jp",                       # Askul consumer arm
    # Tier 4 — Drugstore chains (URL often contains JAN)
    "www.matsukiyo.co.jp",
    "www.matsukiyococokara-online.com",
    "www.welcia-yakkyoku.co.jp",
    "shop.tsuruha.co.jp",
    "www.cocokarafine.co.jp",
    "www.sugi-net.jp",
    "www.cosmospc.co.jp",
    # Tier 5 — Wholesale / B2B aggregators
    "www.super-delivery.com",
    "www.oroshi-uri.com",
    "www.netsea.jp",
]


def _ai_enabled() -> bool:
    """Real OpenAI only when a key is set AND MOCK_AI is not explicitly 1."""
    if os.environ.get("MOCK_AI", "").strip() == "1":
        return False
    key = os.environ.get("OPENAI_API_KEY", "").strip()
    return bool(key)




def _master_list_block(
    categories: list[str] | None,
    vendors: list[str] | None,
) -> str:
    """Build the per-store master-list injection appended to the search prompt.

    Item-3 (Fukunaga 2026-05-29): instead of letting the model free-generate
    brand/category — which then fails the client-side exact match against the
    store's master spelling (歯磨剤 vs 歯磨き粉, サンスター株式会社 vs サンスター)
    — we inject the store's actual category + vendor names and instruct the
    model to pick the EXACT string from the list when one applies.

    Returns "" when neither list is provided, so callers that don't pass lists
    get the original prompt verbatim (no behaviour change for them).
    """
    cats = [c for c in (categories or []) if c and c.strip()]
    vends = [v for v in (vendors or []) if v and v.strip()]
    if not cats and not vends:
        return ""
    lines = [
        "",
        "## マスタ参照（重要）",
        "以下はこの店舗に登録済みのマスタ一覧です。`category` と `brand` は、"
        "**一覧に該当する項目があれば、リスト内の表記をそのまま（一字一句）使用**"
        "してください。一覧の表記とウェブ上の表記が異なる場合（例: 「歯磨き粉」→"
        "「歯磨剤」、「サンスター株式会社」→「サンスター」）も、必ず一覧側の表記に"
        "合わせてください。該当が無い場合のみ、ウェブ上の名称を使用して構いません。",
    ]
    if cats:
        lines.append("")
        lines.append("### 利用可能なカテゴリ一覧:")
        lines.append("[" + ", ".join(cats) + "]")
    if vends:
        lines.append("")
        lines.append("### 利用可能な仕入先一覧:")
        lines.append("[" + ", ".join(vends) + "]")
    lines.append("")
    return "\n".join(lines)


def _create_search_agent(model: str, master_list_block: str = ""):
    """Construct the web-search agent for `model`.

    Tool kwargs are selected via _search_tool_for(model) and ModelSettings
    via _model_settings_for so each model's per-API quirks are honoured.
    Raises ValueError if the model can't do web search at all — caller
    should surface this as a per-model error rather than crashing the run.

    ``master_list_block`` (item-3) is appended to the system prompt so the
    agent can pick canonical category/vendor names from the store's master
    list. Empty string → original prompt unchanged.
    """
    from agents import Agent
    tool = _search_tool_for(model)
    if tool is None:
        raise ValueError(
            f"model '{model}' does not support web search "
            "(see MODEL_NO_WEB_SEARCH). Use it as an extraction model only."
        )
    instructions = SEARCH_SYSTEM_PROMPT + master_list_block
    return Agent(
        name="Product Search Agent",
        instructions=instructions,
        model=model,
        tools=[tool],
        model_settings=_model_settings_for(model, temperature=0.1),
    )


def _create_extraction_agent(model: str):
    from agents import Agent  # lazy
    return Agent(
        name="Product Data Extractor",
        instructions=EXTRACTION_SYSTEM_PROMPT,
        model=model,
        output_type=ExtractionResult,
        model_settings=_model_settings_for(model, temperature=0.0),
    )


