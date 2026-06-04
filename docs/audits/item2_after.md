# Item 2 — AFTER audit (description generation)

Branch: `fix/description-generation` (off `fix/search-accuracy-latency`, off `main`,
not pushed). Date: 2026-06-02.

## What changed

Two prompt edits in `backend/app/services/ai_agent.py`. **No third LLM call added**
— the reconstruction happens inside the existing search agent, and the
no-penalty handling inside the existing extraction agent. No router/schema/filter
changes; `description` remains a lenient (non-strict) field.

### Edit 1 — SEARCH_SYSTEM_PROMPT: description is now reconstructed, verbatim banned

[ai_agent.py:377](../../backend/app/services/ai_agent.py#L377)

**BEFORE:**
```
- 商品説明 1-3文（description）
```

**AFTER:**
```
- 商品説明 1-3文（description）— **重要: 必ず自分の言葉で再構成して記述すること。**
  収集した複数ソースの事実（用途・特徴・対象・成分など）をもとに、1〜3文の
  オリジナルの説明文を**新たに作文**してください。商品ページの紹介文・キャッチ
  コピー・説明文を**そのまま（逐語的に）転記・コピーすることは禁止**します
  （著作権上の理由）。文の構成・語順・言い回しは原文と明確に変え、事実のみを
  反映させてください。原文の特徴的なフレーズをそのまま流用しないこと。
  description には URL を併記しなくて構いません（合成テキストのため）。
```

Factual fields (price, JAN/barcode, weight, image_url, …) are **unchanged** — they
still require sourcing/citation exactly as before. Only `description` is synthesised.

### Edit 2 — EXTRACTION_SYSTEM_PROMPT: description exempt from the URL-less 0.6 cap

[ai_agent.py:423](../../backend/app/services/ai_agent.py#L423) (appended to rule 7)

**BEFORE (rule 7, single line):**
```
7. confidence は 0.0〜1.0 でソースの信頼度を推定。URL無しの緩和フィールド候補は 0.6 以下にしてください。
```

**AFTER:**
```
7. confidence は 0.0〜1.0 でソースの信頼度を推定。URL無しの緩和フィールド候補は 0.6 以下にしてください。
   **ただし `description` は例外。** description は検索エージェントが複数ソースの事実から
   意図的に再構成した合成テキストであり、単一の URL を持たないのが正常です。URL が無いことを
   理由に減点しないでください。description の confidence は、元になった事実の裏付けの強さで
   評価してください（裏付けが十分なら 0.8 前後でも可）。source_url は空欄のままで構いません。
```

## Step 4 decision — chosen: special-case in the prompt only (option a)

A synthesised description has no single `source_url`, so under the old rules it
would show `出典: —`, `confidence ≤ 0.6`, and `jan_verified = false`. I exempted
`description` from the URL-less confidence cap **in the extraction prompt**.

**Why this option, not the others:**
- **vs. "leave as-is + document":** the ≤0.6 cap is *user-visible* in the create
  flow ([ProductCreate.jsx:1182](../../frontend/pages/ProductCreate.jsx#L1182)
  ConfBar). Leaving it would render every (correct, by-design URL-less)
  description with a low-quality bar, training users to distrust a working field.
  Documenting a known defect is worse than fixing it cheaply.
- **vs. "special-case in router code":** that would add an
  `if field_name == "description"` branch into the exact filter path hardened for
  item-1 (wrong-product guard / strict-citation gate) — the costliest place to
  risk a regression. The prompt achieves the same result without touching it.
- **Lowest-risk active fix:** the change is prompt-scoped to one field name; the
  strict-citation field set, the URL filter, and the item-1 guard are untouched.
  `jan_verified=false` is left as-is (honest: a synthesised text genuinely isn't
  JAN-verified, and that marker is dev-arena-only, not in the user flow).

## CURRENT STATE

Product descriptions are now synthesised in the search agent's own words from
collected facts (verbatim transcription explicitly forbidden on copyright grounds),
and the extraction agent no longer penalises a description's confidence for lacking
a URL — all via prompt edits, no extra LLM call, factual/cited fields unchanged.
