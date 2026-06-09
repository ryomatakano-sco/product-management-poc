"""Schemas for the desktop⟷phone scan relay (Option 2 companion scanner).

Multi-scan: one pairing session carries a *list* of scanned JANs (the phone
pairs once and scans many products); the desktop polls with a cursor and opens
each new product.
"""

from __future__ import annotations

from pydantic import BaseModel, Field


class ScanSessionCreated(BaseModel):
    """Returned to the desktop when it opens a pairing session."""

    token: str
    expires_in_seconds: int = Field(..., description="TTL of the pairing token")
    phone_url: str | None = Field(
        None,
        description=(
            "Full URL the phone should open, built from the server's LAN IP so "
            "the pairing QR works across devices (not localhost). None if the "
            "LAN IP couldn't be determined — desktop falls back to its own origin."
        ),
    )


class ScanItem(BaseModel):
    """One scanned product in a session's history."""

    seq: int = Field(..., description="1-based, monotonically increasing per session")
    jan: str
    scanned_at: float = Field(..., description="epoch seconds")


class ScanSessionStatus(BaseModel):
    """Polled by the desktop. ``items`` is the scan history; ``latest_seq`` is
    the cursor to pass back as ``?since=`` next poll. ``jan`` is the most recent
    scan (convenience / backward-compat)."""

    token: str
    status: str = Field(..., description="active | expired")
    items: list[ScanItem] = Field(default_factory=list)
    latest_seq: int = 0
    jan: str | None = None


class ScanSubmit(BaseModel):
    """Phone → relay: the raw decoded code from the camera."""

    code: str = Field(..., min_length=1, max_length=64)


class ScanSubmitResult(BaseModel):
    status: str
    jan: str | None = None
    seq: int = 0
    count: int = Field(0, description="total scans in this session so far")
