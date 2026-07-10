from __future__ import annotations

import csv
import io
from datetime import date, datetime, timedelta, timezone

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import func, select
from sqlalchemy.orm import selectinload

from app.deps import DB, StoreId
from app.models.inventory import InventoryAdjustment, VariantBranchStock
from app.models.product import ItemType, Product, ProductStatus, ProductVariant
from app.schemas.base import PaginatedResponse
from app.schemas.inventory import InventoryAdjustmentRead, InventoryAdjustRequest
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
        is_expiring = bool(p.expiry_date and today <= p.expiry_date <= in_30)
        if on_hand == 0:
            status = "out_of_stock"
        elif available <= 10:
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
            "earliest_expiry_date": p.expiry_date.isoformat() if p.expiry_date else None,
            "last_adjusted_at": (
                last_adj.created_at.isoformat() if last_adj else None
            ),
            "last_adjusted_by": None,  # staff name denorm is future work
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


@router.post("/variants/{variant_id}/inventory-adjust", response_model=InventoryAdjustmentRead, status_code=201)
async def adjust_inventory(variant_id: int, body: InventoryAdjustRequest, db: DB, store_id: StoreId):
    """Atomically adjust a variant's inventory counter (per-branch) and log it."""
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
        store_id=store_id,
        variant_id=variant_id,
        branch_id=branch_id,
        field=body.field,
        delta=body.delta,
        reason=body.reason,
        note=body.note,
    )
    db.add(adj)
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
