"""Support page endpoints — FAQ list + ticket submission + status + version.

The FAQ is static (hard-coded in app/data/faq.py). Tickets persist to
`support_tickets`. System status is always "ok" for the PoC — there's
no real health check upstream. Version info is hard-coded per the design.
"""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter
from sqlalchemy import select

from app.data.faq import FAQ_ITEMS
from app.deps import DB, StoreId
from app.models.support import SupportTicket
from app.schemas.support import (
    FaqItem,
    SupportTicketCreate,
    SupportTicketRead,
    SystemStatus,
    VersionInfo,
)


router = APIRouter(prefix="/support", tags=["support"])


@router.get("/faq", response_model=list[FaqItem], summary="FAQ一覧を取得")
async def list_faq():
    """Static FAQ — see app/data/faq.py for the 8 hardcoded items."""
    return FAQ_ITEMS


@router.post(
    "/tickets",
    response_model=SupportTicketRead,
    status_code=201,
    summary="お問い合わせを送信",
)
async def create_ticket(body: SupportTicketCreate, db: DB, store_id: StoreId):
    ticket = SupportTicket(
        store_id=store_id,
        subject_category=body.subject_category,
        related_page=body.related_page,
        body=body.body,
        email=body.email,
        contact_window=body.contact_window,
    )
    db.add(ticket)
    await db.commit()
    await db.refresh(ticket)
    return ticket


@router.get(
    "/tickets",
    response_model=list[SupportTicketRead],
    summary="お問い合わせ履歴を取得（内部管理用）",
)
async def list_tickets(db: DB, store_id: StoreId):
    rows = (await db.execute(
        select(SupportTicket)
        .where(SupportTicket.store_id == store_id)
        .order_by(SupportTicket.created_at.desc())
        .limit(50)
    )).scalars().all()
    return rows


@router.get("/system-status", response_model=SystemStatus, summary="システム稼働状況")
async def system_status():
    return SystemStatus(status="ok", checked_at=datetime.now(timezone.utc))


@router.get("/version", response_model=VersionInfo, summary="バージョン情報")
async def version():
    return VersionInfo(
        app="1.4.0",
        paylight_x="2.8.3",
        released_at=datetime(2026, 5, 10, tzinfo=timezone.utc),
    )
