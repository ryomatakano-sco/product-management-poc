# Item 1 — BEFORE audit (AI product-search: accuracy + latency)

Branch: `fix/search-accuracy-latency` (off `main`). Audit date: 2026-06-02.
Status: code-trace audit. **No live `OPENAI_API_KEY`** — `backend/.env` has the key
commented out, so all runtime/latency figures below are reasoned from the code +
the in-repo arena notes (2026-05-21), not freshly measured.

---

## 1. Model configuration

| Role | Constant | Value | Location |
|------|----------|-------|----------|
| Search agent | `SEARCH_MODEL` | `gpt-4.1` | [ai_agent.py:49](../../backend/app/services/ai_agent.py#L49) |
| Fallback search | `FALLBACK_SEARCH_MODEL` | `gpt-5-mini` | [ai_agent.py:50](../../backend/app/services/ai_agent.py#L50) |
| Extraction | `EXTRACTION_MODEL` | `gpt-4.1-nano` | [ai_agent.py:51](../../backend/app/services/ai_agent.py#L51) |
| Alias for session `model_name` | `DEFAULT_MODEL` | = `SEARCH_MODEL` (`gpt-4.1`) | [ai_agent.py:52](../../backend/app/services/ai_agent.py#L52) |

Notes:
- Extraction is already on `gpt-4.1-nano`, the cheapest 4.1-family model and the
  documented floor for web search (`gpt-4.1-nano` cannot web-search at all —
  [MODEL_NO_WEB_SEARCH](../../backend/app/services/ai_agent.py#L98)). So there is
  **no cheaper extraction model to drop to** within the supported set.
- Search defaults to full `gpt-4.1` because it is the only allow-list-compliant
  model (accepts `WebSearchTool(filters=...)`); the mini variants reject `filters`
  ([MODEL_NO_SEARCH_FILTERS](../../backend/app/services/ai_agent.py#L106)).

---

## 2. `jan_verified` logic — where computed, and confirmation it is display-only

Definition (identical in two places):
```python
verified = bool(jan and c.source_url and jan in c.source_url)
```
- `/debug` path: [ai_suggestions.py:265](../../backend/app/routers/ai_suggestions.py#L265)
- `/compare` path: [ai_suggestions.py:329](../../backend/app/routers/ai_suggestions.py#L329)

It is assigned to `AiDebugCandidate.jan_verified`
([schema ai_suggestion.py:69](../../backend/app/schemas/ai_suggestion.py#L69)) and
consumed **only by the frontend arena for display/counting**:
- [AiArena.jsx:655](../../frontend/components/AiArena.jsx#L655) — `verifiedCount` badge
- [AiArena.jsx:759](../../frontend/components/AiArena.jsx#L759) — per-candidate ✓ marker

**Confirmed: `jan_verified` is never used in a filter / `continue` / drop decision.**
The only candidate-dropping logic anywhere is the strict-citation check
(`field_name in STRICT_CITATION_FIELDS and not source_url`) at
[ai_suggestions.py:126](../../backend/app/routers/ai_suggestions.py#L126) (create),
[:250](../../backend/app/routers/ai_suggestions.py#L250) (debug),
[:322](../../backend/app/routers/ai_suggestions.py#L322) (compare).

**Critical finding for the accuracy bug:** the user-facing `create` endpoint
([ai_suggestions.py:95-159](../../backend/app/routers/ai_suggestions.py#L95)) does
**not even compute `jan_verified`** — it persists every candidate that passes the
strict-citation filter. So a JAN search for an Ora2 product whose agent cited a
*GUM* product page (wrong product, validly cited URL) is persisted and shown,
because nothing checks that the cited URL actually corresponds to the queried JAN.
The signal to catch this (`jan in source_url`) exists but is computed only in the
two non-persisting debug/arena paths. **This is the root cause of problem (1).**

---

## 3. End-to-end latency — sequential LLM calls per search

Pipeline in `run_product_lookup`
([ai_agent.py:423](../../backend/app/services/ai_agent.py#L423)):

| # | Step | Model | Web search? | Sequential? |
|---|------|-------|-------------|-------------|
| 1 | Search agent | `gpt-4.1` | yes (slow — `search_context_size="high"`) | — |
| 2 | Extraction agent | `gpt-4.1-nano` | no | **awaits step 1** ([:471](../../backend/app/services/ai_agent.py#L471) → [:475](../../backend/app/services/ai_agent.py#L475)) |
| 3 | Fallback search | `gpt-5-mini` | yes | only if `_looks_unhelpful(step 2)` ([:483](../../backend/app/services/ai_agent.py#L483)) |
| 4 | Fallback extraction | `gpt-4.1-nano` | no | awaits step 3 ([:504](../../backend/app/services/ai_agent.py#L504)) |

**Happy path = 2 sequential LLM calls** (search → extraction). They are strictly
sequential: extraction can't begin until search returns, which is *inherent* —
extraction consumes the search agent's text. So "run search + extraction
concurrently" is **not possible** as written; they have a true data dependency.
The real latency lever on the happy path is the single `gpt-4.1` web-search call
(`search_context_size="high"`), which the 2026-05-21 arena note records at ~38s.
Extraction on `gpt-4.1-nano` is a few seconds.

**Worst case = 4 sequential LLM calls.** When the primary result looks unhelpful
(`found=false`, zero candidates, or every candidate missing `source_url` —
[`_looks_unhelpful`, :55](../../backend/app/services/ai_agent.py#L55)), the code
re-runs the **entire search + extraction** on `gpt-5-mini`
([:498-510](../../backend/app/services/ai_agent.py#L498)). The fallback comment
itself quantifies this: "~$0.03 and ~2min" added
([:61](../../backend/app/services/ai_agent.py#L61)).

Worst-case wall clock ≈ primary search (~38s) + primary extraction (~few s) +
fallback search (~2 min) + fallback extraction (~few s) ≈ **~2.5–3 minutes** for a
single user click. The fallback is **always-on** for the create/debug paths
(`allow_fallback=True` by default; create calls `run_product_lookup(jan, title)`
with no override at [:117](../../backend/app/routers/ai_suggestions.py#L117)).
Only `/compare` disables it (`allow_fallback=False`, [:394](../../backend/app/routers/ai_suggestions.py#L394)).

### Latency levers identified (evaluated in the after-audit)
1. **Search↔extraction concurrency** — *not safe / not possible*: hard data
   dependency. No change.
2. **Cheaper extraction model** — already at the floor (`gpt-4.1-nano`). No change.
3. **Always-on fallback** — biggest worst-case cost (~2 min). Candidate to make
   opt-in. Risk: turning it off blindly could reduce recall on long-tail SKUs, so
   it must stay reachable. Safe change: gate it behind a flag/param defaulting to
   off for the interactive path, keep it available.
4. **Per-session JAN cache** — repeated lookups of the same JAN re-run the full
   pipeline. Safe, accuracy-neutral win for repeat clicks.
