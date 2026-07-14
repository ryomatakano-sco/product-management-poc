"""Notification dispatch (heavy-tier item 3).

``notify()`` writes an in-app Notification row and, when the store's 設定 › 通知
toggles allow it AND SMTP is configured, fires an email in a background thread
(failures are logged, never raised — notifications must not break the flow
that emitted them).

PoC constraints (documented):
  • Read state is per-store, not per-user.
  • Email is plain-text smtplib with STARTTLS; the SMTP password lives in the
    settings blob like the other PoC secrets (a real build uses a secret store).
  • De-duplication: an unread notification with the same (kind, link_path)
    suppresses re-emission — so a product sitting below its threshold doesn't
    spam a row on every sale.
"""

from __future__ import annotations

import asyncio
import logging
import smtplib
from email.message import EmailMessage

from sqlalchemy import select

from app.models.notification import Notification
from app.models.settings_kv import SettingsKV

log = logging.getLogger("plx.notifier")

# settings toggle name per kind — kind is skipped when its toggle is off.
_KIND_TOGGLE = {
    "low_stock": "low_stock",
    "expiring_soon": "expiring_soon",
    "po_status": "po_status_change",
    "daily_summary": None,  # always allowed in-app; email still needs email_enabled
}


async def _notification_settings(db, store_id: int) -> dict:
    row = (await db.execute(
        select(SettingsKV).where(
            SettingsKV.store_id == store_id,
            SettingsKV.namespace == "notifications",
        )
    )).scalar_one_or_none()
    return dict(row.data_json) if row and row.data_json else {}


def _send_email_sync(cfg: dict, subject: str, body: str) -> None:
    host = (cfg.get("smtp_host") or "").strip()
    to = (cfg.get("notify_email") or "").strip()
    if not host or not to:
        return  # SMTP not configured — in-app only
    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = (cfg.get("smtp_from") or cfg.get("smtp_user") or "noreply@example.com").strip()
    msg["To"] = to
    msg.set_content(body or subject)
    try:
        with smtplib.SMTP(host, int(cfg.get("smtp_port") or 587), timeout=10) as s:
            s.starttls()
            user = (cfg.get("smtp_user") or "").strip()
            if user:
                s.login(user, cfg.get("smtp_password") or "")
            s.send_message(msg)
        log.info("notification email sent: %s", subject)
    except Exception as e:  # noqa: BLE001 — never break the caller
        log.warning("notification email failed: %s", e)


async def notify(
    db,
    store_id: int,
    kind: str,
    title: str,
    body: str | None = None,
    link_path: str | None = None,
) -> Notification | None:
    """Create an in-app notification (+ optional email). Never raises.

    Returns the row, or None when suppressed (toggle off / unread duplicate).
    Caller owns the transaction: the row rides along with the caller's commit.
    """
    try:
        cfg = await _notification_settings(db, store_id)

        toggle = _KIND_TOGGLE.get(kind)
        if toggle is not None and cfg.get(toggle) is False:
            return None

        # Suppress duplicates: same kind+link still unread.
        if link_path:
            dup = (await db.execute(
                select(Notification.id).where(
                    Notification.store_id == store_id,
                    Notification.kind == kind,
                    Notification.link_path == link_path,
                    Notification.read_at.is_(None),
                ).limit(1)
            )).scalar_one_or_none()
            if dup is not None:
                return None

        n = Notification(
            store_id=store_id, kind=kind, title=title, body=body, link_path=link_path,
        )
        db.add(n)

        if cfg.get("email_enabled"):
            # Fire-and-forget email in a worker thread.
            asyncio.get_running_loop().run_in_executor(
                None, _send_email_sync, cfg, f"[paylight X] {title}", body or title,
            )
        return n
    except Exception as e:  # noqa: BLE001
        log.warning("notify() suppressed error: %s", e)
        return None


async def check_low_stock(db, store_id: int, variant_id: int, product) -> None:
    """Emit a low_stock notification when a variant's available stock is at or
    below its threshold. Call AFTER the stock mutation (same transaction).

    Counters are re-read from the DB because apply_stock_delta mutates them
    with raw SQL — the caller's ORM variant object is stale at this point.
    De-dup happens inside notify().
    """
    try:
        if product is None:
            return
        from app.models.product import ProductVariant
        row = (await db.execute(
            select(
                ProductVariant.on_hand, ProductVariant.committed,
                ProductVariant.unavailable, ProductVariant.low_stock_threshold,
            ).where(ProductVariant.id == variant_id, ProductVariant.store_id == store_id)
        )).one_or_none()
        if row is None:
            return
        on_hand, committed, unavailable, threshold = row
        threshold = threshold if threshold is not None else 10
        available = (on_hand or 0) - (committed or 0) - (unavailable or 0)
        if available <= threshold:
            await notify(
                db, store_id, "low_stock",
                f"在庫低下: {product.name}",
                f"利用可能在庫が {available} 個になりました（しきい値 {threshold}）。",
                link_path=f"/products/{product.id}",
            )
    except Exception as e:  # noqa: BLE001
        log.warning("check_low_stock suppressed error: %s", e)
