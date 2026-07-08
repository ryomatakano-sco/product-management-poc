# SCO Product Management — Proof of Concept

Feature-by-feature documentation. Each section covers one feature that has been added on top of the base project. For project setup, run instructions, and architecture, see the main [README.md](./README.md).

---

## 販売記録 (Sales Records)

Branch: `feature/sales-records`

The `#/sales` page lets clinic staff browse past sales, see live KPIs with day/month deltas, filter by 期間 / 拠点 / 支払方法 / 担当者 / 患者紐付け, search by product or transaction ID, export the filtered list to CSV, and record a sale by hand. Each row supports drill-in (詳細), refund (返品), and receipt issue (レシート発行 with 8% / 10% tax breakdown).

Built up in four increments (P1 polish → P2 filters + KPIs + CSV → P3 transaction ID + staff + detail → P4 refund) plus F12 (receipt issue). Everything since migration 005 is part of this branch.

### What's where

```
backend/
├── alembic/versions/
│   ├── 006_sales_payment_method.py     payment_method ENUM column
│   ├── 007_sales_txn_and_staff.py      transaction_id + sold_by columns
│   ├── 008_sales_refund.py             refunded_at + refund_of_sale_id + refund reason
│   └── 009_product_tax_rate.py         products.tax_rate ENUM (standard/reduced)
├── app/
│   ├── models/sale.py                   PaymentMethod enum, transaction_id, sold_by, refund fields
│   ├── models/product.py                TaxRate enum + tax_rate column
│   ├── models/inventory.py              AdjustmentReason.refund
│   ├── schemas/sale.py                  Validation, UTC datetime, receipt + summary schemas
│   ├── routers/sales.py                 List / summary / staff / export / detail /
│   │                                    receipt-data / create / refund
│   ├── routers/products.py              /products/search accepts status filter
│   ├── routers/inventory.py             Adjust rejects negative result
│   └── schemas/purchase_order.py        Non-negative qty / cost guards
frontend/
├── lib/api.js                           listSales, getSalesSummary, downloadSalesCsv,
│                                        searchProducts, getSale, listSalesStaff,
│                                        createSale, refundSale, getReceiptData
├── lib/hooks.js                         Adds #/sales/:id/receipt route
├── app.jsx                              Mounts ReceiptIssue for the receipt route
├── index.html                           Loads ReceiptIssue.jsx
└── pages/
    ├── SalesRecords.jsx                 List page + ManualSaleModal + SaleDetailModal
    │                                    + SalesKpi + SalesFilterSelect + PmChip
    └── ReceiptIssue.jsx                 Receipt-issue page + ReceiptPreview
```

### What you see in the UI

Open `http://localhost:8000/app/#/sales`:

| Region | What it does |
|---|---|
| **KPI tiles** (top, 4 cards) | 本日の販売件数 / 本日の売上 (税込) / 今月の売上 (税込) / 今月の販売件数 — each with a green ↑ or red ↓ delta chip (+X 昨日比 / +% 先月比) |
| **Filter bar** (5 dropdowns + search) | 期間 (本日 / 昨日 / 過去7日 / 今月 / 先月 / 全期間) · 拠点 · 支払方法 · 担当者 · 患者紐付け · 商品名・SKUで検索 (debounced) |
| **Header buttons** | ⬇ CSVエクスポート · ＋ 手動入力 |
| **Table** | 日時 / 取引ID (green mono `SL-YYYYMMDD-####`) / 商品 (SKU on 2nd line) / 数量 / 合計 (税込) / 支払方法 (colored chip) / 担当者 / 患者 (`〇〇 さま` link) / 操作 (詳細 · 返品) |
| **Refund rows** | Red **返品** chip in the 商品 cell, negative quantity + total rendered in red |
| **Pagination footer** | 表示件数 (25 / 50 / 100), "M-N件 / 全X件", ← 前へ / 1 / 次へ → |

