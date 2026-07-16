"""A5: correction telemetry — a product saved from an AI session records
per-field AI-vs-final rows, marking overrides vs acceptances."""

from sqlalchemy import select

from app.db import async_session
from app.models.ai_session import AiCorrection


async def _ai_session(client, title="パナビア ペースト"):
    r = await client.post("/ai-suggestions", json={"title": title})
    assert r.status_code == 201, r.text
    return r.json()


async def test_saving_with_override_records_correction(client):
    sess = await _ai_session(client)
    mock_title = sess["options"]["title"][0]["value"]

    r = await client.post("/products", json={
        "name": "ユーザーが書き換えた商品名",  # override the AI title
        "status": "draft", "item_type": "product",
        "ai_session_id": sess["id"],
    })
    assert r.status_code == 201, r.text

    async with async_session() as db:
        rows = (await db.execute(
            select(AiCorrection).where(AiCorrection.session_id == sess["id"])
        )).scalars().all()
    assert rows, "no telemetry rows written"
    by_field = {r.field_name: r for r in rows}
    assert "title" in by_field
    t = by_field["title"]
    assert t.accepted is False
    assert t.ai_value == mock_title[:500]
    assert t.final_value == "ユーザーが書き換えた商品名"
    assert t.input_title == "パナビア ペースト"


async def test_saving_ai_title_verbatim_records_acceptance(client):
    sess = await _ai_session(client)
    mock_title = sess["options"]["title"][0]["value"]

    r = await client.post("/products", json={
        "name": mock_title,
        "status": "draft", "item_type": "product",
        "ai_session_id": sess["id"],
    })
    assert r.status_code == 201, r.text

    async with async_session() as db:
        row = (await db.execute(
            select(AiCorrection).where(
                AiCorrection.session_id == sess["id"],
                AiCorrection.field_name == "title",
            )
        )).scalar_one()
    assert row.accepted is True


async def test_dev_readout_reports_accept_rate(client):
    sess = await _ai_session(client)
    await client.post("/products", json={
        "name": "別名で保存", "status": "draft", "item_type": "product",
        "ai_session_id": sess["id"],
    })
    import os
    r = await client.get("/dev/ai-corrections", headers={
        "X-Dev-Password": os.environ.get("DEV_PANEL_PASSWORD", ""),
    })
    assert r.status_code == 200, r.text
    body = r.json()
    assert "title" in body["accept_rate_by_field"]
    assert body["recent"], "recent rows missing"
