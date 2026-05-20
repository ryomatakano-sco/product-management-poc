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

from pydantic import BaseModel

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
SEARCH_MODEL = "gpt-4.1-mini"
EXTRACTION_MODEL = "gpt-4.1-nano"
DEFAULT_MODEL = SEARCH_MODEL


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


# --- Pydantic model for extraction (internal, not persisted directly) ---

class FieldCandidate(BaseModel):
    field_name: str
    value: str
    source_url: str | None = None
    source_title: str | None = None
    confidence: float | None = None


class ExtractionResult(BaseModel):
    found: bool
    candidates: list[FieldCandidate] = []
    raw_search_notes: str = ""


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
- 商品説明 1-3文（description）
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
8. raw_search_notes に検索ノートをそのままコピー。
"""


def _create_search_agent(model: str):
    # Lazy imports because the agents package is optional in mock mode.
    from agents import Agent, ModelSettings, WebSearchTool
    from agents.tool import WebSearchToolFilters
    # Passing filters/user_location/search_context_size promotes the tool
    # from `web_search_preview` (which silently ignores filters) to GA
    # `web_search`. NOTE: `filters` must be the WebSearchToolFilters
    # Pydantic model — a plain dict silently passes the constructor but
    # blows up later in OpenAIResponsesModel._build_response_create_kwargs
    # ("'dict' object has no attribute 'model_dump'"). `user_location` is
    # a TypedDict and accepts a plain dict.
    return Agent(
        name="Product Search Agent",
        instructions=SEARCH_SYSTEM_PROMPT,
        model=model,
        tools=[WebSearchTool(
            filters=WebSearchToolFilters(allowed_domains=_ALLOWED_DOMAINS),
            user_location={
                "type": "approximate",
                "country": "JP",
                "city": "Tokyo",
                "timezone": "Asia/Tokyo",
            },
            search_context_size="high",
        )],
        model_settings=ModelSettings(temperature=0.1),
    )


def _create_extraction_agent(model: str):
    from agents import Agent, ModelSettings  # lazy
    return Agent(
        name="Product Data Extractor",
        instructions=EXTRACTION_SYSTEM_PROMPT,
        model=model,
        output_type=ExtractionResult,
        model_settings=ModelSettings(temperature=0.0),
    )


async def run_product_lookup(
    jan: str | None = None,
    title: str | None = None,
    model: str | None = None,
    extraction_model: str | None = None,
) -> ExtractionResult:
    """Run the two-agent pipeline for product data extraction.

    Returns an ExtractionResult with candidates and raw_search_notes.
    Falls back to ``_mock_lookup`` when ``OPENAI_API_KEY`` is unset.

    ``model`` overrides ``SEARCH_MODEL`` (the web-search agent), and
    ``extraction_model`` overrides ``EXTRACTION_MODEL`` (the structured-output
    agent). Both default to their module-level constants — see the comments
    near the top of this file for the rationale.
    """
    if not _ai_enabled():
        logger.info("AI lookup running in MOCK mode (no OPENAI_API_KEY)")
        return _mock_lookup(jan=jan, title=title)

    from agents import Runner  # lazy
    search_agent = _create_search_agent(model or SEARCH_MODEL)
    extraction_agent = _create_extraction_agent(extraction_model or EXTRACTION_MODEL)

    parts = []
    if jan:
        parts.append(f"JANコード: {jan}")
    if title:
        parts.append(f"商品名: {title}")
    query = "\n".join(parts) + "\nこの商品を検索して情報を収集してください。"

    # Step 1: web search
    search_result = await Runner.run(search_agent, query)
    raw_text: str = search_result.final_output

    # Step 2: structured extraction
    extraction_input = f"検索クエリ: {query}\n\n以下は検索エージェントの出力です:\n\n{raw_text}"
    extraction_result = await Runner.run(extraction_agent, extraction_input)
    return extraction_result.final_output


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
