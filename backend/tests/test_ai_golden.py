"""AI lookup golden set (C2).

Default (CI) mode: MOCK_AI=1 — asserts the /ai-suggestions pipeline shape
(validation, session lifecycle, option structure) deterministically and for
free. Real-recall measurement runs only when RUN_AI_GOLDEN=1 is set AND a
real key is configured — that spends OpenAI money and is for the A1/A4
measurement plan, not CI.
"""

import json
import os
from pathlib import Path

import pytest

GOLDEN = json.loads((Path(__file__).parent / "golden_jans.json").read_text(encoding="utf-8"))
CASES = GOLDEN["cases"]


async def test_lookup_requires_jan_or_title(client):
    r = await client.post("/ai-suggestions", json={})
    assert r.status_code == 400


async def test_invalid_jan_is_422_before_any_model_call(client):
    r = await client.post("/ai-suggestions", json={"jan": "4901616009671"})  # bad check digit
    assert r.status_code == 422


async def test_mock_lookup_returns_wellformed_session(client):
    r = await client.post("/ai-suggestions", json={"jan": CASES[0]["jan"]})
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["input_jan"] == CASES[0]["jan"]
    assert body["status"] in ("completed", "failed")
    assert isinstance(body["options"], dict)
    # Mock candidates must carry the per-field option structure the UI reads.
    for field, opts in body["options"].items():
        assert isinstance(opts, list), field


async def test_mock_title_lookup_wellformed(client):
    r = await client.post("/ai-suggestions", json={"title": "GUM デンタルブラシ"})
    assert r.status_code == 201, r.text
    assert r.json()["input_title"] == "GUM デンタルブラシ"


@pytest.mark.skipif(
    os.environ.get("RUN_AI_GOLDEN") != "1",
    reason="real-recall run costs OpenAI money — set RUN_AI_GOLDEN=1 explicitly",
)
async def test_real_recall_against_golden_set(client):
    """Measures hit-rate over the 20-case golden set with the real agent.
    A HIT = the returned name/brand options agree with the expected brand.
    Records the per-case outcome; asserts the pre-registered floor (≥50%
    overall) and, critically, that no cross-product result appears (the
    Ora2→GUM class)."""
    hits, misses, cross = 0, [], []
    for case in CASES:
        r = await client.post("/ai-suggestions", json={"jan": case["jan"]})
        if r.status_code != 201:
            misses.append(case["jan"]); continue
        opts = r.json()["options"]
        text = json.dumps(opts, ensure_ascii=False)
        if case["brand"] != "N/A" and case["brand"] in text:
            hits += 1
        else:
            misses.append(case["jan"])
        if case.get("note", "").startswith("cross-product") and "GUM" in text and case["brand"] != "GUM":
            cross.append(case["jan"])
    assert not cross, f"cross-product results (Ora2→GUM class): {cross}"
    assert hits / len([c for c in CASES if c["brand"] != "N/A"]) >= 0.5, (hits, misses)
