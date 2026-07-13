"""Notification feed endpoints — power the AdminShell bell."""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Query
from sqlalchemy import func, select, update

from app.deps import DB, StoreId
from app.models.notification import Notification

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get("", summary="通知一覧（新しい順）")
async def list_notifications(
    db: DB,
    store_id: StoreId,
    unread_only: bool = Query(False),
    limit: int = Query(15, ge=1, le=50),
):
    base = select(Notification).where(Notification.store_id == store_id)
    if unread_only:
        base = base.where(Notification.read_at.is_(None))
    rows = (await db.execute(
        base.order_by(Notification.id.desc()).limit(limit)
    )).scalars().all()
    unread = (await db.execute(
        select(func.count()).select_from(Notification).where(
            Notification.store_id == store_id, Notification.read_at.is_(None)
        )
    )).scalar_one()
    return {
        "items": [
            {
                "id": n.id, "kind": n.kind, "title": n.title, "body": n.body,
                "link_path": n.link_path, "read_at": n.read_at.isoformat() if n.read_at else None,
                "created_at": n.created_at.isoformat() if n.created_at else None,
            }
            for n in rows
        ],
        "unread_count": unread,
    }


@router.post("/{notification_id}/read", status_code=204, summary="既読にする")
async def mark_read(notification_id: int, db: DB, store_id: StoreId):
    n = (await db.execute(
        select(Notification).where(
            Notification.id == notification_id, Notification.store_id == store_id
        )
    )).scalar_one_or_none()
    if n is None:
        raise HTTPException(404, detail="Notification not found")
    if n.read_at is None:
        n.read_at = datetime.now(timezone.utc)
        await db.commit()


@router.post("/read-all", status_code=204, summary="すべて既読にする")
async def mark_all_read(db: DB, store_id: StoreId):
    await db.execute(
        update(Notification)
        .where(Notification.store_id == store_id, Notification.read_at.is_(None))
        .values(read_at=datetime.now(timezone.utc))
    )
    await db.commit()
