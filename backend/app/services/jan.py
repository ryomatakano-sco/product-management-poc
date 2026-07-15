"""JAN-13 / EAN-13 / JAN-8 normalisation and validation.

Pure functions, no dependencies. Used by the AI suggestions router as the
gate that runs before any model call — rejects malformed input early so we
don't pay for an OpenAI round-trip on a typo.

Reference: GS1 General Specifications §7.9 (mod-10 check digit calculation).
JAN is GS1 Japan's name for the Japanese subset of EAN — 13 digits with the
GS1 country prefix 45x or 49x, or 8 digits for the short EAN-8 form.
"""

from __future__ import annotations

import unicodedata


def normalize_jan(raw: str | None) -> str | None:
    """Normalise a JAN candidate string.

    Strips whitespace, applies NFKC (so full-width digits ``４９０１…`` become
    half-width ``4901…``), and verifies the result is pure digits of length
    8 or 13. Returns the cleaned digit string on success, ``None`` on failure.

    Does NOT validate the check digit — call ``validate_check_digit`` for that.
    Splitting the two lets the caller report "wrong shape" vs "wrong check
    digit" with different error messages.
    """
    if raw is None:
        return None
    # NFKC folds full-width Roman digits to ASCII; also handles tab/whitespace
    # in compatibility forms. Cast to str first so a bytes input throws early.
    s = unicodedata.normalize("NFKC", str(raw)).strip()
    if not s:
        return None
    # After NFKC, everything that should be a digit is ASCII 0-9.
    if not s.isdigit():
        return None
    if len(s) not in (8, 13):
        return None
    return s


def validate_check_digit(jan: str) -> bool:
    """GS1 mod-10 check on a normalized 8- or 13-digit JAN.

    The last digit is the check; the remaining digits are weighted by 3 and 1
    alternating, starting from the rightmost data digit. Sum, mod 10,
    subtract from 10 (with the special case that 10 → 0) — must equal the
    final digit.

    Caller is responsible for normalising first (call ``normalize_jan``).
    Returns ``False`` on any wrong-shape input rather than raising.
    """
    if not jan or not jan.isdigit() or len(jan) not in (8, 13):
        return False
    digits = [int(c) for c in jan]
    body, check = digits[:-1], digits[-1]
    # GS1 alternates 3-1-3-1 from the rightmost data digit (i.e. body's last).
    # Iterate body in reverse so index 0 of the reversed list gets weight 3.
    weighted = sum(d * (3 if i % 2 == 0 else 1) for i, d in enumerate(reversed(body)))
    expected = (10 - (weighted % 10)) % 10
    return expected == check


