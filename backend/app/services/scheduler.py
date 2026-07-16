"""In-process daily notification scheduler (review C3).

Fires each store's 日次サマリー notification at its configured
設定 › 通知 daily_summary_time (JST), guarded per (store, JST-date) by the
existing daily_summary Notification row.

Deployment assumptions — READ BEFORE SCALING:
- **Single uvicorn worker.** The loop runs in-process; N workers would fire
  N ticks per minute (the per-day guard makes duplicates unlikely but racy).
  Set ENABLE_SCHEDULER=0 on all but one worker/process in a multi-worker
  deploy, or move this to an external scheduler (cron / APScheduler /
  Cloud Scheduler) — see docs/adr/0001 consequences and
  docs/production-readiness.md.
- Errors are logged and the loop continues; it no longer swallows
  exceptions silently.
"""

from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timedelta, timezone

from sqlalchemy import select

from app.db import async_session
from app.models.notification import Notification
from app.models.settings_kv import SettingsKV
from app.models.store import Store
from app.services.notifier import notify
from app.services.summary import count_expiring_consumables, count_low_stock_products

logger = logging.getLogger(__name__)

JST = timezone(timedelta(hours=9))
TICK_SECONDS = 60


async def daily_notification_tick_once() -> None:
    """One pass: for every store whose configured time matches the current
    JST HH:MM and which hasn't been notified today, compose and send the
    daily summary."""
    now_jst = datetime.now(JST)
    hhmm = now_jst.strftime("%H:%M")
    day_start_utc = now_jst.replace(hour=0, minute=0, second=0, microsecond=0) \
        .astimezone(timezone.utc).replace(tzinfo=None)

    async with async_session() as db:
        store_ids = (await db.execute(select(Store.id))).scalars().all()
        for sid in store_ids:
            row = (await db.execute(select(SettingsKV).where(
                SettingsKV.store_id == sid, SettingsKV.namespace == "notifications"
            ))).scalar_one_or_none()
            cfg = dict(row.data_json) if row and row.data_json else {}
            if cfg.get("daily_summary_time", "08:00") != hhmm:
                continue
            already = (await db.execute(select(Notification.id).where(
                Notification.store_id == sid,
                Notification.kind == "daily_summary",
                Notification.created_at >= day_start_utc,
            ).limit(1))).scalar_one_or_none()
            if already is not None:
                continue

            low = await count_low_stock_products(db, sid)
            expiring = await count_expiring_consumables(db, sid, now_jst.date())
            await notify(
                db, sid, "daily_summary",
                f"日次サマリー {now_jst.strftime('%m/%d')}",
                f"在庫低下 {low} 件・期限間近（30日以内） {expiring} 件です。ダッシュボードでご確認ください。",
                link_path="/dashboard",
            )
            await db.commit()
            logger.info("daily summary sent: store=%s low=%s expiring=%s", sid, low, expiring)


async def run_scheduler_loop() -> None:
    """Minute loop. Exceptions are logged (with traceback) and the loop
    continues — a failing tick must not kill the scheduler, but it must
    never fail silently either."""
    logger.info("notification scheduler started (tick=%ss)", TICK_SECONDS)
    while True:
        try:
            await daily_notification_tick_once()
        except asyncio.CancelledError:
            logger.info("notification scheduler stopped")
            raise
        except Exception:
            logger.exception("daily notification tick failed — continuing")
        await asyncio.sleep(TICK_SECONDS)
