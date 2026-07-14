"""FastAPI dependencies: DB session and store_id resolution."""

from __future__ import annotations

from typing import Annotated, AsyncGenerator

from fastapi import Depends, Header, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import async_session


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with async_session() as session:
        yield session


async def get_store_id(
    request: Request,
    x_store_id: Annotated[int | None, Header()] = None,
) -> int:
    """Resolve the tenant store id.

    Order of precedence (PoC — see CONTEXT.md §8.1):
      1. A valid session cookie (set by POST /auth/login) — the store id is
         embedded in the signed token, so no DB hit here.
      2. The legacy ``X-Store-Id`` header — a dev fallback so curl testing and
         the DevPanel store switcher keep working. Restricted to loopback
         clients: a remote request with no session can no longer reach
         store-scoped data by guessing the header (review 2026-07-14).
    """
    from app.services.auth import COOKIE_NAME, parse_session_token

    tok = parse_session_token(request.cookies.get(COOKIE_NAME))
    if tok is not None:
        return tok["store_id"]
    if x_store_id is None:
        raise HTTPException(status_code=400, detail="ログインが必要です")
    if not dev_fallback_allowed(request):
        raise HTTPException(status_code=401, detail="ログインが必要です")
    return x_store_id


async def get_current_user_name(
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> str | None:
    """Display name of the logged-in user, or None on the X-Store-Id dev path.

    Used to stamp `created_by` on writes (mig 016). Snapshot by name, not FK,
    so history survives user deletion.
    """
    from sqlalchemy import select

    from app.models.user import User
    from app.services.auth import COOKIE_NAME, parse_session_token

    tok = parse_session_token(request.cookies.get(COOKIE_NAME))
    if tok is None:
        return None
    return (await db.execute(
        select(User.display_name).where(User.id == tok["user_id"])
    )).scalar_one_or_none()


async def get_current_user(
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Full User row for the session cookie, or None on the X-Store-Id dev
    path. The dev path is treated as admin by role checks (curl testing)."""
    from sqlalchemy import select

    from app.models.user import User
    from app.services.auth import COOKIE_NAME, parse_session_token

    tok = parse_session_token(request.cookies.get(COOKIE_NAME))
    if tok is None:
        return None
    return (await db.execute(
        select(User).where(User.id == tok["user_id"])
    )).scalar_one_or_none()


DB = Annotated[AsyncSession, Depends(get_db)]
StoreId = Annotated[int, Depends(get_store_id)]
CurrentUserName = Annotated[str | None, Depends(get_current_user_name)]
CurrentUser = Annotated[object | None, Depends(get_current_user)]


def ensure_admin(user) -> None:
    """403 when a logged-in non-admin hits an admin-only write.
    None (X-Store-Id dev path) passes — it has no user to check."""
    from app.models.user import UserRole

    if user is not None and user.role != UserRole.admin:
        raise HTTPException(status_code=403, detail="この操作には管理者権限が必要です")


def dev_fallback_allowed(request: Request) -> bool:
    """Whether the anonymous X-Store-Id header path is permitted for this
    request. Only from loopback (curl on the dev box) — a remote client with
    no session must not reach store-scoped writes via the dev header.
    """
    host = request.client.host if request.client else None
    return host in ("127.0.0.1", "::1", "localhost", None)
