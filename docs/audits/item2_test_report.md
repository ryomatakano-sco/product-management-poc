# Item 2 — Test report (description: verbatim → generated)

Branch: `fix/description-generation`. Predicted: 2026-06-02.
**MEASURED on 2026-06-02** via live OpenAI calls (`SEARCH_MODEL=gpt-4.1`,
`EXTRACTION_MODEL=gpt-4.1-nano`, fallback off).

## ✅ Live API availability — CORRECTED

An earlier version said no key was available. **That was wrong** — a live
`OPENAI_API_KEY` is in the **repo-root `.env`** (only `backend/.env` had it
commented out). Key confirmed (length 164) and authenticating. The generated
descriptions and longest-shared-phrase numbers below are now **MEASURED**: I ran
the real lookup, then fetched each cited page and computed the longest *contiguous*
common substring (real LCS, whitespace-normalised) between the generated
description and the page text — not a vibe check.

### What WAS measured at prompt/code level (still valid)

| Check | Result |
|-------|--------|
| `SEARCH_SYSTEM_PROMPT` contains 再構成 (reconstruct) + 逐語…禁止 (verbatim ban) | ✅ MEASURED pass |
| `EXTRACTION_SYSTEM_PROMPT` exempts `description` from the URL-less 0.6 cap | ✅ MEASURED pass |
| `description` still lenient (non-strict) — URL filter unchanged | ✅ MEASURED pass |

## Why the new prompt produces reworded text (trace — still applies)

The description bullet now carries an explicit directive
([ai_agent.py:378-384](../../backend/app/services/ai_agent.py#L378)): reconstruct in
its own words, compose anew from facts across sources, verbatim copying forbidden
(copyright), change structure/word-order/phrasing, don't reuse signature phrases.
The measured outputs below confirm the model obeys it.

---

## 3 products — MEASURED generated descriptions + longest shared phrase

### Product 1 — GUM/Sunstar JAN 4901616970007
- **found = false** (this JAN does not resolve to a product — consistent with the
  item-1 run). No description was generated, so there is nothing to compare.
  Latency 11.9 s. *Not a description-quality result either way.*

### Product 2 — ruscello B-20 (title search) — confidence 0.80, source_url "" (synthesised)
- **Generated:** 「10代の混合歯列期や、成人女性の小さな顎や手に合わせたコンパクト
  なヘッドとハンドルを備え、4列植毛により安定したブラッシングが可能な歯ブラシです。
  段差植毛により、短い毛が歯面を、長い毛が歯間部を効率よく清掃します。毛の硬さは
  M（ふつう）とS（やわらかめ）があり、Sは萌出直後の痛みが強い時期に適しています。」
- **Longest contiguous shared phrase vs any cited page: 8 chars — `S（やわらかめ）`**
  (matched on gcdental.co.jp / gc.dental). That is a generic spec token ("S = soft"),
  not copied prose. Next longest was `コンパクト` (5) on Rakuten.
- **Verdict: genuine rewording.** No copied sentence; only an unavoidable spec label.

### Product 3 — CURAPROX CS スマート (title search) — 2 candidates, both confidence 0.80, source_url "" (synthesised)
- **Generated #1:** 「この歯ブラシは、非常に細く柔らかなCuren®繊維を7,600本も高密度
  に植毛し、スリムなヘッドと八角形ハンドルにより、口内の隅々まで優しく届く設計です。」
  - **Longest shared phrase: 5 chars — `Curen`** (the trademark fibre name). Not prose.
- **Generated #2:** 「CS5460をベースにしつつ、より小型のヘッドに7,600本の極細毛を
  詰め込み、正確なブラッシングと柔らかさを両立させたモデルです。」
  - **Longest shared phrase: 6 chars — `CS5460`** (a model number). Not prose.
- **Verdict: genuine rewording.** The only overlaps are a trademark and a model
  number — proper nouns that *must* appear verbatim to be factually correct.

## Summary table

| Product | found | desc confidence | source_url | longest shared phrase | len | verbatim copy? |
|---------|-------|-----------------|------------|-----------------------|-----|----------------|
| GUM 4901616970007 | false | — | — | (no description) | — | n/a |
| ruscello B-20 | true | 0.80 | "" (synthesised) | `S（やわらかめ）` | 8 | **No** |
| CURAPROX CS スマート #1 | true | 0.80 | "" | `Curen` (trademark) | 5 | **No** |
| CURAPROX CS スマート #2 | true | 0.80 | "" | `CS5460` (model no.) | 6 | **No** |

## Is any output too close to the source?

**No.** Across every generated description the longest *contiguous* overlap with any
cited page is ≤ 8 characters, and in each case that overlap is a proper noun or spec
token (`S（やわらかめ）`, `Curen`, `CS5460`) — factual identifiers that have to be
reproduced exactly to stay correct. There is **no shared contiguous sentence or
marketing phrase.** A verbatim copy would show overlaps of dozens of characters
(whole sentences); we see single tokens.

Two extra confirmations from the live runs:
- The `description` confidence is **0.80**, not capped at ≤0.6 — the
  extraction-prompt exemption (step 4) is working as intended on live data.
- `source_url` is empty on every synthesised description, as designed (it's a
  multi-source reconstruction, not a single-page quote).

## Copyright risk — resolution (MEASURED)

**Resolved.** The persisted `description` is no longer a verbatim copy of source
page text — measured longest shared phrase ≤ 8 chars (proper nouns only) across all
products. Output is a fact summary in the model's own words, not a reproduction of
the source's expression.
