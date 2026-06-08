"""Schemas for the desktop⟷phone scan relay (Option 2 companion scanner)."""

from __future__ import annotations

from pydantic import BaseModel, Field


class ScanSessionCreated(BaseModel):
    """Returned to the desktop when it opens a pairing session."""

    token: str
    expires_in_seconds: int = Field(..., description="TTL of the pairing token")


class ScanSessionStatus(BaseModel):
    """Polled by the desktop; the phone fills `jan` once it scans."""

    token: str
    status: str = Field(..., description="pending | done | expired")
    jan: str | None = None


class ScanSubmit(BaseModel):
    """Phone → relay: the raw decoded code from the camera."""

    code: str = Field(..., min_length=1, max_length=64)


class ScanSubmitResult(BaseModel):
    status: str
    jan: str | None = None
