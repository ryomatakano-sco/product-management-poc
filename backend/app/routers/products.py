"""Products CRUD with search, nested variants/images/tags, sales summary."""

from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from decimal import Decimal

from fastapi import APIRouter, HTTPException, Query, UploadFile
from sqlalchemy import case, exists, func, insert as sa_insert, literal, or_, select, text
from sqlalchemy.orm import selectinload

from app.deps import DB, StoreId, CurrentUserName
from app.models.category import Category
from app.models.product import ItemType, Product, ProductImage, ProductStatus, ProductVariant
from app.models.sale import SalesRecord
from app.models.tag import ProductTag, Tag
from app.models.vendor import Vendor
from app.schemas.base import PaginatedResponse
from app.schemas.product import (
    ImageRead,
    ProductCreate,
    ProductDetail,
    ProductListItem,
    ProductSearchResult,
    ProductUpdate,
    SalesSummary,
    VariantRead,
    VariantSearchResult,
)

router = APIRouter(prefix="/products", tags=["products"])


async def _next_internal_code(db, store_id: int, item_type) -> str:
    """CA#### for consumables / PR#### for retail, per store (mig 016).
    MAX() on the fixed-width code is safe because the numeric part is
    zero-padded; falls back past any manually assigned malformed codes.
    """
    prefix = "CA" if getattr(item_type, "value", item_type) == "consumable" else "PR"
    last = (await db.execute(
        select(func.max(Product.internal_code)).where(
            Product.store_id == store_id,
            Product.internal_code.like(f"{prefix}%"),
        )
    )).scalar_one_or_none()
    n = 0
    if last:
        try:
            n = int(last[len(prefix):])
        except ValueError:
            n = 0
    return f"{prefix}{n + 1:04d}"


# MySQL's default FULLTEXT parser silently ignores tokens shorter than
# `ft_min_word_len` (default 4 for MyISAM, `innodb_ft_min_token_size`
# default 3). Common Japanese product/brand stems like "GUM" or "Ora" hit
# that floor, so for short queries we always fall through to ILIKE on
# name/kana. For ≥4-character queries we still OR FULLTEXT in alongside
# ILIKE so partial substrings match too.
_FULLTEXT_MIN_TOKEN = 4


def _build_product_search(q: str):
    """Return (filter, reasons_expression) for a `q` query.

    filter: a SQLAlchemy boolean clause OR-ing every place the query can
            match (name / kana / description / variant SKU / variant
            barcode).
    reasons_expression: a SQLAlchemy expression that, when selected
            alongside Product columns, returns a comma-separated string
            naming which fields actually matched on this row. Used by the
            frontend to render match-reason pills.
    """
    like = f"%{q}%"
    name_match = Product.name.ilike(like)
    kana_match = Product.name_kana.ilike(like)
    desc_match = Product.description.ilike(like)

    # Variant SKU + barcode hits. Use EXISTS subqueries — cheaper than
    # joining (which would multiply rows when a product has many variants
    # and force DISTINCT downstream).
    sku_match = exists(
        select(literal(1))
        .where(ProductVariant.product_id == Product.id)
        .where(ProductVariant.sku.ilike(like))
    )
    barcode_match = exists(
        select(literal(1))
        .where(ProductVariant.product_id == Product.id)
        .where(ProductVariant.barcode.ilike(like))
    )

    filter_clause = or_(name_match, kana_match, desc_match, sku_match, barcode_match)

    # Reasons: CASE-when each predicate, concatenated. We do this in SQL so
    # the list query doesn't need a per-row Python pass.
    reasons = func.concat_ws(
        ",",
        case((name_match, "name"), else_=None),
        case((kana_match, "kana"), else_=None),
        case((desc_match, "description"), else_=None),
        case((sku_match, "sku"), else_=None),
        case((barcode_match, "barcode"), else_=None),
    )
    return filter_clause, reasons


