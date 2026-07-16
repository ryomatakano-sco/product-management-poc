"""C4: query counts must not scale with item count on the batched tag
paths. C5: the per-store daily AI cap returns 429 past the limit."""

from sqlalchemy import event

from app.config import settings
from app.db import engine


class QueryCounter:
    """Counts statements on the shared engine (executemany counts once —
    that's the point of batching)."""

    def __init__(self):
        self.count = 0

    def __enter__(self):
        self._hook = lambda *a, **k: setattr(self, "count", self.count + 1)
        event.listen(engine.sync_engine, "before_cursor_execute", self._hook)
        return self

    def __exit__(self, *exc):
        event.remove(engine.sync_engine, "before_cursor_execute", self._hook)


async def _create_with_tags(client, name, tags):
    r = await client.post("/products", json={
        "name": name, "status": "active", "item_type": "product",
        "tags": tags,
    })
    assert r.status_code == 201, r.text
    return r.json()


async def test_product_create_query_count_flat_in_tags(client):
    # Warm up name-uniqueness caches etc. so both measured runs are alike.
    await _create_with_tags(client, "ウォームアップ", ["w1"])

    with QueryCounter() as small:
        await _create_with_tags(client, "タグ2個", ["a1", "a2"])
    with QueryCounter() as large:
        await _create_with_tags(client, "タグ10個", [f"b{i}" for i in range(10)])

    assert large.count == small.count, (
        f"query count scales with tag count: {small.count} → {large.count}"
    )


async def test_po_create_query_count_flat_in_tags(client):
    from tests.conftest import create_product
    p = await create_product(client)
    vid = p["variants"][0]["id"]

    async def _po(tags):
        r = await client.post("/purchase-orders", json={
            "supplier_vendor_id": 1, "destination_branch_id": 1,
            "items": [{"variant_id": vid, "quantity_ordered": 1, "unit_cost": "100"}],
            "tags": tags,
        })
        assert r.status_code == 201, r.text

    await _po(["w"])  # warm-up
    with QueryCounter() as small:
        await _po(["c1", "c2"])
    with QueryCounter() as large:
        await _po([f"d{i}" for i in range(10)])
    assert large.count == small.count, (
        f"query count scales with tag count: {small.count} → {large.count}"
    )


async def test_ai_daily_cap_returns_429(client):
    original = settings.ai_daily_cap
    settings.ai_daily_cap = 2
    try:
        for _ in range(2):
            r = await client.post("/ai-suggestions", json={"title": "テスト商品"})
            assert r.status_code == 201, r.text
        r = await client.post("/ai-suggestions", json={"title": "テスト商品"})
        assert r.status_code == 429
        assert "上限" in r.json()["detail"]
    finally:
        settings.ai_daily_cap = original


async def test_compare_requires_auth(anon_client):
    """/compare spends money across up to 6 models — it must not be callable
    without auth (it was, before review C5)."""
    r = await anon_client.post("/ai-suggestions/compare", json={
        "title": "テスト", "models": ["gpt-4.1-mini"],
    })
    assert r.status_code == 400  # no session, no X-Store-Id → rejected
