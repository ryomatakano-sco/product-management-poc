"""AI agent for product data extraction.

Uses the two-agent pattern from the JAN PoC (web search → structured extraction)
adapted to return multiple candidates per field with sources.

When ``OPENAI_API_KEY`` is unset (or ``MOCK_AI=1`` is in the environment),
``run_product_lookup`` returns canned mock data instead of calling OpenAI.
This lets the PoC run end-to-end without an API key and without spending money
on every dev click. Set the key (and unset MOCK_AI) to use the real agents.
"""

from __future__ import annotations

import logging
import os
from dataclasses import dataclass, field, replace

from pydantic import BaseModel

from app.services.ai_pricing import estimate_token_cost_usd, usd_jpy_rate

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


def _looks_unhelpful(result: "ExtractionResult") -> bool:
    """Heuristic: did the primary search agent fail to return anything we
    can show to the user?

    Triggers the FALLBACK_SEARCH_MODEL escalation. Conservative on purpose —
    we only escalate when the result is *clearly* useless, because the
    fallback adds ~$0.03 and ~2min to the call. Specifically:
      - found=false, or
      - zero candidates, or
      - every candidate is missing a source_url (the gpt-4.1-mini-style
        hallucination pattern seen on JAN 4901616008359).
    """
    if not getattr(result, "found", False):
        return True
    cands = list(result.candidates or [])
    if not cands:
        return True
    if all(not c.source_url for c in cands):
        return True
    return False


# ---------------------------------------------------------------------------
# Per-model capability matrix.
#
# Discovered empirically via the dev arena 2026-05-21:
#   - gpt-4.1 (full): accepts WebSearchTool(filters=..., user_location=...,
#     search_context_size=...). Accepts temperature.
#   - gpt-4.1-mini: REJECTS `filters` parameter ("Parameter 'filters' not
#     supported with model 'gpt-4.1-mini'"). Can still use bare WebSearchTool
#     (the preview tool), just without filters. Accepts temperature.
#   - gpt-4.1-nano: REJECTS web search entirely ("Tool 'web_search_preview'
#     is not supported with gpt-4.1-nano"). Extraction-only.
#   - gpt-5 / gpt-5-mini / gpt-5-nano: REJECT `temperature` parameter
#     ("Unsupported parameter: 'temperature' is not supported with this model").
#     Web-search capability is the same as 4.1 family.
#
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


# ---------------------------------------------------------------------------
# Per-process lookup cache.
#
# A single JAN often gets looked up repeatedly in one editing session (user
# clicks "AI lookup", closes the modal, reopens it; dev arena re-runs the same
# code). Each miss is a full search + extraction (~38s+). The inputs fully
# determine the output, so caching by the input tuple is accuracy-neutral:
# identical args → identical result, just without the LLM round-trips.
#
# Bounded FIFO (cap 256) so a long-lived process can't grow unbounded. Mock
# results are never cached (cheap to recompute, and we want mock toggling to
# take effect immediately). Process-local on purpose — keeps the PoC simple;
# a cross-process/Redis cache is listed as "proposed, not done" in the audit.
# ---------------------------------------------------------------------------
_LOOKUP_CACHE: "dict[tuple, ProductLookupOutcome]" = {}
_LOOKUP_CACHE_MAX = 256


def _cache_key(
    jan: str | None,
    title: str | None,
    model: str | None,
    extraction_model: str | None,
    allow_fallback: bool,
) -> tuple:
    return (jan, title, model, extraction_model, allow_fallback)


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


def _usage_from_run(run_result, model: str, step: str) -> LookupStepUsage:
    u = run_result.context_wrapper.usage
    cached = 0
    if u.input_tokens_details is not None:
        cached = getattr(u.input_tokens_details, "cached_tokens", 0) or 0
    cost_usd, known = estimate_token_cost_usd(
        model,
        input_tokens=u.input_tokens,
        output_tokens=u.output_tokens,
        cached_input_tokens=cached,
    )
    return LookupStepUsage(
        step=step,
        model=model,
        input_tokens=u.input_tokens,
        output_tokens=u.output_tokens,
        cached_input_tokens=cached,
        requests=u.requests,
        cost_usd=cost_usd,
        pricing_known=known,
    )