def _build_list_item(p: Product, match_reasons: list[str] | None = None, effective_expiry: 'date | None' = None) -> ProductListItem:
    """Transform a loaded Product ORM object into a ProductListItem.

    Computes ``total_available`` (across all variants) and surfaces
    ``default_sku``/``default_price`` from the variant flagged as default
    (or the first variant when nothing is flagged) so the list view can
    render a useful row without per-row variant fetches.
    """
    total_on_hand = sum(v.on_hand for v in p.variants)
    total_available = sum(
        v.on_hand - v.committed - v.unavailable for v in p.variants
    )
    default_variant = next((v for v in p.variants if v.is_default), None)
    if default_variant is None and p.variants:
        default_variant = p.variants[0]

    # Thumbnail = first image by position
    images_sorted = sorted(p.images, key=lambda i: i.position)
    thumbnail = images_sorted[0].url if images_sorted else None

    return ProductListItem(
        id=p.id,
        store_id=p.store_id,
        name=p.name,
        internal_code=p.internal_code,
        name_kana=p.name_kana,
        category_name=p.category.name if p.category else None,
        vendor_name=p.vendor.company_name if p.vendor else None,
        tags=[t.name for t in p.tags],
        total_on_hand=total_on_hand,
        total_available=total_available,
        default_sku=default_variant.sku if default_variant else None,
        default_price=default_variant.price if default_variant else None,
        default_variant_id=default_variant.id if default_variant else None,
        default_cost=default_variant.cost if default_variant else None,
        default_low_stock_threshold=(default_variant.low_stock_threshold
                                     if default_variant and default_variant.low_stock_threshold is not None
                                     else 10),
        thumbnail_url=thumbnail,
        status=p.status,
        default_amount_at_payment=p.default_amount_at_payment,
        # Yoshioka 2026-05-11 additions
        item_type=p.item_type,
        # Effective expiry (earliest active lot, fallback manual) drives the
        # 期限間近 chip/badge — see services/expiry.py.
        expiry_date=(effective_expiry or p.expiry_date),
        has_reorder_url=bool(p.reorder_url),
        reorder_requested_at=p.reorder_requested_at,
        match_reasons=match_reasons or [],
    )


@router.get("", response_model=PaginatedResponse[ProductListItem])
async def list_products(
    db: DB,
    store_id: StoreId,
    limit: int = Query(20, ge=1, le=500),
    offset: int = Query(0, ge=0),
    q: str | None = Query(None, description="Search name or name_kana"),
    category_id: int | None = Query(None),
    vendor_id: int | None = Query(None),
    tag: list[str] | None = Query(None),
    status: ProductStatus | None = Query(None),
    item_type: ItemType | None = Query(None, description="Filter by 物販品 / 消耗品"),
    expiring_within_days: int | None = Query(
        None,
        ge=0,
        description="Only return products with expiry_date within N days (consumables only)",
    ),
    reorder_requested: bool | None = Query(
        None,
        description="true = only products whose 再発注する was clicked and not yet received",
    ),
):
    # Reasons column is only attached when a `q` is provided. Selecting
    # `null` when `q` is missing keeps the result shape stable.
    if q and q.strip():
        filter_clause, reasons_expr = _build_product_search(q.strip())
        stmt = select(Product, reasons_expr.label("match_reasons"))
    else:
        filter_clause = None
        stmt = select(Product, literal(None).label("match_reasons"))
    stmt = (
        stmt
        .where(Product.store_id == store_id)
        .options(
            selectinload(Product.variants),
            selectinload(Product.images),
            selectinload(Product.category),
            selectinload(Product.vendor),
            selectinload(Product.tags),
        )
    )
    if filter_clause is not None:
        stmt = stmt.where(filter_clause)
    if category_id is not None:
        stmt = stmt.where(Product.category_id == category_id)
    if vendor_id is not None:
        stmt = stmt.where(Product.vendor_id == vendor_id)
    if status is not None:
        stmt = stmt.where(Product.status == status)
    if tag:
        stmt = stmt.where(Product.tags.any(Tag.name.in_(tag)))
    if item_type is not None:
        stmt = stmt.where(Product.item_type == item_type)
    if expiring_within_days is not None:
        from app.services.expiry import effective_expiry_expr
        cutoff = date.today() + timedelta(days=expiring_within_days)
        eff = effective_expiry_expr()
        # Lower bound: already-expired products are excluded, matching the
        # dashboard expiring_soon KPI (expiry >= today).
        stmt = stmt.where(
            eff.is_not(None),
            eff >= date.today(),
            eff <= cutoff,
        )
    if reorder_requested is not None:
        stmt = stmt.where(
            Product.reorder_requested_at.is_not(None)
            if reorder_requested else Product.reorder_requested_at.is_(None)
        )

    # Exclude archived by default
    if status is None:
        stmt = stmt.where(Product.status != ProductStatus.archived)

    # Total count: use just the where-filtered Product set (no need for the
    # reasons column).
    count_q = select(func.count()).select_from(
        stmt.with_only_columns(Product.id).subquery()
    )
    total = (await db.execute(count_q)).scalar_one()
    # Newest first — a just-registered product must appear on page 1, not last.
    rows = (await db.execute(stmt.order_by(Product.id.desc()).offset(offset).limit(limit))).unique().all()
    from app.services.expiry import effective_expiry_map
    eff_map = await effective_expiry_map(db, store_id)
    items: list[ProductListItem] = []
    for row in rows:
        # Each row is a (Product, match_reasons_str_or_None) tuple.
        p = row[0]
        reasons_str = row[1]
        reasons_list = [r for r in (reasons_str or "").split(",") if r] if reasons_str else []
        items.append(_build_list_item(p, match_reasons=reasons_list,
                                      effective_expiry=eff_map.get(p.id)))
    return PaginatedResponse(items=items, total=total)


