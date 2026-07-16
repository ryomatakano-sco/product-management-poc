"""Sales: record decrements stock, refund restores it exactly once."""

from tests.conftest import create_product


async def _sell(client, vid, qty=2):
    r = await client.post("/sales", json={
        "branch_id": 1, "variant_id": vid, "quantity": qty, "unit_price": "500",
        "payment_method": "cash",
    })
    return r


async def test_sale_decrements_stock(client):
    p = await create_product(client, on_hand=5)
    vid = p["variants"][0]["id"]
    r = await _sell(client, vid, qty=2)
    assert r.status_code == 201, r.text
    v = (await client.get(f"/products/{p['id']}")).json()["variants"][0]
    assert v["on_hand"] == 3


async def test_oversell_rejected(client):
    p = await create_product(client, on_hand=1)
    vid = p["variants"][0]["id"]
    r = await _sell(client, vid, qty=2)
    assert r.status_code == 400
    v = (await client.get(f"/products/{p['id']}")).json()["variants"][0]
    assert v["on_hand"] == 1


async def test_refund_restores_stock_once(client):
    p = await create_product(client, on_hand=5)
    vid = p["variants"][0]["id"]
    sale = (await _sell(client, vid, qty=2)).json()

    r = await client.post(f"/sales/{sale['id']}/refund", json={"reason": "テスト返品"})
    assert r.status_code == 201, r.text
    refund = r.json()
    assert refund["quantity"] == -2
    v = (await client.get(f"/products/{p['id']}")).json()["variants"][0]
    assert v["on_hand"] == 5

    # Double refund must be rejected and stock unchanged.
    r = await client.post(f"/sales/{sale['id']}/refund")
    assert r.status_code == 400
    v = (await client.get(f"/products/{p['id']}")).json()["variants"][0]
    assert v["on_hand"] == 5

    # Refund rows themselves can't be refunded.
    r = await client.post(f"/sales/{refund['id']}/refund")
    assert r.status_code == 400
