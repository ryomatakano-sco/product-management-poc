# Title Search (商品名検索) — AFTER

**Branch:** `feature/title-search` (off `fix/category-vendor-mapping` @ `ca323e8`)
**Date:** 2026-06-08

## What changed

**No production code changed.** The live verification (`title_search_test_report.md`) found title search already accurate — 5/5 correct products, 0 wrong-product/sibling-SKU substitutions, correct categories, synthesized descriptions, 15.5–20.7s latency. Per the A3 rule ("if accuracy is already acceptable, DO NOT add complexity"), no guard was added.

Only documentation was added, under `docs/audits/`:
- `title_search_before.md` — static audit (title vs JAN path, which guards apply).
- `title_search_test_report.md` — live measured results for the 5 products.
- `title_search_after.md` — this file.

## Why no guard (evidence-based)

1. **The risk did not manifest.** The Item-1 `jan_verified` guard is correctly skipped for title search (`backend/app/routers/ai_suggestions.py:95-96` — `wrong_product_drop` returns `False` when `jan is None`). That leaves title search with no product-identity guard *by design* (nothing to verify a name against). The concern was wrong-product substitution; measurement showed none on the 5-product sample.

2. **A naive guard would risk regressions for ~zero gain.** Correct results legitimately *expand* the query — `CSスマート` → `クラプロックス 歯ブラシ CSスマート`, `システマ 44M` → `DENT.EX システマ 44M`. A "result tokens ⊆ query" check would wrongly flag these. The only safe direction ("query tokens ⊆ result title") passes all 5 today, so it would change nothing while adding a new failure surface and more code. That violates the "don't add complexity" guidance.

3. **Item-2 and Item-3 already cover the non-identity fields** equally for title results (confirmed in the audit: `ai_agent.py:377-383` description rewrite; `ai_suggestions.py:183` + `ai_agent.py:431-468,490` master-list injection). No title-specific gap there.

## Where a guard *would* go (for future reference, NOT implemented)

If a future sample surfaces real wrong-product substitutions, the conservative hook point is the persist loop in `create_ai_suggestion` (`backend/app/routers/ai_suggestions.py:198-216`), mirrored in `/debug` (`:333-368`) and `/compare` (`:415-438`). A title-overlap helper would live next to `wrong_product_drop` (`ai_suggestions.py:78-97`) and be applied only when `title and not jan`. It must check that the **query's** significant tokens appear in the candidate `title`, never the reverse, and should *flag/deprioritize* rather than hard-drop (low-overlap ≠ definitely wrong). Not built now — no evidence justifies it.

## CURRENT STATE (one line)

Title search is **measured-working** (5/5 correct, no substitutions); no code change made — documented as no-change-needed with live evidence.

## git diff --stat

`git diff --stat fix/category-vendor-mapping..feature/title-search`:

```
 docs/audits/title_search_after.md       |  35 ++++++++
 docs/audits/title_search_before.md      | 137 ++++++++++++++++++++++++++++++++
 docs/audits/title_search_test_report.md |  63 +++++++++++++++
 3 files changed, 235 insertions(+)
```

Docs-only. No production code changed. **Not pushed.**
