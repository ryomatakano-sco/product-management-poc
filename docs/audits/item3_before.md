# Item 3 — BEFORE audit (category + supplier auto-fill mapping)

Branch: `fix/category-vendor-mapping` (off `fix/description-generation`, off `main`).
Date: 2026-06-02.

---

## 1. The exact `===` match logic

In the AI-pick apply handler `applyAi` in
[ProductCreate.jsx](../../frontend/pages/ProductCreate.jsx):

**Vendor (仕入れ先 / brand → vendor):**
```js
if (picks.brand && vendorsQ.data?.items && (!onlyFillEmpty || !vendorId)) {
  const v = vendorsQ.data.items.find((x) => x.company_name === picks.brand.value);
  if (v) setVendorId(String(v.id));
}
```
— [ProductCreate.jsx:275-278](../../frontend/pages/ProductCreate.jsx#L275)
(the match is the raw strict-equality `x.company_name === picks.brand.value` on
[:276](../../frontend/pages/ProductCreate.jsx#L276)).

**Category:**
```js
if (picks.category && categoriesQ.data?.items && (!onlyFillEmpty || !categoryId)) {
  const c = categoriesQ.data.items.find((x) => x.name === picks.category.value);
  if (c) setCategoryId(String(c.id));
}
```
— [ProductCreate.jsx:279-282](../../frontend/pages/ProductCreate.jsx#L279)
(raw strict-equality `x.name === picks.category.value` on
[:280](../../frontend/pages/ProductCreate.jsx#L280)).

Both are exact, case/width-sensitive `===`. Any variant — `サンスター(株式会社)` vs
`サンスター`, `歯磨剤` vs `歯磨き粉`, a stray full-width space, a trailing `Co.,Ltd.`
— makes `.find()` return `undefined`, so `setVendorId`/`setCategoryId` is never
called and the dropdown silently stays empty. No fuzzy fallback, no warning.

## 2. Matching is client-side only; master lists never reach the AI agent

**Client-side only:** the `.find()` comparisons above run entirely in the browser
inside `applyAi`. The master lists are loaded by three client `useFetch` calls:
- [ProductCreate.jsx:26-28](../../frontend/pages/ProductCreate.jsx#L26)
  (`api.listCategories()`, `api.listVendors()`, `api.listTags()`).

**Master lists are never sent to the AI agent.** The agent request body is just
`{jan, title, allow_fallback}` (`AiSuggestionRequest`), and the server builds the
search prompt with **no** access to the store's vendor/category tables:
- The create endpoint calls `run_product_lookup(jan=, title=, allow_fallback=)` —
  [ai_suggestions.py:151-153](../../backend/app/routers/ai_suggestions.py#L151) —
  passing **no** category/vendor list.
- `run_product_lookup`'s signature has no list params —
  [ai_agent.py:466-471](../../backend/app/services/ai_agent.py#L466).
- The search prompt hardcodes a **fixed** category enumeration
  (`歯ブラシ / 歯間ブラシ / フロス / 洗口液 / 歯磨剤 / その他`) —
  [ai_agent.py:384](../../backend/app/services/ai_agent.py#L384) — and has **no
  vendor list at all**. The model free-generates `brand`/`category`, so its output
  is whatever the web pages call the product (`サンスター株式会社`, `歯磨き粉`, …),
  not the store's master spelling. That mismatch is exactly what the client `===`
  then fails to reconcile.

## 3. Where the master lists come from

| List | API endpoint | DB table | Match field |
|------|--------------|----------|-------------|
| Categories | `GET /categories?limit=100` ([api.js:66](../../frontend/lib/api.js#L66)) | `categories` ([models/category.py:20](../../backend/app/models/category.py#L20)) | `categories.name` ([:30](../../backend/app/models/category.py#L30)) |
| Vendors (仕入れ先) | `GET /vendors?limit=100` ([api.js:67](../../frontend/lib/api.js#L67)) | `vendors` ([models/vendor.py:21](../../backend/app/models/vendor.py#L21)) | `vendors.company_name` ([:38](../../backend/app/models/vendor.py#L38)) |

Both tables are **store-scoped** (`store_id` column + `ix_*_store_id` index), so any
server-side injection must filter by the request's `store_id` (available in the
create endpoint as the `StoreId` dep — [ai_suggestions.py:130](../../backend/app/routers/ai_suggestions.py#L130)).
Vendors also carry a `status` (active/inactive); only `active` should be injected.
