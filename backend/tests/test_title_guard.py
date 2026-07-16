"""A4: title-search plausibility guard. The JAN path has strict-citation +
wrong-product guards; this pins the equivalent for 商品名 searches over 10
realistic queries — a title query must never silently surface candidates
that share nothing with the query."""

from types import SimpleNamespace

from app.routers.ai_suggestions import _title_tokens, title_mismatch_drop


def _cands(**by_field):
    return [SimpleNamespace(field_name=f, value=v) for f, v in by_field.items()]


# (query, candidate title/brand, should_drop)
CASES = [
    # Matching results survive — including partial / reordered / width variants.
    ("GUM デンタルブラシ #211", "ガム・デンタルブラシ #211 ふつう", False),
    ("Ora2 ミー ステインクリア", "オーラツーミー ステインクリア ペースト", False),
    ("クリニカ アドバンテージ", "クリニカアドバンテージ ハブラシ 4列", False),
    ("システマ ハグキプラス", "システマ ハグキプラス ハミガキ 90g", False),
    ("コンクールF", "コンクールF 100mL 洗口液", False),
    ("チェックアップ スタンダード", "チェックアップ standard 135g", False),
    ("ルシェロ B-20", "ルシェロ 歯ブラシ B-20 ピセラ", False),
    # Unrelated results are dropped (the silent-wrong-product class).
    ("Ora2 ステインクリア", "GUM デンタルリンス 960ml", True),
    ("ルシェロ 歯ブラシ", "モンダミン プレミアムケア", True),
    ("歯科用グローブ M", "GUM デンタルブラシ #211", True),
]


def test_title_guard_over_10_real_queries():
    for query, cand, should_drop in CASES:
        got = title_mismatch_drop(query, None, _cands(title=cand))
        assert got is should_drop, (query, cand, got)


def test_guard_never_fires_on_jan_searches():
    assert title_mismatch_drop("Ora2", "4901480072944", _cands(title="GUM")) is False


def test_guard_keeps_result_when_brand_agrees_even_if_title_differs():
    cands = _cands(title="全然違う商品名", brand="Ora2")
    assert title_mismatch_drop("Ora2 ステインクリア", None, cands) is False


def test_guard_skips_when_no_name_or_brand_candidates():
    cands = _cands(price="500")
    assert title_mismatch_drop("GUM デンタルブラシ", None, cands) is False


def test_tokenizer_normalizes_width_and_case():
    assert "gum" in _title_tokens("ＧＵＭ デンタル")
    assert "ora2" in _title_tokens("Ora2 ミー")


async def test_mock_title_search_passes_guard_end_to_end(client):
    """Mock results are canned (always Panavia) and bypass the guard — a mock
    title search must still return options for any query."""
    r = await client.post("/ai-suggestions", json={"title": "GUM デンタルブラシ"})
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["status"] == "completed"
    assert body["options"], "guard must not suppress a plausible mock result"
