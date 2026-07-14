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

## クイック改善バッチ (Quick wins batch)

Branch: `feature/sales-records`

Eight small features from the "Quickest Improvements" list, shipped together: a real 発注書作成 form, 仕入先/店舗の追加・編集 forms, CSV export on four pages, pagination on three list pages, quick-chip count badges, and an AI 接続テスト button. All of them wire existing backend capabilities to the UI; the only new backend surface is the CSV export endpoints and the connection test.

### What's where

```
backend/app/routers/
├── purchase_orders.py   GET /purchase-orders/export.csv (before /{po_id})
├── vendors.py           GET /vendors/export.csv (before /{vendor_id})
├── categories.py        GET /categories/export.csv (before /{category_id})
├── inventory.py         GET /inventory/export.csv (棚卸し形式) + shared _build_inventory_rows
└── settings.py          POST /settings/ai/test + fix: AI PUT no longer wipes the stored key
frontend/
├── lib/api.js           downloadCsv generic + per-page wrappers, createPurchaseOrder, testAiConnection
└── pages/
    ├── PurchaseOrders.jsx  POCreateModal (仕入先/拠点/納品予定日/備考/明細エディタ) + CSV button
    │                       + pagination + receive modal shows product name (was 商品ID)
    ├── Vendors.jsx         VendorFormModal (追加) + エクスポート button
    ├── Branches.jsx        BranchFormModal (追加・編集) + card 詳細/編集 buttons
    │                       + fix: BranchDetail crashed on undefined `snap`
    ├── Inventory.jsx       棚卸しCSVダウンロード + pagination
    ├── Categories.jsx      エクスポート button
    ├── ProductList.jsx     pagination + count badges on 在庫低下/期限間近 chips
    └── Settings.jsx        AI 接続テスト button + 接続済み/失敗 pill
```

### Notes

- All CSV endpoints stream with a UTF-8 BOM so Excel renders Japanese correctly, and respect the page's active filters.
- The 棚卸しCSV has blank 実地棚卸数 / 差異 / メモ columns for use on the floor during a stock take.
- Pagination is client-side over one capped fetch (100–200 rows) — right-sized for PoC data volumes; KPI strips stay whole-dataset accurate.
- `POST /settings/ai/test` uses the settings-stored key first, then the env `OPENAI_API_KEY`; it never echoes the key back.
- Static-path routes (`export.csv`) are registered before `/{id}` routes so they aren't parsed as integer ids.

### How to test

1. 発注書: ＋発注書を作成 → pick 仕入先/拠点, add 明細 → 下書きとして作成 → lands on the new PO detail. ⬇ CSVエクスポート downloads the filtered list.
2. 仕入先 / 院・店舗: ＋追加 opens a real form; branch cards now have 詳細 / 編集 buttons.
3. 在庫: ⬇ 棚卸しCSVダウンロード; pager at the bottom of the table.
4. 商品一覧: 在庫低下/期限間近 chips show live counts; pager at the bottom.
5. 設定 › AI設定: 接続テスト → green 接続済み pill (or a reasoned failure message).

---

## クイック改善バッチ 2 (Quick wins batch 2)

Branch: `feature/sales-records`

Three items from the medium list plus a navigation-reachability fix found by audit.

### Navigation audit result

Every route was checked for inbound links (sidebar, buttons, row clicks). One orphan found and fixed:

- `#/sales/:id` was parsed by the router (`sale_detail` in `lib/hooks.js`) but `app.jsx` had **no case for it** — it silently rendered the 開発中 placeholder, and no page ever linked to it. It now renders the Sales Records page with that sale's 販売詳細 modal auto-opened, making sales deep-linkable (e.g. from a future notification or the command palette).
- Everything else is reachable: all 12 sidebar pages, product detail/create/edit, PO detail (list rows), vendor/branch detail (list rows / cards), receipt page (detail modal), scan page (QR — intentionally unlinked).

### Features

| Feature | Where |
|---|---|
| 仕入先詳細タブ (取扱商品 / 発注履歴) | `frontend/pages/Vendors.jsx` — `VendorProductsTab` / `VendorPosTab`. **No new backend** — the existing list endpoints already filter by `vendor_id` / `supplier_vendor_id`. Replaces the 近日対応 blue card; `POStatusPill` exported on `window` for reuse. |
| 在庫金額 (税抜) KPI | Backend adds per-row `value_jpy` (on_hand × variant price — same rule as the branch snapshot, so figures agree) in `_build_inventory_rows`; 5th KPI tile on 在庫 |
| 最近の調整履歴 | New `GET /inventory/adjustments` (cross-variant, newest first, product name + SKU denormalized); table section at the bottom of 在庫 with signed colored deltas, reason labels (販売/入荷/棚卸修正/破損/返品…), row click → product detail |

