"""Dashboard summary endpoint.

Returns the four KPI counts the dashboard tiles consume, a canned AI summary
sentence stitched from those counts, and three secondary blocks: the
"要対応の商品" table, the "最近の活動" feed, and the "カテゴリ別在庫状況" bars.

Real AI generation is intentionally future scope — every page on the dashboard
needs to load reliably for the 2026-05-13 demo, so the summary is a
deterministic template fed from the actual DB.
"""

from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from decimal import Decimal

from fastapi import APIRouter
from sqlalchemy import func, select
from sqlalchemy.orm import selectinload

from app.deps import DB, StoreId
from app.models.category import Category
from app.models.inventory import InventoryAdjustment
from app.models.product import ItemType, Product, ProductStatus, ProductVariant
from app.models.sale import SalesRecord


router = APIRouter(prefix="/dashboard", tags=["dashboard"])

# Real-LLM summary cache: store_id -> (JST date iso, JA narrative, EN narrative).
# Populated ONLY by POST /summary/regenerate (which costs tokens); plain GETs
# serve today's cached narrative or fall back to the free template.
_AI_SUMMARY_CACHE: dict[int, tuple[str, str, str]] = {}


def _split_ja_en(text: str) -> tuple[str, str]:
    """Split an LLM reply of the form "JA:\\n…\\nEN:\\n…" into (ja, en).

    Tolerates missing markers: with no EN marker the whole reply is treated as
    Japanese and EN comes back empty (caller falls back to the template EN).
    """
    import re
    m = re.search(r"^\s*EN\s*[:：]\s*$|\bEN\s*[:：]", text, flags=re.MULTILINE)
    if not m:
        return text.strip(), ""
    ja = text[:m.start()]
    en = text[m.end():]
    ja = re.sub(r"\bJA\s*[:：]", "", ja, count=1)
    return ja.strip(), en.strip()


