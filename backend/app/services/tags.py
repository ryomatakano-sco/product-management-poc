"""Batched tag get-or-create (review C4).

Three routers (product create, PO create, PO update) each ran a per-tag
SELECT + conditional INSERT in a loop — an N+1 that scales with tag count.
This is the one shared implementation: ONE ``WHERE name IN (...)`` fetch,
one bulk add of the missing names, one flush. Does not commit — the caller
owns the transaction.
"""

from __future__ import annotations

from sqlalchemy import select

from app.models.tag import Tag


async def ensure_tags(db, store_id: int, names: list[str]) -> list[Tag]:
    """Return Tag rows for every name, creating the missing ones. Order and
    duplicates of ``names`` are preserved in the returned list."""
    if not names:
        return []
    unique = list(dict.fromkeys(names))
    existing = {
        t.name: t
        for t in (await db.execute(
            select(Tag).where(Tag.store_id == store_id, Tag.name.in_(unique))
        )).scalars().all()
    }
    missing = [n for n in unique if n not in existing]
    if missing:
        # Bulk INSERT (one executemany) + one re-SELECT — MySQL has no
        # RETURNING, so ORM add_all+flush would fall back to N single-row
        # INSERTs to fetch each lastrowid. This stays at 3 queries total
        # regardless of tag count.
        from sqlalchemy import insert
        await db.execute(insert(Tag), [
            {"store_id": store_id, "name": n} for n in missing
        ])
        created = (await db.execute(
            select(Tag).where(Tag.store_id == store_id, Tag.name.in_(missing))
        )).scalars().all()
        existing.update({t.name: t for t in created})
    return [existing[n] for n in names]
