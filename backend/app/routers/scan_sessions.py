"""Desktop⟷phone scan relay endpoints (Option 2 companion scanner).

Thin FastAPI layer over ``app.services.scan_relay`` (the pure in-memory store).
Flow:
    POST /scan-sessions                  desktop opens a pairing session → token
    GET  /scan-sessions/{token}          desktop polls for the scanned JAN
    POST /scan-sessions/{token}/scan     phone submits a decoded code

These endpoints are deliberately **not** store-scoped (no X-Store-Id): the
relay only carries a JAN string between two browsers of the same user. The
actual product lookup/auto-fill still runs on the desktop under its own
X-Store-Id via the existing /ai-suggestions pipeline — this router never
touches the database or the store's data.
"""

from __future__ import annotations

import logging

from fastapi import APIRouter, HTTPException

from app.schemas.scan_session import (
    ScanSessionCreated,
    ScanSessionStatus,
    ScanSubmit,
    ScanSubmitResult,
)
from app.services import scan_relay

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/scan-sessions", tags=["scan-relay"])


@router.post("", response_model=ScanSessionCreated, status_code=201)
async def create_scan_session() -> ScanSessionCreated:
    """Desktop opens a pairing session. Returns an unguessable, short-lived token."""
    sess = scan_relay.create_session()
    return ScanSessionCreated(
        token=sess.token,
        expires_in_seconds=scan_relay.SESSION_TTL_SECONDS,
    )


@router.get("/{token}", response_model=ScanSessionStatus)
async def get_scan_session(token: str) -> ScanSessionStatus:
    """Desktop polls this. ``status`` is pending until the phone scans, then done.

    An unknown or expired token returns ``status="expired"`` (200, not 404) so
    the desktop poller can show a clean "re-open the QR" state without treating
    it as a hard error.
    """
    sess = scan_relay.get_session(token)
    if sess is None:
        return ScanSessionStatus(token=token, status="expired", jan=None)
    return ScanSessionStatus(token=token, status=sess.status, jan=sess.jan)


@router.post("/{token}/scan", response_model=ScanSubmitResult)
async def submit_scan(token: str, body: ScanSubmit) -> ScanSubmitResult:
    """Phone submits a decoded code. Validated as a JAN before it is accepted."""
    try:
        sess = scan_relay.submit_scan(token, body.code)
    except scan_relay.ScanRelayError as e:
        if e.code == "invalid_jan":
            raise HTTPException(422, detail=e.message)
        # not_found / expired
        raise HTTPException(410, detail=e.message)
    return ScanSubmitResult(status=sess.status, jan=sess.jan)