### How to test

1. 仕入先 → any vendor → 取扱商品 / 発注履歴 tabs show that vendor's products and POs; rows click through.
2. 在庫 → second KPI tile shows 在庫金額 (税抜); scroll down for 最近の調整履歴 (record a sale or adjustment to see it update).
3. Type `#/sales/1` in the URL → sales page opens with the 販売詳細 modal for that sale.

---

## クイック改善バッチ 3 (Quick wins batch 3)

Branch: `feature/sales-records`

Three more medium items.

| Feature | Where |
|---|---|
| 在庫調整モーダル (在庫ページ) | The 在庫 page's ＋在庫調整 button used to link to the **product-create page** (a broken affordance). Now a two-step flow: `AdjustProductPicker` (product → variant, shows current counters) → the shared adjust modal from ProductDetail (`window.PlxInventoryAdjustModal`). On save: toast + list & 調整履歴 refetch. |
| 実データの12週販売チャート | New `GET /products/{id}/sales-weekly` (JST weeks, Monday start, refunds negative). `SalesChart` in [ProductDetail.jsx](frontend/pages/ProductDetail.jsx) now renders real buckets with week labels + hover tooltips (was a hard-coded fake shape — Category E item 13 in the gap doc). |
| 発注書の印刷 / PDF | 🖨 印刷 / PDF button on PO detail. Off-screen `POPrintSheet` (発注書 layout: issuer block from 設定›一般, 御中 header, bordered items table, totals, 備考) printed via the same clone-to-body pattern as the receipt page. Monochrome regardless of dark mode. |

### How to test

1. 在庫 → ＋在庫調整 → pick 商品/バリアント → 次へ → set ±数量/理由 → 調整を確定 → history section updates.
2. 商品詳細 → 売上推移 tab → bars are real weekly sales (hover a bar for units + revenue). Record a sale and refresh to see the current week move.
3. 発注書詳細 → 🖨 印刷 / PDF → print preview shows only the 発注書 sheet; choose "Save as PDF".

---

## クイック改善バッチ 4 (Quick wins batch 4)

Branch: `feature/sales-records`

| Feature | Where |
|---|---|
| 商品一覧の一括操作 | [ProductList.jsx](frontend/pages/ProductList.jsx) — the previously decorative checkboxes now track selection (row + header select-all per page). A green bulk bar appears when rows are selected: **N件選択中 / 一括カテゴリ変更 (category dropdown + apply) / 🗄 一括アーカイブ (confirm → DELETE loop) / 選択をクリア**. Per-item failures are counted and reported in the toast. Selection resets when filters change. |
| ダッシュボード カテゴリ別在庫 (実データ) | `CategoryBars` was hard-coded sample data with a TODO; the backend's `/dashboard/summary` already returned `category_breakdown`. Now rendered for real: zero-stock categories hidden, sorted by stock desc (top 8), each row shows count + 在庫金額 and **clicks through to `#/products?category_id=N`** (ProductList now honours that query param). |
| 重複登録の検知 (商品登録) | [ProductCreate.jsx](frontend/pages/ProductCreate.jsx) — debounced (500ms) catalog check while typing. Exact **JAN match → red banner** 「⚠ 同じ JAN の商品が既に登録されています」; **name similarity → amber note** 「💡 似た名前の商品が既にあります」. Both show the existing product's name + 既存の商品を開く → button. Non-blocking (you can still save), skipped in edit mode. Uses the list endpoint's `match_reasons` (barcode/name/kana) — no new backend. Future-features doc item #22. |

### How to test

1. 商品一覧 → tick the header checkbox → green bar shows 12件選択中 → pick a category → 一括カテゴリ変更 (or 一括アーカイブ with confirm).
2. ダッシュボード → カテゴリ別在庫状況 shows real counts/values; click a bar to open that category's product list.
3. 商品登録 → type an existing JAN (e.g. `4901616213241`) in JAN/バーコード → red duplicate banner; type an existing product name → amber similar-name note.

---

## クイック改善バッチ 5 (Quick wins batch 5)

Branch: `feature/sales-records`

The last two items from the medium list that don't require file-upload infrastructure.

| Feature | Where |
|---|---|
| 再発注済トラッキング | Migration `010_product_reorder_requested.py` adds `products.reorder_requested_at`. Clicking 🔗 再発注する on product detail now **stamps the product** (fire-and-forget PATCH) and shows a ✓ 再発注済 badge with the date. The 商品一覧「再発注済」chip — a `console.log` TODO since May — is now a real backend filter (`?reorder_requested=true`) with a live count. **Receiving a PO automatically clears the flag** on the affected products (reorder fulfilled). |
| 発注書 期間フィルタ + 実データKPIデルタ | New `GET /purchase-orders/summary` (今月 vs 先月 count/amount — cancelled excluded — plus current 入荷待ち/一部入荷 counts). KPI tiles now show **↑ +N件 先月比 / ↑ +¥X 先月比** delta chips and no longer depend on the visible page's rows. New 期間 select (過去7日/今月/先月/全期間) filters the list and the CSV export via `date_from`/`date_to`. |