KPI windows use **JST** day/month boundaries so early-morning JST sales don't slip into "yesterday".
`sold_at` and `created_at` are emitted with an explicit UTC `Z` suffix so the browser doesn't mis-parse naive timestamps as local time.

### Manual entry modal (＋ 手動入力)

| Field | Required | Notes |
|---|---|---|
| 商品 | ✅ | Typeahead — `/products/search?status=active` so draft items are hidden |
| 店舗 | ✅ | Auto-selects the first branch; hidden entirely when only one branch exists |
| 数量 | ✅ | Integer ≥ 1 |
| 単価 | ✅ | ≥ 0, auto-filled from the selected variant's price but editable |
| 小計 | (computed) | Live `quantity × unit_price` |
| 支払方法 | ✅ | Chip toggle (green when active), defaults to 現金 |
| 担当者 | optional | Free-text (populates the 担当者 filter dropdown) |
| 患者 | optional | Free-text patient name |
| 日時 | optional | `datetime-local` — blank = server's `now()` (UTC) |
| メモ | optional | 200-char limit with counter |

On save → `POST /sales` → modal closes → success toast → KPI tiles + table + staff list refetch.

### Detail modal (詳細)

Shows every field on the sale in a read-only sheet.

- If the row is a **refund row** → red banner "返品行 — 元の販売 ID: N"
- If the original has been **refunded** → amber banner "⚠ この販売は …に返品されました"
- Footer: **この販売を返品** (only when refundable) · **🧾 レシート発行** · **閉じる**

### Refund flow (返品)

Click **返品** in the 操作 column (or **この販売を返品** in the detail modal) → confirmation → `POST /sales/:id/refund` → creates a negative-quantity row with its own transaction ID, marks the original as refunded, adds the stock back on the variant, and logs an `InventoryAdjustment` with `reason=refund`.

Guards against: sale not found (404), already refunded (400), refunding a refund row (400), zero/negative quantity (400).

### Receipt issue page (🧾 レシート発行)

Reached from the detail modal's **🧾 レシート発行** button → navigates to `#/sales/:id/receipt`.

Split panel:
- **Left (form)** — 書式 pills (レシート / 領収書 / 請求書), 宛名 + 但し書き side-by-side, 税率の内訳 with 10% / 8%(軽減) badges, right-aligned **⬇ PDF で保存** + **🖨 印刷する** buttons
- **Right (live preview)** — narrow receipt card that updates as you type; header block (company name / address / TEL / 登録番号 from Settings › 一般), transaction meta line, dashed dividers, per-item lines with ※ marker on reduced-tax items, 小計 / 内消費税 breakdown by rate, 合計, payment method, ※印 note, 取引ID, ご来院ありがとうございました

Print / PDF via a clone-to-body pattern: the receipt is cloned to a direct child of `<body>` right before `window.print()`, all other body children are `display: none` via a `.plx-printing` class, and the clone is removed after the print dialog closes. Result: single-page PDF with no app chrome.

### Stock guardrails

The manual-entry modal will not let you record a sale that would drive `on_hand` below zero. Save button stays disabled when:
- A variant is selected and `quantity > on_hand`, or
- The selected variant's `on_hand` is `0`

A red ⚠ warning ("在庫切れのため販売できません" / "在庫が不足しています（残り N個）") appears under the form.

Enforced in **three layers** — Pydantic schema (`quantity > 0`, `unit_price ≥ 0`), FastAPI handler (`quantity ≤ on_hand`), and React UI (Save disabled) — so even direct API calls (via `/docs`) can't bypass it.

The same negative-stock pattern showed up in two other endpoints and was fixed preemptively:
- `POST /variants/:id/inventory-adjust` — rejects an adjustment whose resulting counter would be negative
- `POST /purchase-orders/:id/receive` — enforces `quantity_received ≥ 1`

Products in `draft` status can't be sold: `/products/search` accepts an optional `status=active` filter (which the manual-entry modal always passes), and `POST /sales` refuses non-active products even if hit directly.

### API endpoints added