def _outcome_from_steps(
    result: ExtractionResult,
    steps: list[LookupStepUsage],
    *,
    is_mock: bool,
) -> ProductLookupOutcome:
    total_usd = round(sum(s.cost_usd for s in steps), 6)
    return ProductLookupOutcome(
        result=result,
        is_mock=is_mock,
        total_cost_usd=total_usd,
        total_cost_jpy=round(total_usd * usd_jpy_rate(), 2),
        cost_breakdown=steps,
    )


def _cand_key(c: "FieldCandidate") -> tuple[str, str]:
    return (c.field_name, (c.value or "").strip())


def _merge_outcomes(
    prev: ProductLookupOutcome, fresh: ProductLookupOutcome
) -> ProductLookupOutcome:
    """Merge a refresh result into the previous cached one.

    Keeps every prior candidate (so a re-search never loses what was found
    before) and appends candidates that are new this time, flagged ``is_new``.
    The merged result carries the FRESH search's cost (that's what we paid now).
    """
    old = [c.model_copy(update={"is_new": False}) for c in prev.result.candidates]
    old_keys = {_cand_key(c) for c in old}
    additions = [
        c.model_copy(update={"is_new": True})
        for c in fresh.result.candidates
        if _cand_key(c) not in old_keys
    ]
    merged = ExtractionResult(
        found=bool(fresh.result.found or prev.result.found),
        candidates=old + additions,
        raw_search_notes=fresh.result.raw_search_notes or prev.result.raw_search_notes,
    )
    return ProductLookupOutcome(
        result=merged,
        is_mock=False,
        total_cost_usd=fresh.total_cost_usd,
        total_cost_jpy=fresh.total_cost_jpy,
        cost_breakdown=fresh.cost_breakdown,
    )


# --- System prompts ---

SEARCH_SYSTEM_PROMPT = """\
あなたは日本の歯科医院向け商品データ抽出エージェントです。

## タスク
ユーザーから渡された商品情報（JANコードや商品名）をウェブ検索し、該当する歯科関連商品の情報を可能な限り収集してください。

## 絶対ルール
1. **必ずウェブ検索を行うこと。** 事前知識だけで回答してはいけません。
2. 検索して見つけた情報には、必ずその情報が掲載されていたページのURLを併記してください。
3. URLを併記できない情報は報告しないでください。

## 情報ソースの優先順位
1. メーカー公式サイト
2. 歯科専門ディーラー（Ciモール、ヨシダ、デンタリード等）
3. 大手ECサイト（Amazon JP、楽天、ヨドバシ等）
4. アグリゲーター・比較サイト

## 収集する項目（見つかった場合のみ）
各項目について、**異なるソースから最大3つの候補を収集**してください。

- 商品名・正式名称（title）
- 商品名カナ読み（name_kana）— これのみモデル推定OK（読み変換のため）
- メーカー / ブランド（brand）
- 商品説明 1-3文（description）— **重要: 必ず自分の言葉で再構成して記述すること。**
  収集した複数ソースの事実（用途・特徴・対象・成分など）をもとに、1〜3文の
  オリジナルの説明文を**新たに作文**してください。商品ページの紹介文・キャッチ
  コピー・説明文を**そのまま（逐語的に）転記・コピーすることは禁止**します
  （著作権上の理由）。文の構成・語順・言い回しは原文と明確に変え、事実のみを
  反映させてください。原文の特徴的なフレーズをそのまま流用しないこと。
  description には URL を併記しなくて構いません（合成テキストのため）。
- カテゴリ: 歯ブラシ / 歯間ブラシ / フロス / 洗口液 / 歯磨剤 / その他（category）
- 適応・用途（indications）: 歯周病, 知覚過敏, インプラント周囲, 矯正中, 子供用, 高齢者, ドライマウス 等 — **商品ページに明記されている場合のみ**
- JANコード / バーコード番号（barcode）
- 重量（weight）— g 単位で
- 原産国（country_of_origin）
- 価格（price）— 税込 or 税抜を明記
- 画像URL（image_url）— ダウンロードしない、URLだけ記録

## 出力フォーマット
各項目を箇条書きで、ソースごとに分けて記載：
```
- title:
  - 候補1: [値] [URL] [ソースタイトル]
  - 候補2: [値] [URL] [ソースタイトル]
- brand:
  - 候補1: [値] [URL] [ソースタイトル]
```

該当商品が見つからなかった場合は「該当商品なし」と明記。
最後に「検索ノート」を記載。

すべての人間が読むテキストは日本語で出力してください。
"""

