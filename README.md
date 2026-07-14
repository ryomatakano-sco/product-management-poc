# SCO Product Management — Proof of Concept

A dental clinic product management web app for SCO. Manages inventory, vendors, purchase orders, and sales — with AI-assisted product data lookup from JAN codes. Backend is FastAPI + MySQL; frontend is no-build React (CDN + Babel-in-the-browser) styled to match SCO's **paylight X** design language.

This is a **PoC**, not production code. The whole stack is designed to be runnable in one command.

---

## What's where

```
product-management-poc/
├── frontend/        Real frontend. No build step — open in a browser, it runs.
├── backend/         FastAPI + SQLAlchemy + MySQL (nested git repo).
├── jan-lookup-poc/  Research sandbox: standalone CLI that proves out the AI
│                    lookup. Productionized version lives in backend/app/services/ai_agent.py.
├── mockup/          Original design prototype from Claude Design. Reference only.
├── docker-compose.yml  Brings up db + api in one command. API also serves
│                       the frontend as static files.
├── .env.example     Copy to .env to (optionally) set OPENAI_API_KEY.
└── CHANGES.md       Running log of every change made during the unification.
```

> `backend/` and `jan-lookup-poc/` are independent git repos (gitlinks, not submodules). Changes inside them commit to their own histories.

---

## Run it (no Docker — recommended for development)

You need:
- **Python 3.11+** (3.13 / 3.14 both tested)
- **MySQL 8** running locally on port 3306 (we use a dedicated DB called `product_management_dev`, separate from any existing data)
- **`backend\.env`** has `DB_USER` / `DB_PASSWORD` / `DB_NAME` set (defaults: `root` / `admin` / `product_management_dev`)

**First time only:**
```cmd
scripts\setup.bat
```
This creates a Python venv in `backend\.venv`, installs all dependencies, creates the database, runs Alembic migrations, and seeds sample data.

**Every time you start dev:**
```cmd
scripts\dev.bat
```
That's it. Open <http://localhost:8000>. The browser will redirect to `/app/` (the frontend).

- **Backend changes**: `uvicorn --reload` is on. Save a `.py` file → server restarts automatically (~1 second).
- **Frontend changes**: just refresh the browser. No build step, Babel parses the `.jsx` in-browser.

**Other helpful scripts:**
- `scripts\reset-db.bat` — drop + recreate the dev database, then re-seed. Use after schema changes or to get a clean slate.

> **Where's the data?** Your local MySQL, in the `product_management_dev` database. **Your existing data (e.g. in `maindb`) is untouched** — we deliberately use a separate database so the PoC tables can't collide with anything else.

**Pulling the latest?** The schema now goes up to migration **018**. If you started the DB on an older revision, run:
```cmd
cd backend && .venv\Scripts\python -m alembic upgrade head
```
`scripts\setup.bat` / `scripts\reset-db.bat` already do this for you.

### First-time user tutorial

The first time a user logs in, a short **guided tour** starts automatically on the dashboard — a spotlight highlights each key button (sidebar, search, notifications, and the main action on Products / Inventory / Purchase orders / Sales / Settings) with a one-line explanation. Press **次へ / スキップ** or **Esc** to move through or exit; once seen (or skipped) it won't fire again.

To replay or control it without creating a new user, open the **Dev menu** (see below) → **Tutorial** section:
- **▶ チュートリアルを開始** — replay the tour now.
- **フラグをリセット** — clear the "seen" flag so it auto-starts again on the next dashboard visit.
- **Auto-start ON/OFF** — the "tutorial mode" switch. Turn it **OFF** to stop the tour auto-firing for first-time users (e.g. during a demo where you'll trigger it manually).

### Dev menu (`</>`, bottom-left) — now password-protected

The developer panel (DB/AI status, store switcher, env editor, model comparison, and the tutorial controls above) opens with the **`</>` button at the bottom-left** or **Ctrl+`**.

It's protected by a password. Set it in `backend\.env`:
```
DEV_PANEL_PASSWORD=sco-dev
```
(default `sco-dev`; leave the line out to disable the password entirely). The panel asks for it once per browser session. Every `/dev/*` API call is checked **server-side** against this value, so it can't be bypassed by calling the API directly — and the endpoints are already restricted to localhost.

---

## Run it (Docker — alternative)

If you don't have Python / MySQL set up locally, or you prefer containers:

```bash
cp .env.example .env       # edit if you want OPENAI_API_KEY
docker compose up -d
docker compose exec api alembic upgrade head
docker compose exec api python -m app.seed
```

Open <http://localhost:8000>. The api container connects to **your host MySQL** via `host.docker.internal:3306` (no DB container — see `docker-compose.yml`). To stop: `docker compose down`.

---

## What the frontend looks like

Three screens, hash-routed:

| Route | Screen |
|---|---|
| `http://localhost:8000/app/#/products` | Product list with search, category/vendor filters, tag chips |
| `http://localhost:8000/app/#/products/:id` | Product detail — hero, variants table, inventory history, sales chart, inventory-adjust modal |
| `http://localhost:8000/app/#/products/new` | Create form with AI Assist modal |

No build step. No `npm install`. Edit a `.jsx` file in `frontend/`, reload the browser, see your change. Babel parses the JSX in-browser. Fine for a PoC; not what you'd ship to production.

---

## Why no build step?

For a PoC the dev-experience cost of Vite (npm install, node version drama, build step) outweighs the benefit. The trade-offs are clearly documented in [CHANGES.md](./CHANGES.md). If this graduates to production, the same React code can be moved into a Vite+TS project with minimal effort.

---

## AI Assist — real vs mocked

The "AI で入力する" button on the Create screen calls `POST /ai-suggestions`. The backend behavior depends on env vars:

| `OPENAI_API_KEY` | `MOCK_AI` | Behavior |
|---|---|---|
| unset / empty | (any) | **Mock mode**: returns canned candidates (looks identical in the UI to a real result). Free, instant, deterministic. |
| set | unset | **Real mode**: runs the two-agent OpenAI pipeline (web search → structured extraction). Costs $ per call. |
| set | `1` | **Forced mock**: ignores the key, returns mocked data. Useful for offline demos. |

---

## API endpoints

All endpoints require an `X-Store-Id` header. The frontend reads this from `localStorage` (key `sco.storeId`, default `1`).

See `http://localhost:8000/docs` for full API documentation. The endpoints the frontend uses:

- `GET /products` — list with filters
- `GET /products/:id` — detail (includes variants, images, tags, 90-day sales)
- `POST /products` — create
- `DELETE /products/:id` — archive (soft delete)
- `GET /categories`, `GET /vendors`, `GET /tags` — reference data
- `POST /variants/:id/inventory-adjust` — adjust stock + log audit
- `GET /variants/:id/inventory-history` — paginated audit log
- `POST /ai-suggestions` — kick off AI lookup
- `GET /ai-suggestions/:id` — poll status / read results

---

## Changes from the original layout

See [CHANGES.md](./CHANGES.md) for the full log. High-level:

1. Original `frontend/` (raw HTML/JSX design prototype) → renamed to `mockup/` for reference.
2. New `frontend/` written as a no-build React app, wired to the real API.
3. Backend gained CORS, a static mount for `frontend/`, an expanded `ProductListItem` (SKU + price + available stock per row), and a mock-AI fallback.
4. `docker-compose.yml` moved to repo root so `docker compose up` brings up everything.
5. `jan-lookup-poc/` untouched — it's a research sandbox.
