from __future__ import annotations

import csv
import io
from datetime import date, datetime, timedelta, timezone

from fastapi import APIRouter, HTTPException, Query, UploadFile
from fastapi.responses import StreamingResponse
from sqlalchemy import func, select
from sqlalchemy.orm import selectinload

from app.deps import DB, StoreId, CurrentUser, CurrentUserName
from app.models.inventory import AdjustmentReason, InventoryAdjustment, InventoryField, VariantBranchStock
from app.models.product import ItemType, Product, ProductStatus, ProductVariant
from app.schemas.base import PaginatedResponse
from app.schemas.inventory import InventoryAdjustmentRead, InventoryAdjustRequest
from app.services.notifier import check_low_stock
from app.services.stock import StockError, apply_stock_delta

router = APIRouter(tags=["inventory"])


async def _build_inventory_rows(
    db,
    store_id: int,
    branch_id: int | None,
    item_type: ItemType | None,
    status_filter: str | None,
    q: str | None,
) -> list[dict]:
    """Aggregate per-product inventory rows shared by the list endpoint and CSV export.

    Per-branch inventory (migration 012): when ``branch_id`` is given the
    counters come from ``variant_branch_stock`` for that branch (missing rows
    count as 0); otherwise the variant's store-wide denormalized totals are
    used, exactly as before.
    """
    today = date.today()
    in_30 = today + timedelta(days=30)
    from app.services.expiry import effective_expiry_map
    eff_map = await effective_expiry_map(db, store_id)

    # Branch scope: resolve name + per-variant counters up front.
    branch_name = "全拠点"
    branch_stock: dict[int, tuple[int, int, int]] = {}
    if branch_id is not None:
        from app.models.branch import Branch
        branch = (await db.execute(
            select(Branch).where(Branch.id == branch_id, Branch.store_id == store_id)
        )).scalar_one_or_none()
        if branch is None:
            raise HTTPException(404, detail="拠点が見つかりません")
        branch_name = branch.name
        vbs_rows = (await db.execute(
            select(
                VariantBranchStock.variant_id,
                VariantBranchStock.on_hand,
                VariantBranchStock.committed,
                VariantBranchStock.unavailable,
            ).where(
                VariantBranchStock.store_id == store_id,
                VariantBranchStock.branch_id == branch_id,
            )
        )).all()
        branch_stock = {vid: (oh, c, u) for vid, oh, c, u in vbs_rows}

    def counters(v) -> tuple[int, int, int]:
        if branch_id is None:
            return (v.on_hand, v.committed, v.unavailable)
        return branch_stock.get(v.id, (0, 0, 0))

    stmt = (
        select(Product)
        .where(Product.store_id == store_id, Product.status == ProductStatus.active)
        .options(selectinload(Product.variants), selectinload(Product.category))
    )
    if item_type is not None:
        stmt = stmt.where(Product.item_type == item_type)
    if q:
        stmt = stmt.where(Product.name.ilike(f"%{q}%"))

    rows = (await db.execute(stmt.order_by(Product.id))).scalars().unique().all()

    items = []
    for p in rows:
        triples = [counters(v) for v in p.variants]
        on_hand = sum(t[0] for t in triples)
        committed = sum(t[1] for t in triples)
        unavailable = sum(t[2] for t in triples)
        available = on_hand - committed - unavailable
        eff_expiry = eff_map.get(p.id) or p.expiry_date
        is_expiring = bool(eff_expiry and today <= eff_expiry <= in_30)
        variant_low = any(
            (t[0] - t[1] - t[2])
                <= (v.low_stock_threshold if v.low_stock_threshold is not None else 10)
            for v, t in zip(p.variants, triples)
        )
        if on_hand == 0:
            status = "out_of_stock"
        elif variant_low:
            status = "low_stock"
        elif is_expiring:
            status = "expiring_soon"
        else:
            status = "normal"
        if status_filter and status_filter != status:
            continue
        # Most recent adjustment metadata (per product).
        last_adj = (await db.execute(
            select(InventoryAdjustment)
            .where(InventoryAdjustment.store_id == store_id)
            .join(ProductVariant, ProductVariant.id == InventoryAdjustment.variant_id)
            .where(ProductVariant.product_id == p.id)
            .order_by(InventoryAdjustment.created_at.desc())
            .limit(1)
        )).scalar_one_or_none()
        # Pick first variant for the SKU snapshot.
        default_v = next((v for v in p.variants if v.is_default), p.variants[0] if p.variants else None)
        items.append({
            "product": {
                "id": p.id,
                "name": p.name,
                "sku": default_v.sku if default_v else None,
                "item_type": p.item_type.value if hasattr(p.item_type, "value") else str(p.item_type),
            },
            "branch": {"id": branch_id or 0, "name": branch_name},
            "on_hand": on_hand,
            "committed": committed,
            "available": available,
            # on_hand × price per variant — same rule as the branch snapshot's
            # total_value_jpy, so the two pages' 在庫金額 figures agree.
            "value_jpy": int(sum(counters(v)[0] * (v.price or 0) for v in p.variants)),
            "status": status,
            "earliest_expiry_date": eff_expiry.isoformat() if eff_expiry else None,
            "last_adjusted_at": (
                last_adj.created_at.isoformat() if last_adj else None
            ),
            "last_adjusted_by": last_adj.created_by if last_adj else None,
        })
    return items