EXTRACTION_SYSTEM_PROMPT = """\
あなたは構造化データ抽出エージェントです。
ウェブ検索エージェントが収集したテキストレポートを受け取り、ExtractionResult スキーマに変換してください。

## ルール
1. URL併記ポリシーはフィールドごとに異なります:
   - **厳格フィールド**（URLが必須。URL無しの候補は除外してください）: `price`, `weight`, `image_url`, `fluoride_ppm`, `dimensions`
   - **緩和フィールド**（URLは推奨。URL無しでも採用可、その場合 source_url は空欄のまま）: `title`, `name_kana`, `brand`, `description`, `category`, `indications`, `barcode`, `country_of_origin`, `head_size`, `bristle_hardness`
   緩和フィールドは、検索エージェントのレポート本文に値が記載されていれば、個別URLが併記されていなくても候補として残してください。検証可能な数値・価格・画像は依然としてURLが必要です。
2. found フィールド: 該当商品が見つかったかどうか。
3. candidates リストに、見つかった各フィールドの各候補を FieldCandidate として追加。
4. field_name は以下のいずれか: title, name_kana, brand, description, category, indications, barcode, weight, country_of_origin, price, image_url
5. indications のように複数値がある場合は、JSON配列文字列として value に格納（例: '["歯周病", "知覚過敏"]'）。
6. image_url のように複数ある場合も同様に JSON配列文字列。
7. confidence は 0.0〜1.0 でソースの信頼度を推定。URL無しの緩和フィールド候補は 0.6 以下にしてください。
   **ただし `description` は例外。** description は検索エージェントが複数ソースの事実から
   意図的に再構成した合成テキストであり、単一の URL を持たないのが正常です。URL が無いことを
   理由に減点しないでください。description の confidence は、元になった事実の裏付けの強さで
   評価してください（裏付けが十分なら 0.8 前後でも可）。source_url は空欄のままで構いません。
8. raw_search_notes に検索ノートをそのままコピー。
"""


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


