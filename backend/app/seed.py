"""Seed script: populates the DB with sample data for testing.

Run: docker compose exec api python -m app.seed
"""

from __future__ import annotations

import asyncio
from datetime import date, timedelta
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import async_session, engine
from app.models import Base  # noqa: F401 — ensure all models registered
from app.models.branch import Branch, BranchStatus, BranchType
from app.models.category import Category, CategoryAppliesTo
from app.models.inventory import AdjustmentReason, InventoryAdjustment, InventoryField
from app.models.product import (
    ItemType,
    Product,
    ProductImage,
    ProductStatus,
    ProductVariant,
    WeightUnit,
)
from app.models.settings_kv import SettingsKV
from app.models.store import Store
from app.models.support import SupportSubject, SupportTicket, TicketStatus
from app.models.tag import Tag, ProductTag
from app.models.vendor import Vendor, VendorStatus


async def seed() -> None:
    async with async_session() as db:
        # Check if already seeded
        existing = (await db.execute(select(Store))).scalar_one_or_none()
        if existing:
            print("Database already seeded. Skipping.")
            return

        # --- Store ---
        store = Store(name="サンプル歯科クリニック")
        db.add(store)
        await db.flush()
        sid = store.id
        print(f"Created store: {store.name} (id={sid})")

        # --- Dev admin user (PoC auth) — admin@example.com / admin ---
        # Existing DBs get the same user via migration 011's INSERT..SELECT.
        from app.models.user import User, UserRole
        from app.services.auth import hash_password
        db.add(User(
            store_id=sid,
            email="admin@example.com",
            password_hash=hash_password("admin"),
            display_name="山田 花子",
            role=UserRole.admin,
        ))
        print("Created dev admin: admin@example.com / admin")

        # --- Branches: 本院 + 分院 (brief §4.2/§4.10) ---
        # Two branches so the 院・店舗 list and the inventory branch filter
        # have something to render.
        main_hours = {
            "mon": [{"open": "09:30", "close": "13:00"}, {"open": "14:30", "close": "19:00"}],
            "tue": [{"open": "09:30", "close": "13:00"}, {"open": "14:30", "close": "19:00"}],
            "wed": [],
            "thu": [{"open": "09:30", "close": "13:00"}, {"open": "14:30", "close": "19:00"}],
            "fri": [{"open": "09:30", "close": "13:00"}, {"open": "14:30", "close": "19:00"}],
            "sat": [{"open": "09:30", "close": "17:00"}],
            "sun": [],
            "holiday": [],
        }
        branch = Branch(
            store_id=sid, name="本院 ペイライト歯科クリニック",
            is_default=True, branch_type=BranchType.main,
            country="JP", postal_code="100-0005",
            address="東京都千代田区丸の内3-4-1 新国際ビル9階",
            phone="03-6281-8883",
            manager_name="田島 雄一",
            operating_hours_json=main_hours,
            status=BranchStatus.active,
        )
        db.add(branch)
        sub_hours = {
            "mon": [{"open": "10:00", "close": "13:30"}, {"open": "15:00", "close": "20:00"}],
            "tue": [{"open": "10:00", "close": "13:30"}, {"open": "15:00", "close": "20:00"}],
            "wed": [{"open": "10:00", "close": "13:30"}, {"open": "15:00", "close": "20:00"}],
            "thu": [{"open": "10:00", "close": "13:30"}, {"open": "15:00", "close": "20:00"}],
            "fri": [{"open": "10:00", "close": "13:30"}, {"open": "15:00", "close": "20:00"}],
            "sat": [{"open": "10:00", "close": "18:00"}],
            "sun": [{"open": "10:00", "close": "18:00"}],
            "holiday": [],
        }
        branch_sub = Branch(
            store_id=sid, name="分院 ペイライト歯科クリニック 梅田",
            is_default=False, branch_type=BranchType.sub,
            country="JP", postal_code="530-0012",
            address="大阪府大阪市北区芝田2-6-27 PMO梅田 8階B",
            phone="06-1234-5678",
            manager_name="山口 さくら",
            operating_hours_json=sub_hours,
            status=BranchStatus.active,
        )
        db.add(branch_sub)
        await db.flush()
        print(f"Created branches: {branch.name}, {branch_sub.name}")

        # --- Categories with hierarchy (brief §4.3) ---
        # Two top-level parents (物販品 / 消耗品) and 11 leaves with the
        # exact colors + Lucide icons the design specifies.
        cats: dict[str, Category] = {}
        retail_parent = Category(
            store_id=sid, name="物販品", applies_to=CategoryAppliesTo.retail,
            color_hex="#16A36C", icon_name="ShoppingBag", sort_order=0,
        )
        consumable_parent = Category(
            store_id=sid, name="消耗品", applies_to=CategoryAppliesTo.consumable,
            color_hex="#2E7BD6", icon_name="Boxes", sort_order=1,
        )
        db.add(retail_parent)
        db.add(consumable_parent)
        await db.flush()
        cats["物販品"] = retail_parent
        cats["消耗品"] = consumable_parent

        leaf_specs = [
            # (name, parent_key, color, icon, applies_to, sort)
            ("歯ブラシ",       "物販品", "#16A36C", "Brush",       CategoryAppliesTo.retail, 10),
            ("歯磨剤",         "物販品", "#2E7BD6", "Sparkle",     CategoryAppliesTo.retail, 11),
            ("フロス",         "物販品", "#22B07A", "Wind",        CategoryAppliesTo.retail, 12),
            ("洗口液",         "物販品", "#7AD3B0", "Droplet",     CategoryAppliesTo.retail, 13),
            ("ホワイトニング", "物販品", "#E89B17", "Star",        CategoryAppliesTo.retail, 14),
            ("矯正用品",       "物販品", "#9C56C0", "Smile",       CategoryAppliesTo.retail, 15),
            ("衛生材料",       "消耗品", "#5B6776", "ShieldCheck", CategoryAppliesTo.consumable, 20),
            ("印象材",         "消耗品", "#2E7BD6", "Layers",      CategoryAppliesTo.consumable, 21),
            ("麻酔・薬剤",     "消耗品", "#D6433A", "Pill",        CategoryAppliesTo.consumable, 22),
            ("グローブ",       "消耗品", "#0F8A5F", "Hand",        CategoryAppliesTo.consumable, 23),
            ("滅菌・消毒",     "消耗品", "#16A36C", "Sparkles",    CategoryAppliesTo.consumable, 24),
            # Keep the legacy keys that existing product seed lines reference.
            # These act as aliases so the product creates below keep working.
            ("歯間ブラシ",     "物販品", "#7AD3B0", "Brush",       CategoryAppliesTo.retail, 16),
            ("麻酔",           "消耗品", "#D6433A", "Pill",        CategoryAppliesTo.consumable, 25),
            ("その他",         None,     "#8A95A4", "MoreHorizontal", CategoryAppliesTo.both, 99),
        ]
        for name, parent_key, color, icon, applies, sort in leaf_specs:
            parent_id = cats[parent_key].id if parent_key else None
            leaf = Category(
                store_id=sid, name=name,
                parent_id=parent_id,
                color_hex=color, icon_name=icon,
                applies_to=applies, sort_order=sort,
            )
            db.add(leaf)
            await db.flush()
            cats[name] = leaf
        print(f"Created {len(cats)} categories (2 parents + {len(leaf_specs)} leaves)")

        # --- Vendors (brief §4.4 — 6 real Japanese dental suppliers) ---
        # Existing product seed references "サンスター", "ライオン", "Ci メディカル"
        # so we keep those names but enrich with full contact + payment terms.
        vendor_specs = [
            # (display_name, alias_keys, contact, phone, email, payment_terms, website)
            ("サンスター", ["サンスター", "サンスター株式会社"],
                "佐藤 健一", "03-1234-5678", "k.sato@sunstar.co.jp",
                "月末締/翌月末払", "https://www.sunstar.com/jp/"),
            ("ライオン", ["ライオン", "ライオン歯科材株式会社"],
                "鈴木 美咲", "03-2345-6789", "suzuki@lion-dent.co.jp",
                "月末締/翌々月10日払", "https://www.lion.co.jp/"),
            ("Ci メディカル", ["Ci メディカル", "Ci メディカル株式会社"],
                "中村 翔", "052-1234-5678", "nakamura@ci-medical.com",
                "月末締/翌月末払", "https://www.ci-medical.com/"),
            ("GC株式会社", ["GC", "GC株式会社"],
                "田中 浩二", "03-3456-7890", "tanaka@gc.dental.jp",
                "月末締/翌月末払", "https://www.gc.dental"),
            ("モリタ製作所", ["モリタ", "モリタ製作所"],
                "山本 由紀", "06-1234-5678", "yamamoto@morita.com",
                "月末締/翌月末払", "https://www.morita.com"),
            ("ヘンリーシャイン・ジャパン", ["ヘンリーシャイン"],
                "David Tanaka", "03-4567-8901", "dtanaka@henryschein.jp",
                "月末締/翌月20日払", "https://www.henryschein.jp"),
        ]
        vendors: dict[str, Vendor] = {}
        for (name, aliases, contact, phone, email, terms, web) in vendor_specs:
            v = Vendor(
                store_id=sid, company_name=name, country="JP",
                contact_name=contact, phone=phone, email=email,
                payment_terms=terms, website=web,
                status=VendorStatus.active,
            )
            db.add(v)
            await db.flush()
            for k in aliases:
                vendors[k] = v
        print(f"Created {len({v.id for v in vendors.values()})} vendors")

        # --- Tags ---
        tag_names = ["歯周病ケア", "知覚過敏", "子供用", "フッ素配合", "おすすめ"]
        tags = {}
        for tname in tag_names:
            t = Tag(store_id=sid, name=tname)
            db.add(t)
            await db.flush()
            tags[tname] = t
        print(f"Created {len(tags)} tags")

        # --- Products with variants ---

        # Product 1: GUM デンタルブラシ #211 (with reorder_url for demo)
        p1 = Product(
            store_id=sid,
            name="GUM デンタルブラシ #211",
            name_kana="ガム デンタルブラシ ニイチイチ",
            category_id=cats["歯ブラシ"].id,
            vendor_id=vendors["サンスター"].id,
            description="3列コンパクトヘッドのやわらかめ歯ブラシ。歯周病予防に。",
            default_amount_at_payment=Decimal("330"),
            status=ProductStatus.active,
            item_type=ItemType.product,
            reorder_url="https://www.sunstar.com/jp/products/gum211/reorder",
        )
        db.add(p1)
        await db.flush()
        db.add(ProductTag(product_id=p1.id, tag_id=tags["歯周病ケア"].id))
        db.add(ProductTag(product_id=p1.id, tag_id=tags["おすすめ"].id))
        db.add(ProductVariant(
            product_id=p1.id, store_id=sid, sku="GUM-211-S",
            barcode="4901616213241", is_default=True,
            price=Decimal("330"), cost=Decimal("200"),
            weight_value=Decimal("20"), weight_unit=WeightUnit.g,
            on_hand=5,  # low stock for dashboard demo
            option1_name="かたさ", option1_value="やわらかめ",
        ))
        db.add(ProductImage(
            product_id=p1.id, store_id=sid,
            url="https://www.sunstar.com/jp/products/gum211.jpg",
            alt_text="GUM #211 歯ブラシ", position=0,
        ))

        # Product 2: Ci700 超先細
        p2 = Product(
            store_id=sid,
            name="Ci700 超先細 Mふつう",
            name_kana="シーアイナナヒャク チョウセンボソ エムフツウ",
            category_id=cats["歯ブラシ"].id,
            vendor_id=vendors["Ci メディカル"].id,
            description="超先細毛で歯周ポケットの汚れを除去。歯科医院専売品。",
            default_amount_at_payment=Decimal("150"),
            status=ProductStatus.active,
        )
        db.add(p2)
        await db.flush()
        db.add(ProductTag(product_id=p2.id, tag_id=tags["歯周病ケア"].id))
        db.add(ProductVariant(
            product_id=p2.id, store_id=sid, sku="CI700-M",
            barcode="4582357820024", is_default=True,
            price=Decimal("150"), cost=Decimal("80"),
            weight_value=Decimal("15"), weight_unit=WeightUnit.g,
            on_hand=100,
            option1_name="かたさ", option1_value="ふつう",
        ))

        # Product 3: クリニカアドバンテージ デンタルフロス
        p3 = Product(
            store_id=sid,
            name="クリニカアドバンテージ デンタルフロス Y字タイプ",
            name_kana="クリニカアドバンテージ デンタルフロス ワイジタイプ",
            category_id=cats["フロス"].id,
            vendor_id=vendors["ライオン"].id,
            description="Y字ホルダーで奥歯の歯間にも届きやすいデンタルフロス。",
            default_amount_at_payment=Decimal("440"),
            status=ProductStatus.active,
        )
        db.add(p3)
        await db.flush()
        db.add(ProductVariant(
            product_id=p3.id, store_id=sid, sku="CLINICA-FLOSS-Y",
            barcode="4903301282532", is_default=True,
            price=Decimal("440"), cost=Decimal("280"),
            weight_value=Decimal("30"), weight_unit=WeightUnit.g,
            on_hand=30,
        ))

        # Product 4: システマ ハグキプラス ハミガキ
        p4 = Product(
            store_id=sid,
            name="システマ ハグキプラス ハミガキ 90g",
            name_kana="システマ ハグキプラス ハミガキ キュウジュウグラム",
            category_id=cats["歯磨剤"].id,
            vendor_id=vendors["ライオン"].id,
            description="歯周病予防ハミガキ。薬用成分IPMP配合で歯周ポケットの奥まで届く。",
            default_amount_at_payment=Decimal("550"),
            status=ProductStatus.active,
        )
        db.add(p4)
        await db.flush()
        db.add(ProductTag(product_id=p4.id, tag_id=tags["歯周病ケア"].id))
        db.add(ProductTag(product_id=p4.id, tag_id=tags["フッ素配合"].id))
        db.add(ProductVariant(
            product_id=p4.id, store_id=sid, sku="SYSTEMA-HP-90",
            barcode="4903301293248", is_default=True,
            price=Decimal("550"), cost=Decimal("350"),
            weight_value=Decimal("90"), weight_unit=WeightUnit.g,
            on_hand=25,
        ))

        # Product 5: Draft product (no barcode yet)
        p5 = Product(
            store_id=sid,
            name="テスト商品（下書き）",
            name_kana="テストショウヒン シタガキ",
            category_id=cats["その他"].id,
            description="下書き状態のテスト商品です。",
            default_amount_at_payment=Decimal("1000"),
            status=ProductStatus.draft,
        )
        db.add(p5)
        await db.flush()
        db.add(ProductVariant(
            product_id=p5.id, store_id=sid,
            is_default=True, price=Decimal("1000"), cost=Decimal("600"),
            on_hand=0,
        ))

        # --- Consumables (Yoshioka 2026-05-11) ---
        today = date.today()

        # Product 6: 歯科用紙コップ — expires soon (22 days). Low stock too.
        p6 = Product(
            store_id=sid,
            name="歯科用紙コップ 100枚入り",
            name_kana="シカヨウ カミコップ ヒャクマイイリ",
            category_id=cats["消耗品"].id,
            vendor_id=vendors["Ci メディカル"].id,
            description="使い捨て紙コップ。100枚入りパック。",
            default_amount_at_payment=Decimal("680"),
            status=ProductStatus.active,
            item_type=ItemType.consumable,
            expiry_date=today + timedelta(days=22),
            lot_number="LOT-2026A-018",
            unit="箱",
            reorder_url="https://www.ci-medical.com/product/paper-cup-100",
        )
        db.add(p6)
        await db.flush()
        db.add(ProductVariant(
            product_id=p6.id, store_id=sid, sku="CI-CUP-100",
            barcode="4987111090049", is_default=True,
            price=Decimal("680"), cost=Decimal("320"),
            on_hand=12, committed=0, unavailable=0,
        ))

        # Product 7: ニトリル グローブ — expires in 45 days. Very low stock (3).
        p7 = Product(
            store_id=sid,
            name="ニトリル グローブ パウダーフリー M",
            name_kana="ニトリル グローブ パウダーフリー エム",
            category_id=cats["消耗品"].id,
            vendor_id=vendors["Ci メディカル"].id,
            description="100枚入。アレルギー対応のパウダーフリー手袋。",
            default_amount_at_payment=Decimal("1280"),
            status=ProductStatus.active,
            item_type=ItemType.consumable,
            expiry_date=today + timedelta(days=45),
            lot_number="LOT-2026B-007",
            unit="箱",
        )
        db.add(p7)
        await db.flush()
        db.add(ProductVariant(
            product_id=p7.id, store_id=sid, sku="CI-NTR-M-100",
            barcode="4987111090032", is_default=True,
            price=Decimal("1280"), cost=Decimal("640"),
            on_hand=3, committed=0, unavailable=0,
        ))

        # Product 8: オーラ注 歯科用キシロカイン — expires in 78 days (safe range)
        p8 = Product(
            store_id=sid,
            name="オーラ注 歯科用キシロカイン",
            name_kana="オーラチュウ シカヨウ キシロカイン",
            category_id=cats["麻酔"].id,
            vendor_id=vendors["Ci メディカル"].id,
            description="カートリッジ式局所麻酔薬。1.8mL × 50本入。",
            default_amount_at_payment=Decimal("3200"),
            status=ProductStatus.active,
            item_type=ItemType.consumable,
            expiry_date=today + timedelta(days=78),
            lot_number="LOT-2026C-022",
            unit="本",
        )
        db.add(p8)
        await db.flush()
        db.add(ProductVariant(
            product_id=p8.id, store_id=sid, sku="MOR-XYL-50",
            barcode="4987111032214", is_default=True,
            price=Decimal("3200"), cost=Decimal("2100"),
            on_hand=24, committed=6, unavailable=0,
        ))

        # Product 9: オートクレーブ滅菌バッグ — expires in 12 days (critical!)
        p9 = Product(
            store_id=sid,
            name="オートクレーブ用滅菌バッグ 200枚",
            name_kana="オートクレーブヨウ メッキンバッグ ニヒャクマイ",
            category_id=cats["消耗品"].id,
            vendor_id=vendors["Ci メディカル"].id,
            description="耐熱滅菌バッグ。蒸気滅菌・EOG滅菌に対応。",
            default_amount_at_payment=Decimal("2400"),
            status=ProductStatus.active,
            item_type=ItemType.consumable,
            expiry_date=today + timedelta(days=12),
            lot_number="LOT-2026A-031",
            unit="箱",
        )
        db.add(p9)
        await db.flush()
        db.add(ProductVariant(
            product_id=p9.id, store_id=sid, sku="CI-STR-200",
            barcode="4987111090056", is_default=True,
            price=Decimal("2400"), cost=Decimal("1200"),
            on_hand=42, committed=6, unavailable=0,
        ))

        await db.commit()
        print(f"Created 9 products with variants, images, and tags (5 retail + 4 consumables)")

        # ── Settings (brief §4.9) ──
        # Insert one settings_kv row per namespace with sensible defaults.
        settings_seed = {
            "general": {
                "company_name": "ペイライト歯科クリニック",
                "company_registration_no": "1234567890123",
                "representative": "田島 雄一",
                "phone": "03-6281-8883",
                "email": "info@example.com",
                "address": "東京都千代田区丸の内3-4-1 新国際ビル9階",
                "timezone": "Asia/Tokyo",
                "language": "ja",
                "currency": "JPY",
                "date_format": "YYYY/MM/DD",
                "logo_url": None,
                "brand_color_hex": "#16A36C",
            },
            "notifications": {
                "email_enabled": True,
                "low_stock": True,
                "expiring_soon": True,
                "po_status_change": True,
                "daily_summary_time": "08:00",
                "recipient_user_ids": [1, 2],
            },
            "tax_rates": {
                "rates": [
                    {"id": 1, "name": "標準税率", "rate": "10.00", "is_default": True},
                    {"id": 2, "name": "軽減税率", "rate": "8.00", "is_default": False},
                    {"id": 3, "name": "非課税", "rate": "0.00", "is_default": False},
                ]
            },
            "ai": {
                "auto_fill_mode": "auto",
                "openai_api_key_set": False,
                "daily_summary_schedule": {"time": "06:00", "weekdays": [1, 2, 3, 4, 5]},
                "model": "gpt-4o-mini",
                "monthly_usage": {"api_calls": 2847, "tokens": 1400000, "cost_jpy": "3200"},
            },
            "integrations": {
                "paylight_x_sso": {"connected": True, "connected_at": "2026-04-15T09:00:00+09:00"},
                "accounting": {"provider": "freee", "connected": False},
                "line_official": {"connected": False, "connected_at": None},
                "slack": {"connected": False, "webhook_url_set": False},
            },
        }
        for ns, data in settings_seed.items():
            db.add(SettingsKV(store_id=sid, namespace=ns, data_json=data))
        await db.flush()
        print(f"Created {len(settings_seed)} settings_kv rows")

        # ── Support tickets (brief §4.10) ──
        ticket_specs = [
            (SupportSubject.bug, "products", "在庫数が表示されない", "info@example.com", TicketStatus.resolved),
            (SupportSubject.feature, "purchase-orders", "PDFテンプレートをカスタマイズしたい", "manager@example.com", TicketStatus.in_progress),
            (SupportSubject.howto, "settings", "ユーザーを新規追加する方法は？", "admin@example.com", TicketStatus.open),
        ]
        for sc, page, body, email, status in ticket_specs:
            db.add(SupportTicket(
                store_id=sid, subject_category=sc, related_page=page,
                body=body, email=email,
                contact_window="平日 10:00-17:00",
                status=status,
            ))
        await db.flush()
        print(f"Created {len(ticket_specs)} support tickets")

        # ── Inventory adjustments — feed the dashboard's 最近の活動 ──
        # A handful of recent receives + sales so the timeline isn't empty.
        # Reference an arbitrary variant via the first one we created.
        variant_rows = (await db.execute(select(ProductVariant).limit(5))).scalars().all()
        from datetime import datetime, timezone
        now = datetime.now(timezone.utc)
        for i, v in enumerate(variant_rows):
            db.add(InventoryAdjustment(
                store_id=sid, variant_id=v.id,
                field=InventoryField.on_hand,
                delta=10 if i % 2 == 0 else -2,
                reason=AdjustmentReason.purchase_order_received if i % 2 == 0 else AdjustmentReason.sale,
                note="シード用の入荷/販売イベント",
            ))
        await db.commit()
        print(f"Created {len(variant_rows)} sample inventory adjustments")

        print("Seed complete!")


if __name__ == "__main__":
    asyncio.run(seed())
