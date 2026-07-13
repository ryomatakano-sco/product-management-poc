"""FastAPI application entry point.

In addition to mounting the API routers, this also:
- Adds permissive CORS (the unified PoC is same-origin so CORS isn't strictly
  needed, but it's cheap insurance for anyone hitting the API from elsewhere).
- Serves the no-build frontend at ``/app/`` from ``/frontend`` (mounted by
  the root ``docker-compose.yml``). The bare ``/`` redirects to ``/app/`` so
  ``http://localhost:8000`` opens the UI.
"""

import os
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
from fastapi.staticfiles import StaticFiles

from app.routers import (
    ai_suggestions,
    auth,
    branches,
    notifications,
    categories,
    dashboard,
    dev,
    images,
    inventory,
    products,
    purchase_orders,
    sales,
    scan_sessions,
    search,
    settings as settings_router,
    stores,
    support,
    tags,
    variants,
    vendors,
)

app = FastAPI(
    title="Product Management API",
    description="Backend for Japanese dental clinic product management",
    version="0.1.0",
)

# Permissive CORS. The frontend is normally same-origin (served at /app/), so
# CORS is redundant — this is here for ergonomics if someone hits the API
# directly from a different origin during development.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(stores.router)
app.include_router(branches.router)
app.include_router(vendors.router)
app.include_router(categories.router)
app.include_router(tags.router)
app.include_router(products.router)
app.include_router(variants.router)
app.include_router(images.router)
app.include_router(inventory.router)
app.include_router(sales.router)
app.include_router(purchase_orders.router)
app.include_router(ai_suggestions.router)
app.include_router(scan_sessions.router)
app.include_router(dashboard.router)
app.include_router(settings_router.router)
app.include_router(support.router)
app.include_router(search.router)
app.include_router(notifications.router)
app.include_router(dev.router)


# --- Daily notification tick (heavy-tier item 3) --------------------------------
# A single asyncio loop (PoC: one uvicorn worker) that fires the 日次サマリー
# notification at each store's configured 設定 › 通知 daily_summary_time (JST).
# Guarded per (store, JST-date) by checking for an existing daily_summary row.
@app.on_event("startup")
async def _start_daily_notification_tick() -> None:
    import asyncio
    from datetime import datetime, timedelta, timezone as _tz

    from sqlalchemy import func as _func, select as _select

    from app.db import async_session as _session
    from app.models.notification import Notification as _Notification
    from app.models.product import (
        ItemType as _ItemType, Product as _Product,
        ProductStatus as _PStatus, ProductVariant as _PV,
    )
    from app.models.settings_kv import SettingsKV as _KV
    from app.models.store import Store as _Store
    from app.services.notifier import notify as _notify

    _JST = _tz(timedelta(hours=9))

    async def _tick_once() -> None:
        now_jst = datetime.now(_JST)
        hhmm = now_jst.strftime("%H:%M")
        day_start_utc = now_jst.replace(hour=0, minute=0, second=0, microsecond=0) \
            .astimezone(_tz.utc).replace(tzinfo=None)
        async with _session() as db:
            stores = (await db.execute(_select(_Store.id))).scalars().all()
            for sid in stores:
                row = (await db.execute(_select(_KV).where(
                    _KV.store_id == sid, _KV.namespace == "notifications"
                ))).scalar_one_or_none()
                cfg = dict(row.data_json) if row and row.data_json else {}
                if cfg.get("daily_summary_time", "08:00") != hhmm:
                    continue
                already = (await db.execute(_select(_Notification.id).where(
                    _Notification.store_id == sid,
                    _Notification.kind == "daily_summary",
                    _Notification.created_at >= day_start_utc,
                ).limit(1))).scalar_one_or_none()
                if already is not None:
                    continue
                # Compose the summary: low-stock count + expiring consumables.
                low = (await db.execute(
                    _select(_func.count(_func.distinct(_Product.id)))
                    .join(_PV, _PV.product_id == _Product.id)
                    .where(
                        _Product.store_id == sid,
                        _Product.status == _PStatus.active,
                        (_PV.on_hand - _PV.committed - _PV.unavailable)
                        <= _func.coalesce(_PV.low_stock_threshold, 10),
                    )
                )).scalar_one()
                expiring = (await db.execute(
                    _select(_func.count(_Product.id)).where(
                        _Product.store_id == sid,
                        _Product.item_type == _ItemType.consumable,
                        _Product.expiry_date.is_not(None),
                        _Product.expiry_date <= (now_jst.date() + timedelta(days=30)),
                        _Product.expiry_date >= now_jst.date(),
                    )
                )).scalar_one()
                await _notify(
                    db, sid, "daily_summary",
                    f"日次サマリー {now_jst.strftime('%m/%d')}",
                    f"在庫低下 {low} 件・期限間近（30日以内） {expiring} 件です。ダッシュボードでご確認ください。",
                    link_path="/dashboard",
                )
                await db.commit()

    async def _loop() -> None:
        while True:
            try:
                await _tick_once()
            except Exception:  # noqa: BLE001 — the tick must never die
                pass
            await asyncio.sleep(60)

    asyncio.create_task(_loop())


@app.get("/health")
async def health() -> dict:
    return {"status": "ok"}


# --- Uploaded media mount ------------------------------------------------------
# Files uploaded through the app (currently: the 表示ロゴ from 設定 › 一般)
# land in backend/media/ (gitignored) and are served here.
_media_dir = Path(__file__).resolve().parent.parent / "media"
_media_dir.mkdir(parents=True, exist_ok=True)
app.mount("/media", StaticFiles(directory=str(_media_dir)), name="media")


# --- Static frontend mount ----------------------------------------------------
# The root docker-compose mounts the host's ./frontend at /frontend inside the
# container. If that directory exists, serve it at /app/. Outside docker the
# fallback path (../frontend relative to this file) lets `uvicorn app.main:app`
# also serve the frontend.
_frontend_candidates = [
    Path(os.environ.get("FRONTEND_DIR", "/frontend")),
    Path(__file__).resolve().parent.parent.parent / "frontend",
]
class _SafeStaticFiles(StaticFiles):
    """Wrap StaticFiles so malformed paths return 404 instead of 500.

    Background: browser autofill / bookmark heuristics sometimes navigate
    to URLs like ``/app/http%3A//127.0.0.1%3A8000/app/`` — a literal ``:``
    in the path, which ``os.stat()`` on Windows rejects with WinError 123.
    Without this wrapper, the request crashes with a 500 traceback in the
    server log on every such hit; with it, we return a quiet 404.
    """

    async def get_response(self, path, scope):  # type: ignore[override]
        try:
            return await super().get_response(path, scope)
        except OSError:
            # Windows can't represent the path (colon, etc.) — treat as missing.
            from starlette.responses import PlainTextResponse
            return PlainTextResponse("Not Found", status_code=404)


for _candidate in _frontend_candidates:
    if _candidate.is_dir() and (_candidate / "index.html").is_file():
        app.mount(
            "/app",
            _SafeStaticFiles(directory=str(_candidate), html=True),
            name="frontend",
        )

        @app.get("/", include_in_schema=False)
        async def _root_redirect() -> RedirectResponse:
            return RedirectResponse(url="/app/")

        break