async def run_product_lookup(
    jan: str | None = None,
    title: str | None = None,
    model: str | None = None,
    extraction_model: str | None = None,
    allow_fallback: bool = False,
    categories: list[str] | None = None,
    vendors: list[str] | None = None,
    refresh: bool = False,
) -> ProductLookupOutcome:
    """Run the two-agent pipeline for product data extraction.

    Returns a ProductLookupOutcome (result + per-step token/cost telemetry).
    Falls back to ``_mock_lookup`` when ``OPENAI_API_KEY`` is unset.

    ``categories`` / ``vendors`` (item-3) are the store's master-list names.
    When provided, they are injected into the search prompt so the agent picks
    canonical category/brand spellings from the list rather than free-generating
    web variants. Both default to None → original prompt, no behaviour change.

    ``model`` overrides ``SEARCH_MODEL`` (the web-search agent), and
    ``extraction_model`` overrides ``EXTRACTION_MODEL`` (the structured-output
    agent). Both default to their module-level constants — see the comments
    near the top of this file for the rationale.

    ``allow_fallback`` is **opt-in (default False)**. It used to default True,
    which meant every weak primary result silently re-ran the *entire* search +
    extraction on ``FALLBACK_SEARCH_MODEL`` (gpt-5-mini) — ~$0.03 and ~2 min
    added to the call. Now a caller must explicitly ask for that long-tail
    recall. When True and the caller did not override ``model``, an unhelpful
    primary result (see ``_looks_unhelpful``) is retried with the fallback
    model; its candidates replace the primary's and the cost breakdown carries
    both steps. The compare arena passes False to keep each column single-model.

    Identical-input lookups are served from a per-process cache
    (``_LOOKUP_CACHE``); real results are cached, mock results are not.

    ``refresh`` forces a fresh web search, bypassing the cache read (used by the
    "再検索する" button so a stale cached result — including a cached "not found"
    — can be re-run). On refresh, candidates that are NEW relative to the prior
    cached result are merged in and flagged ``is_new``; the merged result becomes
    the new cache baseline. Cache hits set ``from_cache=True`` on the returned
    outcome (the cached object itself stays ``from_cache=False`` for reuse).
    """
    if not _ai_enabled():
        logger.info("AI lookup running in MOCK mode (no OPENAI_API_KEY)")
        return _outcome_from_steps(_mock_lookup(jan=jan, title=title), [], is_mock=True)

    # Build the master-list prompt block once; fold it into the cache key so a
    # different store's lists don't collide with another store's cached result.
    master_block = _master_list_block(categories, vendors)
    cache_key = _cache_key(jan, title, model, extraction_model, allow_fallback) + (master_block,)
    prev = _LOOKUP_CACHE.get(cache_key)
    if prev is not None and not refresh:
        logger.info("AI lookup cache HIT for jan=%s title=%s", jan, title)
        return replace(prev, from_cache=True)
    if refresh:
        logger.info("AI lookup REFRESH (bypassing cache) for jan=%s title=%s", jan, title)

    def _store(outcome: ProductLookupOutcome) -> ProductLookupOutcome:
        # On refresh, merge any newly-found candidates into the previous result
        # so we never lose what was found before, and flag the additions.
        if refresh and prev is not None:
            outcome = _merge_outcomes(prev, outcome)
        if len(_LOOKUP_CACHE) >= _LOOKUP_CACHE_MAX:
            # FIFO evict the oldest entry (dicts preserve insertion order).
            _LOOKUP_CACHE.pop(next(iter(_LOOKUP_CACHE)))
        # Store a clean copy (from_cache False) so future hits flag themselves.
        _LOOKUP_CACHE[cache_key] = replace(outcome, from_cache=False)
        return outcome

    from agents import Runner  # lazy

    extract_model = extraction_model or EXTRACTION_MODEL
    extraction_agent = _create_extraction_agent(extract_model)

    parts = []
    if jan:
        parts.append(f"JANコード: {jan}")
    if title:
        parts.append(f"商品名: {title}")
    query = "\n".join(parts) + "\nこの商品を検索して情報を収集してください。"

    async def _run_search(search_model: str, step_label: str) -> tuple[str, LookupStepUsage]:
        agent = _create_search_agent(search_model, master_list_block=master_block)
        run_res = await Runner.run(agent, query)
        return run_res.final_output, _usage_from_run(run_res, search_model, step_label)

    primary_model = model or SEARCH_MODEL
    user_override = model is not None and model != SEARCH_MODEL

    raw_text, primary_usage = await _run_search(primary_model, "search")
    usages: list[LookupStepUsage] = [primary_usage]

    extraction_input = f"検索クエリ: {query}\n\n以下は検索エージェントの出力です:\n\n{raw_text}"
    extraction_result = await Runner.run(extraction_agent, extraction_input)
    extract_usage = _usage_from_run(extraction_result, extract_model, "extraction")
    usages.append(extract_usage)
    primary_extraction: ExtractionResult = extraction_result.final_output

    # Fallback ladder: gpt-4.1 → gpt-5-mini. Only escalates when (a) the
    # caller didn't pin a specific model (arena compare passes its own
    # model with allow_fallback=False) and (b) the primary clearly missed.
    should_fallback = (
        allow_fallback
        and not user_override
        and FALLBACK_SEARCH_MODEL
        and FALLBACK_SEARCH_MODEL != primary_model
        and _looks_unhelpful(primary_extraction)
    )
    if not should_fallback:
        return _store(_outcome_from_steps(primary_extraction, usages, is_mock=False))

    logger.info(
        "AI lookup: primary model %s returned unhelpful result for jan=%s title=%s; "
        "escalating to %s",
        primary_model, jan, title, FALLBACK_SEARCH_MODEL,
    )
    try:
        fb_text, fb_usage = await _run_search(FALLBACK_SEARCH_MODEL, "search_fallback")
        usages.append(fb_usage)
        fb_extraction_input = (
            f"検索クエリ: {query}\n\n以下は検索エージェントの出力です:\n\n{fb_text}"
        )
        fb_extraction = await Runner.run(extraction_agent, fb_extraction_input)
        usages.append(_usage_from_run(fb_extraction, extract_model, "extraction_fallback"))
        fb_result: ExtractionResult = fb_extraction.final_output
        # Only adopt the fallback if it actually improved things — otherwise
        # keep the primary so dev tooling sees the original signal.
        winner = fb_result if not _looks_unhelpful(fb_result) else primary_extraction
        return _store(_outcome_from_steps(winner, usages, is_mock=False))
    except Exception as e:  # noqa: BLE001 — fallback must never crash the call
        logger.warning("Fallback model %s failed: %s", FALLBACK_SEARCH_MODEL, e)
        return _store(_outcome_from_steps(primary_extraction, usages, is_mock=False))


