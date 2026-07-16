"""Inventory adjustment: the atomic non-negative guard (services/stock.py)
and the staff→approval workflow (mig 018) — the path that once silently
bypassed approval via the un-imported-annotation FastAPI pitfall."""

from sqlalchemy import select, func

from app.db import async_session
from app.models import ApprovalRequest
from tests.conftest import create_product


async def _get_variant(client, pid):
    r = await client.get(f"/products/{pid}")
    return r.json()["variants"][0]


async def test_adjust_increases_on_hand(client):
    p = await create_product(client, on_hand=0)
    vid = p["variants"][0]["id"]
    r = await client.post(f"/variants/{vid}/inventory-adjust", json={
        "field": "on_hand", "delta": 7, "reason": "correction",
    })
    assert r.status_code == 201, r.text
    v = await _get_variant(client, p["id"])
    assert v["on_hand"] == 7


async def test_negative_result_is_rejected_atomically(client):
    p = await create_product(client, on_hand=3)
    vid = p["variants"][0]["id"]
    r = await client.post(f"/variants/{vid}/inventory-adjust", json={
        "field": "on_hand", "delta": -10, "reason": "correction",
    })
    assert r.status_code == 400
    # Stock unchanged — the guard is in the UPDATE itself, not read-then-write.
    v = await _get_variant(client, p["id"])
    assert v["on_hand"] == 3


async def test_staff_adjust_goes_to_approval_not_stock(anon_client):
    """A logged-in staff member's manual adjustment must NOT touch stock —
    it becomes a pending approval request (regression: FastAPI silent-
    annotation bug once let staff writes through unchecked)."""
    r = await anon_client.post("/auth/login", json={
        "email": "staff@test.example", "password": "staff-pw",
    })
    assert r.status_code == 200

    p = await create_product(anon_client, on_hand=2)
    vid = p["variants"][0]["id"]
    r = await anon_client.post(f"/variants/{vid}/inventory-adjust", json={
        "field": "on_hand", "delta": 5, "reason": "correction",
    })
    assert r.status_code in (200, 201, 202), r.text

    v = (await anon_client.get(f"/products/{p['id']}")).json()["variants"][0]
    assert v["on_hand"] == 2, "staff adjust must not change stock directly"

    async with async_session() as db:
        n = (await db.execute(
            select(func.count(ApprovalRequest.id)).where(
                ApprovalRequest.kind == "inventory_adjust",
            )
        )).scalar_one()
    assert n == 1
