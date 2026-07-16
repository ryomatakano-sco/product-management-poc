"""Product CRUD: create (variant defaulting), edit (attribution + audit,
mig 019), archive (soft delete + stock freeze)."""

from sqlalchemy import select

from app.db import async_session
from app.models import AuditEvent
from tests.conftest import create_product


async def test_create_returns_default_variant(client):
    p = await create_product(client, on_hand=3)
    assert p["status"] == "active"
    assert len(p["variants"]) == 1
    v = p["variants"][0]
    assert v["is_default"] is True
    assert v["on_hand"] == 3
    assert p["internal_code"] and p["internal_code"].startswith("PR")


async def test_create_without_variants_autocreates_default(client):
    r = await client.post("/products", json={
        "name": "バリアントなし", "status": "draft", "item_type": "product",
        "default_amount_at_payment": "300",
    })
    assert r.status_code == 201, r.text
    p = r.json()
    assert len(p["variants"]) == 1 and p["variants"][0]["is_default"] is True


async def test_edit_updates_fields_and_writes_audit(client):
    p = await create_product(client)
    r = await client.patch(f"/products/{p['id']}", json={"name": "改名後", "unit": "本"})
    assert r.status_code == 200, r.text
    assert r.json()["name"] == "改名後"

    async with async_session() as db:
        ev = (await db.execute(
            select(AuditEvent).where(
                AuditEvent.action == "product_updated",
                AuditEvent.entity_id == p["id"],
            )
        )).scalar_one_or_none()
    assert ev is not None
    assert "name" in (ev.detail or "")


async def test_edit_noop_writes_no_audit(client):
    p = await create_product(client)
    r = await client.patch(f"/products/{p['id']}", json={"name": p["name"]})
    assert r.status_code == 200
    async with async_session() as db:
        ev = (await db.execute(
            select(AuditEvent).where(AuditEvent.action == "product_updated")
        )).scalar_one_or_none()
    assert ev is None


async def test_archive_is_soft_and_freezes_stock(client):
    p = await create_product(client, on_hand=5)
    vid = p["variants"][0]["id"]

    r = await client.delete(f"/products/{p['id']}")
    assert r.status_code == 200
    assert r.json()["status"] == "archived"

    # Archived products reject further stock movements (audit M8).
    r = await client.post(f"/variants/{vid}/inventory-adjust", json={
        "field": "on_hand", "delta": 1, "reason": "correction",
    })
    assert r.status_code == 400

    async with async_session() as db:
        ev = (await db.execute(
            select(AuditEvent).where(
                AuditEvent.action == "product_archived",
                AuditEvent.entity_id == p["id"],
            )
        )).scalar_one_or_none()
    assert ev is not None


async def test_variant_edit_writes_audit(client):
    p = await create_product(client)
    vid = p["variants"][0]["id"]
    r = await client.patch(f"/variants/{vid}", json={"sku": "SKU-001", "price": "780"})
    assert r.status_code == 200, r.text
    assert r.json()["sku"] == "SKU-001"
    async with async_session() as db:
        ev = (await db.execute(
            select(AuditEvent).where(
                AuditEvent.action == "variant_updated",
                AuditEvent.entity_id == vid,
            )
        )).scalar_one_or_none()
    assert ev is not None
