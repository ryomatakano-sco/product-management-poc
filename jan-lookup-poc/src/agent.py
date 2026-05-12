"""Agent definitions for JAN code product lookup.

Uses a two-agent pattern to avoid the known JSON truncation bug when combining
WebSearchTool with structured output (output_type) on large Pydantic models.

1. search_agent: uses WebSearchTool, returns plain text with all findings.
2. extraction_agent: parses the search agent's text into ProductLookupResult.
"""

from __future__ import annotations

from agents import Agent, WebSearchTool, ModelSettings

from schema import ProductLookupResult, ProductNameLookupResult


SEARCH_SYSTEM_PROMPT = """\
あなたは日本の歯科医院向け商品データ抽出エージェントです。

## タスク
ユーザーから渡されたJANコード（バーコード番号）をウェブ検索し、該当する歯科関連商品の情報を可能な限り収集してください。

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
- 商品名（title）
- メーカー / ブランド（brand）
- 商品説明 1-3文（description）
- カテゴリ: 歯ブラシ / 歯間ブラシ / フロス / 洗口液 / 歯磨剤 / その他
- 適応・用途（indications）: 歯周病, 知覚過敏, インプラント周囲, 矯正中, 子供用, 高齢者, ドライマウス 等 — **商品ページに明記されている場合のみ**。推測で適応を追加しないこと。
- 毛のかたさ（bristle_hardness）: やわらかめ / ふつう / かため（該当する場合のみ）
- ヘッドサイズ（head_size）（該当する場合のみ）
- フッ素濃度 ppm（fluoride_ppm）（該当する場合のみ）
- 重量 g（weight_g）
- 寸法（dimensions）: WxDxH mm 等
- 価格（price_jpy）: 税込 or 税抜を明記
- 画像URL（image_urls）: ダウンロードしない、URLだけ記録

## 出力フォーマット
- 各項目を箇条書きで、**URLを必ず [ ] 内に記載**。
- 複数ソースで情報が異なる場合は、メーカーサイトを優先しつつ、矛盾を明記。
- JANコードに該当する商品が見つからなかった場合は「該当商品なし」と明記し、検索した内容と結果を報告。
- 最後に「検索ノート」として、どのような検索を行い、何がヒットし、何がヒットしなかったか、不確実な点は何かを率直に記載。

すべての人間が読むテキストは日本語で出力してください。
"""

EXTRACTION_SYSTEM_PROMPT = """\
あなたは構造化データ抽出エージェントです。
ウェブ検索エージェントが収集したテキストレポートを受け取り、ProductLookupResult スキーマに変換してください。

## ルール
1. テキスト中にURLが併記されていない情報は、value を null にしてください。source_url がないフィールドは null です。これが最重要ルールです。
2. found フィールド: 検索結果に該当商品が見つかったかどうか。「該当商品なし」等の記載があれば false。
3. indications の value は list[str] 型です。
4. image_urls の value は list[str] 型です。
5. 数値フィールド（fluoride_ppm, weight_g, price_jpy）の value は float 型です。
6. その他の value は str 型です。
7. raw_search_notes には検索エージェントの「検索ノート」をそのままコピーしてください。
8. jan_code にはユーザーから渡されたJANコードをセットしてください。
"""


def create_search_agent(model: str) -> Agent:
    """Create the web search agent (returns plain text)."""
    return Agent(
        name="JAN Search Agent",
        instructions=SEARCH_SYSTEM_PROMPT,
        model=model,
        tools=[WebSearchTool()],
        model_settings=ModelSettings(temperature=0.1),
    )


def create_extraction_agent(model: str) -> Agent[ProductLookupResult]:
    """Create the structured extraction agent (returns ProductLookupResult)."""
    return Agent(
        name="Product Data Extractor",
        instructions=EXTRACTION_SYSTEM_PROMPT,
        model=model,
        output_type=ProductLookupResult,
        model_settings=ModelSettings(temperature=0.0),
    )


# ---------------------------------------------------------------------------
# Product-name-based agents
# ---------------------------------------------------------------------------

NAME_SEARCH_SYSTEM_PROMPT = """\
あなたは日本の歯科医院向け商品データ抽出エージェントです。

## タスク
ユーザーから渡された商品名（製品名・通称）をウェブ検索し、該当する歯科関連商品の情報を可能な限り収集してください。

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
- JANコード / バーコード番号（jan_code）
- 商品名・正式名称（title）
- メーカー / ブランド（brand）
- 商品説明 1-3文（description）
- カテゴリ: 歯ブラシ / 歯間ブラシ / フロス / 洗口液 / 歯磨剤 / その他
- 適応・用途（indications）: 歯周病, 知覚過敏, インプラント周囲, 矯正中, 子供用, 高齢者, ドライマウス 等 — **商品ページに明記されている場合のみ**。推測で適応を追加しないこと。
- 毛のかたさ（bristle_hardness）: やわらかめ / ふつう / かため（該当する場合のみ）
- ヘッドサイズ（head_size）（該当する場合のみ）
- フッ素濃度 ppm（fluoride_ppm）（該当する場合のみ）
- 重量 g（weight_g）
- 寸法（dimensions）: WxDxH mm 等
- 価格（price_jpy）: 税込 or 税抜を明記
- 画像URL（image_urls）: ダウンロードしない、URLだけ記録

## 出力フォーマット
- 各項目を箇条書きで、**URLを必ず [ ] 内に記載**。
- 複数ソースで情報が異なる場合は、メーカーサイトを優先しつつ、矛盾を明記。
- 商品名に該当する商品が見つからなかった場合は「該当商品なし」と明記し、検索した内容と結果を報告。
- 最後に「検索ノート」として、どのような検索を行い、何がヒットし、何がヒットしなかったか、不確実な点は何かを率直に記載。

すべての人間が読むテキストは日本語で出力してください。
"""

NAME_EXTRACTION_SYSTEM_PROMPT = """\
あなたは構造化データ抽出エージェントです。
ウェブ検索エージェントが収集したテキストレポートを受け取り、ProductNameLookupResult スキーマに変換してください。

## ルール
1. テキスト中にURLが併記されていない情報は、value を null にしてください。source_url がないフィールドは null です。これが最重要ルールです。
2. found フィールド: 検索結果に該当商品が見つかったかどうか。「該当商品なし」等の記載があれば false。
3. jan_code の value は str 型です（バーコード番号）。ページ上に記載されていた場合のみセットしてください。
4. indications の value は list[str] 型です。
5. image_urls の value は list[str] 型です。
6. 数値フィールド（fluoride_ppm, weight_g, price_jpy）の value は float 型です。
7. その他の value は str 型です。
8. raw_search_notes には検索エージェントの「検索ノート」をそのままコピーしてください。
9. product_name にはユーザーから渡された商品名をセットしてください。
"""


def create_name_search_agent(model: str) -> Agent:
    """Create the web search agent for product-name-based lookup (returns plain text)."""
    return Agent(
        name="Product Name Search Agent",
        instructions=NAME_SEARCH_SYSTEM_PROMPT,
        model=model,
        tools=[WebSearchTool()],
        model_settings=ModelSettings(temperature=0.1),
    )


def create_name_extraction_agent(model: str) -> Agent[ProductNameLookupResult]:
    """Create the structured extraction agent for product-name-based lookup."""
    return Agent(
        name="Product Name Data Extractor",
        instructions=NAME_EXTRACTION_SYSTEM_PROMPT,
        model=model,
        output_type=ProductNameLookupResult,
        model_settings=ModelSettings(temperature=0.0),
    )
