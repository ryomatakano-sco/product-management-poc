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

from fastapi import APIRouter, HTTPException, Request

from app.schemas.scan_session import (
    ScanItem,
    ScanSessionCreated,
    ScanSessionStatus,
    ScanSubmit,
    ScanSubmitResult,
)
from app.services import scan_relay

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/scan-sessions", tags=["scan-relay"])


@router.post("", response_model=ScanSessionCreated, status_code=201)
async def create_scan_session(request: Request) -> ScanSessionCreated:
    """Desktop opens a pairing session. Returns an unguessable, short-lived token.

    Also returns ``phone_url`` built from the server's LAN IP + the port the
    request came in on, so the pairing QR sends the phone to the PC's network
    address (not ``localhost``, which on the phone is the phone itself). If the
    desktop opened the app via the LAN IP already, that host is used as-is.
    """
    sess = scan_relay.create_session()
    phone_url = None
    # Port the desktop reached us on (Host header), so the QR keeps the port.
    port = request.url.port
    host = request.url.hostname or ""
    scheme = request.url.scheme
    base_host = host
    # If the desktop is on localhost/127.x, swap in the detected LAN IP so the
    # phone can resolve it. Otherwise keep whatever host the desktop used.
    if host in ("localhost", "127.0.0.1", "::1", ""):
        ip = scan_relay.lan_ip()
        if ip:
            base_host = ip
    if base_host:
        netloc = f"{base_host}:{port}" if port else base_host
        phone_url = f"{scheme}://{netloc}/app/#/scan?token={sess.token}"
    return ScanSessionCreated(
        token=sess.token,
        expires_in_seconds=scan_relay.SESSION_TTL_SECONDS,
        phone_url=phone_url,
    )


@router.get("/{token}", response_model=ScanSessionStatus)
async def get_scan_session(token: str, since: int = 0) -> ScanSessionStatus:
    """Desktop polls this with ``?since=<last seq seen>`` and gets only newer
    scans. Multi-scan: one session accumulates many products.

    An unknown or expired token returns ``status="expired"`` (200, not 404) so
    the desktop poller can show a clean "re-open the QR" state without treating
    it as a hard error.
    """
    sess = scan_relay.get_session(token)
    if sess is None:
        return ScanSessionStatus(token=token, status="expired", items=[], latest_seq=since)
    new_items = scan_relay.items_since(sess, since)
    latest_seq = sess.items[-1].seq if sess.items else 0
    last_jan = sess.items[-1].jan if sess.items else None
    return ScanSessionStatus(
        token=token,
        status="active",
        items=[ScanItem(seq=i.seq, jan=i.jan, scanned_at=i.scanned_at) for i in new_items],
        latest_seq=latest_seq,
        jan=last_jan,
    )


@router.post("/{token}/scan", response_model=ScanSubmitResult)
async def submit_scan(token: str, body: ScanSubmit) -> ScanSubmitResult:
    """Phone submits a decoded code. Validated as a JAN before it is accepted.
    Appends to the session history (supports many scans per pairing)."""
    try:
        sess, item = scan_relay.submit_scan(token, body.code)
    except scan_relay.ScanRelayError as e:
        if e.code == "invalid_jan":
            raise HTTPException(422, detail=e.message)
        # not_found / expired
        raise HTTPException(410, detail=e.message)
    return ScanSubmitResult(status="ok", jan=item.jan, seq=item.seq, count=len(sess.items))