@router.get("/search", response_model=list[ProductSearchResult])
async def search_products(
    db: DB,
    store_id: StoreId,
    q: str = Query(..., min_length=1, description="Search query"),
    status: ProductStatus | None = Query(
        None,
        description="Restrict to a specific status (pass 'active' to hide drafts)",
    ),
):
    """Lightweight AJAX search. Max 20 results.

    Default (no `status` param): returns active + draft (excludes archived).
    Used by the PO page where staff scan a JAN that might still be a draft
    being onboarded.

    Sales / manual sale entry should pass `status=active` so draft products
    (which don't appear on the inventory page) can't be sold.
    """
    filter_clause, _reasons = _build_product_search(q.strip())
    status_clause = (
        Product.status == status
        if status is not None
        else Product.status != ProductStatus.archived
    )
    stmt = (
        select(Product)
        .where(
            Product.store_id == store_id,
            status_clause,
            filter_clause,
        )
        .options(selectinload(Product.variants))
        .limit(20)
    )
    products = (await db.execute(stmt)).scalars().unique().all()
    results = []
    for p in products:
        default_v = next((v for v in p.variants if v.is_default), None)
        dv = None
        if default_v:
            dv = VariantSearchResult(
                id=default_v.id,
                sku=default_v.sku,
                price=default_v.price,
                on_hand=default_v.on_hand,
            )
        results.append(ProductSearchResult(id=p.id, name=p.name, default_variant=dv))
    return results


# NOTE: static routes — declared before /{product_id}.
_IMPORT_COLUMNS = ["name", "name_kana", "category", "vendor", "sku", "barcode",
                   "price", "cost", "stock", "item_type", "expiry_date", "unit", "reorder_url"]


@router.get("/import-template.csv", summary="商品インポート用テンプレートCSV")
async def product_import_template():
    import csv as _csv
    import io as _io
    from fastapi.responses import StreamingResponse
    buf = _io.StringIO()
    buf.write("﻿")  # UTF-8 BOM
    w = _csv.writer(buf)
    w.writerow(_IMPORT_COLUMNS)
    w.writerow(["サンプル歯ブラシ", "サンプルハブラシ", "歯ブラシ", "サンスター",
                "SAMPLE-001", "4901234567894", "330", "200", "10", "product", "", "個", ""])
    w.writerow(["サンプルグローブ", "", "衛生材料", "Ci メディカル",
                "", "", "1280", "800", "20", "consumable", "2027-01-31", "箱", ""])
    return StreamingResponse(
        iter([buf.getvalue()]), media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": 'attachment; filename="product_import_template.csv"'},
    )


