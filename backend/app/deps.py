"""FastAPI dependencies: DB session and store_id resolution."""

from __future__ import annotations

from typing import Annotated, AsyncGenerator

from fastapi import Depends, Header, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import async_session


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with async_session() as session:
        yield session


async def get_store_id(
    x_store_id: Annotated[int | None, Header()] = None,
) -> int:
    """Extract store_id from the X-Store-Id header.

    Every request must include this header. There is no auth in this PoC,
    but multi-tenancy requires knowing which store we're operating on.
    """
    if x_store_id is None:
        raise HTTPException(status_code=400, detail="X-Store-Id header is required")
    return x_store_id


DB = Annotated[AsyncSession, Depends(get_db)]
StoreId = Annotated[int, Depends(get_store_id)]
