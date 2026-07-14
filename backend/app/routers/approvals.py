"""Approval queue (mig 018): admin decides on staff-initiated changes.

Approving replays the stored payload through the normal service path
(apply_stock_delta), so every invariant/guard still applies at decision
time — stale requests that would drive stock negative are rejected with
the same 400 the live write would have produced.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.orm import selectinload

from app.deps import DB, CurrentUser, StoreId, ensure_admin
from app.models.approval import ApprovalRequest, ApprovalStatus
from app.models.inventory import AdjustmentReason, InventoryAdjustment, InventoryField
from app.models.product import ProductVariant
from app.services.audit import log_event
from app.services.notifier import check_low_stock
from app.services.stock import StockError, apply_stock_delta

router = APIRouter(prefix="/approvals", tags=["approvals"])

_JST = timezone(timedelta(hours=9))


def _to_read(r: ApprovalRequest) -> dict:
    return {
        "id": r.id,
        "kind": r.kind,
        "summary": r.summary,
        "payload": r.payload_json,
        "requested_by": r.requested_by,
        "status": r.status.value if hasattr(r.status, "value") else str(r.status),
        "decided_by": r.decided_by,
        "decided_at": r.decided_at.isoformat() if r.decided_at else None,
        "decision_note": r.decision_note,
        "created_at": r.created_at.isoformat() if r.created_at else None,
    }


@router.get("", summary="承認リクエスト一覧")
async def list_approvals(
    db: DB, store_id: StoreId,
    status: str | None = Query(None, description="pending | approved | rejected"),
    limit: int = Query(20, ge=1, le=100),
):
    stmt = select(ApprovalRequest).where(ApprovalRequest.store_id == store_id)
    if status:
        try:
            stmt = stmt.where(ApprovalRequest.status == ApprovalStatus(status))
        except ValueError:
            raise HTTPException(400, detail="不正な status です")
    rows = (await db.execute(
        stmt.order_by(ApprovalRequest.created_at.desc(), ApprovalRequest.id.desc()).limit(limit)
    )).scalars().all()
    pending = (await db.execute(
        select(func.count()).select_from(ApprovalRequest).where(
            ApprovalRequest.store_id == store_id,
            ApprovalRequest.status == ApprovalStatus.pending,
        )
    )).scalar_one()
    return {"items": [_to_read(r) for r in rows], "pending_count": pending}


async def _get_pending(req_id: int, store_id: int, db) -> ApprovalRequest:
    req = (await db.execute(
        select(ApprovalRequest).where(
            ApprovalRequest.id == req_id, ApprovalRequest.store_id == store_id
        )
    )).scalar_one_or_none()
    if req is None:
        raise HTTPException(404, detail="承認リクエストが見つかりません")
    if req.status != ApprovalStatus.pending:
        raise HTTPException(400, detail="このリクエストは既に処理済みです")
    return req


@router.post("/{req_id}/approve", summary="承認して適用（管理者）")
async def approve_request(req_id: int, db: DB, store_id: StoreId, user: CurrentUser = None):
    ensure_admin(user)
    req = await _get_pending(req_id, store_id, db)
    admin_name = user.display_name if user is not None else None

    if req.kind != "inventory_adjust":
        raise HTTPException(400, detail=f"未知の承認種別です: {req.kind}")

    p = req.payload_json or {}
    variant = (await db.execute(
        select(ProductVariant)
        .where(ProductVariant.id == p.get("variant_id"), ProductVariant.store_id == store_id)
        .options(selectinload(ProductVariant.product))
    )).scalar_one_or_none()
    if variant is None:
        raise HTTPException(400, detail="対象のバリアントが見つかりません（削除済みの可能性）")

    field = InventoryField(p["field"])
    delta = int(p["delta"])
    try:
        branch_id = await apply_stock_delta(
            db, store_id=store_id, variant_id=variant.id,
            branch_id=p.get("branch_id"), field=field, delta=delta,
        )
    except StockError as e:
        await db.rollback()
        raise HTTPException(400, detail=f"適用できません: {e.message}")

    db.add(InventoryAdjustment(
        store_id=store_id,
        variant_id=variant.id,
        branch_id=branch_id,
        field=field,
        delta=delta,
        reason=AdjustmentReason(p.get("reason", "manual")),
        note=(p.get("note") or "") + f"｜承認: {admin_name or '—'}",
        created_by=req.requested_by,
    ))
    if field == InventoryField.on_hand and delta < 0:
        await check_low_stock(db, store_id, variant.id, variant.product)

    req.status = ApprovalStatus.approved
    req.decided_by = admin_name
    req.decided_at = datetime.now(_JST).replace(tzinfo=None)
    log_event(db, store_id=store_id, user_name=admin_name,
              action="approval_approved", entity_type="approval_request",
              entity_id=req.id, detail=req.summary)
    await db.commit()
    return {"ok": True, "status": "approved"}


@router.post("/{req_id}/reject", summary="却下する（管理者）")
async def reject_request(req_id: int, db: DB, store_id: StoreId, body: dict | None = None, user: CurrentUser = None):
    ensure_admin(user)
    req = await _get_pending(req_id, store_id, db)
    admin_name = user.display_name if user is not None else None
    req.status = ApprovalStatus.rejected
    req.decided_by = admin_name
    req.decided_at = datetime.now(_JST).replace(tzinfo=None)
    req.decision_note = (str((body or {}).get("note") or "").strip() or None)
    log_event(db, store_id=store_id, user_name=admin_name,
              action="approval_rejected", entity_type="approval_request",
              entity_id=req.id, detail=req.summary)
    await db.commit()
    return {"ok": True, "status": "rejected"}