@router.get("/summary", summary="ダッシュボードサマリーを取得")
async def get_dashboard_summary(db: DB, store_id: StoreId) -> dict:
    """Aggregate KPI + secondary data + canned AI summary.

    Shape matches the brief §3.1 contract. All money values returned as
    strings; counts as int. `generated_at` is ISO-8601 with offset.
    """
    today = date.today()
    in_30_days = today + timedelta(days=30)
    month_start = today.replace(day=1)

    # ── KPI 1: total active products ──
    total_products = (await db.execute(
        select(func.count(Product.id)).where(
            Product.store_id == store_id,
            Product.status == ProductStatus.active,
        )
    )).scalar_one()

    # ── KPI 2: low_stock — any variant at/below ITS OWN threshold ──
    # Single source of truth with the notifier / auto-draft / inventory page
    # (was a hardcoded 10, which disagreed with per-variant thresholds).
    low_stock = (await db.execute(
        select(func.count(func.distinct(Product.id)))
        .join(ProductVariant, ProductVariant.product_id == Product.id)
        .where(
            Product.store_id == store_id,
            Product.status == ProductStatus.active,
            (ProductVariant.on_hand - ProductVariant.committed - ProductVariant.unavailable)
                <= func.coalesce(ProductVariant.low_stock_threshold, 10),
        )
    )).scalar_one()

    # ── KPI 3: consumables expiring within 30 days ──
    expiring_soon = (await db.execute(
        select(func.count(Product.id)).where(
            Product.store_id == store_id,
            Product.item_type == ItemType.consumable,
            Product.expiry_date.is_not(None),
            Product.expiry_date <= in_30_days,
            Product.expiry_date >= today,
        )
    )).scalar_one()

    # ── KPI 4: this-month sales total (sum of qty * unit_price for the month) ──
    # Month boundary = JST calendar month start converted to UTC-naive to
    # match sold_at storage (audit C2 — was treated as UTC midnight).
    from app.services.tz import JST as _JST, jst_to_utc_naive as _jst2utc
    month_start_utc = _jst2utc(datetime.combine(month_start, datetime.min.time(), tzinfo=_JST))
    sales_row = (await db.execute(
        select(func.coalesce(func.sum(SalesRecord.quantity * SalesRecord.unit_price), 0))
        .where(
            SalesRecord.store_id == store_id,
            SalesRecord.sold_at >= month_start_utc,
        )
    )).scalar_one()
    monthly_sales = Decimal(str(sales_row))

    # ── needs_attention: the 5 genuinely lowest-available products ──
    # Rank in SQL over the whole catalog (summing the variants' available =
    # on_hand−committed−unavailable) so we don't miss the actual lowest by
    # sampling an arbitrary 50 (review 2026-07-14).
    avail_expr = func.coalesce(
        func.sum(ProductVariant.on_hand - ProductVariant.committed - ProductVariant.unavailable),
        0,
    )
    ranked = (await db.execute(
        select(Product.id, avail_expr.label("avail"))
        .join(ProductVariant, ProductVariant.product_id == Product.id)
        .where(Product.store_id == store_id, Product.status == ProductStatus.active)
        .group_by(Product.id)
        .order_by(avail_expr.asc())
        .limit(5)
    )).all()
    low_ids = [pid for pid, _ in ranked]
    attention_sorted = []
    if low_ids:
        by_id = {p.id: p for p in (await db.execute(
            select(Product).where(Product.id.in_(low_ids))
            .options(selectinload(Product.variants))
        )).scalars().all()}
        attention_sorted = [by_id[pid] for pid in low_ids if pid in by_id]

    def available(p: Product) -> int:
        return sum(v.on_hand - v.committed - v.unavailable for v in p.variants)
    needs_attention = []
    for p in attention_sorted:
        avail = available(p)
        days_left = None
        if p.expiry_date:
            days_left = (p.expiry_date - today).days
        variant_low = any(
            (v.on_hand - v.committed - v.unavailable)
                <= (v.low_stock_threshold if v.low_stock_threshold is not None else 10)
            for v in p.variants
        )
        if variant_low:
            status = "low_stock"
        elif days_left is not None and 0 <= days_left <= 30:
            status = "expiring_soon"
        else:
            status = "normal"
        needs_attention.append({
            "id": p.id,
            "name": p.name,
            "item_type": p.item_type.value if hasattr(p.item_type, "value") else str(p.item_type),
            "status": status,
            "stock_qty": avail,
            "expiry_date": p.expiry_date.isoformat() if p.expiry_date else None,
            "action_hint": "reorder" if status == "low_stock" else (
                "use_first" if status == "expiring_soon" else "review"
            ),
        })

    # ── recent_activity: 5 most recent inventory adjustments ──
    recent_adjustments = (await db.execute(
        select(InventoryAdjustment, ProductVariant, Product)
        .join(ProductVariant, ProductVariant.id == InventoryAdjustment.variant_id)
        .join(Product, Product.id == ProductVariant.product_id)
        .where(InventoryAdjustment.store_id == store_id)
        .order_by(InventoryAdjustment.created_at.desc())
        .limit(5)
    )).all()
    recent_activity = []
    for adj, _v, prod in recent_adjustments:
        sign = "+" if adj.delta > 0 else ""
        recent_activity.append({
            "actor": adj.created_by or "システム",
            "text": f"{prod.name} の在庫を {sign}{adj.delta} 件調整",
            "occurred_at": (
                adj.created_at.isoformat()
                if adj.created_at else None
            ),
            "kind": adj.reason.value if hasattr(adj.reason, "value") else str(adj.reason),
        })

    # ── category_breakdown ──
    cat_rows = (await db.execute(
        select(
            Category.id,
            Category.name,
            func.coalesce(func.sum(ProductVariant.on_hand), 0),
            func.coalesce(func.sum(ProductVariant.on_hand * func.coalesce(ProductVariant.price, 0)), 0),
        )
        .select_from(Category)
        .join(Product, Product.category_id == Category.id, isouter=True)
        .join(ProductVariant, ProductVariant.product_id == Product.id, isouter=True)
        .where(Category.store_id == store_id)
        .group_by(Category.id, Category.name)
        .order_by(Category.sort_order.asc(), Category.id.asc())
    )).all()
    category_breakdown = [
        {
            "category_id": cid,
            "name": cname,
            "stock_count": int(stock),
            "stock_value_jpy": str(Decimal(str(value))),
        }
        for cid, cname, stock, value in cat_rows
    ]

    # ── canned AI summary (deterministic template, JA + EN) ──
    sentences = []
    sentences_en = []
    if low_stock > 0:
        sentences.append(
            f"本日、在庫が補充ポイントを下回る商品が **{low_stock} 件** あります。"
            "在庫一覧から「在庫低下」フィルターで確認してください。"
        )
        sentences_en.append(
            f"Today, **{low_stock} product(s)** are below their restock point. "
            "Check them with the \"Low stock\" filter on the inventory list."
        )
    if expiring_soon > 0:
        sentences.append(
            f"使用期限が 30 日以内に切れる消耗品が **{expiring_soon} 件** あります。"
            "早めの使い切りまたは廃棄の判断をお願いします。"
        )
        sentences_en.append(
            f"**{expiring_soon} consumable(s)** will expire within 30 days. "
            "Please plan to use them up or discard them soon."
        )
    if monthly_sales > 0:
        sentences.append(
            f"今月の販売は累計 ¥{int(monthly_sales):,} です。"
        )
        sentences_en.append(
            f"Sales this month total ¥{int(monthly_sales):,}."
        )
    if not sentences:
        ai_summary = "本日、対応が必要な項目はありません。すべて順調です。お疲れさまです 🌿"
        ai_summary_en = "Nothing needs your attention today. Everything looks good 🌿"
        ai_status = "ok"
    else:
        ai_summary = "\n\n".join(sentences)
        ai_summary_en = "\n\n".join(sentences_en)
        ai_status = "alert"

    # Serve today's REAL LLM narrative when 再生成 produced one (never spend
    # tokens on a plain GET).
    ai_generated = False
    _cached = _AI_SUMMARY_CACHE.get(store_id)
    if _cached is not None and _cached[0] == datetime.now(timezone(timedelta(hours=9))).date().isoformat():
        ai_summary = _cached[1]
        # EN slot may be empty when the LLM reply couldn't be split — keep the
        # template EN text in that case rather than showing Japanese under EN.
        if _cached[2]:
            ai_summary_en = _cached[2]
        ai_generated = True

    # Asia/Tokyo offset for the demo's expected timezone.
    jst = timezone(timedelta(hours=9))
    return {
        "generated_at": datetime.now(jst).isoformat(),
        "ai_summary": ai_summary,
        "ai_summary_en": ai_summary_en,
        # Keep both spellings so old + new frontend code paths work.
        "ai_status": ai_status,
        "ai_summary_status": ai_status,
        # True when ai_summary is a real LLM narrative (再生成), not the template.
        "ai_generated": ai_generated,
        "kpis": {
            "total_products": total_products,
            "low_stock": low_stock,
            "low_stock_count": low_stock,
            "expiring_soon": expiring_soon,
            "expiring_soon_count": expiring_soon,
            "monthly_sales_jpy": str(monthly_sales),
        },
        "needs_attention": needs_attention,
        "recent_activity": recent_activity,
        "category_breakdown": category_breakdown,
    }


