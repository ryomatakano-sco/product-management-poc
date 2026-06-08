# Title Search (商品名検索) — Audit (BEFORE)

**Branch:** `feature/title-search` (off `fix/category-vendor-mapping` @ `ca323e8`)
**Date:** 2026-06-08
**Scope:** Trace how the product-lookup pipeline handles a **title-only** input vs a **JAN** input, and confirm which of the three prior accuracy fixes (Item-1 JAN guard, Item-2 description, Item-3 category/vendor mapping) apply to title-sourced results.
**Status of method:** This is a static code trace (PREDICTED from code). Live measurement is in `title_search_test_report.md`.

---

## 1. Entry point: title vs JAN

Both inputs enter the same endpoint, `POST /ai-suggestions`:

`backend/app/routers/ai_suggestions.py:160-189`

```python
@router.post("", response_model=AiSuggestionRead, status_code=201)
async def create_ai_suggestion(body: AiSuggestionRequest, db: DB, store_id: StoreId):
    if not body.jan and not body.title:
        raise HTTPException(400, detail="At least one of 'jan' or 'title' is required")
    jan = _normalised_jan_or_422(body.jan)   # title path: body.jan is None → returns None
    title = body.title
    ...
    outcome = await run_product_lookup(
        jan=jan, title=title, allow_fallback=body.allow_fallback,
        categories=categories, vendors=vendors,
    )
```

Key difference at the gate:

- **JAN input** runs through `_normalised_jan_or_422` (`ai_suggestions.py:34-53`) → NFKC normalize, shape check (8/13 digits), mod-10 check digit. Malformed JAN = `HTTPException(422)` *before* any model call.
- **Title input** has **no equivalent pre-validation**. `title = body.title` is passed straight through (`ai_suggestions.py:169`). There is nothing to normalize or checksum — a free-text product name is accepted as-is.

When only a title is supplied, `jan` is `None` for the rest of the request.

## 2. The lookup itself treats title and JAN symmetrically

`backend/app/services/ai_agent.py:511-577`

```python
async def run_product_lookup(jan=None, title=None, model=None, extraction_model=None,
                             allow_fallback=False, categories=None, vendors=None):
    ...
    parts = []
    if jan:
        parts.append(f"JANコード: {jan}")
    if title:
        parts.append(f"商品名: {title}")
    query = "\n".join(parts) + "\nこの商品を検索して情報を収集してください。"
```

The two-agent pipeline (web-search agent → structured-extraction agent) is **identical** for both. The only difference is whether the query string contains a `JANコード:` line, a `商品名:` line, or both. There is no title-specific branch, prompt, model, or post-processing anywhere in `run_product_lookup`.

## 3. Item-1 (JAN accuracy guard) — correctly SKIPPED for title

The wrong-product guard is implemented in the router, not the agent:

`backend/app/routers/ai_suggestions.py:78-97`

```python
def wrong_product_drop(jan: str | None, candidates) -> bool:
    ...
    if not jan:
        return False          # <-- title-only search: jan is None → guard never fires
    return any(jan_verified_for(jan, getattr(c, "source_url", None)) for c in candidates)
```

`jan_verified_for` (`ai_suggestions.py:66-75`) checks whether the queried JAN string appears verbatim in a candidate's `source_url`. With a title-only search there **is no JAN** to look for, so:

- `wrong_product_drop(None, ...)` returns `False` (line 95-96).
- At persist time, `drop_unverified` is `False`, so the line that would drop candidates is never taken:
  `ai_suggestions.py:205` → `if drop_unverified and not jan_verified_for(jan, candidate.source_url): continue`.

**Conclusion: the Item-1 guard is correctly and deliberately skipped for title searches.** This is the right behavior — there is no barcode to verify a result against, so there is nothing for `jan_verified` to check. The code comment at `ai_suggestions.py:93` states this explicitly: *"Title/name-only searches pass `jan=None` → returns False → nothing dropped."*

