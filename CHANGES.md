# Changes Log — Frontend + Backend Unification

> Running record of every change made in the move from "design prototype + isolated backend + isolated JAN PoC" to a unified, runnable PoC stack.
> Each entry: **What** changed, **Where** it lives, **Why**.

---

## Summary of the reshape

| Before | After |
|---|---|
| `frontend/` = raw HTML/JSX design prototype (not runnable, mock data) | `mockup/` = same files, renamed for reference only |
| No real frontend wired to the API | `frontend/` = no-build React app (CDN + Babel-in-browser), wired to API |
| `backend/docker-compose.yml` = backend-only | `docker-compose.yml` at repo root = brings up db + api together (api also serves the frontend as static files) |
| `jan-lookup-poc/` = standalone CLI research | Same — kept as a research sandbox, README updated to mark it as such |
| AI assist requires `OPENAI_API_KEY` to work | AI assist works without a key (returns canned mock data); real OpenAI used only when `OPENAI_API_KEY` is set |
| `ProductListItem` API response was missing SKU/price/available-stock per row | Expanded to include `default_sku`, `default_price`, `total_available` so the table can render real values |
| No CORS middleware on the backend | Added `CORSMiddleware` for safety; in the unified setup it's also moot because the API serves the frontend |

---

## Why no Vite / no build step

For a PoC the dev-experience cost of Vite (npm install, node version drama, build step) outweighs the benefit. The no-build approach mirrors what the original design prototype already used (React + Babel from CDN), but split into proper files and wired to the real API. **You edit a `.jsx` file, reload the browser, done.** No HMR, no `node_modules`, no package-lock.

The trade-off: no TypeScript safety, slower first-load (Babel parses in-browser), no minification. All acceptable for a PoC. If this graduates to production, the same React code can be lifted into a Vite+TS project with minimal changes.

---

## Change entries (chronological)

### 1. Renamed `frontend/` → `mockup/`

- **Where**: repo root
- **What**: `git mv` equivalent (`mv frontend mockup`). The folder still contains the original `AdminShell.jsx / ProductList.jsx / ProductDetail.jsx / ProductCreate.jsx / design-canvas.jsx / SCO Product Management POC.html / colors_and_type.css / mock-data.jsx / assets/ / fonts/ / uploads/`.
- **Why**: To free the `frontend/` name for the real app, while preserving the design prototype for visual reference and future cross-checks.

### 2. Created this file (`CHANGES.md`)

- **Where**: repo root
- **What**: This log.
- **Why**: User explicitly asked for a document of changes — why, where, what.

---

### 3. Wrote the no-build frontend

- **Where**: `frontend/` (new contents — replaces what was renamed in step 1)
- **What** (per file):
  - `frontend/index.html` — single HTML page. Loads React 18, ReactDOM 18, and Babel from `unpkg.com`. Loads our `.jsx`/`.js` files via `<script type="text/babel" data-presets="env,react">` in dependency order (theme → api → hooks → atoms → shell → pages → app). Inlines design tokens as CSS variables (no separate CSS file needed).
  - `frontend/lib/theme.js` — `PLX_*` color constants and `available()` / `formatYen()` helpers. Attached to `window` so other files can read without imports.
  - `frontend/lib/api.js` — thin `fetch` wrapper. Injects `X-Store-Id` header from `localStorage` on every call. All paths relative (the API serves us, so no CORS).
  - `frontend/lib/hooks.js` — `useFetch(fn, deps)` (replaces TanStack Query) and `useHashRoute()` + `navigate()` (replaces React Router). About 30 lines total.
  - `frontend/components/Atoms.jsx` — `SectionLabel`, `Pill`, `StatusPill`, `Select`, `SegmentedControl`, `FormRow`, plus the inline-style constants `formInput`, `btnPrimary`, `btnSecondary`, `btnGhost`.
  - `frontend/components/AdminShell.jsx` — sidebar + topbar + nav icons + clinic card.
  - `frontend/pages/ProductList.jsx` — filter bar, tag chips, the product table. Reads the **expanded** `ProductListItem` (sku/price/available come straight from the API, no per-row fetch).
  - `frontend/pages/ProductDetail.jsx` — hero, 90-day stat cards, three tabs (variants, history, sales), inventory-adjust modal that POSTs to `/variants/:id/inventory-adjust`. Reuses `useFetch` for history.
  - `frontend/pages/ProductCreate.jsx` — full form, plus the AI Assist modal. Modal POSTs to `/ai-suggestions`, polls if needed, displays candidates per field with checkboxes + confidence bars, applies selections, then POSTs `/products` with `ai_session_id` linkage.
  - `frontend/app.jsx` — entry. `useHashRoute()` chooses one of the three pages and renders.
  - `frontend/assets/` — copied logo + check icons from `mockup/assets/`.
