"""Timezone helpers for the repo's split storage convention (see CONTEXT.md §4).

  • ``sales_records.sold_at`` is **UTC-naive** (Python ``datetime.now(timezone.utc)``).
  • ``created_at`` columns are **JST-naive** (MySQL ``NOW()`` on the dev box) —
    those are handled by ``_to_naive_jst`` in routers/purchase_orders.py.

Any JST calendar boundary (today, this month…) that gets compared against
``sold_at`` MUST go through ``jst_to_utc_naive`` — comparing a JST-aware or
JST-naive datetime against the UTC-naive column silently skews every day/month
KPI by 9 hours (audit findings C1/C2/M9).
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

JST = timezone(timedelta(hours=9))


def jst_to_utc_naive(dt: datetime) -> datetime:
    """JST-aware (or naive-assumed-JST) datetime → naive UTC for sold_at comparisons."""
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=JST)
    return dt.astimezone(timezone.utc).replace(tzinfo=None)


def any_to_utc_naive(dt: datetime) -> datetime:
    """Client-supplied datetime (aware in any zone, or naive-assumed-UTC) →
    naive UTC. Use for query params filtering sold_at."""
    if dt.tzinfo is None:
        return dt  # naive input is treated as already-UTC (matches storage)
    return dt.astimezone(timezone.utc).replace(tzinfo=None)
