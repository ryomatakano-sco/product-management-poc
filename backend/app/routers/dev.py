"""Developer status endpoint.

Powers the in-app Dev Panel (frontend/components/DevPanel.jsx). Reports live
connectivity for MySQL and the AI configuration, plus a bit of runtime info.

This endpoint does NOT require an X-Store-Id header (it's infrastructure-level)
and never returns secret values — at most a masked tail of the OpenAI key so
you can tell *which* key is loaded without exposing it.
"""

from __future__ import annotations

import os
import platform
import sys
import time
from datetime import datetime
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy import text

from app.config import ENV_FILES, settings
from app.db import engine
from app.deps import dev_fallback_allowed
from app.services.ai_agent import EXTRACTION_MODEL, FALLBACK_SEARCH_MODEL, SEARCH_MODEL


def _local_only(request: Request) -> None:
    """Dev panel endpoints write .env to disk and report DB host/user — they
    must only be reachable from the local machine, never a remote client
    (review 2026-07-14).

    Additionally, when ``DEV_PANEL_PASSWORD`` is set in the environment, every
    /dev/* call must carry a matching ``X-Dev-Password`` header — the panel
    prompts once per browser session. Unset env = no password (backwards
    compatible for fresh checkouts). NOTE: this key must never be added to
    EDITABLE_KEYS, or the panel could rewrite its own lock.
    """
    if not dev_fallback_allowed(request):
        raise HTTPException(status_code=404, detail="Not found")
    import hmac as _hmac

    required = os.environ.get("DEV_PANEL_PASSWORD", "").strip()
    if required:
        supplied = request.headers.get("X-Dev-Password", "")
        if not _hmac.compare_digest(supplied, required):
            raise HTTPException(status_code=401, detail="dev password required")


router = APIRouter(prefix="/dev", tags=["dev"], dependencies=[Depends(_local_only)])

# Keys that the dev panel is allowed to edit. We intentionally keep this small
# — DB_* changes need a process restart to re-create the SQLAlchemy engine, so
# we don't expose them here. AI knobs take effect on the next request because
# ai_agent.py reads os.environ each call.
EDITABLE_KEYS = {"OPENAI_API_KEY", "MOCK_AI"}


def _ai_status() -> dict:
    """Mirror the logic in services/ai_agent.py without importing it."""
    key = os.environ.get("OPENAI_API_KEY", "").strip()
    mock_flag = os.environ.get("MOCK_AI", "").strip() == "1"
    if mock_flag:
        mode = "forced_mock"
    elif key:
        mode = "real"
    else:
        mode = "mock"
    return {
        "mode": mode,
        "openai_api_key_set": bool(key),
        # Masked tail so it's possible to tell which key is loaded without
        # leaking it. Empty when no key is set.
        "openai_api_key_tail": (f"…{key[-4:]}" if len(key) >= 8 else ""),
        "mock_ai_env": os.environ.get("MOCK_AI", ""),
        "search_model": SEARCH_MODEL,
        "fallback_search_model": FALLBACK_SEARCH_MODEL,
        "extraction_model": EXTRACTION_MODEL,
    }


async def _db_status() -> dict:
    """Try a trivial SELECT 1 and time it. Returns connectivity + latency."""
    started = time.perf_counter()
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        elapsed_ms = round((time.perf_counter() - started) * 1000, 1)
        return {
            "connected": True,
            "latency_ms": elapsed_ms,
            "error": None,
        }
    except Exception as exc:  # noqa: BLE001 — surface any DB error to the UI
        return {
            "connected": False,
            "latency_ms": None,
            # Class + short message — enough to debug, no stack trace dump.
            "error": f"{type(exc).__name__}: {exc}",
        }


def _target_env_file() -> Path:
    """Pick which .env file the dev panel writes to.

    Prefer the root .env (canonical, also used by docker-compose). If only the
    backend-local one exists, fall back to that. If neither exists, create the
    root one — that's the file we expect contributors to maintain.
    """
    for p in ENV_FILES:
        if p.is_file():
            return p
    # No file yet — create at the first declared location (repo root).
    target = ENV_FILES[0]
    target.touch()
    return target


def _upsert_env_lines(path: Path, updates: dict[str, str]) -> None:
    """Replace or append KEY=value lines in a .env file, preserving comments.

    Lines matching ``KEY=...`` (ignoring leading whitespace, with optional
    leading ``#`` for commented-out lines) are replaced. Anything else is
    written back verbatim. Missing keys are appended at the end.
    """
    try:
        original = path.read_text(encoding="utf-8").splitlines(keepends=False)
    except FileNotFoundError:
        original = []

    remaining = dict(updates)
    out: list[str] = []
    for line in original:
        stripped = line.lstrip()
        # Strip optional leading "#" used to comment a var out
        bare = stripped[1:].lstrip() if stripped.startswith("#") else stripped
        replaced = False
        for key in list(remaining):
            if bare.startswith(f"{key}="):
                out.append(f"{key}={remaining.pop(key)}")
                replaced = True
                break
        if not replaced:
            out.append(line)
    for key, val in remaining.items():
        out.append(f"{key}={val}")

    path.write_text("\n".join(out) + "\n", encoding="utf-8")


class EnvPatch(BaseModel):
    # Use Optional-style: only keys present in the body are touched. Sending
    # an empty string clears the value (and uncomments any matching line).
    OPENAI_API_KEY: str | None = None
    MOCK_AI: str | None = None


@router.patch("/env")
async def patch_dev_env(patch: EnvPatch) -> dict:
    """Update editable env vars in-process AND in the on-disk .env file.

    Effects:
    - Updates ``os.environ`` immediately (services read from it on each call,
      so the change is live without a server restart).
    - Persists to the canonical .env file so the change survives restarts.

    Only ``OPENAI_API_KEY`` and ``MOCK_AI`` can be set here. DB vars are not
    exposed because changing them at runtime would require rebuilding the
    SQLAlchemy engine — outside the scope of the dev panel.
    """
    updates = {k: v for k, v in patch.model_dump().items() if v is not None}
    if not updates:
        raise HTTPException(status_code=400, detail="No editable fields provided")
    unknown = set(updates) - EDITABLE_KEYS
    if unknown:
        raise HTTPException(
            status_code=400, detail=f"Unsupported keys: {sorted(unknown)}"
        )

    for key, value in updates.items():
        if value == "":
            os.environ.pop(key, None)
        else:
            os.environ[key] = value

    target = _target_env_file()
    _upsert_env_lines(target, updates)

    return {
        "updated": sorted(updates.keys()),
        "written_to": str(target),
        "ai": _ai_status(),
    }


@router.get("/status")
async def dev_status() -> dict:
    db = await _db_status()
    ai = _ai_status()
    return {
        "now": datetime.now().isoformat(timespec="seconds"),
        "db": {
            **db,
            "host": settings.db_host,
            "port": settings.db_port,
            "name": settings.db_name,
            "user": settings.db_user,
            # Driver/dialect from the resolved URL prefix only — no credentials.
            "dialect": settings.resolved_database_url.split("://", 1)[0],
            "using_database_url_override": bool(settings.database_url.strip()),
        },
        "ai": ai,
        "runtime": {
            "python": sys.version.split()[0],
            "platform": platform.platform(),
            "frontend_dir": os.environ.get("FRONTEND_DIR", ""),
            "env_files_loaded": [str(p) for p in ENV_FILES if p.is_file()],
            "env_write_target": str(_target_env_file()),
        },
    }
