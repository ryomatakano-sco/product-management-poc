# Item 1 — Test report (before / after)

Branch: `fix/description-generation` (contains item-1 + item-2 changes).
Predicted: 2026-06-02. **MEASURED on 2026-06-02** via live OpenAI calls
(`SEARCH_MODEL=gpt-4.1`, `EXTRACTION_MODEL=gpt-4.1-nano`).

## ✅ Live API availability — CORRECTED

An earlier version of this report said no key was available. **That was wrong** —
a live `OPENAI_API_KEY` is present in the **repo-root `.env`** (I had only checked
`backend/.env`, where it is commented out). Key confirmed readable (length 164) and
authenticating (`models.list()` → 171 models). All rows below are now **MEASURED**.

> Note: `latency_s` is **fallback OFF** (the new default, `allow_fallback=False`)
> unless stated. Each lookup cleared the per-process cache first, so these are
> cold-cache numbers (repeat lookups hit the cache at ~0 s — measured separately
> in the item-1 unit tests).

### What WAS measured at unit level (still valid)

| Check | Result |
|-------|--------|
| `jan_verified_for` truth table | ✅ MEASURED pass |
| `wrong_product_drop`: title-only / ≥1 verified / 0 verified / empty | ✅ MEASURED pass |
| `allow_fallback` default is now `False` | ✅ MEASURED pass |
| Real result cached; 2nd identical lookup skips both LLM calls (~0 s) | ✅ MEASURED pass |

## Test JANs (same 5 as before)

| # | JAN | Cohort |
|---|-----|--------|
| 1 | 4901616005266 | oldest Sunstar |
| 2 | 4901616006096 | oldest Sunstar |
| 3 | 4901616970007 | newest Sunstar |
| 4 | 4901616970021 | newest Sunstar |
| 5 | 4987261000245 | non-Sunstar (different GS1 prefix) |

## MEASURED results (fallback OFF)

| JAN | returned product (title) | correct? | guard fired? | dropped_reason (count) | latency_s |
|-----|--------------------------|----------|--------------|------------------------|-----------|
| 4901616005266 | 薬用メディカつぶつぶ塩 170g | ✓ (Rakuten URLs carry the JAN) | **yes** | "JAN not present in source_url (wrong-product guard)" × **4** (incl. a price+weight from `askul.co.jp/p/UE74586/` — a *different* SKU page; and a URL-less description/category) | **20.32** |
| 4901616006096 | ガムケア 電動ハブラシ用デンタルジェル (GUM) | ✓ | no (only the Sunstar JAN-list PDF verified → kept all 10) | — (0) | **15.30** |
| 4901616970007 | (該当商品なし / not found) | n/a — found=false | no | — (0) | **7.41** |
| 4901616970021 | (該当商品なし / not found) | n/a — found=false | no | — (0) | **8.30** |
| 4987261000245 | (該当商品なし / not found) | n/a — found=false | no | — (0) | **10.21** |

## Wrong-product (Ora2→GUM class) reproduction — step 4

I did **not** see a clean "completely wrong product returned as the title" case in
these 5 JANs — the resolved JANs (266, 096) returned the *right* product. **Being
honest: I did not manufacture one.**

However, JAN `4901616005266` **did** exhibit the same *class* of bug at the
candidate level, and the guard caught it: among the candidates the agent cited, the
`price` (¥450) and `weight` (170g) came from `https://www.askul.co.jp/p/UE74586/`
— an Askul page whose path is a different SKU id, **not** this JAN. BEFORE, those
wrong-product facts would have been persisted and shown (the create path had no
JAN↔URL check). AFTER, because ≥1 candidate verified (the Rakuten URLs contain
`4901616005266`), the guard fired and dropped the 4 non-matching candidates,
including the mis-attributed Askul price/weight. **This is the wrong-product guard
working on a real case** — just at field-granularity rather than a whole wrong
product.

For JANs that returned nothing (970007 / 970021 / 4987261000245) the guard is moot
(no candidates), and with fallback OFF they fail fast (7–10 s) instead of paying
the old ~2 min escalation.

## Fallback ON vs OFF — worst-case delta (MEASURED)

| JAN | mode | latency_s | found | guard fired |
|-----|------|-----------|-------|-------------|
| 4901616005266 | fallback **OFF** | 20.32 | true | yes (4 dropped) |
| 4901616005266 | fallback **ON** | 18.43 | true | yes (8 dropped) |

Surprise vs prediction: the fallback-ON run did **not** add ~2 min here, because
the *primary* already returned a usable result, so `_looks_unhelpful` was false and
no escalation happened — the two numbers are within noise. The ~2 min worst case
only materialises when the primary genuinely fails (found=false / all-unsourced),
which in this sample are the 970xxx / 4987261 JANs — and there, fallback ON would
add the second full search+extraction the OFF runs skipped (OFF measured 7–10 s).
So the *latency win of fallback-off is concentrated exactly on the not-found JANs*,
which is where it matters.

## Correction vs the earlier PREDICTED table

- Predicted primary latency ~38 s; **measured 7–20 s** — the live pipeline is
  faster than the 2026-05-21 arena note suggested. Prediction was conservative.
- Predicted JANs 1/2/5 likely wrong-before; **measured**: 1 & 2 resolve to the
  right product (guard still cleaned mis-attributed fields on #1), 3/4/5 return
  nothing. So "wrong product shown" was over-predicted; the real failure mode in
  this sample is "not found", not "wrong product".
