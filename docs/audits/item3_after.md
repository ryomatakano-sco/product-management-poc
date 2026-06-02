# Item 3 — AFTER audit (category + supplier mapping)

Branch: `fix/category-vendor-mapping` (off `fix/description-generation`, off `main`,
not pushed). Date: 2026-06-02.

## What changed — two layered fixes

### Layer 1 (DONE, shipped) — frontend normalised match

`frontend/pages/ProductCreate.jsx`:
- New `_COMPANY_AFFIXES` + `_normMaster(s)` helper — NFKC → lower-case → strip all
  whitespace (incl. full-width 　) → strip company affixes (株式会社/(株)/㈱/有限会社/
  Co.,Ltd/Inc/… ) → strip wrapping punctuation —
  [ProductCreate.jsx:20-58](../../frontend/pages/ProductCreate.jsx#L20).
- New `_matchMaster(items, field, aiValue)` — exact `===` fast path, then normalised
  compare; returns the row or undefined, never a partial guess —
  [ProductCreate.jsx:60-70](../../frontend/pages/ProductCreate.jsx#L60).
- Wired into `applyAi`: vendor match now `_matchMaster(..., "company_name", picks.brand.value)`
  and category `_matchMaster(..., "name", picks.category.value)` — replacing the raw
  `===` finds — [ProductCreate.jsx:323-332](../../frontend/pages/ProductCreate.jsx#L323).
- **Kept as the permanent safety net** even after Layer 2 lands (step 5).

### Layer 2 (DONE) — server-side master-list injection

`backend/app/services/ai_agent.py`:
- New `_master_list_block(categories, vendors)` — builds the
  `## マスタ参照 … ### 利用可能なカテゴリ一覧: [...] ### 利用可能な仕入先一覧: [...]`
  block with the "use the list's exact spelling, even if the web differs
  (歯磨き粉→歯磨剤, サンスター株式会社→サンスター)" instruction; returns "" when no
  lists → prompt unchanged — [ai_agent.py:431-470](../../backend/app/services/ai_agent.py#L431).
- `_create_search_agent(model, master_list_block="")` now appends the block to the
  system prompt — [ai_agent.py:473-507](../../backend/app/services/ai_agent.py#L473).
- `run_product_lookup(..., categories=None, vendors=None)` — builds the block, passes
  it to `_run_search`, and folds it into the cache key (so stores don't collide) —
  [ai_agent.py:511-517](../../backend/app/services/ai_agent.py#L511),
  [cache key :548](../../backend/app/services/ai_agent.py#L548),
  [_run_search :573](../../backend/app/services/ai_agent.py#L573).

`backend/app/routers/ai_suggestions.py`:
- Imports `Category`, `Vendor`, `VendorStatus`
  ([:15-16](../../backend/app/routers/ai_suggestions.py#L15)).
- New `_load_master_lists(db, store_id)` — store-scoped category names + **active**
  vendor names, capped 200 each
  ([:100-126](../../backend/app/routers/ai_suggestions.py#L100)).
- Create endpoint loads the lists and passes them to `run_product_lookup`
  ([:155-162](../../backend/app/routers/ai_suggestions.py#L155)).

## Done vs TODO (server-side)

**Done:**
- Full plumbing: master lists loaded from DB (store-scoped, active vendors) →
  injected into the live search prompt → cache-key isolated per store.
- Verified (MEASURED, live) that injection does not corrupt already-correct output
  and that the prompt block is built/threaded correctly (unit + live).

**TODO / not done (clearly out of scope for a safe week-1 ship):**
- **Only the `POST /ai-suggestions` create path injects lists.** `/debug` and
  `/compare` still call `run_product_lookup` without lists (they have no `store_id`
  dependency wired). Fine — they're dev tools — but noted.
- **No post-hoc server-side reconciliation.** If the agent still emits a variant,
  the server persists it as-is; the *frontend* normaliser is what reconciles it at
  apply time. A stronger version would map the candidate to the master id server-side
  and store the canonical string. Deferred.
- **Synonym coverage depends on the model.** Injection *asks* the model to map
  歯磨き粉→歯磨剤; it is not a hard guarantee. A deterministic synonym table is a
  possible follow-up if the prompt proves unreliable in production.

## CURRENT STATE

Spelling/width/company-suffix variants now auto-fill via a normalised client-side
match (shipped, 11/11 test cases, no false positives); the search prompt is also
injected server-side with the store's real category/vendor master lists so the agent
emits canonical spellings (incl. the 歯磨剤/歯磨き粉 synonym the frontend cannot
fix) — create path only, with the frontend normaliser retained as the safety net.
