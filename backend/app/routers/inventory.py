from __future__ import annotations

import csv
import io
from datetime import date, datetime, timedelta, timezone

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import func, select
from sqlalchemy.orm import selectinload

from app.deps import DB, StoreId
from app.models.inventory import InventoryAdjustment
from app.models.product import ItemType, Product, ProductStatus, ProductVariant
from app.schemas.base import PaginatedResponse
from app.schemas.inventory import InventoryAdjustmentRead, InventoryAdjustRequest

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

    PoC scope: stock is held on `product_variants.on_hand` and is NOT yet
    per-branch (no `branch_id` on the variant). The `branch_id` query
    parameter is accepted for forward-compat but currently returns the
    same numbers regardless. A future migration will introduce a
    `variant_branch_stock` table; until then, the 院・店舗 page reads
    the same denormalized totals.
    """
    today = date.today()
    in_30 = today + timedelta(days=30)

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
        on_hand = sum(v.on_hand for v in p.variants)
        committed = sum(v.committed for v in p.variants)
        unavailable = sum(v.unavailable for v in p.variants)
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
            "branch": {"id": branch_id or 0, "name": "全拠点"},
            "on_hand": on_hand,
            "committed": committed,
            "available": available,
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
    """Atomically adjust a variant's inventory counter and log the adjustment."""
    variant = (
        await db.execute(
            select(ProductVariant).where(
                ProductVariant.id == variant_id, ProductVariant.store_id == store_id
            )
        )
    ).scalar_one_or_none()
    if not variant:
        raise HTTPException(404, detail="Variant not found")

    # Update counter — reject if the result would go negative.
    current = getattr(variant, body.field.value)
    new_value = current + body.delta
    if new_value < 0:
        raise HTTPException(
            status_code=400,
            detail=f"在庫が不足しています（現在: {current}, 調整後: {new_value}）",
        )
    setattr(variant, body.field.value, new_value)

    # Log adjustment
    adj = InventoryAdjustment(
        store_id=store_id,
        variant_id=variant_id,
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