# --- Mock fallback ------------------------------------------------------------

# Canned candidates returned when no OpenAI key is configured. Shape matches
# what the real agents would return: each candidate has a value, a source_url,
# a source_title, and a confidence. The router persists these the same way it
# would persist real ones, so the UI flow (modal → field options → apply) is
# identical regardless of whether AI is real or mocked.
_MOCK_CANDIDATES: list[FieldCandidate] = [
    FieldCandidate(
        field_name="title",
        value="パナビア V5 ペースト 2.5g (Aユニバーサル)",
        source_url="https://mock.example.jp/panavia-v5",
        source_title="クラレノリタケデンタル — 製品ページ (モック)",
        confidence=0.94,
    ),
    FieldCandidate(
        field_name="title",
        value="PANAVIA V5 Paste 2.5g A-Universal",
        source_url="https://mock.example.jp/jandb",
        source_title="JAN データベース (モック)",
        confidence=0.81,
    ),
    FieldCandidate(
        field_name="name_kana",
        value="パナビア ブイファイブ ペースト",
        confidence=0.85,
    ),
    FieldCandidate(
        field_name="brand",
        value="クラレノリタケデンタル",
        source_url="https://mock.example.jp/panavia-v5",
        source_title="メーカー公式 (モック)",
        confidence=0.96,
    ),
    FieldCandidate(
        field_name="category",
        value="修復材",
        source_url="https://mock.example.jp/dict",
        source_title="分類辞書 (モック)",
        confidence=0.92,
    ),
    FieldCandidate(
        field_name="barcode",
        value="4548611112233",
        source_url="https://mock.example.jp/jandb",
        source_title="JAN データベース (モック)",
        confidence=0.99,
    ),
    FieldCandidate(
        field_name="price",
        value="12800",
        source_url="https://mock.example.jp/supply",
        source_title="dental-supply.example.jp (モック)",
        confidence=0.71,
    ),
    FieldCandidate(
        field_name="description",
        value=(
            "デュアルキュア型レジンセメント。クラウン・ブリッジ・インレー・"
            "オンレー・ベニアの接着、ポストコアの装着に。"
        ),
        source_url="https://mock.example.jp/panavia-v5",
        source_title="クラレノリタケデンタル — 製品ページ (モック)",
        confidence=0.88,
    ),
]


def _mock_lookup(jan: str | None, title: str | None) -> ExtractionResult:
    """Deterministic mock data used when OPENAI_API_KEY is not set.

    The data is intentionally similar to the prototype's MOCK_AI_SUGGESTIONS
    so the demo experience matches what the design called for.
    """
    note_lines = ["[MOCK MODE] OPENAI_API_KEY is not set — returning canned data."]
    if jan:
        note_lines.append(f"  · 受け取った JAN: {jan}")
    if title:
        note_lines.append(f"  · 受け取った商品名: {title}")
    note_lines.append(
        "  · 実際の AI ルックアップを試すには .env に OPENAI_API_KEY を設定してください。"
    )
    return ExtractionResult(
        found=True,
        candidates=list(_MOCK_CANDIDATES),
        raw_search_notes="\n".join(note_lines),
    )