### Notes / gotchas

- **Run `alembic upgrade head`** after pulling — this batch adds migration 010.
- `purchase_orders.created_at` comes from MySQL `NOW()` (server-local = **JST-naive** on the dev box), unlike `sales_records.sold_at` which is Python-set UTC-naive. The PO date filters and summary boundaries therefore compare in JST-naive space (`_to_naive_jst` in the router). Worth remembering if timestamps ever look 9 hours off.
- GUM デンタルブラシ #211 is currently stamped 再発注済 as a demo — receive a PO containing it (or PATCH `reorder_requested_at: null`) to clear.

### How to test

1. 商品詳細 (a product with 発注先 URL) → 🔗 再発注する → toast + ✓ 再発注済 badge appears.
2. 商品一覧 → 再発注済 chip shows a count; clicking filters to just the stamped products.
3. 発注書 → KPI tiles show 先月比 delta chips; 期間 select narrows the table (and the CSV export follows it).
4. Receive a PO for a stamped product → its 再発注済 badge/chip entry disappears.

---

## 表示ロゴのアップロード (Logo upload)

Branch: `feature/sales-records`

The last medium item — and the app's **first real file-upload plumbing** (everything before this was URL-input only).

### What's where

| Piece | Where |
|---|---|
| Upload / delete endpoints | `backend/app/routers/settings.py` — `POST /settings/logo` (multipart) + `DELETE /settings/logo`. PNG/JPEG/WebP only, 2MB cap. **SVG deliberately rejected** (can embed scripts — stored-XSS vector). Replacing or deleting removes the old file from disk. |
| Storage & serving | Files land in `backend/media/` (gitignored, auto-created) with random names (`logo_{store}_{token}.png`), served at `/media/` by a new StaticFiles mount in `main.py`. |
| Settings blob | The public URL is written into the `general` namespace's existing `logo_url` field — the schema had the field since prompt 03; it was just never populated. Normal GET/PUT round-trips preserve it. |
| UI | 設定 › 一般 → 表示ロゴ: dashed **click-or-drag drop zone** (mockup's ブランディング design). Once uploaded: preview thumbnail + 変更 / 削除 buttons. `useSettingsForm` gained a `reload` so the pane refreshes after upload. |

### How to test

1. 設定 › 一般 → 表示ロゴ → click the dashed zone (or drag an image onto it) → preview appears, toast confirms.
2. 変更 swaps the file (old one is deleted from `backend/media/`); 削除 clears it back to the drop zone.
3. Try a non-image or >2MB file → Japanese validation error toast.

The logo is stored and served; wiring it into the receipt/PO print headers is a natural follow-up.

---

## 認証・ユーザー管理 (Auth & user management) — heavy tier 1

Branch: `feature/sales-records` · Migration **011**

PoC-grade session auth: the app now has a real login. Unauthenticated visitors see a
paylight X login page; sessions are HttpOnly HMAC-signed cookies (7 days, stateless — they
survive server restarts). Passwords are hashed with stdlib **scrypt** (no new dependency).

| Piece | Where |
|---|---|
| `users` table + dev admin | Migration `011_users_auth.py` inserts **admin@example.com / admin** for existing DBs; `seed.py` creates the same on fresh installs |
| Token/hash primitives | `backend/app/services/auth.py` (secret: `AUTH_SECRET` env, fixed dev default) |
| Endpoints | `POST /auth/login`, `POST /auth/logout`, `GET /auth/me`, admin-only `GET/POST /auth/users` + `PATCH /auth/users/{id}` (duplicate email → 409; self-demotion/deactivation → 400) |
| Store resolution | `deps.get_store_id`: session cookie wins; **`X-Store-Id` header kept as dev fallback** so curl/DevPanel keep working (remove in production) |
| UI | `pages/Login.jsx` + auth gate in `app.jsx` (the `#/scan` phone page stays ungated); AdminShell footer shows the real user + ⎋ logout; 設定 › ユーザー管理 is now a real pane (list / add / role / enable-disable; staff see a polite notice) |

**How to test:** log out via the sidebar ⎋ → login page appears → sign in with
admin/admin → footer shows your name; 設定 › ユーザー管理 → add a staff user, log in as
them in an incognito window → ユーザー管理 shows "管理者のみ".

---

## 拠点別在庫 (Per-branch inventory) — heavy tier 2

Branch: `feature/sales-records` · Migration **012**

Stock is now tracked **per branch**. New table `variant_branch_stock` holds one row per
(variant, branch); existing stock was backfilled to each store's 本院. The variant's old
counters remain as **denormalized store-wide totals**, so every existing read kept working.

The new `services/stock.py` is the single choke point for ALL stock movement — it validates
the branch belongs to the store, upserts the branch row, and applies the delta **atomically
in SQL with a non-negative guard** at both the branch and total level. This also fixes three
audit findings in one stroke: the C3 oversell race, M2/M4 cross-tenant branch/variant writes,
and per-path negative-stock gaps.

| Rewired path | Behavior now |
|---|---|
| `POST /sales` | decrements at the sale's 拠点 (validated); oversell at that branch → 400 「この拠点の在庫が不足しています」 |
| `POST /sales/:id/refund` | restores stock at the original sale's branch |
| `POST /variants/:id/inventory-adjust` | accepts optional `branch_id` (default = 本院); rejects archived products (audit M8) |
| `POST /purchase-orders/:id/receive` | stock lands at the PO's 納品先拠点; variant/product lookups store-scoped |
| `POST /purchase-orders` | validates vendor / branch / every line variant belong to the store (audit M3) → 400 |
| `GET /inventory?branch_id=` | **finally real** — counters come from that branch's rows (0 when absent); 棚卸しCSV follows |
| `GET /branches/:id/inventory-snapshot` | true per-branch numbers (was store-wide duplicated on every card) |
| `inventory_adjustments.branch_id` | audit trail records WHERE stock moved |

UI: 在庫 page gains a 拠点 filter select; the shared 在庫調整 modal gains a 拠点 select
(hidden for single-branch stores, defaults to 本院).

**Verified end-to-end:** backfill (本院 348 items / 梅田 0) → +3 adjust at 梅田 → oversell 5
blocked with per-branch message → sell 2 → 梅田 1・本院 unchanged・total consistent → refund
restores 3 → PO received into 梅田 → 4; foreign-variant PO → 400; invalid branch → 400.
Totals remained exactly equal to branch-row sums throughout — including during concurrent
real edits from the product edit screen.

**Unlocked next (cheap now):** branch-to-branch transfer = one endpoint creating a paired
±delta via `apply_stock_delta` with a new `transfer` reason.

---

## 通知配信 (Notification delivery) — heavy tier 3

Branch: `feature/sales-records` · Migration **013**

The 設定 › 通知 toggles finally DO something. Notifications are real: an in-app feed behind
the topbar bell, plus optional email when SMTP is configured.

| Piece | Where |
|---|---|
| `notifications` table | Migration `013_notifications.py` — kind / title / body / link_path / read_at, per-store |
| Dispatch service | `backend/app/services/notifier.py` — `notify()` writes the row and (when `email_enabled` + SMTP configured) fires a plain-text email in a background thread. **Never raises** — a notification failure can't break a sale. Unread duplicates (same kind + link) are suppressed, so a product below threshold doesn't spam a row per sale |
| Emitters | Sales create + downward inventory adjust → `check_low_stock` (re-reads counters post-atomic-update; fires when available ≤ per-variant threshold). PO submit / receive / cancel → `po_status`. Daily loop in `main.py` fires a 日次サマリー (low-stock + expiring counts) at each store's `daily_summary_time` (JST, deduped per day) |
| Endpoints | `GET /notifications` (items + unread_count), `POST /notifications/{id}/read`, `POST /notifications/read-all` |
| Bell UI | `AdminShell.jsx` `NotificationBell` — 30s poll, unread count badge, dropdown with kind icons + relative time, click = mark read + navigate, すべて既読 |
| SMTP settings | New fields in the notifications namespace (`notify_email`, `smtp_host/port/user/password/from`) + inputs in 設定 › 通知. Empty = in-app only |

**Honored toggles:** `low_stock`, `expiring_soon`, `po_status_change` gate their kinds;
`email_enabled` gates email. PoC notes: read state is per-store (not per-user); SMTP
password sits in the settings blob like other PoC secrets.

**Verified:** low-stock fires on a threshold-crossing sale (「在庫低下: test 6 — 利用可能在庫が
4 個…」) with dedupe (second sale → still one unread row); PO cancel/submit/receive rows with
correct titles + links; read / read-all → unread_count 0; stock-affecting test sales refunded.

**How to test:** sell a low-stock product → bell shows a badge within 30s → click the row →
lands on the product page, row marked read. Configure SMTP + 宛先 in 設定 › 通知 to also
receive emails.

---

## ロット管理 (FEFO lot tracking) — heavy tier 4

Branch: `feature/sales-records` · Migration **014**

The ロット履歴 tab shows **real data** now — the fabricated LOT-2026A-012 sample rows are gone
(the last "mock data" item from the gap analysis).

- `product_lots`: one row per received lot of a variant at a branch. Lots are a **tracking
  layer** — `variant_branch_stock` remains the stock source of truth, and all lot movement
  helpers (`services/lots.py`) are best-effort: a lot hiccup can never break a sale.
- **Capture:** the PO 入荷を記録 modal gains optional ロット番号 + 使用期限 per line →
  creates/merges a lot at the PO's 納品先拠点. Existing consumables with lot/expiry data were
  backfilled (one lot per stocked branch).
- **FEFO:** sales consume lots earliest-expiry-first (NULL expiry last) at the sale's branch;
  refunds restock the newest lot. Manual adjustments deliberately don't touch lots
  (documented PoC gap — the tab footer explains 未追跡分).
- `GET /products/{id}/lots` → rows with status (使用中/期限切れ/使い切り), branch, received date.

**Verified:** backfill created lots for the 4 seeded consumables (expired one correctly
flagged); receive with LOT-TEST-A + expiry → appears in the tab; sale dropped it 3→2 (FEFO);
refund restored 3.

---

## 実AIサマリー (Real AI dashboard summary) — heavy tier 5

Branch: `feature/sales-records`

The dashboard's 再生成 button now calls a **real LLM** (gpt-4.1-nano via the OpenAI API).

- Cost design: **only the 再生成 click spends tokens** (~¥0.1–0.2). The narrative is cached
  per (store, JST-day); plain GETs serve the cached text — or the free deterministic
  template when nothing was generated today. No key / `MOCK_AI=1` / API failure → silent
  template fallback, so the dashboard always renders.
- The prompt receives **aggregates only** (KPI counts, top-5 attention names, month sales) —
  no raw rows leave the DB.
- Response gains `ai_generated: bool`; the card shows a **✨ AI生成** badge when the narrative
  is live-generated.

**Verified with a real call:** regenerate produced a coherent Japanese morning-brief
(「…**4 件**が在庫低下のため早急な対応が必要です…」), and the follow-up GET served it from
cache with `ai_generated: true`.

---

## Phase 0 — 監査指摘の修正 + EN翻訳カバレッジ

Branch: `feature/sales-records`

The remaining fixes from `docs/audits/full_system_audit_2026-07-09.md`, plus an EN-mode
translation pass.

**Backend**
| Fix | What changed |
|---|---|
| C1/C2/M9 timezone skew | New `services/tz.py` (`jst_to_utc_naive` / `any_to_utc_naive`). Applied to sales summary boundaries, sales list/CSV `date_from/date_to`, and the dashboard 今月の売上 month start. **Verified:** a sale at 01:00 JST now counts toward *today* (pre-fix it landed in yesterday). PO endpoints untouched — their `created_at` is JST-naive and was already correct. |
| C4 transaction-id 500 | `_next_transaction_id` now probes for a free id (counts drift when rows are deleted / refunds inflate the day) instead of blindly using count+1; bails to a 409 after 200 probes. |
| M6 cross-field invariant | `apply_stock_delta` rejects committed/unavailable moves that would push branch *available* negative (verified: `利用可能: -99994` → 400 + rollback). |
| M8 receive guard | PO receive rejects archived products. |
| m1 default variant | Multi-variant API create with no `is_default` now really marks the first variant default (was a `pass`). |
| C5 refund fail-closed | Refund 400s when the variant's product record is missing. |

**Frontend (F1–F6)**
- F1: EN dashboard date no longer leaks `${["Sun",…]}` — the date is built locale-aware in
  Dashboard.jsx; the fragile dictionary template was removed. Verified: "Today is Mon, July 13, 2026".
- F2: `T.PLX_INK_050` (nonexistent token) → `T.PLX_SURFACE_50` in SalesRecords (stock badge + 小計 box).
- F3: bulk-bar category select now readable in dark mode (fixed dark-on-white pair).
- F4: PO submit/cancel/save-edit toasts now show the real server message (`e.body.detail`).
- F5/F6: 在庫履歴 tab refetches after an adjustment and follows the *default* variant.

**EN translation coverage**
- ~110 new dictionary entries covering everything shipped since May: login page, notification
  bell, users pane, SMTP section, per-branch filters/adjust flow, PO create modal + lot
  capture, lots tab, bulk bar, duplicate-detection banners, AI badge, CSV/export buttons.
- Fixed a live mistranslation: 「あと 17 日」 rendered as "あと 17 **Sun**" (the bare 日 counter
  hit the weekday entry). The indicator is now a single template child with its own entry →
  "17 days left". **Pattern note for future strings:** keep counter phrases as ONE template
  child (`{\`あと ${days} 日\`}`), never `あと {days} 日` split across children.
- Data values (category/vendor/product names) intentionally stay Japanese in EN mode.


## 最終バッチ — 移動・棚卸取込・自動発注・商品CSV取込・クイック販売・APIパネル

Branch: `feature/sales-records`

**Backend**
| Feature | Endpoint | Notes |
|---|---|---|
| 拠点間在庫移動 | `POST /inventory/transfer` | migration 015 が `inventory_adjustments.reason` に `'transfer'` を追加。移動元 −qty / 移動先 +qty を `apply_stock_delta` でアトミックに適用し、reason=`transfer` の監査行を 2 本記録。同一拠点は 400、在庫不足も 400。バリアント合計は不変（検証済み: 50 = 48+2 → 戻し）。 |
| 棚卸しCSV取込 | `POST /inventory/stocktake.csv?branch_id=` | エクスポートCSV（UTF-8 BOM / cp932 両対応）の「実地棚卸数」列を読み、システム在庫との差分を reason=`correction`・メモ「棚卸し取込 <日付>」の調整として適用。`{adjusted, unchanged, errors[]}` を返す（検証: 1 件修正 / 11 件変更なし）。 |
| 低在庫から自動発注 | `POST /purchase-orders/auto-draft` | 有効・仕入先設定済み・利用可能≦しきい値・未発注（オープンPOなし）のデフォルトバリアントを仕入先ごとにまとめ、下書きPOを作成。数量 = max(1, しきい値×2 − 利用可能)。再実行は重複を作らない（検証: 2 → 0 件）。 |
| 商品CSVインポート | `GET /products/import-template.csv` + `POST /products/import.csv` | ヘッダー名でマッピング（name 必須）。カテゴリ・仕入先は**名前**で解決、未知は行エラー。JAN 重複も行エラー。取込商品は下書き、初期在庫は `apply_stock_delta` で拠点別に整合（検証: 1 件取込 + 2 行エラー、branch 行と variant 合計一致）。 |

**Frontend**
- 在庫: `⇄ 拠点間移動` モーダル（商品→バリアント→移動元/先→数量→メモ）と `⬆ 棚卸しCSV取込`（hidden file input → 結果トースト）。調整履歴の transfer は「拠点間移動」ラベルで表示。
- 発注書: `⚡ 低在庫から自動作成` ボタン（作成件数をトースト）。
- 商品一覧: `⬆ インポート` モーダル（テンプレDL / ファイル選択 / 行エラーテーブル表示）。
- 商品詳細: `＋ 販売を記録` — SalesRecords の ManualSaleModal を `window.PlxManualSaleModal` として共有化し、`initialProduct` で商品プリフィル・担当者はログインユーザー名。
- 設定 > API・Webhooks: 実情パネル（ベースURL / Swagger `/docs` リンク / セッションクッキー + `X-Store-Id` の説明 / curl 例 / APIキー・Webhook は本番スコープの注記）。

**EN 翻訳の追加修正（ユーザー指摘: 「en 版で日本語が残る」）**
- 最終バッチ全 UI 文言 + 既存の抜け（在庫テーブルヘッダー、ページネーション、調整履歴ヘッダー、サイドバーフッター、検索プレースホルダー等）を辞書に追加（約 90 エントリ）。
- **i18n_autotr.js の実バグ修正**: テンプレートの優先順位が「キー全長」ソートだったため、スロット名が長い汎用キー（`${b.low_stock_threshold} 件`）が具体的なテンプレート（`${a} - ${b} 件 / 全 ${c} 件`）に勝ってしまい、末尾「件」が欠落する誤訳が発生。**リテラル部分の長さ**でソートするよう修正。
- ページネーション等の複数子 JSX は単一テンプレート子（`{`...`}`）に統一（Phase 0 のパターン規則に準拠）。


## フィードバック改善 A — 部分入荷の導線・返品理由・検索付きピッカー・増減の視覚化

Branch: `feature/sales-records`（ユーザーフィードバック 2026-07-13 反映）

| 指摘 | 対応 |
|---|---|
| 「部分入荷ができない」 | 調査の結果、API・モーダルとも部分入荷は**元々動作**（検証: 4/10 → 一部入荷 → +6 → 入荷済み）。ハマりどころは**下書きPOには入荷ボタンが出ない**こと（自動作成POは下書き）。下書きPO詳細に琥珀色のヒントバナー「先に 📤送信 で発注済みにすると部分入荷も記録できます」を追加。 |
| 返品理由の記録 | `POST /sales/{id}/refund` が任意 body `{reason}` を受付。返品行 note =「返品: <取引ID>｜理由: <理由>」、監査調整行 note =「理由: <理由>」。フロントは confirm() を廃止し、理由テキストエリア付きの返品モーダル（一覧・詳細の両方から共通の `RefundReasonModal`）。理由なしでも従来どおり動作（検証済み）。 |
| 在庫調整の商品選択が長い | 在庫調整ピッカーと拠点間移動モーダルに検索ボックスを追加 — `GET /products?q=` によるサーバー側絞り込みなので商品が増えても機能する（検証: 「グローブ」→ 1 件）。 |
| マイナス表記を色+方向で | 調整履歴（在庫ページ・商品詳細）の増減を `▲ +n`（緑）/ `▼ n`（赤）表記に変更。PO の KPI 前月比は既存の ↑/↓ ピル形式を踏襲。 |

EN 辞書: 返品モーダル・絞り込みプレースホルダー・下書きヒントの各文言を追加。


## フィードバック改善 B — 操作者の記録・監査ログ・税率編集・カテゴリ英語名・社内コード

Branch: `feature/sales-records`（migration 016）

| 機能 | 実装 |
|---|---|
| 誰が操作したかの記録 | `deps.CurrentUserName`（セッションクッキー → users.display_name のスナップショット）を全書き込み系に注入。`created_by` 列を sales_records / inventory_adjustments / purchase_orders に追加（mig 016）。販売作成・返品・在庫調整・移動・棚卸取込・PO作成/自動作成/入荷・商品CSV取込の全パスでスタンプ。表示: 調整履歴の「by 山田 花子」、販売詳細の「記録者」行、在庫一覧の 最終調整者。X-Store-Id 開発ヘッダー経由は NULL（匿名）。 |
| 監査ログ | `audit_events` テーブル + `services/audit.py log_event()`（呼び出し元のトランザクションに同乗、絶対に raise しない）。記録: ユーザー追加/無効化/有効化/権限変更/パスワード再設定、設定変更（namespace付き）。`GET /auth/audit-events`（管理者のみ）+ 設定 > ユーザー管理の下に監査ログパネル（最新15件）。 |
| 税率の編集 | 設定 > 税率が読み取り専用 → 完全編集可能に（名前・%・標準ラジオ・追加・削除・保存）。保存は既存の `PUT /settings/tax_rates`（スキーマ検証つき全置換）。変更は監査ログに記録。 |
| カテゴリ英語名 | `categories.name_en`（任意）。カテゴリ追加/編集モーダルに「英語名（任意）」欄。**表示の仕組み**: app.jsx がログイン後にカテゴリを取得し `name_en` を EN 辞書へ動的マージ → チップ・セレクト・テーブル等すべての描画箇所が自動で翻訳される（未設定カテゴリは日本語のまま = フォールバック）。 |
| 社内コード | `products.internal_code`: 消耗品 CA####、物販 PR####（店舗ごと連番）。mig 016 で既存商品をバックフィル、新規作成・CSVインポートでも自動採番（`_next_internal_code`）。商品一覧（名前下のモノスペース表記）と商品詳細（社内コード行）に表示。 |

検証: cookie ログイン → 調整で created_by=山田 花子、PR0001 表示、カテゴリ「歯ブラシ」に Toothbrush 設定 → EN モードで全画面 Toothbrush 表示、税率 PUT → audit_events に settings_updated 記録。


## フィードバック改善 C — 商品画像・POコメント・月別チャート・KPIローテーション

Branch: `feature/sales-records`（migration 017）

| 機能 | 実装 |
|---|---|
| 商品画像アップロード | `POST /products/{id}/images`（multipart, PNG/JPEG/WebP ≤4MB, ロゴと同じ /media 保存）+ `DELETE .../images/{image_id}`（DB 行 + ファイルを削除）。既存 `product_images` テーブルを利用、position は追記順で先頭がサムネイル。商品詳細のサムネ下に「＋ 画像を追加」ボタン + サブ画像サムネ（×で削除）。 |
| PO コメント | mig 017 `po_comments`（author = ログインユーザー名スナップショット, body ≤1000字, CASCADE削除）。`GET/POST /purchase-orders/{id}/comments`。PO 詳細下部にスレッド UI（Enter 送信）— 編集権がなくても注意喚起・提案を残せる。空コメントは 400。 |
| 月別 入荷 vs 販売チャート | `GET /dashboard/monthly-flow?months=`：inventory_adjustments を JST 月で集計（in = purchase_order_received の Σdelta、out = sale の Σ(−delta)、負値はノイズとして 0 クランプ）。ダッシュボード下部に 2 色棒グラフ（緑=入荷 / 青=販売、凡例・欠損月は 0 表示）。 |
| KPI ローテーション | ダッシュボードの KPI 4 枚が 7 秒ごとに第2セットとクロスフェード：登録商品数↔総在庫点数、在庫低下↔要対応件数、期限間近↔今月の入荷点数、今月の販売額↔今月の販売点数。在庫・PO ページの KPI は保有情報を既に全て表示しているため対象外（追加データができたら同パターンを適用）。 |

検証: 画像アップロード→ /media 配信 200 →削除 204、コメント投稿（author=山田 花子）+空ガード 400、monthly-flow が 2026-02〜07 の連続軸で 7月 = 入荷66/販売15、KPI が 7 秒後に第2セットへ切替。


## フィードバック改善 D — 権限管理 + 承認ワークフロー（heavy）

Branch: `feature/sales-records`（migration 018）

**権限（ロールベース）**
- `deps.CurrentUser`（セッションの User 行）+ `ensure_admin()`：ログイン中の非管理者が管理者専用の書き込みを叩くと 403「この操作には管理者権限が必要です」。
- 管理者専用: 設定 PUT（全 namespace・税率含む）・ロゴ、カテゴリ/仕入先/拠点の作成・更新・削除、ユーザー管理（既存）。スタッフは閲覧 + 販売記録 + PO 操作 + （承認制の）在庫調整。
- `X-Store-Id` 開発ヘッダー経由（ユーザーなし）は従来どおり素通し（curl テスト用、PoC 限定）。

**承認ワークフロー（mig 018 `approval_requests`）**
- スタッフが手動在庫調整を送信 → **在庫は変更されず** pending の承認リクエストになり、管理者へ通知（ベル）。
- 在庫ページに「⏳ 承認待ちの在庫調整」パネル：管理者は ✓承認 / ✕却下、スタッフは自分の申請状態を確認。
- 承認 = 保存済みペイロードを通常の `apply_stock_delta` 経路で再生 → ガード（マイナス在庫等）が承認時点でも効く。調整行の created_by は**申請者**、note に「｜承認: <管理者>」を追記。却下は在庫に触れない（任意の却下理由を保存）。
- 監査ログに approval_approved / approval_rejected を記録。

**重要な学び（CONTEXT.md にも追記）**: `from __future__ import annotations` 下では、未 import の型を FastAPI パラメータ注釈に使っても **ImportError にならず silently Any 扱い**になり依存が解決されない（`CurrentUser` を import し忘れて承認分岐が動かなかった）。新しい deps 型を使うときは import を必ず確認。

検証: スタッフ調整→pending（在庫不変）→スタッフ approve 403→管理者 approve 200 → +5 / created_by=佐藤 太郎 / note に承認者、reject は在庫不変、通知 kind=approval_request、UI で却下ボタン→キュー消滅。


## バグ・翻訳フローの総点検（sweep 2026-07-14）

静的アナライザ（辞書 + i18n_autotr のマッチングを Node で再現し、全 JSX の文字列リテラル・テンプレート・JSX テキストを照合）で EN 未訳を機械的に洗い出し。**未訳 173 件 → 37 件**（残りは意図的: 印刷レシート本文・スマホスキャン画面の日英併記・データ文字列・JA 専用コード分岐のみ）。

**修正内容**
- 辞書 +約 210 エントリ: 販売記録ページ全体、PO 一覧/詳細/編集ビュー、支店・仕入先・カテゴリ・サポート・工事中ページ、コマンドパレット、AI 商品アシスト一式、レシート発行の操作 UI、設定のトースト類、共通語（読み込み中…・詳細・備考 等）。
- **ネイティブ confirm() ダイアログは React フックで翻訳不可** → i18n_autotr が `window.PLX_TR`（exact→trimmed→template の同一マッチャ）を公開し、4 箇所の confirm（一括アーカイブ / PO キャンセル / ロゴ削除 / ユーザー無効化）が表示前に翻訳を通すようにした。
- ProductCreate の文中 `<b>` 分割 5 箇所（AI 案内文・キャッシュ注記・再検索件数・QR 手順・localhost 注意）を単一テンプレート子に再構成し全文キーで翻訳。
- バグ修正 2 件: `POST /approvals/{id}/reject` が body 必須で bodyless curl が 422 になっていた（optional 化、確認: 400 業務エラーが正しく返る）。設定保存の失敗トーストがサーバー detail（403 の「管理者権限が必要です」等）を握りつぶしていた。
- 辞書の重複キー 8 件の値衝突を確認 — いずれも同文脈（後勝ちで一貫）。esbuild で全変更 JSX の構文検証、主要 14 エンドポイントの回帰スモーク全 200。

**既知の残り（意図的）**: レシート印字本文は日本語文書のまま／スマホスキャン画面は日英併記デザイン／会社形態サフィックス（株式会社等）はデータ照合用リテラル。