- **Why**:
  - User asked for "something easy to run, not Vite, because it's a PoC". The pattern (React from CDN + Babel-in-browser + plain `.jsx` files) is the same one the original design prototype already used, so this stays in the spirit of "no build step".
  - Hash routing means the browser only ever fetches `/` (or `/app/`) and named asset paths — it never accidentally requests `/products` (which is an API route). No path-collision gymnastics needed.
  - Putting `window.PLX_*` constants and `window.api` on the global is ugly by 2024 standards, but it's exactly how the prototype already worked, and it's the simplest thing that works without a module system or bundler.

### 4. Patched the backend (`backend/app/`)

- **Where**: inside `backend/` (its own git repo)
- **Files touched**: `app/main.py`, `app/services/ai_agent.py`, `app/schemas/product.py`, `app/routers/products.py`

#### 4a. `app/main.py` — CORS + static mount + root redirect

- Added `CORSMiddleware` with `allow_origins=["*"]`. The frontend is normally same-origin (served at `/app/`), so CORS is redundant — but it's cheap insurance for anyone hitting the API directly from a different origin.
- After the routers are registered, the app looks for the frontend directory (env `FRONTEND_DIR`, default `/frontend` inside Docker, or `../frontend` for local `uvicorn` runs). If it finds an `index.html`, it mounts the directory at `/app/` via `StaticFiles(..., html=True)` and adds a `GET /` → `RedirectResponse("/app/")`.
- **Why**: lets the same FastAPI server serve both the API and the frontend. One URL, one container, zero CORS issues.

#### 4b. `app/services/ai_agent.py` — mock fallback when no key

- Added `_ai_enabled()`: returns `True` only when `OPENAI_API_KEY` is set AND `MOCK_AI` is not `"1"`.
- Added `_mock_lookup(jan, title)`: returns a deterministic `ExtractionResult` with candidates for `title`, `name_kana`, `brand`, `category`, `barcode`, `price`, `description` — same shape the real agent produces, with `source_url="https://mock.example.jp/..."` and realistic confidence values.
- `run_product_lookup` now short-circuits to `_mock_lookup` when AI is disabled.
- Moved the `from agents import ...` imports inside the functions that need them, so the module imports cleanly even if the `openai-agents` SDK isn't installed in mock-only environments.
- **Why**: the design's whole "AI で入力" experience should work the moment you `docker compose up`, without spending OpenAI credits on every dev click. Setting the key in `.env` flips on real OpenAI; leaving it out gives you canned data that looks identical in the UI.

#### 4c. `app/schemas/product.py` — expanded `ProductListItem`

Added three new fields:
- `total_available: int` — sum of `(on_hand - committed - unavailable)` across variants
- `default_sku: str | None` — SKU of the default variant (falls back to first variant)
- `default_price: Decimal | None` — price of the default variant, serialized as string

Also extended `field_serializer` to include `default_price`.

**Why**: the original `ProductListItem` only carried `default_amount_at_payment`. The frontend table needs **SKU**, **price**, and **available stock** per row to render the design faithfully. Without these the list shows `—` everywhere. Computing them server-side is cheap (variants are already eagerly loaded) and avoids N+1 round-trips from the browser.

#### 4d. `app/routers/products.py` — populate the new fields

Updated `_build_list_item()` to:
- Compute `total_available` via the same `(on_hand - committed - unavailable)` formula
- Pick the variant flagged `is_default` (or the first one if nothing flagged) and surface its `sku` + `price`

### 5. Created the root `docker-compose.yml`