@router.post("/import.csv", summary="商品CSVを一括インポート")
async def import_products_csv(db: DB, store_id: StoreId, file: UploadFile, user_name: CurrentUserName = None):
    """Bulk product import. Row rules (documented):
      • name required; category/vendor resolved BY NAME (unknown → row error,
        nothing auto-created); barcode already in the catalog → row error.
      • item_type: product | consumable (default product).
      • Rows import as DRAFT products with one default variant; publish from
        the list afterwards. Bad rows are reported, good rows still import.
    """
    import csv as _csv
    import io as _io

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

    rows = list(_csv.reader(_io.StringIO(text_data)))
    if not rows:
        raise HTTPException(422, detail="CSV が空です")

    # Header map (template order not required — match by header name).
    header = [h.strip().lstrip("﻿").lower() for h in rows[0]]
    col = {name: header.index(name) for name in _IMPORT_COLUMNS if name in header}
    if "name" not in col:
        raise HTTPException(422, detail="ヘッダー行に name 列が必要です（テンプレートをご利用ください）")

    def cell(row, key):
        i = col.get(key)
        return (row[i].strip() if i is not None and i < len(row) else "")

    cats = {c.name: c.id for c in (await db.execute(
        select(Category).where(Category.store_id == store_id))).scalars().all()}
    vendors = {v.company_name: v.id for v in (await db.execute(
        select(Vendor).where(Vendor.store_id == store_id))).scalars().all()}
    existing_barcodes = set((await db.execute(
        select(ProductVariant.barcode).where(
            ProductVariant.store_id == store_id, ProductVariant.barcode.is_not(None))
    )).scalars().all())

    created, errors = 0, []
    for idx, row in enumerate(rows[1:], start=2):
        if not any((c or "").strip() for c in row):
            continue
        name = cell(row, "name")
        if not name:
            errors.append({"row": idx, "message": "name が空です"})
            continue
        cat_name, vendor_name = cell(row, "category"), cell(row, "vendor")
        if cat_name and cat_name not in cats:
            errors.append({"row": idx, "message": f"カテゴリ「{cat_name}」が存在しません"})
            continue
        if vendor_name and vendor_name not in vendors:
            errors.append({"row": idx, "message": f"仕入先「{vendor_name}」が存在しません"})
            continue
        barcode = cell(row, "barcode") or None
        if barcode and barcode in existing_barcodes:
            errors.append({"row": idx, "message": f"JAN {barcode} は既に登録されています"})
            continue
        item_type_raw = (cell(row, "item_type") or "product").lower()
        if item_type_raw not in ("product", "consumable"):
            errors.append({"row": idx, "message": f"item_type は product か consumable です: {item_type_raw}"})
            continue
        try:
            price = Decimal(cell(row, "price") or "0")
            cost = Decimal(cell(row, "cost")) if cell(row, "cost") else None
            stock = int(cell(row, "stock") or "0")
            expiry = date.fromisoformat(cell(row, "expiry_date")) if cell(row, "expiry_date") else None
        except (ValueError, ArithmeticError):
            errors.append({"row": idx, "message": "price / cost / stock / expiry_date の形式が不正です"})
            continue

        product = Product(
            store_id=store_id, name=name, name_kana=cell(row, "name_kana") or None,
            internal_code=await _next_internal_code(db, store_id, item_type_raw),
            category_id=cats.get(cat_name), vendor_id=vendors.get(vendor_name),
            status=ProductStatus.draft,
            item_type=ItemType(item_type_raw),
            expiry_date=expiry, unit=cell(row, "unit") or None,
            reorder_url=cell(row, "reorder_url") or None,
        )
        db.add(product)
        await db.flush()
        variant = ProductVariant(
            product_id=product.id, store_id=store_id, is_default=True,
            sku=cell(row, "sku") or None, barcode=barcode,
            price=price, cost=cost, on_hand=0,
        )
        db.add(variant)
        await db.flush()
        # Initial stock goes through the per-branch stock service so the
        # branch row + total stay consistent, with an audit trail.
        if stock > 0:
            from app.models.inventory import AdjustmentReason, InventoryAdjustment, InventoryField
            from app.services.stock import StockError, apply_stock_delta
            try:
                b = await apply_stock_delta(
                    db, store_id=store_id, variant_id=variant.id,
                    branch_id=None, field=InventoryField.on_hand, delta=stock,
                )
                db.add(InventoryAdjustment(
                    created_by=user_name,
                    store_id=store_id, variant_id=variant.id, branch_id=b,
                    field=InventoryField.on_hand, delta=stock,
                    reason=AdjustmentReason.correction, note="CSVインポート初期在庫",
                ))
            except StockError as e:
                errors.append({"row": idx, "message": f"在庫の初期化に失敗: {e.message}"})
        if barcode:
            existing_barcodes.add(barcode)
        created += 1

    await db.commit()
    return {"created": created, "errors": errors}


