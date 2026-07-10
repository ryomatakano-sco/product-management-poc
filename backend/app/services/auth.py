"""PoC auth primitives: scrypt password hashing + stateless HMAC session tokens.

Deliberate PoC trade-offs (revisit before production):
  • stdlib-only (scrypt + hmac) — the project brief forbids gratuitous deps.
  • Session token is stateless: ``{user_id}.{store_id}.{expires_ts}.{sig}``
    signed with a fixed dev secret from config. No server-side session store,
    so tokens survive --reload restarts; there is no revocation list —
    deactivating a user takes effect on the next /auth/me check the frontend
    performs at app load, not instantly on API calls.
  • Cookie: plx_session, HttpOnly, SameSite=Lax, 7 days.
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import secrets
import time

from app.config import settings

COOKIE_NAME = "plx_session"
SESSION_TTL_SECONDS = 7 * 24 * 3600

_SCRYPT_N, _SCRYPT_R, _SCRYPT_P, _DKLEN = 2**14, 8, 1, 64


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.scrypt(
        password.encode(), salt=salt, n=_SCRYPT_N, r=_SCRYPT_R, p=_SCRYPT_P, dklen=_DKLEN
    )
    return f"scrypt${base64.b64encode(salt).decode()}${base64.b64encode(digest).decode()}"


def verify_password(password: str, stored: str) -> bool:
    try:
        scheme, salt_b64, hash_b64 = stored.split("$")
        if scheme != "scrypt":
            return False
        salt = base64.b64decode(salt_b64)
        expected = base64.b64decode(hash_b64)
        digest = hashlib.scrypt(
            password.encode(), salt=salt, n=_SCRYPT_N, r=_SCRYPT_R, p=_SCRYPT_P, dklen=_DKLEN
        )
        return hmac.compare_digest(digest, expected)
    except Exception:
        return False


def _sign(payload: str) -> str:
    return hmac.new(settings.auth_secret.encode(), payload.encode(), hashlib.sha256).hexdigest()[:40]


def make_session_token(user_id: int, store_id: int) -> str:
    expires = int(time.time()) + SESSION_TTL_SECONDS
    payload = f"{user_id}.{store_id}.{expires}"
    return f"{payload}.{_sign(payload)}"


def parse_session_token(token: str | None) -> dict | None:
    """Return {'user_id', 'store_id'} for a valid, unexpired token, else None."""
    if not token:
        return None
    parts = token.split(".")
    if len(parts) != 4:
        return None
    payload = ".".join(parts[:3])
    if not hmac.compare_digest(_sign(payload), parts[3]):
        return None
    try:
        user_id, store_id, expires = int(parts[0]), int(parts[1]), int(parts[2])
    except ValueError:
        return None
    if expires < time.time():
        return None
    return {"user_id": user_id, "store_id": store_id}
