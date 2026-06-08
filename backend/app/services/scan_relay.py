"""In-memory desktop⟷phone scan relay (Option 2 companion scanner).

Pure, framework-free state for a short-lived "pairing" channel:

    desktop  --POST /scan-sessions-->  token  --(QR)-->  phone
    phone    --POST /scan-sessions/{token}/scan {code}-->  relay
    desktop  --GET  /scan-sessions/{token} (poll)-->  {status, jan}

There is **no database** here on purpose. A scan pairing is a transient,
seconds-to-minutes handshake; persisting it would mean a manual schema change
(the PoC has no migration library) for data that is meaningless after the JAN
reaches the desktop. So the channel lives in a process-local dict with a TTL.

Caveats (documented, acceptable for a PoC, must be revisited before prod):
  - Process-local: a multi-worker / multi-process deploy would not share the
    dict. The PoC runs a single uvicorn worker, so this is fine for now.
  - No auth: anyone who learns a live token could submit a code to it. Tokens
    are unguessable (``secrets.token_urlsafe``) and expire fast, and the only
    payload is a JAN string (no PII, no write to the store happens here — the
    desktop still drives the actual lookup/auto-fill under its own X-Store-Id).

JAN validation reuses ``app.services.jan`` so the relay and the interactive
endpoint enforce the exact same GS1 rules.
"""

from __future__ import annotations

import secrets
import time
from dataclasses import dataclass, field
from threading import Lock

from app.services.jan import normalize_jan, validate_check_digit

# How long a freshly created pairing token stays usable, in seconds.
SESSION_TTL_SECONDS = 300  # 5 minutes — long enough to pick up a phone, short
#                            enough that a leaked token is useless quickly.
# Hard cap so a flood of create calls can't grow memory without bound.
_MAX_SESSIONS = 500


@dataclass
class _Session:
    token: str
    created_at: float
    expires_at: float
    status: str = "pending"          # pending | done
    jan: str | None = None
    store_id: int | None = None      # informational only; desktop drives the store
    scanned_at: float | None = field(default=None)


_SESSIONS: dict[str, _Session] = {}
_LOCK = Lock()


def _now() -> float:
    return time.time()


def _sweep_locked() -> None:
    """Drop expired sessions. Caller must hold ``_LOCK``."""
    now = _now()
    expired = [t for t, s in _SESSIONS.items() if s.expires_at <= now]
    for t in expired:
        _SESSIONS.pop(t, None)


def create_session(store_id: int | None = None) -> _Session:
    """Create a pairing session and return it (token + expiry)."""
    with _LOCK:
        _sweep_locked()
        if len(_SESSIONS) >= _MAX_SESSIONS:
            # FIFO-evict the oldest to stay bounded (dicts keep insertion order).
            _SESSIONS.pop(next(iter(_SESSIONS)), None)
        token = secrets.token_urlsafe(9)  # ~12 chars, URL/QR safe, unguessable
        now = _now()
        sess = _Session(
            token=token,
            created_at=now,
            expires_at=now + SESSION_TTL_SECONDS,
            store_id=store_id,
        )
        _SESSIONS[token] = sess
        return sess


def get_session(token: str) -> _Session | None:
    """Return the session if it exists and hasn't expired, else None."""
    with _LOCK:
        _sweep_locked()
        return _SESSIONS.get(token)


class ScanRelayError(Exception):
    """Base for relay submit failures, carrying an HTTP-ish hint."""

    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code          # "not_found" | "expired" | "invalid_jan"
        self.message = message


def submit_scan(token: str, raw_code: str) -> _Session:
    """Phone-side: attach a scanned code to a pairing session.

    Validates the code as a JAN (NFKC normalize → 8/13 digits → GS1 mod-10),
    exactly like the interactive endpoint. Raises ``ScanRelayError`` for an
    unknown/expired token or a non-JAN code (the phone keeps scanning).
    """
    normalised = normalize_jan(raw_code)
    if normalised is None or not validate_check_digit(normalised):
        # Non-JAN (QR/Code-128) or bad check digit — do not store; phone retries.
        raise ScanRelayError("invalid_jan", "有効なJANバーコードではありません")
    with _LOCK:
        _sweep_locked()
        sess = _SESSIONS.get(token)
        if sess is None:
            raise ScanRelayError("not_found", "ペアリングが見つかりません（期限切れの可能性）")
        if sess.expires_at <= _now():
            _SESSIONS.pop(token, None)
            raise ScanRelayError("expired", "ペアリングの有効期限が切れました")
        sess.jan = normalised
        sess.status = "done"
        sess.scanned_at = _now()
        return sess


def _reset_for_tests() -> None:
    """Test helper: clear all sessions."""
    with _LOCK:
        _SESSIONS.clear()
