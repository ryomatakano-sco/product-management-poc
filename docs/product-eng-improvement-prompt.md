# Implementation Prompt — Product & Engineering Improvements

> Hand this to a coding agent working in `product-management-poc`. It turns the product/
> engineering review into executable work. Same repo constraints as the a11y prompt: **no
> build step, no new runtime deps beyond what's justified, don't push without PM OK, keep
> diffs reviewable, PoC conventions.** Several items are **PM-alignment-gated** — do the
> local/safe parts, and stop at a decision point where noted rather than guessing.

---

## Ground rules
- No bundler/TS. Backend is FastAPI + async SQLAlchemy + MySQL; frontend no-build React.
- Every change behavior-preserving unless the item says otherwise.
- **Add tests as you go** — this codebase has zero. Use `pytest` + `httpx.AsyncClient`
  against a SQLite-or-test-MySQL fixture. A test net is a deliverable, not optional.
- Work on a branch (e.g. `feat/review-improvements`), one concern per commit.
- Do NOT start the JAN-DB / Rakuten / Yahoo ingestion layer as code — it's ToS- and
  architecture-gated. Produce the ADR (Phase A1) and stop for PM sign-off.

---

## Phase A — Correctness & trust (do first; these undermine confidence today)

### A1. ADR: solve the JAN lookup recall ceiling (architecture, NOT code yet)
Write `docs/adr/0001-recall-improvement.md` (ADR format: context / options / decision /
consequences). Problem: the tool depends solely on model web-search; recall is ~50–70% and
floors at products with no Japanese web presence — the B2B dental consumables that are the
real inventory. Evaluate: (a) a JAN-database pre-search layer, (b) supplier-PDF/CSV
ingestion, (c) Yahoo!ショッピング API (Rakuten/Amazon are ToS-blocked — state this). Include a
measurement plan (hit-rate on a real masked product master, B2C vs B2B split) and the
pre-registered go/no-go threshold. **Stop here for PM alignment — do not implement the layer.**

### A2. Replace mock data on the Dashboard with real queries
`frontend/pages/Dashboard.jsx:511` has `TODO: wire to inventory_adjustments + audit log after
demo` — the dashboard renders placeholder/mock figures. A dashboard showing fabricated numbers
is a trust hazard. Wire every card/table to real endpoints (the backend already computes
low-stock and expiring counts in `main.py`'s notification tick — reuse that logic via a shared
service, see C1). Where real data genuinely isn't available yet, show an explicit empty state,
never fake numbers.

### A3. Product edit flow (missing CRUD)
Today products support create + archive (soft delete) but **no edit**. Users can't correct an
AI-mis-filled field after saving without re-creating. Add `PATCH /products/:id` (+ variant
edit) with the same validation as create, `created_by`/updated attribution (mig 016 pattern),
and an audit event. Frontend: an edit mode on ProductDetail reusing the ProductCreate form
components. This is the highest-value user-facing gap.

### A4. Verify + guard title search
All accuracy work targeted JAN search; title search (商品名検索) was never verified and has no
accuracy guard. Add a title-search regression test over ~10 real product names, and a
confidence/plausibility guard (e.g. require brand+category agreement across candidates) so a
title query can't silently surface a wrong product. Record measured before/after.

### A5. Capture AI correction feedback (new, small, high-leverage)
When a user overrides an AI-filled field before saving, log the (field, ai_value, final_value,
jan/title, model) tuple to a lightweight `ai_corrections` table. This is free accuracy
telemetry — it turns everyday use into the eval set A1/A4 need, and lets you report real field
accuracy instead of sampling. Add the model, the write on save, and a `/dev` readout.

---

## Phase B — Feature gaps worth speccing (write spec-let first, then build)

For each, drop a short spec in `docs/specs/<name>.md` (problem / goal / non-goals / acceptance)
before coding, then implement behind the existing patterns.

### B1. Bulk / batch product registration
Clinics onboard hundreds of SKUs; one-at-a-time AI lookup doesn't scale. Add CSV import
(JAN/name/qty columns) → batch AI-enrich (reuse the cheap `gpt-4.1-mini` batch model already in
the model map) → a review-and-confirm grid → bulk create. Rate-limit and checkpoint so a
partial failure resumes. This is the biggest workflow multiplier for a real clinic.

### B2. Close the reorder loop
Low-stock detection already exists (notifier + dashboard) and Purchase Orders exist, but
nothing connects them. Add "suggested reorder" — from low-stock + lot/expiry + sales velocity,
propose a draft PO grouped by supplier. Keep it a *draft* the user approves (fits the existing
approvals model, mig 018).

### B3. Expiry write-off / FEFO surfacing
Lots + expiry exist (mig 014) but there's no expiry-driven action. Surface expiring lots on the
dashboard (A2) and add a one-click "write off expired" adjustment reason (the enum already has
refund/transfer patterns to copy) with audit.

---

## Phase C — Engineering structure & reliability

