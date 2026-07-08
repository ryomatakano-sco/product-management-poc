# SCO Product Management — Proof of Concept

Feature-by-feature documentation. Each section covers one feature that has been added on top of the base project. For project setup, run instructions, and architecture, see the main [README.md](./README.md).

---

## 販売記録 (Sales Records)

Branch: `feature/sales-records`

The `#/sales` page lets clinic staff browse past sales, see live KPIs, and record a sale by hand through a manual-entry modal. Backed by a new `GET /sales` list endpoint, a `GET /sales/summary` aggregate, the existing `POST /sales`, and a new `payment_method` column on `sales_records`.

### What's where

```
backend/
├── alembic/versions/006_sales_payment_method.py   Adds payment_method column
├── app/
│   ├── models/sale.py                              PaymentMethod enum + column
│   ├── schemas/sale.py                             Validation + UTC datetime serializer
│   ├── routers/sales.py                            GET /sales, /summary, POST /sales
│   ├── routers/products.py                         /products/search accepts status filter
│   ├── routers/inventory.py                        Adjust rejects negative result
│   └── schemas/purchase_order.py                   Non-negative qty/cost guards
frontend/
├── lib/api.js                                      listSales, getSalesSummary, createSale, searchProducts
└── pages/SalesRecords.jsx                          Page + ManualSaleModal
```

### What you see in the UI

Open `http://localhost:8000/app/#/sales`:

| Region | What it does |
|---|---|
| **KPI tiles** (top, 4 cards) | 本日の販売件数 / 本日の売上 / 今月の売上 / 今月の販売件数 — live from `GET /sales/summary` |
| **支払方法 chips** | すべて / 現金 / カード / PayPay / 銀行振込 — filter the table by payment method |
| **Table** | 日時 / 商品 / SKU / 数量 / 単価 / 小計 / 支払方法 — newest first, 50 rows per page |
| **＋ 手動入力 button** (top right) | Opens the manual sale entry modal |

KPI windows use **JST** day/month boundaries so early-morning JST sales don't slip into "yesterday".

### Manual entry modal

Click **＋ 手動入力** to open. The form:

| Field | Required | Notes |
|---|---|---|
| 商品 | ✅ | Typeahead — searches `/products/search?status=active` so draft items are hidden |
| 店舗 | ✅ | Auto-selects the first branch |
| 数量 | ✅ | Integer ≥ 1 |
| 単価 | ✅ | ≥ 0, auto-filled from the selected variant's price but editable |
| 小計 | (computed) | Live `quantity × unit_price` |
| 支払方法 | ✅ | Chip toggle, defaults to 現金 |
| 日時 | optional | `datetime-local` — blank = server's `now()` (UTC) |
| メモ | optional | 200-char limit with counter |

On save → `POST /sales` → modal closes → success toast → KPI tiles + table refetch.

### Stock guardrails

The modal will not let you record a sale that would drive `on_hand` below zero. The Save button stays disabled when:
- A variant is selected and `quantity > on_hand`, or
- The selected variant's `on_hand` is `0`

A red ⚠ warning ("在庫切れのため販売できません" / "在庫が不足しています（残り N個）") appears under the form.

This is enforced in **three layers** — Pydantic schema, FastAPI handler, and React UI — so even direct API calls (e.g. via `/docs`) can't bypass it.

The same negative-stock pattern showed up in two other endpoints and was fixed preemptively:
- `POST /variants/:id/inventory-adjust` — rejects an adjustment whose resulting counter would be negative.
- `POST /purchase-orders/:id/receive` — enforces `quantity_received ≥ 1`.

### API endpoints added

All require `X-Store-Id`.

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/sales` | Paginated list. Query params: `payment_method`, `branch_id`, `date_from`, `date_to`, `limit`, `offset` |
| `GET` | `/sales/summary` | Today / month count + revenue (JST windows) |
| `POST` | `/sales` | Existed — now also accepts `payment_method`, validates quantity vs stock |
| `GET` | `/products/search` | Existed — now accepts optional `status` filter (manual-entry passes `status=active`) |

`SaleRead` now denormalizes `product_name` + `sku` and emits `sold_at` / `created_at` with explicit UTC `Z` suffix so the browser doesn't mis-parse naive timestamps as local time.

### payment_method column

Migration **006** adds `sales_records.payment_method` as a MySQL ENUM (`cash` / `card` / `paypay` / `bank_transfer`) with `server_default='cash'` so pre-existing rows keep working. A composite index on `(store_id, payment_method, sold_at)` keeps filtered list queries fast.

Re-run `scripts\setup.bat` (or `alembic upgrade head` inside `backend/`) once after pulling the branch to apply the migration.

### How to test

1. Pull the branch: `git checkout feature/sales-records && git pull`
2. Apply the migration: `scripts\setup.bat` (or `cd backend && .venv\Scripts\python.exe -m alembic upgrade head`)
3. Start the dev server: `scripts\dev-https.bat`
4. Open `https://127.0.0.1:8000/app/#/sales`
5. Click **＋ 手動入力**, fill the form, save → row appears in the table, KPIs update
6. Try selecting a low-stock or 0-stock item and confirm Save is blocked
7. Click each 支払方法 chip and confirm the row count narrows

To create a 0-stock test item:
```sql
mysql -u root -padmin product_management_dev -e "
INSERT INTO products (store_id, name, status, item_type, is_insurable, is_pinned)
VALUES (1, 'テスト在庫切れ', 'active', 'product', 0, 0);
SET @pid = LAST_INSERT_ID();
INSERT INTO product_variants (product_id, store_id, sku, price, cost, on_hand, is_default, weight_unit, low_stock_threshold)
VALUES (@pid, 1, 'TEST-OOS', 500, 300, 0, 1, 'g', 10);
"
```

---

<!--
Add the next feature section here. Suggested template:

## <Feature name>

Branch: `feature/...`

One-paragraph summary.

### What's where
### What you see in the UI
### API endpoints added
### How to test
-->