@router.get("/{product_id}/sales-weekly", summary="過去N週の週次販売実績")
async def product_sales_weekly(
    product_id: int,
    db: DB,
    store_id: StoreId,
    weeks: int = Query(12, ge=1, le=52),
):
    """Real weekly sales buckets for the detail-page chart (JST weeks, Monday
    start, oldest first, refunds included as negative quantities).
    """
    jst = timezone(timedelta(hours=9))
    now_jst = datetime.now(jst)
    this_monday = (now_jst - timedelta(days=now_jst.weekday())).replace(
        hour=0, minute=0, second=0, microsecond=0
    )
    start_jst = this_monday - timedelta(weeks=weeks - 1)
    # sold_at is stored as naive UTC — compare in that space.
    start_utc_naive = start_jst.astimezone(timezone.utc).replace(tzinfo=None)

    rows = (await db.execute(
        select(SalesRecord.sold_at, SalesRecord.quantity, SalesRecord.unit_price)
        .join(ProductVariant, ProductVariant.id == SalesRecord.variant_id)
        .where(
            SalesRecord.store_id == store_id,
            ProductVariant.product_id == product_id,
            SalesRecord.sold_at >= start_utc_naive,
        )
    )).all()

    buckets = [{"units": 0, "revenue": Decimal("0")} for _ in range(weeks)]
    for sold_at, quantity, unit_price in rows:
        sold_jst = sold_at.replace(tzinfo=timezone.utc).astimezone(jst)
        idx = (sold_jst.date() - start_jst.date()).days // 7
        if 0 <= idx < weeks:
            buckets[idx]["units"] += quantity
            buckets[idx]["revenue"] += (unit_price or 0) * quantity

    return {
        "weeks": [
            {
                "week_start": (start_jst + timedelta(weeks=i)).date().isoformat(),
                "units": b["units"],
                "revenue": str(b["revenue"]),
            }
            for i, b in enumerate(buckets)
        ]
    }


@router.get("/{product_id}/lots", summary="ロット一覧（実データ・migration 014）")
async def product_lots(product_id: int, db: DB, store_id: StoreId):
    """Real per-lot rows for the detail page's ロット履歴 tab, newest first.

    status: current (qty>0, not expired) / expired (qty>0, past expiry) /
    depleted (qty==0).
    """
    from app.models.branch import Branch
    from app.models.lot import ProductLot

    rows = (await db.execute(
        select(ProductLot, Branch.name)
        .join(ProductVariant, ProductVariant.id == ProductLot.variant_id)
        .join(Branch, Branch.id == ProductLot.branch_id)
        .where(
            ProductLot.store_id == store_id,
            ProductVariant.product_id == product_id,
        )
        .order_by(ProductLot.qty_on_hand == 0,  # active lots first
                  ProductLot.expiry_date.is_(None), ProductLot.expiry_date)
    )).all()

    today = date.today()
    items = []
    for lot, branch_name in rows:
        if lot.qty_on_hand <= 0:
            status = "depleted"
        elif lot.expiry_date is not None and lot.expiry_date < today:
            status = "expired"
        else:
            status = "current"
        items.append({
            "id": lot.id,
            "lot_number": lot.lot_number,
            "expiry_date": lot.expiry_date.isoformat() if lot.expiry_date else None,
            "qty_on_hand": lot.qty_on_hand,
            "status": status,
            "branch_name": branch_name,
            "received_at": lot.received_at.isoformat() if lot.received_at else None,
        })
    return {"items": items}


