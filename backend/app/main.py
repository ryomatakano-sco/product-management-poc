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
    branches,
    categories,
    dashboard,
    dev,
    images,
    inventory,
    products,
    purchase_orders,
    sales,
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
app.include_router(dashboard.router)
app.include_router(settings_router.router)
app.include_router(support.router)
app.include_router(dev.router)


@app.get("/health")
async def health() -> dict:
    return {"status": "ok"}


# --- Static frontend mount ----------------------------------------------------
# The root docker-compose mounts the host's ./frontend at /frontend inside the
# container. If that directory exists, serve it at /app/. Outside docker the
# fallback path (../frontend relative to this file) lets `uvicorn app.main:app`
# also serve the frontend.
_frontend_candidates = [
    Path(os.environ.get("FRONTEND_DIR", "/frontend")),
    Path(__file__).resolve().parent.parent.parent / "frontend",
]
for _candidate in _frontend_candidates:
    if _candidate.is_dir() and (_candidate / "index.html").is_file():
        app.mount(
            "/app",
            StaticFiles(directory=str(_candidate), html=True),
            name="frontend",
        )

        @app.get("/", include_in_schema=False)
        async def _root_redirect() -> RedirectResponse:
            return RedirectResponse(url="/app/")

        break
