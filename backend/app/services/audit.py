"""Audit trail helper (migration 016).

`log_event` only stages the row on the session — the caller's commit picks it
up, so an audit row can never outlive a rolled-back business write. It must
never raise: auditing failures must not break the underlying operation.
"""

from __future__ import annotations

import logging

from app.models.audit import AuditEvent

logger = logging.getLogger(__name__)


def log_event(
    db,
    *,
    store_id: int,
    user_name: str | None,
    action: str,
    entity_type: str,
    entity_id: int | None = None,
    detail: str | None = None,
) -> None:
    try:
        db.add(AuditEvent(
            store_id=store_id,
            user_name=user_name,
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            detail=(detail or None) and detail[:500],
        ))
    except Exception:  # pragma: no cover — defensive, see module docstring
        logger.exception("audit log_event failed")