@router.get("/{product_id}", response_model=ProductDetail)
async def get_product(product_id: int, db: DB, store_id: StoreId):
    stmt = (
        select(Product)
        .where(Product.id == product_id, Product.store_id == store_id)
        .options(
            selectinload(Product.variants),
            selectinload(Product.images),
            selectinload(Product.category),
            selectinload(Product.vendor),
            selectinload(Product.tags),
        )
    )
    product = (await db.execute(stmt)).scalar_one_or_none()
    if not product:
        raise HTTPException(404, detail="Product not found")

    # Sales summary: last 90 days across all variants
    variant_ids = [v.id for v in product.variants]
    cutoff = datetime.now(timezone.utc) - timedelta(days=90)
    summary = SalesSummary(last_90_days_quantity=0, last_90_days_revenue=Decimal("0"))
    if variant_ids:
        row = (
            await db.execute(
                select(
                    func.coalesce(func.sum(SalesRecord.quantity), 0),
                    func.coalesce(func.sum(SalesRecord.quantity * SalesRecord.unit_price), 0),
                ).where(
                    SalesRecord.store_id == store_id,
                    SalesRecord.variant_id.in_(variant_ids),
                    SalesRecord.sold_at >= cutoff,
                )
            )
        ).one()
        summary = SalesSummary(
            last_90_days_quantity=int(row[0]),
            last_90_days_revenue=Decimal(str(row[1])),
        )

    images_sorted = sorted(product.images, key=lambda i: i.position)

    # 最終入荷日 (last_received_at): the most recent inventory adjustment
    # with reason=purchase_order_received across this product's variants.
    # Done as a single MAX() query — no per-variant N+1.
    last_received_at = None
    if variant_ids:
        from app.models.inventory import InventoryAdjustment, AdjustmentReason
        last_received_at = (await db.execute(
            select(func.max(InventoryAdjustment.created_at))
            .where(
                InventoryAdjustment.variant_id.in_(variant_ids),
                InventoryAdjustment.reason == AdjustmentReason.purchase_order_received,
            )
        )).scalar_one()

    return ProductDetail(
        id=product.id,
        store_id=product.store_id,
        name=product.name,
        internal_code=product.internal_code,
        name_kana=product.name_kana,
        description=product.description,
        category_id=product.category_id,
        category_name=product.category.name if product.category else None,
        vendor_id=product.vendor_id,
        vendor_name=product.vendor.company_name if product.vendor else None,
        country_of_origin=product.country_of_origin,
        default_amount_at_payment=product.default_amount_at_payment,
        is_insurable=product.is_insurable,
        is_pinned=product.is_pinned,
        default_insurance_point_at_payment=product.default_insurance_point_at_payment,
        status=product.status,
        # Yoshioka 2026-05-11 additions
        item_type=product.item_type,
        expiry_date=product.expiry_date,
        lot_number=product.lot_number,
        unit=product.unit,
        reorder_url=product.reorder_url,
        reorder_requested_at=product.reorder_requested_at,
        ai_session_id=product.ai_session_id,
        variants=[VariantRead.model_validate(v) for v in product.variants],
        images=[ImageRead.model_validate(i) for i in images_sorted],
        tags=[t.name for t in product.tags],
        sales_summary=summary,
        last_received_at=last_received_at,
        created_at=product.created_at,
        updated_at=product.updated_at,
    )


@router.post("", response_model=ProductDetail, status_code=201)
async def create_product(body: ProductCreate, db: DB, store_id: StoreId, user_name: CurrentUserName = None):
    product = Product(
        internal_code=await _next_internal_code(db, store_id, body.item_type),
        store_id=store_id,
        name=body.name,
        name_kana=body.name_kana,
        category_id=body.category_id,
        vendor_id=body.vendor_id,
        description=body.description,
        country_of_origin=body.country_of_origin,
        default_amount_at_payment=body.default_amount_at_payment,
        is_insurable=body.is_insurable,
        is_pinned=body.is_pinned,
        default_insurance_point_at_payment=body.default_insurance_point_at_payment,
        status=body.status,
        # Yoshioka 2026-05-11 additions
        item_type=body.item_type,
        expiry_date=body.expiry_date,
        lot_number=body.lot_number,
        unit=body.unit,
        reorder_url=body.reorder_url,
        ai_session_id=body.ai_session_id,
    )

    # Link AI session if provided
    if body.ai_session_id:
        from app.models.ai_session import AiSuggestionSession

        session = (
            await db.execute(
                select(AiSuggestionSession).where(
                    AiSuggestionSession.id == body.ai_session_id,
                    AiSuggestionSession.store_id == store_id,
                )
            )
        ).scalar_one_or_none()
        if session:
            session.applied_to_product_id = None  # will be set after flush

    db.add(product)
    await db.flush()  # get product.id

    # Link AI session back
    if body.ai_session_id:
        if session:
            session.applied_to_product_id = product.id

    # Variants — ensure at least one default
    has_default = False
    first_variant: ProductVariant | None = None
    for vdata in body.variants:
        v = ProductVariant(
            product_id=product.id,
            store_id=store_id,
            **vdata.model_dump(),
        )
        if first_variant is None:
            first_variant = v
        if v.is_default:
            has_default = True
        db.add(v)

    if not body.variants:
        # Auto-create default variant
        db.add(ProductVariant(
            product_id=product.id,
            store_id=store_id,
            is_default=True,
            price=body.default_amount_at_payment,
        ))
    elif not has_default and first_variant is not None:
        # Mark the first variant as default for real (audit m1 — the old
        # `pass` left multi-variant API creates with NO default variant,
        # blanking SKU/price in every list view).
        first_variant.is_default = True

    # Images
    for idata in body.images:
        db.add(ProductImage(
            product_id=product.id,
            store_id=store_id,
            **idata.model_dump(),
        ))

    # Tags — auto-create missing, use direct insert to avoid lazy load
    for tag_name in body.tags:
        tag = (
            await db.execute(
                select(Tag).where(Tag.store_id == store_id, Tag.name == tag_name)
            )
        ).scalar_one_or_none()
        if not tag:
            tag = Tag(store_id=store_id, name=tag_name)
            db.add(tag)
            await db.flush()
        await db.execute(
            sa_insert(ProductTag).values(product_id=product.id, tag_id=tag.id)
        )

    await db.commit()

    # Return full detail
    return await get_product(product.id, db, store_id)