### C1. Extract domain logic out of routers
Routers carry the business logic (`products.py` 834 lines, `purchase_orders.py` 755,
`sales.py` 570) while `app/services/` is thin — this diverges from the stated repo convention
(pure-logic layer separate from FastAPI routes) and blocks unit testing. Introduce
`app/services/` (or `app/logic/`) functions for the meaty operations (product create/edit,
PO build/receive, sales record/refund, dashboard aggregation) and reduce routers to
validation + call + serialize. Move the dashboard/notification aggregation queries out of
`main.py` into a `services/summary.py` shared by the tick and the dashboard endpoint.

### C2. Add the test net (blocking for everything above)
Stand up `backend/tests/` with `pytest`, an async client fixture, and a seeded test DB.
Minimum: auth/tenancy (X-Store-Id loopback rule, cross-store isolation), product create/edit/
archive, inventory adjust (no-negative guard), PO receive, sales refund, and a **golden-set AI
regression** (~20 known JANs incl. the GUM→Ora2 cross-product case, run in mock mode by default
so CI is free/deterministic). Wire a `scripts/test.bat`.

### C3. Fix the background notification loop
`main.py`'s daily tick uses the deprecated `@app.on_event("startup")`, runs an in-process
`while True` loop with a bare `except Exception: pass` that silently swallows every error, and
only works with one uvicorn worker. Move it to a `services/scheduler.py`, switch to the FastAPI
`lifespan` context manager, **log** exceptions instead of swallowing, and document the
single-worker assumption (or gate the loop behind an env flag so multi-worker deploys don't
double-fire). Longer term this belongs in an external scheduler — note that in the ADR.

### C4. Kill the N+1 queries
- `purchase_orders.py:473` and `:544` do a per-tag `SELECT` inside a loop — batch into one
  `WHERE name IN (...)` fetch + in-memory map.
- `products.py:723` write-in-loop — batch the inserts.
Add a test that asserts query count doesn't scale with item count for these paths.

### C5. Guard the money endpoint
`POST /ai-suggestions` calls OpenAI (real spend) with auth but **no rate limit or per-store
quota**. Add a simple per-store token-bucket / daily cap (config-driven) and return a clear
429 with a Japanese message when exceeded. Protects against a loop or abuse burning API budget.

### C6. Split `ai_agent.py` (770 lines)
Break into `ai/agents.py` (search/extraction agent construction + model settings), `ai/
lookup.py` (orchestration, merge, outcome), `ai/mock.py`, and `ai/schemas.py`. Pure
refactor, covered by the C2 golden-set so behavior is pinned.

---

## Phase D — Hygiene & housekeeping (low-risk, do anytime)

- **Version-control the big docs.** `README(v2).md` (68K), `CHANGES.md`, `CONTEXT.md`,
  `FRONTEND_DESIGN_BRIEF.md` are untracked. Decide per-file: track it or move to `docs/`. Losing
  the 68K feature doc to a clean checkout would hurt. (Also decide the fate of the two prompt
  files in `docs/`.)
- **Consolidate the i18n trio.** `lib/i18n.js` + `lib/i18n_autotr.js` + `lib/i18n_strings.js`
  (1497 lines) are one concern in three files, and the 1242-line EN string table is maintained
  for a JP-primary product. **Decision for PM:** either commit to real bilingual (worth it —
  non-JP staff exist on this very project) and consolidate into one module with a tested
  fallback, or drop the EN layer to stop the maintenance drag. Don't leave it half-alive.
- **Consider `components/ui/`** for the new `<Button>`/`<TextInput>` primitives instead of the
  `Atoms.jsx` grab-bag, so the design-system layer is discoverable.
- `mockup/` (15M, untracked) is reference-only — fine to leave locally, but confirm it's
  `.gitignore`d and not shipped.

---

## Production-readiness flags (document, don't necessarily fix in PoC)
Collect these in `docs/production-readiness.md` so they're not forgotten:
- CORS is `allow_origins=["*"]` — lock to known origins for prod.
- `AUTH_SECRET` has an in-code default — must be env-only in prod; set the session cookie
  `Secure` flag under HTTPS.
- Babel-in-browser → move to a real build (Vite) if this graduates.
- Broad `except Exception` in `notifier.py`/`audit.py` swallow-and-continue — acceptable for
  non-critical paths, but confirm none hide data-integrity failures.

---

## Verification / definition of done
1. `pytest` green, incl. tenancy isolation and the AI golden-set (mock mode).
2. Dashboard shows only real or explicit-empty data — no mock numbers (grep the TODO gone).
3. Product edit works end-to-end with audit; title-search guard has a measured before/after.
4. N+1 paths proven flat by a query-count test.
5. `/ai-suggestions` returns 429 past the cap.
6. Notification loop logs errors and no longer uses `on_event`.
7. `docs/adr/0001-recall-improvement.md` + Phase-B spec-lets exist; recall layer NOT built.
8. Short `docs/audits/improvement-report.md` with before/after and what's left for PM.

## Suggested order
A2 → A3 → C2 (tests, alongside) → C1 (refactor under test) → C4/C5/C3 → A4/A5 → B1→B2→B3
(each spec-first) → C6 → D. A1 ADR early and in parallel (it's writing, not code), then pause
for alignment.
