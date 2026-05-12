"""Dashboard summary endpoint.

Computes KPIs from real DB state and returns a natural-language summary.
The text itself is mocked for the PoC (deterministic, free, no AI cost)
and is just stitched together from the KPI numbers. Real AI generation
is future scope — see CHANGES.md section 11.
"""

from __future__ import annotations

from datetime import date, datetime, timedelta

from fastapi import APIRouter
from sqlalchemy import func, select

from app.deps import DB, StoreId
from app.models.product import ItemType, Product, ProductStatus, ProductVariant


router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/summary")
async def get_dashboard_summary(db: DB, store_id: StoreId) -> dict:
    """Return KPIs + a mocked natural-language AI summary for the clinic."""
    today = date.today()
    in_30_days = today + timedelta(days=30)

    # KPI 1: total active products
    total_products = (
        await db.execute(
            select(func.count(Product.id)).where(
                Product.store_id == store_id,
                Product.status == ProductStatus.active,
            )
        )
    ).scalar_one()

    # KPI 2: low stock — products with at least one variant where available <= 10.
    # `distinct(Product.id)` is needed so a product with two depleted variants
    # only counts once.
    low_stock = (
        await db.execute(
            select(func.count(func.distinct(Product.id)))
            .join(ProductVariant, ProductVariant.product_id == Product.id)
            .where(
                Product.store_id == store_id,
                Product.status == ProductStatus.active,
                (ProductVariant.on_hand - ProductVariant.committed - ProductVariant.unavailable) <= 10,
            )
        )
    ).scalar_one()

    # KPI 3: consumables expiring within 30 days
    expiring_soon = (
        await db.execute(
            select(func.count(Product.id)).where(
                Product.store_id == store_id,
                Product.item_type == ItemType.consumable,
                Product.expiry_date.is_not(None),
                Product.expiry_date <= in_30_days,
                Product.expiry_date >= today,
            )
        )
    ).scalar_one()

    # Canned AI summary (deterministic, free). Real AI gen is future scope.
    sentences = []
    if low_stock > 0:
        sentences.append(
            f"本日、在庫が補充ポイントを下回る商品が **{low_stock} 件** あります。"
            "在庫一覧から「在庫低下」フィルターで確認してください。"
        )
    if expiring_soon > 0:
        sentences.append(
            f"使用期限が 30 日以内に切れる消耗品が **{expiring_soon} 件** あります。"
            "早めの使い切りまたは廃棄の判断をお願いします。"
        )
    if not sentences:
        ai_summary = "本日、対応が必要な項目はありません。在庫水準・使用期限ともに健全な状態です。"
        ai_status = "ok"
    else:
        ai_summary = "\n\n".join(sentences)
        ai_status = "alert"

    return {
        "generated_at": datetime.now().isoformat(),
        "ai_summary": ai_summary,
        "ai_status": ai_status,
        "kpis": {
            "total_products": total_products,
            "low_stock": low_stock,
            "expiring_soon": expiring_soon,
            "monthly_sales_jpy": 84200,  # mock — future scope
        },
    }