@router.patch("/{product_id}", response_model=ProductDetail)
async def update_product(product_id: int, body: ProductUpdate, db: DB, store_id: StoreId):
    product = (
        await db.execute(
            select(Product).where(Product.id == product_id, Product.store_id == store_id)
        )
    ).scalar_one_or_none()
    if not product:
        raise HTTPException(404, detail="Product not found")
    for key, val in body.model_dump(exclude_unset=True).items():
        setattr(product, key, val)
    await db.commit()
    return await get_product(product_id, db, store_id)


@router.delete("/{product_id}", response_model=ProductDetail)
async def delete_product(product_id: int, db: DB, store_id: StoreId):
    """Soft delete via status='archived'."""
    product = (
        await db.execute(
            select(Product).where(Product.id == product_id, Product.store_id == store_id)
        )
    ).scalar_one_or_none()
    if not product:
        raise HTTPException(404, detail="Product not found")
    product.status = ProductStatus.archived
    await db.commit()
    return await get_product(product_id, db, store_id)

# ── Product images (feedback batch C) ───────────────────────────────
# Same storage as the display logo: file lands in MEDIA_DIR, public URL
# /media/<name>, DB row in product_images (position = append order).

_IMG_TYPES = {"image/png": ".png", "image/jpeg": ".jpg", "image/webp": ".webp"}
_IMG_MAX_BYTES = 4 * 1024 * 1024


@router.post("/{product_id}/images", summary="商品画像をアップロード")
async def upload_product_image(product_id: int, file: UploadFile, db: DB, store_id: StoreId):
    import secrets as _secrets

    from app.routers.settings import MEDIA_DIR

    product = (await db.execute(
        select(Product).where(Product.id == product_id, Product.store_id == store_id)
        .options(selectinload(Product.images))
    )).scalar_one_or_none()
    if product is None:
        raise HTTPException(404, detail="商品が見つかりません")
    ext = _IMG_TYPES.get((file.content_type or "").lower())
    if ext is None:
        raise HTTPException(422, detail="PNG / JPEG / WebP のみアップロードできます")
    contents = await file.read()
    if len(contents) > _IMG_MAX_BYTES:
        raise HTTPException(422, detail="ファイルサイズは 4MB 以下にしてください")

    MEDIA_DIR.mkdir(parents=True, exist_ok=True)
    fname = f"product_{store_id}_{product_id}_{_secrets.token_hex(8)}{ext}"
    (MEDIA_DIR / fname).write_bytes(contents)

    img = ProductImage(
        product_id=product_id, store_id=store_id,
        url=f"/media/{fname}", alt_text=product.name,
        position=max([i.position for i in product.images], default=-1) + 1,
    )
    db.add(img)
    await db.commit()
    await db.refresh(img)
    return {"id": img.id, "url": img.url, "position": img.position}


@router.delete("/{product_id}/images/{image_id}", status_code=204, summary="商品画像を削除")
async def delete_product_image(product_id: int, image_id: int, db: DB, store_id: StoreId):
    from pathlib import Path as _Path

    from app.routers.settings import MEDIA_DIR

    img = (await db.execute(
        select(ProductImage).where(
            ProductImage.id == image_id,
            ProductImage.product_id == product_id,
            ProductImage.store_id == store_id,
        )
    )).scalar_one_or_none()
    if img is None:
        raise HTTPException(404, detail="画像が見つかりません")
    url = img.url
    await db.delete(img)
    await db.commit()
    if url.startswith("/media/"):
        try:
            (_Path(MEDIA_DIR) / url.removeprefix("/media/")).unlink(missing_ok=True)
        except OSError:
            pass
