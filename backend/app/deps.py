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
      2. The legacy ``X-Store-Id`` header — kept as a dev fallback so curl
         testing and the DevPanel store switcher keep working. A production
         build would remove this branch.
    """
    from app.services.auth import COOKIE_NAME, parse_session_token

    tok = parse_session_token(request.cookies.get(COOKIE_NAME))
    if tok is not None:
        return tok["store_id"]
    if x_store_id is None:
        raise HTTPException(status_code=400, detail="X-Store-Id header is required")
    return x_store_id


DB = Annotated[AsyncSession, Depends(get_db)]
StoreId = Annotated[int, Depends(get_store_id)]
