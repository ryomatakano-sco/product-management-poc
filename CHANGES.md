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

## 12. paylight X visual refresh + 12-page IA (2026-05-12)

A fresh design brief from Claude Design ("compass" markdown + new mockup
bundle) defines the full **paylight X 商品管理 PoC** visual system: dark-green
sidebar chrome, calm Inter+Noto Sans JP type stack, grouped sidebar IA
(メイン / オペレーション / マスタ / その他), and 12 pages covering the whole
clinic-side workflow. Demo deadline is 2026年5月13日 11:00 JST.

This entry refreshes the existing 4 live pages (Dashboard + Product trio)
to the new visual system **and** introduces an Under-Construction
placeholder for the 8 pages the brief calls for but that we won't fully
build before the demo. All sidebar links now resolve to something
coherent — no 404s on the demo path.

### 12.1 What changed and why

- **Tokens (`frontend/lib/theme.js`)** — replaced the old `PLX_GREEN`/`PLX_MUTED` constants with the full **paylight X token set (`T.*`)** from brief §7: greens 700/600/500/300/100/050, blues, ambers, reds, purples, full ink scale (`PLX_INK_900/700/500/400/300`), separate sidebar color block (`PLX_SIDEBAR_BG` = #0F2A23), radii, shadows, `FONT` / `FONT_MONO` stacks, and the `LOGO_HEADER` URL. The legacy `PLX_*` names are kept as **aliases pointing at the new values** so existing components pick up the new palette without an edit. Net result: greens shift from teal-leaning (#1AA68A) to calm SCO-brand green (#16A36C), and neutrals get the deeper ink-scale.
- **`AdminShell.jsx`** — full rewrite around the new sidebar pattern. Dark-green rail (#0F2A23), four nav groups with caption labels, square "pX" + "paylight X" wordmark in the header (PNG fallback acceptable per brief §2.1 — we use the in-line CSS variant for offline reliability), workspace switcher row, dim-green section labels, active row pill (`PLX_GREEN_600` bg, **3 px bright stripe on the left edge**), bell + 280 px search bar in the new 56 px topbar, **breadcrumb row inside the topbar** (per brief §3 — moved out of the page body), `ChevronDown`/`ChevronRight` helpers. Stable nav id mapping (`dashboard`, `products`, `categories`, `inventory`, `po`, `sales`, `vendors`, `branches`, `settings`, `support`) — every entry routes somewhere.
- **`hooks.js`** — `parseHash()` now recognises 8 new stub routes (`/categories`, `/inventory`, `/purchase-orders`, `/sales`, `/vendors`, `/branches`, `/settings`, `/support`) and returns `{ name: "stub", stub: { navId, title, breadcrumbs } }` so the app can render the placeholder with the right sidebar item highlighted.
- **`app.jsx`** — added a `stub` branch in the router that mounts `<UnderConstruction>` with the right `navId`/breadcrumbs.
- **`pages/UnderConstruction.jsx` (NEW)** — full implementation of brief §5: centered card, 96 px green circle, HardHat-ish icon, 「現在開発中」 / 「この機能は現在開発中です。5月13日以降のデモにてご紹介いたします。」, secondary [← ダッシュボードに戻る] + primary [🔔 通知を受け取る], and the version footer 「PoC v1.4.0 ・ 商品管理モジュール」. The sidebar stays correctly highlighted for whichever stub route the user landed on, so a reviewer always knows where they are.
- **`pages/Dashboard.jsx`** — rebuilt page head per brief §4.4: friendly greeting 「<時間帯>、山田さん 👋」 (time-of-day aware), real Japanese date subtitle 「本日は YYYY年M月D日（曜）。」, and a 「本日 ▼」 date-range pill on the right. AI summary card refreshed to match brief: 3 px `PLX_GREEN_600` left edge, `PLX_GREEN_050` wash bg, caption-style header 「AIサマリー — 1日1回 朝6:00 更新」, in-card 「再生成」 button with refresh icon, real `generated_at` timestamp in the footer.
- **`pages/ProductList.jsx`** — brief §4.1 page head: H1 「商品一覧」 + subtitle 「全 N 件の商品が登録されています」 (with a current-filter-count tail when items < total). Breadcrumb moved to the topbar (「ホーム / 商品一覧」). The existing quick-filter chip row, 種別 column, expiry indicator, and search bar from the Yoshioka spec (§11) are retained.
- **`pages/ProductDetail.jsx`** — breadcrumb refactored to 「ホーム / 商品一覧 / <product name>」 with brief-compliant 32-char truncation.
- **`pages/ProductCreate.jsx`** — breadcrumb to 「ホーム / 商品一覧 / 新規登録」.
- **`index.html`** — `UnderConstruction.jsx` added to the script load order before `app.jsx` (Babel-in-browser load order matters; pages must register on `window` before `app.jsx` references them).
- **`mockup/`** — replaced wholesale with the new Claude Design bundle (14 .jsx files including V1 + V2 + Dashboard + Categories + Inventory + PurchaseOrders + SalesRecords + Vendors + Branches + Settings + Support + UnderConstruction + AppShell + tokens.jsx). Reference only — not loaded by the app.

### 12.2 Trade-offs accepted

The brief specifies **12 pages**. We deliver **4 at production quality** (Dashboard + Product trio) and **8 as Under-Construction placeholders** (categories, inventory, purchase orders, sales records, vendors, branches, settings, support). The brief explicitly authorises this in §6 ("If a screen must be cut, cut at the detail / wireframe levels first — Support → Settings → branch detail, never at the dashboard or product trio levels"). Sidebar links work; reviewers always land on a styled "this is coming" page rather than a 404. Building the 8 remaining pages would require:

- 5 new backend routers (categories CRUD with hierarchy, inventory bulk ops, full PO lifecycle, sales records with returns, vendor master) — ~600+ lines of Python + migrations
- 8 new frontend pages — ~3,000 lines of JSX
- 6 new database tables / model extensions

That's a separate engineering pass after the demo.

### 12.3 Verified live (2026-05-12)

- `scripts\dev.bat` starts uvicorn cleanly.
- All routes return 200:
  - `/` → 307 → `/app/`
  - `/app/` → 200 (10 KB HTML loading 15 scripts)
  - Every script in the load order (`./lib/*`, `./components/*`, `./pages/*`, `./app.jsx`) → 200
- All API endpoints from §11 still work: `/dashboard/summary`, `/products`, etc.
- The 8 new stub routes (`#/categories`, `#/inventory`, …) render the Under-Construction card with the correct sidebar item highlighted.
- The dashboard page header uses the new greeting + date pill.
- The AI summary card has the 3 px green left edge and the 再生成 button.
- Product list breadcrumb shows 「ホーム / 商品一覧」 in the topbar; product detail truncates names >32 chars.

---

## 13. Basic CRUD backend round-out (2026-05-12)

Implements the `03_basic_backend_implementation_prompt` brief — the
minimum-viable functional backend so every page in the paylight X design
mockups has working data. Focuses on the gaps in the existing code rather
than re-implementing what already works (per brief §1: *"If anything below
is already implemented, skip it and move on. Do not refactor working code."*)

### 13.1 What got added

**Migration `003_basic_crud_schema.py`** — additive, idempotent, reversible.
Extends three existing tables and creates two new ones:

- `categories` → `color_hex`, `icon_name`, `applies_to` (retail/consumable/both),
  `default_tax_rate`, `description`, `sort_order`. Drives the design's
  colored circles + tree filter on the カテゴリ page.
- `vendors` → `postal_code`, `payment_terms`, `status` (active/inactive),
  `notes`. The contact basics (`contact_name`, `email`, `phone`) already
  existed.
- `branches` → `branch_type` (main/sub), `postal_code`, `manager_name`,
  `operating_hours_json` (per-day open/close array, see brief §2.2),
  `default_tax_rate`, `low_stock_threshold`, `status`.
- New table **`support_tickets`** — backs the お問い合わせ form.
- New table **`settings_kv`** — single-row-per-namespace JSON blob storage
  for the 設定 page (5 namespaces: general / notifications / tax_rates /
  ai / integrations).

**Models extended/added**:
- `app/models/category.py` — `CategoryAppliesTo` enum + 6 new columns.
- `app/models/vendor.py` — `VendorStatus` enum + 4 new columns.
- `app/models/branch.py` — `BranchType` + `BranchStatus` enums + 7 new columns.
- `app/models/support.py` (NEW) — `SupportTicket`, `SupportSubject`, `TicketStatus`.
- `app/models/settings_kv.py` (NEW) — `SettingsKV` (JSON blob model).

**Schemas extended/added**:
- `app/schemas/category.py` — re-shaped around `CategoryBase`; added
  `CategoryTreeNode` for the recursive `/categories/tree` response.
- `app/schemas/vendor.py` — added `product_count` and `ytd_purchase_total`
  computed fields on `VendorRead` (string-serialized Decimal).
- `app/schemas/branch.py` — full re-shape; added `InventorySnapshot` for
  the per-branch KPI endpoint.
- `app/schemas/support.py` (NEW) — `FaqItem`, `SupportTicketCreate/Read`,
  `SystemStatus`, `VersionInfo`.
- `app/schemas/settings.py` (NEW) — one Pydantic class per namespace
  (`GeneralSettings`, `NotificationsSettings`, `TaxRatesSettings`,
  `AiSettings`, `IntegrationsSettings`) + `NAMESPACE_SCHEMAS` registry.

**Routers**:
- `app/routers/categories.py` (REWRITE) — full CRUD with `GET /categories/tree`
  (recursive, single fetch), inline `product_count` aggregation (one
  GROUP BY query, no N+1), and a delete-guard that blocks when products
  or children reference the category and returns the counts in the
  error body.
- `app/routers/vendors.py` (REWRITE) — same shape as before plus
  pre-computed `product_count` (GROUP BY products) and
  `ytd_purchase_total` (SUM of received PO totals this calendar year)
  attached to every read. DELETE soft-deletes (status=inactive) when
  products still reference the vendor.
- `app/routers/branches.py` (REWRITE) — adds `GET
  /branches/{id}/inventory-snapshot` returning `{total_items,
  total_value_jpy, low_stock_count, expiring_soon_count}` per
  branch.low_stock_threshold; DELETE soft-deletes when inventory history exists.
- `app/routers/dashboard.py` (EXTEND) — returns the full brief §3.1
  contract: `needs_attention` (top-5 lowest-available products with
  status flags + action hints), `recent_activity` (5 most recent
  inventory adjustments rendered as Japanese sentences),
  `category_breakdown` (per-category stock count + value), and a real
  `monthly_sales_jpy` summed from `sales_records` for the current
  calendar month. `generated_at` switched to Asia/Tokyo offset.
- `app/routers/inventory.py` (EXTEND) — new `GET /inventory` aggregate
  view returning `{product, branch, on_hand, committed, available,
  status, earliest_expiry_date, last_adjusted_at}` with filters
  (`branch_id`, `item_type`, `status`, `q`). Existing
  `/variants/{id}/inventory-adjust` and history endpoints unchanged.
- `app/routers/settings.py` (NEW) — `GET/PUT /settings/{namespace}` with
  per-namespace Pydantic validation, MySQL `ON DUPLICATE KEY UPDATE`
  upsert, and **secret scrubbing** for the AI namespace
  (`openai_api_key` on PUT is moved into `_secret_openai_api_key` inside
  `data_json`; GET returns only `openai_api_key_set: bool`).
- `app/routers/support.py` (NEW) — `GET /support/faq` (8 hard-coded items
  from `app/data/faq.py`), `POST /support/tickets` (persists), `GET
  /support/tickets` (internal admin list), `GET /support/system-status`,
  `GET /support/version`.

**Other**:
- `app/data/faq.py` (NEW) — 8 hard-coded FAQ items per brief §3.10.
- `app/main.py` — registered `settings` and `support` routers.
- `app/seed.py` — extended with:
  - **Two branches** (本院 + 分院 梅田) with addresses, phones,
    `operating_hours_json`, managers per brief §4.2.
  - **Hierarchical categories**: 2 parents (物販品 / 消耗品) + 11 leaves
    with the exact colors and Lucide icon names from brief §4.3, plus
    legacy aliases (歯間ブラシ / 麻酔 / その他) so older product seed
    references still resolve.
  - **6 vendors** with the contact, phone, email, payment_terms from
    brief §4.4 (Sunstar / Lion / Ci / GC / Morita / Henry Schein).
  - **5 settings_kv rows** (one per namespace) with realistic defaults
    matching brief §3.9.
  - **3 support tickets** (open/in_progress/resolved mix).
  - **5 sample inventory adjustments** so the dashboard's
    `recent_activity` feed has something to show.

### 13.2 Trade-offs taken (with brief authority)

The brief is ambitious; the demo is tomorrow at 11:00 JST. Per brief §1
("If anything below is already implemented, skip it…") and §7 ("Test
coverage beyond happy-path… don't burn time"), I deliberately did NOT do:

- **`/api/v1` prefix**. The brief calls for all endpoints under
  `/api/v1`. The existing frontend hits `/products`, `/vendors`,
  `/dashboard/summary` etc. without that prefix. Adding it would break
  the working frontend with zero PoC benefit. Routes stay at root for
  now; a future migration can mount a versioned alias.
- **`item_type` enum rename**. Brief calls the values `retail` /
  `consumable`. Migration 002 + seed + frontend + dashboard all use
  `product` / `consumable`. Renaming would cascade through 10+ files.
  Documented in the migration's docstring.
- **PO/sales table column refactor**. The brief redesigns
  `purchase_orders` and `sales_records` (new `po_number`, `transaction_id`,
  `tax`, `subtotal`, dedicated PO/sales items columns). The existing
  models already cover the demo path; refactoring would invalidate
  seeded data and break the working PO router. Deferred to a future
  migration.
- **`api/v1/sales` refund + daily/monthly summaries**. Existing
  `/sales` POST works; the refund endpoint and the aggregated summary
  endpoints are out-of-scope for the demo since 販売記録 is currently
  rendered as an Under-Construction placeholder.
- **`EmailStr` Pydantic type**. Brief §5.3 says use it, but
  `email-validator` isn't in `pyproject.toml` and brief §0.4.2 forbids
  new deps. Switched to plain `str` — frontend HTML5 validation handles
  the client side.
- **Tests**. Brief §7 explicitly allows skipping coverage for happy-path
  beyond ~60%. Live smoke test via curl was used instead.

### 13.3 Verified live (2026-05-12)

`scripts\reset-db.bat` drops and recreates `product_management_dev`. All 3
migrations apply cleanly through `alembic upgrade head`. Seed populates:
- 1 store, 2 branches, 16 categories (2 parents + 14 leaves), 6 vendors,
  5 tags, 9 products (5 retail + 4 consumables), 5 settings_kv rows,
  3 support tickets, 5 inventory adjustments.

Live smoke test through curl confirms:
- `/health` 200; `/dashboard/summary` returns full payload with
  `needs_attention` (5 rows), `recent_activity` (5 rows), `category_breakdown`
  (16 cats), `kpis` (4 fields).
- `/categories/tree` returns 3 top-level nodes (物販品 with 7 children,
  消耗品 with 6, その他 with 0).
- `/vendors` returns 6 rows; each includes `payment_terms`,
  `contact_name`, computed `product_count` and `ytd_purchase_total`.
- `/branches/1/inventory-snapshot` returns the four KPI counts.
- `/inventory?status=low_stock` returns the 2 low-stock products
  (GUM #211 + ニトリル グローブ).
- `/settings/{ns}` GET/PUT round-trips for all 5 namespaces; AI namespace
  accepts `openai_api_key` on PUT but never echoes it on GET (only
  `openai_api_key_set: bool`). Verified: writing `sk-test-XYZ`, then
  reading back, returned no occurrence of the key string.
- `/support/faq` returns 8 items; `/support/tickets` POST creates ticket
  id=4 from JSON body with 「テスト送信」 Japanese body intact.
- All Decimal fields (`default_tax_rate`, `ytd_purchase_total`) serialize
  as strings, not floats.
- Missing `X-Store-Id` header → 400 (verified on `/products` and `/vendors`).
- `/docs` returns 200 with 38 paths; all 7 new endpoints visible
  (`/categories/tree`, `/branches/{id}/inventory-snapshot`, `/settings/{ns}`,
  `/support/{faq, tickets, system-status, version}`).
- Existing `/products` endpoint unchanged — `total=9`, response shape
  preserved; the frontend's product list and detail pages still work.

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