@router.post("/summary/regenerate", summary="AIサマリーを再生成する（実LLM）")
async def regenerate_summary(db: DB, store_id: StoreId):
    """REAL LLM narrative (heavy-tier item 5).

    Gathers today's aggregates, asks gpt-4.1-nano for a 2–3 sentence Japanese
    clinic-morning-brief, caches it per (store, JST-day), and returns the full
    summary payload. Cost control: only THIS endpoint spends tokens (≈¥0.1 per
    click); GETs serve the cached narrative. Falls back to the template when
    no API key is configured / MOCK_AI=1 / the call fails.
    """
    from app.config import settings as app_settings

    base = await get_dashboard_summary(db, store_id)

    key = (app_settings.openai_api_key or "").strip()
    if not key or app_settings.mock_ai == "1":
        return base  # template fallback — same contract, ai_generated stays False

    # Compact context from the already-computed payload (aggregates only —
    # no raw rows leave the DB).
    kpis = base["kpis"]
    attention = ", ".join(
        f"{a['name']}(残{a.get('stock_qty', '?')})"
        for a in base.get("needs_attention", [])[:5]
    ) or "なし"
    jst_now = datetime.now(timezone(timedelta(hours=9)))
    prompt = (
        f"あなたは歯科クリニックの物品管理アシスタントです。本日 {jst_now.strftime('%m月%d日')} の"
        f"朝会向けに、以下のデータから簡潔なサマリー（2〜3文）を日本語と英語の両方で書いてください。"
        f"数字は太字(**N 件**のように)で強調し、最後に一言だけ前向きな行動提案を添えてください。"
        f"箇条書きや見出しは使わないでください。\n"
        f"出力は必ず次の形式にしてください（マーカー行をそのまま使うこと）:\n"
        f"JA:\n<日本語のサマリー>\n"
        f"EN:\n<英語のサマリー>\n\n"
        f"- 登録商品数: {kpis['total_products']} 件\n"
        f"- 在庫低下: {kpis['low_stock']} 件（要対応: {attention}）\n"
        f"- 期限間近(30日以内)の消耗品: {kpis['expiring_soon']} 件\n"
        f"- 今月の売上: ¥{int(float(kpis['monthly_sales_jpy'])):,}\n"
    )

    import httpx
    try:
        async with httpx.AsyncClient(timeout=25.0) as client:
            res = await client.post(
                "https://api.openai.com/v1/chat/completions",
                headers={"Authorization": f"Bearer {key}"},
                json={
                    "model": "gpt-4.1-nano",
                    "messages": [{"role": "user", "content": prompt}],
                    "max_tokens": 440,
                    "temperature": 0.5,
                },
            )
        if res.status_code == 200:
            text = (res.json()["choices"][0]["message"]["content"] or "").strip()
            if text:
                text_ja, text_en = _split_ja_en(text)
                _AI_SUMMARY_CACHE[store_id] = (jst_now.date().isoformat(), text_ja, text_en)
                base["ai_summary"] = text_ja
                if text_en:
                    base["ai_summary_en"] = text_en
                base["ai_generated"] = True
    except (httpx.HTTPError, KeyError, ValueError):
        pass  # keep the template — the dashboard must always render

    return base