@router.get("/inventory", summary="在庫一覧（商品×拠点）を取得")
async def list_inventory(
    db: DB,
    store_id: StoreId,
    branch_id: int | None = Query(None, description="Filter by branch (optional)"),
    item_type: ItemType | None = Query(None),
    status_filter: str | None = Query(
        None, alias="status",
        description="normal | low_stock | expiring_soon | out_of_stock",
    ),
    q: str | None = Query(None, description="Search product name"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
):
    """Aggregate inventory rows for the 在庫 page. See `_build_inventory_rows`."""
    items = await _build_inventory_rows(db, store_id, branch_id, item_type, status_filter, q)
    total = len(items)
    return {"items": items[offset:offset + limit], "total": total}


_INV_STATUS_JA = {
    "normal": "通常",
    "low_stock": "在庫低下",
    "expiring_soon": "期限間近",
    "out_of_stock": "在庫切れ",
}


@router.get("/inventory/adjustments", summary="最近の在庫調整履歴を取得")
async def list_recent_adjustments(
    db: DB,
    store_id: StoreId,
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
):
    """Recent adjustments across ALL variants, newest first, with product
    name + SKU denormalized — powers the 最近の調整履歴 section on the 在庫 page.
    (The per-variant history stays at /variants/{id}/inventory-history.)
    """
    base = select(InventoryAdjustment).where(InventoryAdjustment.store_id == store_id)
    total = (await db.execute(select(func.count()).select_from(base.subquery()))).scalar_one()
    rows = (await db.execute(
        base.options(
            selectinload(InventoryAdjustment.variant).selectinload(ProductVariant.product)
        )
        .order_by(InventoryAdjustment.created_at.desc(), InventoryAdjustment.id.desc())
        .limit(limit)
        .offset(offset)
    )).scalars().all()

    items = []
    for a in rows:
        variant = a.variant
        product = variant.product if variant else None
        items.append({
            "id": a.id,
            "created_by": a.created_by,
            "created_at": a.created_at.isoformat() if a.created_at else None,
            "product_id": product.id if product else None,
            "product_name": product.name if product else f"#{a.variant_id}",
            "sku": variant.sku if variant else None,
            "field": a.field.value if hasattr(a.field, "value") else str(a.field),
            "delta": a.delta,
            "reason": a.reason.value if hasattr(a.reason, "value") else str(a.reason),
            "note": a.note,
        })
    return {"items": items, "total": total}


@router.post("/inventory/transfer", summary="拠点間で在庫を移動する")
async def transfer_stock(body: dict, db: DB, store_id: StoreId, user_name: CurrentUserName = None):
    """Branch-to-branch transfer: −qty at from_branch, +qty at to_branch,
    both atomic and logged with reason='transfer' (migration 015).
    Body: {variant_id, from_branch_id, to_branch_id, quantity, note?}
    """
    try:
        variant_id = int(body["variant_id"])
        from_branch = int(body["from_branch_id"])
        to_branch = int(body["to_branch_id"])
        quantity = int(body["quantity"])
    except (KeyError, TypeError, ValueError):
        raise HTTPException(422, detail="variant_id / from_branch_id / to_branch_id / quantity は必須です")
    if quantity <= 0:
        raise HTTPException(422, detail="数量は1以上を指定してください")
    if from_branch == to_branch:
        raise HTTPException(400, detail="移動元と移動先が同じ拠点です")
    note = (body.get("note") or "").strip() or None

    variant = (await db.execute(
        select(ProductVariant)
        .where(ProductVariant.id == variant_id, ProductVariant.store_id == store_id)
        .options(selectinload(ProductVariant.product))
    )).scalar_one_or_none()
    if variant is None:
        raise HTTPException(404, detail="Variant not found")

    try:
        await apply_stock_delta(
            db, store_id=store_id, variant_id=variant_id,
            branch_id=from_branch, field=InventoryField.on_hand, delta=-quantity,
        )
        await apply_stock_delta(
            db, store_id=store_id, variant_id=variant_id,
            branch_id=to_branch, field=InventoryField.on_hand, delta=quantity,
        )
    except StockError as e:
        await db.rollback()
        raise HTTPException(400, detail=e.message)

    for b, d in ((from_branch, -quantity), (to_branch, quantity)):
        db.add(InventoryAdjustment(
            created_by=user_name,
            store_id=store_id, variant_id=variant_id, branch_id=b,
            field=InventoryField.on_hand, delta=d,
            reason=AdjustmentReason.transfer, note=note,
        ))
    await db.commit()
    return {"ok": True, "variant_id": variant_id, "moved": quantity,
            "from_branch_id": from_branch, "to_branch_id": to_branch}


@router.post("/inventory/stocktake.csv", summary="棚卸しCSVを取り込んで差異を反映")
async def import_stocktake_csv(
    db: DB,
    store_id: StoreId,
    file: UploadFile,
    user_name: CurrentUserName = None,
    branch_id: int | None = Query(None, description="棚卸しした拠点（省略時は本院）"),
):
    """Re-import the 棚卸しCSV: rows where 実地棚卸数 (col 10) is filled and
    differs from the current count create a reason='correction' adjustment
    for the difference.

    PoC scope (documented): the CSV is per-PRODUCT; corrections apply to the
    product's DEFAULT variant at the chosen branch — exact for single-variant
    products (all current data), approximate for multi-variant ones.
    """
    raw = await file.read()
    if len(raw) > 2 * 1024 * 1024:
        raise HTTPException(422, detail="ファイルサイズは 2MB 以下にしてください")
    try:
        text_data = raw.decode("utf-8-sig")
    except UnicodeDecodeError:
        try:
            text_data = raw.decode("cp932")
        except UnicodeDecodeError:
            raise HTTPException(422, detail="CSV の文字コードを判定できません（UTF-8 か Shift_JIS で保存してください）")

    from app.services.notifier import check_low_stock
    from app.services.stock import resolve_branch_id
    try:
        target_branch = await resolve_branch_id(db, store_id, branch_id)
    except StockError as e:
        raise HTTPException(400, detail=e.message)

    reader = csv.reader(io.StringIO(text_data))
    rows = list(reader)
    adjusted, unchanged, errors = 0, 0, []
    today_note = f"棚卸し取込 {date.today().isoformat()}"

    for idx, row in enumerate(rows[1:], start=2):  # skip header; 1-based +header
        if not row or not (row[0] or "").strip():
            continue
        try:
            product_id = int(row[0])
            actual_raw = (row[9] if len(row) > 9 else "").strip()
            if actual_raw == "":
                unchanged += 1
                continue
            actual = int(actual_raw)
            if actual < 0:
                raise ValueError("負の数")
        except (ValueError, IndexError):
            errors.append({"row": idx, "message": "商品ID または 実地棚卸数 が不正です"})
            continue

        variant = (await db.execute(
            select(ProductVariant)
            .where(ProductVariant.product_id == product_id, ProductVariant.store_id == store_id)
            .order_by(ProductVariant.is_default.desc(), ProductVariant.id)
            .options(selectinload(ProductVariant.product))
            .limit(1)
        )).scalar_one_or_none()
        if variant is None:
            errors.append({"row": idx, "message": f"商品ID {product_id} が見つかりません"})
            continue

        current = (await db.execute(
            select(VariantBranchStock.on_hand).where(
                VariantBranchStock.store_id == store_id,
                VariantBranchStock.variant_id == variant.id,
                VariantBranchStock.branch_id == target_branch,
            )
        )).scalar_one_or_none() or 0
        delta = actual - current
        if delta == 0:
            unchanged += 1
            continue
        try:
            await apply_stock_delta(
                db, store_id=store_id, variant_id=variant.id,
                branch_id=target_branch, field=InventoryField.on_hand, delta=delta,
            )
        except StockError as e:
            errors.append({"row": idx, "message": e.message})
            continue
        db.add(InventoryAdjustment(
            created_by=user_name,
            store_id=store_id, variant_id=variant.id, branch_id=target_branch,
            field=InventoryField.on_hand, delta=delta,
            reason=AdjustmentReason.correction, note=today_note,
        ))
        if delta < 0:
            await check_low_stock(db, store_id, variant.id, variant.product)
        adjusted += 1

    await db.commit()
    return {"adjusted": adjusted, "unchanged": unchanged, "errors": errors}


@router.get("/inventory/export.csv", summary="棚卸しCSVをダウンロード")
async def export_inventory_csv(
    db: DB,
    store_id: StoreId,
    branch_id: int | None = Query(None),
    item_type: ItemType | None = Query(None),
    status_filter: str | None = Query(None, alias="status"),
    q: str | None = Query(None),
):
    """棚卸し (stock-take) CSV: current system counts plus a blank 実地棚卸数
    column staff fill in on the floor, and a 差異 column to note discrepancies.
    """
    items = await _build_inventory_rows(db, store_id, branch_id, item_type, status_filter, q)

    buf = io.StringIO()
    buf.write("﻿")  # UTF-8 BOM so Excel opens Japanese correctly
    writer = csv.writer(buf)
    writer.writerow([
        "商品ID", "商品名", "SKU", "種別", "在庫 (システム)", "引当", "利用可能",
        "使用期限", "状態", "実地棚卸数", "差異", "メモ",
    ])
    for r in items:
        writer.writerow([
            r["product"]["id"],
            r["product"]["name"],
            r["product"]["sku"] or "",
            "消耗品" if r["product"]["item_type"] == "consumable" else "物販品",
            r["on_hand"],
            r["committed"],
            r["available"],
            r["earliest_expiry_date"] or "",
            _INV_STATUS_JA.get(r["status"], r["status"]),
            "",  # 実地棚卸数 — filled in by hand during the stock take
            "",  # 差異
            "",  # メモ
        ])

    jst = timezone(timedelta(hours=9))
    filename = f"stocktake_{datetime.now(jst).strftime('%Y%m%d_%H%M')}.csv"
    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.post("/variants/{variant_id}/inventory-adjust", status_code=201)
async def adjust_inventory(variant_id: int, body: InventoryAdjustRequest, db: DB, store_id: StoreId, user: CurrentUser = None):
    """Atomically adjust a variant's inventory counter (per-branch) and log it.

    Approval workflow (mig 018): a STAFF-initiated manual adjustment does NOT
    touch stock — it becomes a pending approval_request an admin must approve
    (the payload is then replayed through this same service path).
    """
    from app.models.user import UserRole

    user_name = user.display_name if user is not None else None
    variant = (
        await db.execute(
            select(ProductVariant)
            .where(ProductVariant.id == variant_id, ProductVariant.store_id == store_id)
            .options(selectinload(ProductVariant.product))
        )
    ).scalar_one_or_none()
    if not variant:
        raise HTTPException(404, detail="Variant not found")
    # Archived products are out of catalog — no further stock movements (audit M8).
    if variant.product is not None and variant.product.status == ProductStatus.archived:
        raise HTTPException(400, detail="アーカイブ済み商品の在庫は調整できません")

    if user is not None and user.role == UserRole.staff:
        from app.models.approval import ApprovalRequest
        from app.services.notifier import notify

        req = ApprovalRequest(
            store_id=store_id,
            kind="inventory_adjust",
            payload_json={
                "variant_id": variant_id,
                "branch_id": body.branch_id,
                "field": body.field.value,
                "delta": body.delta,
                "reason": body.reason.value,
                "note": body.note,
            },
            summary=(
                f"{variant.product.name if variant.product else f'variant {variant_id}'}"
                f" {body.field.value} {'+' if body.delta >= 0 else ''}{body.delta}"
            ),
            requested_by=user_name,
        )
        db.add(req)
        await notify(
            db, store_id=store_id, kind="approval_request",
            title="在庫調整の承認リクエスト",
            body=f"{user_name} さんが在庫調整の承認を求めています: {req.summary}",
            link_path="/inventory",
        )
        await db.commit()
        await db.refresh(req)
        return {"pending_approval": True, "request_id": req.id,
                "detail": "管理者の承認待ちになりました（在庫はまだ変更されていません）"}

    # Atomic per-branch delta + denormalized total (services/stock.py;
    # branch_id=None targets the store's main branch).
    try:
        branch_id = await apply_stock_delta(
            db, store_id=store_id, variant_id=variant_id,
            branch_id=body.branch_id, field=body.field, delta=body.delta,
        )
    except StockError as e:
        await db.rollback()
        raise HTTPException(400, detail=e.message)

    # Log adjustment
    adj = InventoryAdjustment(
        created_by=user_name,
        store_id=store_id,
        variant_id=variant_id,
        branch_id=branch_id,
        field=body.field,
        delta=body.delta,
        reason=body.reason,
        note=body.note,
    )
    db.add(adj)

    # Downward on_hand moves can cross the low-stock threshold.
    if body.field == InventoryField.on_hand and body.delta < 0:
        await check_low_stock(db, store_id, variant_id, variant.product)

    await db.commit()
    await db.refresh(adj)
    return adj


@router.get("/variants/{variant_id}/inventory-history", response_model=PaginatedResponse[InventoryAdjustmentRead])
async def inventory_history(
    variant_id: int,
    db: DB,
    store_id: StoreId,
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
):
    stmt = select(InventoryAdjustment).where(
        InventoryAdjustment.variant_id == variant_id,
        InventoryAdjustment.store_id == store_id,
    )
    total = (await db.execute(select(func.count()).select_from(stmt.subquery()))).scalar_one()
    rows = (
        await db.execute(stmt.order_by(InventoryAdjustment.created_at.desc()).offset(offset).limit(limit))
    ).scalars().all()
    return PaginatedResponse(items=rows, total=total)


@router.post("/variants/{variant_id}/write-off-expired", status_code=201,
             summary="期限切れロットを一括廃棄する")
async def write_off_expired(variant_id: int, db: DB, store_id: StoreId, user: CurrentUser = None):
    """B3 (docs/specs/expiry-writeoff.md): zero every EXPIRED lot of the
    variant and decrement on_hand by the same amounts, per branch, under the
    auditable reason `expired_write_off`. Admin-only — disposal is an audit
    event, not a routine adjustment (no approval-replay path on purpose)."""
    from datetime import date as _date

    from app.deps import ensure_admin
    from app.models.lot import ProductLot
    from app.services.audit import log_event

    ensure_admin(user)
    user_name = user.display_name if user is not None else None

    variant = (
        await db.execute(
            select(ProductVariant)
            .where(ProductVariant.id == variant_id, ProductVariant.store_id == store_id)
            .options(selectinload(ProductVariant.product))
        )
    ).scalar_one_or_none()
    if not variant:
        raise HTTPException(404, detail="Variant not found")

    today = _date.today()
    lots = (await db.execute(
        select(ProductLot).where(
            ProductLot.store_id == store_id,
            ProductLot.variant_id == variant_id,
            ProductLot.qty_on_hand > 0,
            ProductLot.expiry_date.is_not(None),
            ProductLot.expiry_date < today,
        )
    )).scalars().all()
    if not lots:
        raise HTTPException(400, detail="期限切れのロット在庫はありません")

    # Per-branch totals so each stock decrement stays atomic + branch-true.
    from collections import defaultdict
    per_branch: dict[int, int] = defaultdict(int)
    for lot in lots:
        per_branch[lot.branch_id] += lot.qty_on_hand

    written_off = 0
    for branch_id, qty in per_branch.items():
        try:
            await apply_stock_delta(
                db, store_id=store_id, variant_id=variant_id,
                branch_id=branch_id, field=InventoryField.on_hand, delta=-qty,
            )
        except StockError as e:
            await db.rollback()
            raise HTTPException(400, detail=e.message)
        db.add(InventoryAdjustment(
            created_by=user_name,
            store_id=store_id,
            variant_id=variant_id,
            branch_id=branch_id,
            field=InventoryField.on_hand,
            delta=-qty,
            reason=AdjustmentReason.expired_write_off,
            note=f"期限切れロット廃棄（{len(lots)}ロット）",
        ))
        written_off += qty

    for lot in lots:
        lot.qty_on_hand = 0

    log_event(db, store_id=store_id, user_name=user_name,
              action="expired_write_off", entity_type="variant",
              entity_id=variant_id,
              detail=f"{variant.product.name if variant.product else variant_id}: {written_off}点廃棄")
    await db.commit()
    return {"written_off": written_off, "lots": len(lots)}
