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
