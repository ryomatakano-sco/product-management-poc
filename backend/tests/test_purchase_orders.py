"""PO lifecycle: draft → submit → receive bumps stock; over-receive rejected."""

from tests.conftest import create_product


async def _make_po(client, vid, qty=10):
    r = await client.post("/purchase-orders", json={
        "supplier_vendor_id": 1,
        "destination_branch_id": 1,
        "items": [{"variant_id": vid, "quantity_ordered": qty, "unit_cost": "120"}],
    })
    assert r.status_code == 201, r.text
    return r.json()


async def test_po_receive_bumps_stock(client):
    p = await create_product(client, on_hand=0)
    vid = p["variants"][0]["id"]
    po = await _make_po(client, vid, qty=10)

    r = await client.post(f"/purchase-orders/{po['id']}/submit")
    assert r.status_code == 200, r.text

    item_id = po["items"][0]["id"]
    r = await client.post(f"/purchase-orders/{po['id']}/receive", json={
        "items": [{"item_id": item_id, "quantity_received": 4}],
    })
    assert r.status_code == 200, r.text
    assert r.json()["status"] == "partially_received"

    v = (await client.get(f"/products/{p['id']}")).json()["variants"][0]
    assert v["on_hand"] == 4

    # Receive the rest → fully received.
    r = await client.post(f"/purchase-orders/{po['id']}/receive", json={
        "items": [{"item_id": item_id, "quantity_received": 6}],
    })
    assert r.status_code == 200
    assert r.json()["status"] == "received"
    v = (await client.get(f"/products/{p['id']}")).json()["variants"][0]
    assert v["on_hand"] == 10


async def test_over_receive_rejected(client):
    p = await create_product(client)
    vid = p["variants"][0]["id"]
    po = await _make_po(client, vid, qty=3)
    await client.post(f"/purchase-orders/{po['id']}/submit")
    item_id = po["items"][0]["id"]
    r = await client.post(f"/purchase-orders/{po['id']}/receive", json={
        "items": [{"item_id": item_id, "quantity_received": 5}],
    })
    assert r.status_code == 400


async def test_receive_on_draft_rejected(client):
    p = await create_product(client)
    vid = p["variants"][0]["id"]
    po = await _make_po(client, vid)
    item_id = po["items"][0]["id"]
    r = await client.post(f"/purchase-orders/{po['id']}/receive", json={
        "items": [{"item_id": item_id, "quantity_received": 1}],
    })
    assert r.status_code == 400
