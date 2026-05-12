"""Seed script: populates the DB with sample data for testing.

Run: docker compose exec api python -m app.seed
"""

from __future__ import annotations

import asyncio
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import async_session, engine
from app.models import Base  # noqa: F401 — ensure all models registered
from app.models.branch import Branch
from app.models.category import Category
from app.models.product import Product, ProductImage, ProductStatus, ProductVariant, WeightUnit
from app.models.store import Store
from app.models.tag import Tag, ProductTag
from app.models.vendor import Vendor


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

        # --- Default branch ---
        branch = Branch(store_id=sid, name="本院", is_default=True, country="JP", address="東京都渋谷区1-1-1")
        db.add(branch)
        await db.flush()
        print(f"Created branch: {branch.name}")

        # --- Categories ---
        cats = {}
        for name in ["歯ブラシ", "歯間ブラシ", "フロス", "歯磨剤", "洗口液", "その他"]:
            c = Category(store_id=sid, name=name)
            db.add(c)
            await db.flush()
            cats[name] = c
        print(f"Created {len(cats)} categories")

        # --- Vendors ---
        vendor_data = [
            ("サンスター", "JP", "https://www.sunstar.com/jp/"),
            ("ライオン", "JP", "https://www.lion.co.jp/"),
            ("Ci メディカル", "JP", "https://www.ci-medical.com/"),
        ]
        vendors = {}
        for vname, country, website in vendor_data:
            v = Vendor(store_id=sid, company_name=vname, country=country, website=website)
            db.add(v)
            await db.flush()
            vendors[vname] = v
        print(f"Created {len(vendors)} vendors")

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

        # Product 1: GUM デンタルブラシ #211
        p1 = Product(
            store_id=sid,
            name="GUM デンタルブラシ #211",
            name_kana="ガム デンタルブラシ ニイチイチ",
            category_id=cats["歯ブラシ"].id,
            vendor_id=vendors["サンスター"].id,
            description="3列コンパクトヘッドのやわらかめ歯ブラシ。歯周病予防に。",
            default_amount_at_payment=Decimal("330"),
            status=ProductStatus.active,
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
            on_hand=50,
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

        await db.commit()
        print(f"Created 5 products with variants, images, and tags")
        print("Seed complete!")


if __name__ == "__main__":
    asyncio.run(seed())
