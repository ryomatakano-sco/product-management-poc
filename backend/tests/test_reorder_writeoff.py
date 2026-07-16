"""B2: velocity-aware auto-draft quantities. B3: expired-lot write-off."""

from datetime import date, timedelta

from sqlalchemy import select

from app.db import async_session
from app.models.inventory import InventoryAdjustment
from app.models.lot import ProductLot
from tests.conftest import create_product


async def _adjust(client, vid, delta):
    r = await client.post(f"/variants/{vid}/inventory-adjust", json={
        "field": "on_hand", "delta": delta, "reason": "correction",
    })
    assert r.status_code == 201, r.text


async def test_auto_draft_uses_sales_velocity(client):
    # 60 sold in the last 30 days, 5 usable on hand, threshold 10
    # → spec: qty = max(60 − 5, 10*2 − 5) = 55, reason "velocity".
    p = await create_product(client, name="回転の速い商品", on_hand=60,
                             vendor_id=1)
    vid = p["variants"][0]["id"]
    r = await client.post("/sales", json={
        "branch_id": 1, "variant_id": vid, "quantity": 60, "unit_price": "300",
        "payment_method": "cash",
    })
    assert r.status_code == 201, r.text
    await _adjust(client, vid, 5)

    r = await client.post("/purchase-orders/auto-draft")
    assert r.status_code == 200, r.text
    detail = r.json()["detail"]
    lines = [ln for po in detail for ln in po["lines"] if ln["variant_id"] == vid]
    assert lines, r.text
    assert lines[0]["quantity"] == 55
    assert lines[0]["suggested_reason"] == "velocity"


async def test_auto_draft_falls_back_to_threshold_without_sales(client):
    p = await create_product(client, name="売れていない商品", on_hand=2, vendor_id=1)
    vid = p["variants"][0]["id"]
    r = await client.post("/purchase-orders/auto-draft")
    assert r.status_code == 200, r.text
    lines = [ln for po in r.json()["detail"] for ln in po["lines"] if ln["variant_id"] == vid]
    assert lines, r.text
    # threshold(5)*2 − available(2) = 8
    assert lines[0]["quantity"] == 8
    assert lines[0]["suggested_reason"] == "threshold"


async def _seed_lot(vid, qty, expiry, branch_id=1):
    async with async_session() as db:
        db.add(ProductLot(
            store_id=1, variant_id=vid, branch_id=branch_id,
            lot_number="LOT-TEST", qty_on_hand=qty, expiry_date=expiry,
        ))
        await db.commit()


async def test_write_off_expired_lots(client):
    p = await create_product(client, name="期限切れあり", on_hand=5)
    vid = p["variants"][0]["id"]
    await _seed_lot(vid, 3, date.today() - timedelta(days=1))

    r = await client.post(f"/variants/{vid}/write-off-expired")
    assert r.status_code == 201, r.text
    assert r.json()["written_off"] == 3

    v = (await client.get(f"/products/{p['id']}")).json()["variants"][0]
    assert v["on_hand"] == 2

    async with async_session() as db:
        lot = (await db.execute(
            select(ProductLot).where(ProductLot.variant_id == vid)
        )).scalar_one()
        assert lot.qty_on_hand == 0
        adj = (await db.execute(
            select(InventoryAdjustment).where(
                InventoryAdjustment.variant_id == vid,
                InventoryAdjustment.reason == "expired_write_off",
            )
        )).scalar_one()
        assert adj.delta == -3


async def test_write_off_rejects_when_nothing_expired(client):
    p = await create_product(client, name="期限内のみ", on_hand=5)
    vid = p["variants"][0]["id"]
    await _seed_lot(vid, 3, date.today() + timedelta(days=90))
    r = await client.post(f"/variants/{vid}/write-off-expired")
    assert r.status_code == 400


async def test_write_off_is_admin_only(anon_client):
    r = await anon_client.post("/auth/login", json={
        "email": "staff@test.example", "password": "staff-pw",
    })
    assert r.status_code == 200
    p = await create_product(anon_client, name="スタッフ不可", on_hand=5)
    vid = p["variants"][0]["id"]
    await _seed_lot(vid, 2, date.today() - timedelta(days=1))
    r = await anon_client.post(f"/variants/{vid}/write-off-expired")
    assert r.status_code == 403