@router.get("/monthly-flow", summary="月別の入荷・販売点数（棒グラフ用）")
async def monthly_flow(db: DB, store_id: StoreId, months: int = 6):
    """Units received (PO receive adjustments) vs units sold per JST month.

    Both series come from inventory_adjustments, whose created_at is JST-naive
    (MySQL NOW()) — so DATE_FORMAT month grouping is already calendar-correct.
    Sale deltas are negative; refunds are excluded from both series.
    """
    months = max(1, min(months, 24))
    # First day of the window, JST calendar months.
    today = datetime.now(timezone(timedelta(hours=9))).date()
    y, m = today.year, today.month - (months - 1)
    while m <= 0:
        m += 12
        y -= 1
    start = date(y, m, 1)

    rows = (await db.execute(
        select(
            func.date_format(InventoryAdjustment.created_at, "%Y-%m").label("ym"),
            InventoryAdjustment.reason,
            func.sum(InventoryAdjustment.delta),
        )
        .where(
            InventoryAdjustment.store_id == store_id,
            InventoryAdjustment.created_at >= datetime.combine(start, datetime.min.time()),
            InventoryAdjustment.reason.in_(["purchase_order_received", "sale"]),
        )
        .group_by("ym", InventoryAdjustment.reason)
    )).all()

    by_month: dict[str, dict[str, int]] = {}
    for ym, reason, total in rows:
        r = getattr(reason, "value", reason)
        d = by_month.setdefault(ym, {"in": 0, "out": 0})
        if r == "purchase_order_received":
            d["in"] += int(total or 0)
        else:
            # Sale deltas are negative by design; clamp legacy/noise rows to 0.
            d["out"] += max(0, int(-(total or 0)))

    # Emit a continuous month axis (missing months as zeros).
    out = []
    y, m = start.year, start.month
    for _ in range(months):
        ym = f"{y}-{m:02d}"
        d = by_month.get(ym, {"in": 0, "out": 0})
        out.append({"month": ym, "received": d["in"], "sold": d["out"]})
        m += 1
        if m == 13:
            y, m = y + 1, 1
    return {"months": out}