All require the `X-Store-Id` header.

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/sales` | Paginated list. Params: `payment_method` / `branch_id` / `sold_by` / `date_from` / `date_to` / `has_patient` / `q` / `limit` / `offset` |
| `GET` | `/sales/summary` | Today / yesterday / month / last-month count + revenue (JST windows) — powers the KPI tiles and their delta chips |
| `GET` | `/sales/staff` | Distinct non-null `sold_by` values — feeds the 担当者 filter |
| `GET` | `/sales/export.csv` | Streaming CSV of the current filter set (UTF-8 BOM for Excel) |
| `GET` | `/sales/:id` | Sale detail |
| `GET` | `/sales/:id/receipt-data` | Sale + store info + 8% / 10% tax breakdown for the receipt page |
| `POST` | `/sales` | Records a sale — accepts `payment_method`, `sold_by`, `patient_ref`; auto-generates `transaction_id`; validates quantity vs stock and product status |
| `POST` | `/sales/:id/refund` | Creates a negative-quantity refund row, restores `on_hand`, logs an audit adjustment |
| `GET` | `/products/search` | Existed — now accepts optional `status` filter (manual-entry passes `status=active`) |

`SaleRead` denormalizes `product_name` + `sku` and emits `sold_at` / `created_at` / `refunded_at` with an explicit UTC `Z` suffix.

### Schema summary

| Migration | Adds |
|---|---|
| **006** — `006_sales_payment_method.py` | `sales_records.payment_method` ENUM('cash','card','paypay','bank_transfer') + composite index on `(store_id, payment_method, sold_at)` |
| **007** — `007_sales_txn_and_staff.py` | `sales_records.transaction_id` (unique, format `SL-YYYYMMDD-####`) + `sales_records.sold_by` (free-text staff name). Backfills existing rows using a window function partitioned by (store, JST date) |
| **008** — `008_sales_refund.py` | `sales_records.refunded_at` + self-FK `refund_of_sale_id`; extends `adjustment_reason` ENUM with `'refund'` |
| **009** — `009_product_tax_rate.py` | `products.tax_rate` ENUM('standard'=10%, 'reduced'=8%), default `'standard'` |

Migrations are chained through `down_revision`, so a single `alembic upgrade head` walks the whole ladder.

### How to test

1. Pull the branch: `git checkout feature/sales-records && git pull`
2. Apply the migrations: `scripts\setup.bat` (or `cd backend && .venv\Scripts\python.exe -m alembic upgrade head`) — picks up all four
3. Start the dev server: `scripts\dev-https.bat`
4. Open `https://127.0.0.1:8000/app/#/sales`

Verify:
- **KPI tiles + deltas** — record two sales today, one yesterday → today's chip should read `+1 昨日比` or similar
- **Filter bar** — click each 期間 / 拠点 / 支払方法 / 担当者 / 患者紐付け and confirm the table narrows
- **Search** — type a product name, SKU, or the start of a transaction ID
- **Pagination** — set 表示件数 = 25, navigate with 前へ / 次へ
- **CSV** — click **⬇ CSVエクスポート**, open in Excel, confirm Japanese renders (BOM)
- **手動入力** — fill 商品 (typeahead) + 数量 + 単価 + 支払方法 + 担当者 + 患者 → save
- **Stock block** — try to sell a variant with `on_hand=0` (see SQL below) → Save stays disabled
- **詳細 / 返品** — click 詳細 on any sale → click **この販売を返品** → confirm → refund row appears in red at the top of the table
- **🧾 レシート発行** — open a detail modal → click **🧾 レシート発行** → switch between レシート / 領収書 / 請求書 → click **🖨 印刷する** → confirm the print preview shows just the receipt (single page)

Optional — mark a product as reduced-tax so the receipt shows the 8% bracket:
```sql
UPDATE products SET tax_rate='reduced' WHERE id=<PRODUCT_ID>;
```

To create a 0-stock test item for the guardrail check:
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