- **Where**: repo root (replaces — but doesn't delete — `backend/docker-compose.yml`)
- **What**: defines two services:
  - `db`: MySQL 8 with the same config as the backend-only compose
  - `api`: builds from `./backend`, mounts both `./backend:/backend` (hot-reload for backend code) and `./frontend:/frontend:ro` (read-only mount so FastAPI can serve it as static files), reads `OPENAI_API_KEY` and `MOCK_AI` from a `.env` file, exposes port 8000
- **Why**: one command (`docker compose up -d`) at the repo root brings up the entire stack. No remembering to `cd backend`, no separate frontend dev server, no CORS, no `npm install`.

> The old `backend/docker-compose.yml` is kept (untouched) for anyone who wants to bring up just the backend in isolation. Both files use the same volume name (`mysql_data`) so the data persists across both setups.

### 6. Created `.env.example`

- **Where**: repo root
- **What**: documents the two env vars that matter — `OPENAI_API_KEY` and `MOCK_AI` — and notes that both are optional.

### 7. Created top-level `README.md`

- **Where**: repo root
- **What**: project overview, "what's where" map, one-command run instructions, AI behavior table, API endpoint list, non-Docker dev instructions.
- **Why**: someone fresh to the repo should be able to clone → read README → run the app, in that order, without needing to dig.

### 8. Added `jan-lookup-poc/README.md`

- **Where**: inside `jan-lookup-poc/` (its own git repo)
- **What**: documents that this folder is a **research sandbox**, with a comparison table of "when to use this CLI vs the backend endpoint", and a reminder to port prompt changes to `backend/app/services/ai_agent.py`.
- **Why**: prevents future confusion about which AI code path is "real". The user kept this folder explicitly as a sandbox; this README makes that intent self-documenting.

---

## Trade-offs accepted

- **No TypeScript** in the frontend. Errors that TS would catch (typos, wrong API shapes) now show up at runtime in the browser console. Acceptable for a PoC; the failure modes are loud and easy to spot during demo testing.
- **Babel-in-the-browser** parses ~3000 lines of JSX on every page load. First load takes ~1–2 seconds longer than a bundled app would. Not acceptable for production; acceptable for a PoC.
- **No HMR**. Edit a file, hit reload. Tolerable for small files.
- **Global `window` namespace** instead of ES modules. Works because all files load in dependency order from one HTML page; the load order is fixed in `index.html`.
- **Hash routing** means URLs look like `http://localhost:8000/app/#/products/3` instead of `http://localhost:8000/products/3`. Cosmetic. Lets us avoid history-API fallback configuration and keeps the API path-collision-free.
- **The old backend `docker-compose.yml` is left in place**. Could be removed for tidiness, but it's not in the way and someone may rely on the path muscle memory.

---

### 9. Switched DB from containerized MySQL to host MySQL

User has MySQL 8 already running locally (`localhost:3306`, `root` / `admin`, database `maindb`) and asked us to use that instead of spinning up a second one in Docker.

- **Where**: `backend/app/config.py`, `backend/app/db.py`, `backend/alembic/env.py`, root `docker-compose.yml`, root `.env.example`, README.
- **What**:
  - `backend/app/config.py` — `Settings` now supports two paths: full `DATABASE_URL` (wins when set) **or** split `DB_HOST` / `DB_PORT` / `DB_USER` / `DB_PASSWORD` / `DB_NAME`. Added a `resolved_database_url` property that returns whichever is configured. Password is URL-quoted (`urllib.parse.quote_plus`) so `@`/`#`/etc. in passwords don't break the URL.
  - `backend/app/db.py` and `backend/alembic/env.py` — switched to `settings.resolved_database_url` so both the runtime engine and Alembic migrations honour either form.
  - `docker-compose.yml` — **dropped the `db` service entirely**. The api container is now the only service. It connects out to the host MySQL via `host.docker.internal:3306`. Added `extra_hosts: ["host.docker.internal:host-gateway"]` so the same compose file works on native Linux too.
  - `.env.example` — rewritten as a fully-commented placeholder template. Documents both DB-config forms, the host vs container `localhost` gotcha, AI mode flags, and the multi-tenancy header default.
  - `README.md` — run instructions updated. Added a callout explaining why `host.docker.internal` is used and how to switch to `127.0.0.1` when running uvicorn natively.
- **Why**: avoid running two MySQL instances on the same machine; let the team's existing local DB serve as the dev database. Splitting into `DB_*` vars matches the `.env` style the user already has.

**Compatibility note**: anyone still using a `DATABASE_URL` in their `.env` keeps working — the property returns that verbatim. The `DB_*` path is purely additive.

---

### 10. Native (no-Docker) dev path

User asked to stop using Docker for the inner dev loop — every code change cycling through `docker compose` is too slow.

- **Where**: `backend/pyproject.toml`, `backend/.env`, `scripts/setup.bat`, `scripts/dev.bat`, `scripts/reset-db.bat`, `README.md`.
- **What**:
  - **`backend/pyproject.toml`** — added `[tool.setuptools] packages = ["app"]`. Without this, `pip install -e .` failed because setuptools couldn't auto-discover with both `app/` and `alembic/` at the project root.
  - **`backend/.env`** — switched `DB_NAME=maindb` → `DB_NAME=product_management_dev`. The existing `maindb` on this host is a real clinic-management app with a conflicting `stores` table; the PoC now uses its own database to avoid colliding with anything.
  - **`scripts/setup.bat`** — one-time setup: creates Python venv at `backend/.venv`, runs `pip install -e ./backend`, creates the `product_management_dev` database via `mysql.exe`, runs `alembic upgrade head`, then `python -m app.seed`.
  - **`scripts/dev.bat`** — daily dev command: starts `uvicorn app.main:app --reload --reload-dir app` from the venv, with `FRONTEND_DIR` pointed at `./frontend`. Hot-reloads on every backend file change.
  - **`scripts/reset-db.bat`** — `DROP DATABASE` + recreate + re-run migrations + seed. Use after schema changes or to get back to a known-good state.
  - **`README.md`** — restructured. "Run it (no Docker — recommended for development)" is now the **first** run section; Docker is demoted to "alternative". Old "Development without Docker" section near the bottom removed (now covered up top).
- **Why**:
  - Native uvicorn restart on file save = ~1 second. Docker rebuild + compose up = 30–60 seconds. The difference compounds across a dev session.
  - Frontend has no build step anyway — refresh the browser and you see your change. The only thing that benefited from Docker was the backend process, and that runs fine natively with the local MySQL.
  - **Discovery**: Python 3.14 works fine for the entire dep tree (fastapi, sqlalchemy[asyncio], aiomysql, openai-agents, pydantic v2 — all have 3.14 wheels). No need to downgrade.
- **Verified live**:
  - `pip install -e ./backend` → all 50+ deps installed successfully under Python 3.14
  - `alembic upgrade head` → schema created in `product_management_dev`
  - `python -m app.seed` → 5 products + variants + tags + images persisted
  - `uvicorn` started, hot-reload watcher engaged
  - Probed: `/health` 200, `/` 307→`/app/`, `/app/` 200, `/app/app.jsx` 200, `/products` 200 with real seeded data (e.g. `{"name": "GUM デンタルブラシ #211", "default_sku": "GUM-211-S", "default_price": "330.00", "total_available": 50, "status": "active"}`)

---

## 11. Post-D5 spec additions (Yoshioka 2026-05-11)

Six features added to the May-7 baseline based on Yoshioka's requests during the
2026-05-11 review. All implemented mock-first so the demo works offline; real
data and live AI generation are layered on top where possible.

### 11.1 `item_type` (物販品 / 消耗品) classification

- **Where**:
  - `backend/app/models/product.py` — new `ItemType` enum + column on `Product`
  - `backend/app/schemas/product.py` — `item_type` on `ProductCreate`, `ProductUpdate`, `ProductListItem`, `ProductDetail`
  - `backend/app/routers/products.py` — `?item_type=` filter on list; create/list pass-through
  - `backend/alembic/versions/002_yoshioka_2026_05_11_additions.py` — `ADD COLUMN item_type ENUM('product','consumable') NOT NULL DEFAULT 'product'`, then drop server default
  - `backend/app/seed.py` — 4 consumables added (paper cups, gloves, anesthetic, sterile bags)
  - `frontend/pages/ProductList.jsx` — 種別 segmented filter, 種別 column with `KindPill` (green=物販 / blue=消耗品), quick-filter chips `在庫低下` / `期限間近` / `再発注済`
  - `frontend/pages/ProductDetail.jsx` — 種別 badge in hero next to category
  - `frontend/pages/ProductCreate.jsx` — `ItemKindToggle` at top of basic info, payload sends `item_type`
- **Why**: Yoshioka explicitly requested separating retail products from treatment consumables ("そっちの方が良さそう" on May 11). Drives expiry tracking, dashboard filtering, and which fields are required at creation time.

### 11.2 `expiry_date`, `lot_number`, `unit` for consumables

- **Where**:
  - `backend/app/models/product.py` — three new columns (`Date`, `String(100)`, `String(20)`)
  - `backend/app/schemas/product.py` — `expiry_date: date | None`, `lot_number`, `unit` on all four schemas; `expiry_date` also on `ProductListItem` for the inline indicator
  - `backend/app/routers/products.py` — new `?expiring_within_days=N` query param filters `expiry_date <= today + N days`
  - `backend/app/seed.py` — consumables seeded with realistic expiries spanning the "critical" (12d), "warning" (22d, 45d), and "safe" (78d) buckets so the demo shows every state
  - `frontend/pages/ProductList.jsx` — `ExpiryIndicator` shows `あと N 日` pill below the stock cell (red <30d / amber <60d / nothing >60d / "期限切れ" for past dates)
  - `frontend/pages/ProductDetail.jsx` — `使用期限`, `ロット番号`, `単位` rows added to the new basic-info card on the hero, all conditional on the data being present
  - `frontend/pages/ProductCreate.jsx` — conditional "消耗品の追加情報" section appears below basic info when `itemType === "consumable"`, with native `<input type="date">`, lot text input, and unit `<select>` (個 / 箱 / mL / g / 本)
  - `frontend/lib/theme.js` — `daysUntil()`, `expiryTone()`, `formatJpDate()` helpers shared by list + detail
- **Why**: Yoshioka requested expiry management for drugs, paper cups, anesthetic agents ("使用期限のあるものは管理したい" on May 11). Kept simple: one expiry per product, not per lot. Per-lot tracking is in section 11.3 (lot tab is mocked).

### 11.3 `reorder_url` for one-click reorder

- **Where**:
  - `backend/app/models/product.py` — `reorder_url String(2000)`
  - `backend/app/schemas/product.py` — `reorder_url` on `ProductCreate`/`ProductUpdate`/`ProductDetail`; `has_reorder_url: bool` on `ProductListItem` (a cheap signal for future quick-filter chips, avoids shipping full URLs in list view)
  - `backend/app/routers/products.py` — `_build_list_item()` computes `has_reorder_url = bool(p.reorder_url)`
  - `backend/app/seed.py` — product 1 and product 6 get reorder URLs
  - `frontend/pages/ProductDetail.jsx` — `発注先 URL` row in basic-info card with truncated link + green `🔗 再発注する` button (opens new tab via `target="_blank" rel="noopener noreferrer"`)
  - `frontend/pages/ProductCreate.jsx` — `発注先 URL` field with inline `🔗 開く` button that validates and opens
- **Why**: Yoshioka asked for a one-click jump to the supplier site so receptionists/hygienists can reorder without leaving the app. May-11 spec.

### 11.4 Barcode-first AI Assist UX

- **Where**:
  - `frontend/pages/ProductCreate.jsx` — `AiAssistModal` rewritten:
    - New `mode` state (`jan` | `name`), defaulting to `jan` per Yoshioka's "そっちの方が良さそう"
    - Centered segmented control `ジャンルコード / 商品名` at the top of the input phase
    - Single large 54px-tall input (numeric `inputMode` in JAN mode), with monospace font and tighter letter-spacing for code legibility
    - Disabled `📷 カメラで読み取る` button overlaid in the JAN field with a 準備中 badge — visually present, no scanner code (FUTURE SCOPE)
    - Helper text under the input: "ジャンルコードでの検索の方が精度が高いです"
    - Primary search button moved into the body (full-width green CTA) rather than the modal footer
  - **No backend changes** — `_mock_lookup()` already returns sensible data when called with a JAN code; the real OpenAI path is fine too.
- **Why**: Yoshioka loved the barcode/JAN-first approach during the May-11 demo. Defaulting to JAN-mode + a giant single input matches the muscle memory of physical scanners. Camera scan is intentionally just visual — real device-camera access is future scope.

### 11.5 Dashboard page

- **Where**:
  - `backend/app/routers/dashboard.py` — new `GET /dashboard/summary` endpoint returning real KPIs computed from the DB:
    - `total_products`: count of active products
    - `low_stock`: distinct active products with at least one variant where `available <= 10`
    - `expiring_soon`: count of consumables with `expiry_date BETWEEN today AND today+30d`
    - `monthly_sales_jpy`: hard-coded mock (PoC; sales aggregation is future scope)
    - `ai_summary`: deterministic Japanese paragraphs stitched from the KPIs ("本日、在庫が補充ポイントを下回る商品が **N 件** あります…"). Real OpenAI generation is FUTURE SCOPE.
    - `ai_status`: `"ok"` if no alerts, `"alert"` otherwise (drives empty-vs-ready UI variant)
    - `generated_at`: ISO timestamp so the header pill can show update time
  - `backend/app/main.py` — `app.include_router(dashboard.router)`
  - `frontend/lib/api.js` — `getDashboardSummary()` helper
  - `frontend/pages/Dashboard.jsx` — full page: AI summary card with `**bold**` → `<strong>` markdown helper, 4 KPI tiles (登録商品数 / 在庫低下 / 期限切れ間近 / 今月の販売), 要対応の商品 table (top-5 lowest-available, real data via `api.listProducts`), 最近の活動 (mock — TODO post-demo), category bars (mock — TODO post-demo). Skeleton loading state per Yoshioka's mockup.
- **Why**: Yoshioka asked for a top-level summary that surfaces the day's actions on May 11. AI generation is mocked because (a) cost control, (b) deterministic demo. KPI counts are real so seeded data flows through.

### 11.6 Dashboard navigation polish

- **Where**:
  - `frontend/lib/hooks.js` — `parseHash()` now defaults to `dashboard` instead of `list`, accepts `?query=` strings, returns `{ name, id?, query }`. New `#/dashboard` route.
  - `frontend/app.jsx` — added `Dashboard` case and passes `route.query` to `ProductList` as `initialQuery`.
  - `frontend/pages/ProductList.jsx` — `initialQuery.stock === "low"` and `initialQuery.expiry === "soon"` preselect the matching quick-filter chips on mount. KPI tiles deep-link to `#/products?stock=low` / `#/products?expiry=soon` so the click-through from the dashboard activates the filter automatically.
  - `frontend/components/AdminShell.jsx` — dashboard nav item gets `to: "/dashboard"` so the sidebar link works; active-row highlight works automatically via the existing `currentNav` prop.
  - `frontend/index.html` — added `<script>` tag for `Dashboard.jsx` in dependency order.
- **Why**: Make the dashboard the default landing page, and make every KPI on it actionable in one click.

### Verified live (2026-05-12)

- `scripts\reset-db.bat` drops + recreates `product_management_dev`, applies both migrations (001 + 002), seeds 9 products (5 retail + 4 consumables).
- `scripts\dev.bat` starts uvicorn cleanly. All endpoints return 200:
  - `GET /` → 307 → `/app/`
  - `GET /app/` and every `/app/lib/*.js`, `/app/pages/*.jsx`, `/app/app.jsx` → 200
  - `GET /dashboard/summary` → `{"ai_status":"alert","kpis":{"total_products":8,"low_stock":2,"expiring_soon":2,...}}`
  - `GET /products?item_type=consumable&expiring_within_days=30` → returns the 2 expected consumables (paper cups + sterile bags) with all new fields populated
  - `GET /products/6` → consumable detail includes `item_type`, `expiry_date`, `lot_number`, `unit`, `reorder_url`
  - `POST /products` with `item_type=consumable + expiry_date + lot_number + unit + reorder_url` succeeds and returns the created product (id=10) with all fields round-tripped correctly

### Out of scope (intentionally not implemented)

These were requested but explicitly flagged as future scope:

- Real AI summary generation (the canned text is good enough for demo)
- Per-lot expiry tracking with a separate `lots` table (only one expiry per product right now; the ロット履歴 tab is mocked from the current expiry)
- Camera/QR barcode scanning (the 📷 button is visual only)
- "再発注済" quick-filter (needs a `reorder_requested_at` column — the chip is wired, the filter is a no-op + console.log)
- Real "最近の活動" (mocked — needs to read from `inventory_adjustments` + a broader audit log)
- Real category bars (mocked — needs `/categories` aggregate with variant rollup)
- Patient-based product recommendations
- Market data ("全国で何位")
- Category master with clinic-editable taxonomy

---

## How to verify (smoke test)

```bash
cd /c/Users/nafis.iqbal/SCO/Code/product-management-poc

# 1. Prep .env (DB_* defaults work for root/admin/maindb on the host).
cp .env.example .env

# 2. Make sure the database exists on your host MySQL.
mysql -u root -p -e "CREATE DATABASE IF NOT EXISTS maindb \
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

# 3. Start the api (connects to host MySQL via host.docker.internal).
docker compose up -d

# 4. Run migrations + seed sample data.
docker compose exec api alembic upgrade head
docker compose exec api python -m app.seed

# 5. Wait for "Application startup complete":
docker compose logs -f api

# 6. Open http://localhost:8000
```

Expect:
1. Redirect to `http://localhost:8000/app/` and the **product list** loads with seeded data.
2. Click a row → **product detail** loads. Switch tabs. Click "在庫を調整" → modal opens.
3. From the list, click "＋ 新しい商品を追加" → **create form** loads. Click "✨ AI で入力する" → modal opens, type any JAN code, click search. Mock candidates appear.

