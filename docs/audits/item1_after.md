# Item 1 — AFTER audit (what changed)

Branch: `fix/search-accuracy-latency` (off `main`, not pushed). Date: 2026-06-02.

## Accuracy fix — wrong-product guard

The wrong-product signal (`jan in source_url`) existed but was only computed in
the two non-persisting debug/arena paths and never used to filter. It is now a
real filter, behind two clearly-named helpers (no copy-pasted logic):

- `jan_verified_for(jan, source_url)` — the JAN-presence check, single definition
  ([ai_suggestions.py:64](../../backend/app/routers/ai_suggestions.py#L64)).
- `wrong_product_drop(jan, candidates)` — decides whether the guard fires for a
  result set ([ai_suggestions.py:76](../../backend/app/routers/ai_suggestions.py#L76)).
  **Rule:** drop unverified candidates **only on a JAN search where ≥1 candidate
  IS verified**. If zero verify (only manufacturer slug URLs were cited) it keeps
  everything, so the most-trusted Tier-1 sources aren't gutted. Title/name-only
  searches pass `jan=None` → guard never fires (lenient, as required).

Wired into all three spots:
- create (persist): [ai_suggestions.py:159](../../backend/app/routers/ai_suggestions.py#L159) (`drop_unverified`) + the `continue` that skips unverified candidates just below.
- debug (report): [ai_suggestions.py:296](../../backend/app/routers/ai_suggestions.py#L296), dropped candidates now carry reason `"JAN not present in source_url (wrong-product guard)"` ([:319](../../backend/app/routers/ai_suggestions.py#L319)).
- compare (arena): [ai_suggestions.py:378](../../backend/app/routers/ai_suggestions.py#L378) + drop reason ([:392](../../backend/app/routers/ai_suggestions.py#L392)).

The strict-citation field set (`STRICT_CITATION_FIELDS`) and the existing
field-scoped URL filter are **untouched** — the new guard is a second, independent
gate layered after it.

## Latency fix

**Implemented (safe, accuracy-neutral):**
1. **Fallback is now opt-in.** `run_product_lookup(..., allow_fallback=False)` is
   the new default ([ai_agent.py:461](../../backend/app/services/ai_agent.py#L461)).
   The always-on gpt-5-mini re-search added ~$0.03 and ~2 min to every weak
   lookup; it's now reachable only when a caller asks. Exposed as an opt-in
   request field `AiSuggestionRequest.allow_fallback` (default False,
   [schemas/ai_suggestion.py:10](../../backend/app/schemas/ai_suggestion.py#L10))
   and threaded into create ([ai_suggestions.py:152](../../backend/app/routers/ai_suggestions.py#L152))
   and debug ([:277](../../backend/app/routers/ai_suggestions.py#L277)). `/compare`
   already passed `allow_fallback=False`, so it is unaffected.
2. **Per-process lookup cache.** Identical-input lookups skip both LLM calls
   ([ai_agent.py:255](../../backend/app/services/ai_agent.py#L255) cache,
   [:489](../../backend/app/services/ai_agent.py#L489) lookup/store). Bounded FIFO
   (cap 256); mock results not cached; `clear_lookup_cache()` for busting.
   Accuracy-neutral: same args → same result. MEASURED: 2nd identical lookup
   re-ran 0 LLM calls.

**Evaluated, intentionally NOT changed:**
- *Search ↔ extraction concurrency* — impossible: extraction consumes the search
  agent's text (true data dependency). Left sequential.
- *Cheaper extraction model* — already at the floor (`gpt-4.1-nano`, the cheapest
  model that still produces reliable JSON; anything cheaper can't web-search and
  extraction doesn't need to). No change.

**Proposed, NOT done (riskier / out of scope):**
- Cross-process / Redis cache (current cache is per-worker; a multi-worker deploy
  won't share hits).
- Streaming the search agent so the UI shows partial results before extraction.
- Lowering `search_context_size` from `"high"` to `"medium"` — could cut primary
  search latency but is a recall risk; needs a measured A/B with a live key.
- A Wave-2 fetch-based verifier so manufacturer-slug URLs can also be JAN-verified
  (would let the guard fire even when no retailer URL is present).

## Edits (file:line)

| File | Lines | Change |
|------|-------|--------|
| backend/app/routers/ai_suggestions.py | 64–101 | new `jan_verified_for` + `wrong_product_drop` helpers |
| backend/app/routers/ai_suggestions.py | 152, 159–168 | create: thread `allow_fallback`, apply wrong-product drop |
| backend/app/routers/ai_suggestions.py | 277, 296, 309–321 | debug: thread `allow_fallback`, drop + reason |
| backend/app/routers/ai_suggestions.py | 378, 388–397 | compare: drop + reason |
| backend/app/schemas/ai_suggestion.py | 10–17 | `AiSuggestionRequest.allow_fallback` opt-in field |
| backend/app/services/ai_agent.py | 241–271 | lookup cache + `_cache_key` + `clear_lookup_cache` |
| backend/app/services/ai_agent.py | 461, 480–500, 561, 564 | fallback opt-in default + cache wire-in |

## CURRENT STATE

Wrong-product candidates are now dropped on JAN searches when a JAN-verified hit
exists (accuracy bug fixed without sacrificing manufacturer-tier recall), and the
always-on ~2-min fallback is opt-in plus identical lookups are cached (latency
cut on weak and repeat lookups) — verified in MOCK/unit tests; live-key
before/after numbers remain PREDICTED pending an API key.