**The consequence (the gap this work investigates):** a title search has **no accuracy guard at all**. Whatever the search agent returns for a product name is persisted (subject only to the citation filter in §5). If the agent returns the wrong product or a sibling SKU for an ambiguous name, nothing downstream catches it.

## 4. Item-2 (description generation) — APPLIES equally

The "rewrite, don't copy" instruction lives in the **search system prompt**, which is used for every lookup regardless of input type:

`backend/app/services/ai_agent.py:377-383`

```
- 商品説明 1-3文（description）— **重要: 必ず自分の言葉で再構成して記述すること。**
  ... 商品ページの紹介文・キャッチコピー・説明文を**そのまま（逐語的に）転記・
  コピーすることは禁止**します（著作権上の理由）。...
```

Reinforced in the extraction prompt's confidence rule that exempts `description` from the no-URL penalty (`ai_agent.py:423-426`). Both prompts are built once in `_create_search_agent` / `_create_extraction_agent` and are **input-agnostic** — they do not look at whether `jan` or `title` was supplied. **Item-2 applies equally to title-sourced results.**

## 5. Item-3 (category / vendor master-list mapping) — APPLIES equally

The store's master lists are loaded and injected on **every** create call, before the lookup, with no JAN/title conditional:

`backend/app/routers/ai_suggestions.py:183`
```python
categories, vendors = await _load_master_lists(db, store_id)
```
passed into `run_product_lookup(..., categories=categories, vendors=vendors)` (`:186-189`), which builds the master-list prompt block (`ai_agent.py:431-468`, `_master_list_block`) and appends it to the search agent's instructions (`ai_agent.py:490`). **Item-3 applies equally to title-sourced results.**

(Layer-1, the deterministic frontend normalization of category/vendor strings, is also input-agnostic — it runs on whatever values come back.)

## 6. What still filters a title result

Even without the JAN guard, **one** filter still applies to title searches — the strict-citation filter:

`backend/app/routers/ai_suggestions.py:61-63, 203-204`

```python
STRICT_CITATION_FIELDS = frozenset({"price", "weight", "image_url", "fluoride_ppm", "dimensions"})
...
if candidate.field_name in STRICT_CITATION_FIELDS and not candidate.source_url:
    continue
```

So for a title search, `price`/`weight`/`image_url`/etc. are dropped if they lack a source URL, but `title`/`brand`/`description`/`category`/`indications` (the "lenient" fields) are kept on the agent's narrative alone. This is the same as JAN search — it is not a product-identity guard, just a citation-quality gate.

---

## Summary table

| Mechanism | JAN search | Title search | File:line |
|---|---|---|---|
| Pre-call input validation | mod-10 check digit (422 on bad) | **none** (free text passed through) | `ai_suggestions.py:48-53` vs `:169` |
| Wrong-product accuracy guard (Item-1) | fires when ≥1 candidate JAN-verified | **never fires** (jan=None) | `ai_suggestions.py:95-97` |
| Strict-citation filter | applies | applies | `ai_suggestions.py:203-204` |
| Description rewrite (Item-2) | applies | applies | `ai_agent.py:377-383` |
| Category/vendor mapping (Item-3) | applies | applies | `ai_suggestions.py:183`, `ai_agent.py:431-468,490` |

## Audit conclusion (PREDICTED)

1. Title and JAN inputs share one pipeline; the only behavioral fork is the JAN-only accuracy guard.
2. The Item-1 `jan_verified` guard is **correctly skipped** for title searches — there is no barcode to verify against, by design.
3. Item-2 (description) and Item-3 (category/vendor mapping) **apply equally** to title-sourced results.
4. **Therefore title search has no product-identity guard.** The open risk is wrong-product / sibling-SKU substitution on ambiguous names, which nothing would catch. Whether this risk is *real* must be **measured live** (next: `title_search_test_report.md`) before deciding whether a guard is warranted.
