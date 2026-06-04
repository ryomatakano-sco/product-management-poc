# Item 2 — BEFORE audit (description generation / copyright risk)

Branch: `fix/description-generation` (off `fix/search-accuracy-latency`, off `main`).
Audit date: 2026-06-02. No live `OPENAI_API_KEY` — analysis is by reading the
prompts; runtime outputs in the test report are PREDICTED.

---

## 1. The description instruction in SEARCH_SYSTEM_PROMPT

The search agent is told to *collect* a description as one of the fields:

> `- 商品説明 1-3文（description）`
> — [ai_agent.py:377](../../backend/app/services/ai_agent.py#L377)

That is the **entire** instruction for description. It says "1–3 sentences" but
says **nothing** about *how* to produce them. Combined with the absolute rules at
the top of the same prompt:

> `2. 検索して見つけた情報には、必ずその情報が掲載されていたページのURLを併記してください。`
> `3. URLを併記できない情報は報告しないでください。`
> — [ai_agent.py:362-363](../../backend/app/services/ai_agent.py#L362)

…the model is steered to *report what it found on the page, with the page URL*.
The path of least resistance for an LLM under "report the info you found, cite the
URL" is to **lift the product blurb verbatim** off the retailer page. That is the
copyright risk: the persisted `description` is, in practice, a copy of the source
page's marketing copy.

## 2. No rewrite / summarise / paraphrase instruction anywhere

Searched both `SEARCH_SYSTEM_PROMPT` and `EXTRACTION_SYSTEM_PROMPT` for any of
再構成 / 要約 / 言い換え / リライト / paraphrase / rewrite / summarise / 逐語 /
転記 / そのまま.

- **Only hit:** rule 8 of the extraction prompt —
  `8. raw_search_notes に検索ノートをそのままコピー。`
  ([ai_agent.py:417](../../backend/app/services/ai_agent.py#L417)) — which tells the
  extractor to copy the *search notes* into a debug field; it is **not** about the
  product description and does not instruct rewriting.

**Confirmed: neither prompt instructs the model to reword, summarise, paraphrase,
or reconstruct the description in its own words.** Nothing prevents a verbatim copy.

## 3. description is a "lenient field" — what that means for the URL filter

Extraction prompt rule 1 lists the field tiers:

> 緩和フィールド（URLは推奨。URL無しでも採用可…）: `title`, `name_kana`, `brand`,
> **`description`**, `category`, `indications`, `barcode`, `country_of_origin`, …
> — [ai_agent.py:409](../../backend/app/services/ai_agent.py#L409)

`description` is a **lenient field** (not in the strict set `price`, `weight`,
`image_url`, `fluoride_ppm`, `dimensions`). Consequences:

- **URL filter** ([ai_suggestions.py STRICT_CITATION_FIELDS](../../backend/app/routers/ai_suggestions.py#L59)):
  a lenient field is **kept even with no `source_url`** — it is not dropped by the
  strict-citation gate. So a description with no URL survives persistence.
- **Confidence cap** (extraction rule 7,
  [ai_agent.py:416](../../backend/app/services/ai_agent.py#L416)):
  `URL無しの緩和フィールド候補は 0.6 以下にしてください。` → a URL-less candidate is
  forced to `confidence ≤ 0.6`.
- **`jan_verified`** = `bool(jan and source_url and jan in source_url)`
  ([ai_suggestions.py:295-ish](../../backend/app/routers/ai_suggestions.py#L296)) →
  with no `source_url` a description is always `jan_verified=false`.

So once description becomes *synthesised* (no single source page → no `source_url`),
the current rules will (correctly) keep it, but will (a) show `出典: —` and (b) cap
its confidence at ≤0.6 and (c) mark it `jan_verified=false`. **Item-2 step 4 must
decide whether to special-case description so this URL-less-by-design field isn't
visually penalised.** Where the user actually sees this:

- User create flow ([ProductCreate.jsx:1178-1182](../../frontend/pages/ProductCreate.jsx#L1178)):
  shows `出典:` and a confidence `ConfBar` — the ≤0.6 cap **is user-visible** here.
- Dev arena ([AiArena.jsx:759](../../frontend/components/AiArena.jsx#L759)):
  shows the `jan_verified` ✓ marker — dev-only.
