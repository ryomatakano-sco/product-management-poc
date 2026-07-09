# Full System Audit — 2026-07-09

Pre-heavy-tier verification of every workflow, data flow, screen flow, button, and validation.
Branch: `feature/sales-records` @ `fdd2f87`.

## Method (three independent tracks)

1. **Live API suite** — 72 assertions via curl against a running server: every endpoint group,
   full lifecycles (sale→refund→double-refund guard; PO create→submit→partial receive→full
   receive→cancel guard), and every validation guard (oversell, negative stock, negative qty,
   draft-product sale, over-receive, receive-before-submit, bad enum, missing header, bogus
   namespace, wrong file type). **Result: 72/72 PASS.** Test artifacts labeled `AUDIT`,
   stock deltas reverted.
2. **Code audit — backend** (all 18 routers, models, schemas, deps, services): tenancy,
   validation, races, Decimal handling, timezone consistency, integrity, error paths, upload
   security, injection.
3. **Code audit — frontend** (index.html, all lib/, components/, 15 pages): dead buttons,
   cross-script scope hazards, state staleness, i18n breakage, dark mode, error handling,
   routing, numeric handling. Plus browser click-throughs of all screens (zero console errors).

## Verdict summary

Every shipped feature **works as designed under normal single-user use** — all lifecycle
guards the UI depends on hold. The flaws found are concurrency races, timezone skew in two
KPI queries, cross-tenant write paths (moot until auth exists, but must be fixed with it),
and a handful of frontend polish bugs. Nothing found that breaks the demo path.

## Flaws found (ranked)

### Critical — fix before/with heavy tier
| # | Flaw | Where | Effect |
|---|---|---|---|
| C1 | Sales summary compares JST-aware boundaries against UTC-naive `sold_at` | `sales.py` `sales_summary` | 今日/今月 KPI misattributes sales in a 9h window at day/month edges |
| C2 | Dashboard 今月の売上 has the same UTC/JST mismatch (different flavor) | `dashboard.py` | Dashboard revenue disagrees with sales page at month edges |
| C3 | Sale creation is read-modify-write on `on_hand` without locking | `sales.py` | Two concurrent sales of the last unit both succeed → negative stock (same pattern: adjust, receive, refund) |
| C4 | `transaction_id` = COUNT+1 → duplicate under concurrency → unique-index 500 | `sales.py` | Concurrent sales on the same day: one request 500s |
| C5 | Refund adds stock back unconditionally (no product/status re-check, no upper bound) | `sales.py` | Refunds can inflate on_hand beyond reality |
| F1 | EN mode: Dashboard date renders raw `${["Sun",…]}` template literal | `i18n_strings.js:518` + `i18n_autotr.js` | Visible JS source leaks into the UI; root cause: EN template's 4th slot text ≠ JA key's slot text, so substitution fails |

### High
| # | Flaw | Where | Effect |
|---|---|---|---|
| M3/M4 | PO create/receive don't scope `variant_id`/vendor/branch by store — receive loads variant by id only | `purchase_orders.py` | Cross-tenant inventory writes (latent until multi-store use; `X-Store-Id` is client-trusted anyway = M1) |
| F2 | `T.PLX_INK_050` doesn't exist → undefined background | `SalesRecords.jsx:530,680` | Manual-sale stock badge and 小計 box lose their surface in both themes |
| F3 | Bulk-bar category `<select>` hardcodes white bg + token text color | `ProductList.jsx` | White-on-white text in dark mode |

### Medium
- M2: sale `branch_id` not verified against store. M5: editing an ordered/partially-received PO can orphan received-stock accounting. M6: `committed` adjustment can drive computed `available` negative (no cross-field invariant). M7: variant with no product bypasses the active-status sale guard. M8: archived products still accept adjustments/receives. M9: sales list/CSV `date_from/date_to` not normalized to UTC-naive. M10: CSV money paths use `float()` (display rounding risk). M11: sale `unit_price` fully client-trusted (product decision: discount vs validation). M12: inventory list is O(N) queries (per-product last-adjustment) + hardcoded `available<=10` instead of per-variant threshold.
- F4: PO action handlers read `e?.detail` instead of `e.body.detail` → server error messages never shown. F5: 在庫履歴 tab doesn't refresh after adjusting from the same page. F6: 在庫履歴 uses `variants[0]` not the default variant.

### Minor
- m1: API-created product with variants but no `is_default` gets no default variant. m2: logo upload buffers whole file before size check; no max_length on long text fields (2000-char `reorder_url` → raw 500). m4: CSV exports build whole file in memory. m5: future-dated sale silently dropped from weekly chart. F7: product-list search not debounced. F8: stale "coming soon" EN dictionary keys. F9: `settings?ns=` param can drift from component state.

### Verified clean (highlights)
JAN validation & scan relay (thread-safe, TTL, bounded, unguessable tokens); media/static path traversal; SQL injection (all bound params); Decimal string serialization on all JSON read schemas; receipt tax math (Decimal + quantize); category delete guard; vendor/branch soft-delete; PO explicit state transitions; PO summary/list JST handling (`_to_naive_jst` — correct, and the model for fixing C1/C2); AI-suggestion tenancy; routing table (every route has a case + inbound link); useFetch error handling (no stuck spinners); cross-script window exports; formatYen/parseInt handling; dark mode everywhere except F2/F3.

## Recommended fix plan (Phase 0, before heavy tier)

1. **Timezone sweep (C1, C2, M9)** — one shared helper (`jst_range_to_utc_naive`) used by sales
   summary, dashboard, sales list/export filters. ~half day incl. boundary tests.
2. **Concurrency hardening (C3, C4)** — atomic `UPDATE … SET on_hand = on_hand - :q WHERE on_hand >= :q`
   (check rowcount) for sale/adjust/receive/refund; retry-once on `transaction_id` IntegrityError.
   ~half day.
3. **Guard tightening (C5, M6, M7, M8, m1)** — refund re-checks product; cross-field available
   invariant on adjust; status checks on adjust/receive; default-variant fallback on create. ~half day.
4. **Frontend fixes (F1–F6)** — i18n template slot fix, `PLX_INK_050`→existing token, dark-mode
   select, `e.body.detail`, history refresh + default variant. ~half day.
5. **Tenancy scoping (M2, M3, M4)** — add store_id filters to PO item/branch/vendor lookups.
   Cheap now; mandatory the moment auth lands. ~2 hours.

Deferred by design (documented): M1 header-trusted tenancy + m6 CORS `*` + `stores` enumeration
(all resolve with the auth heavy-tier item), M11 price-override policy, M12 inventory query
optimization (fine at PoC scale), m4 CSV streaming.
