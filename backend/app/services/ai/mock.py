"""Canned mock lookup (C6 split of ai_agent.py). Active when
OPENAI_API_KEY is unset or MOCK_AI=1 — free, deterministic, same shape as a
real result so the whole UI flow works without spending money.
"""

from __future__ import annotations

from app.services.ai.schemas import ExtractionResult, FieldCandidate

# --- Mock fallback ------------------------------------------------------------

# Canned candidates returned when no OpenAI key is configured. Shape matches
# what the real agents would return: each candidate has a value, a source_url,
# a source_title, and a confidence. The router persists these the same way it
# would persist real ones, so the UI flow (modal → field options → apply) is
# identical regardless of whether AI is real or mocked.
_MOCK_CANDIDATES: list[FieldCandidate] = [
    FieldCandidate(
        field_name="title",
        value="パナビア V5 ペースト 2.5g (Aユニバーサル)",
        source_url="https://mock.example.jp/panavia-v5",
        source_title="クラレノリタケデンタル — 製品ページ (モック)",
        confidence=0.94,
    ),
    FieldCandidate(
        field_name="title",
        value="PANAVIA V5 Paste 2.5g A-Universal",
        source_url="https://mock.example.jp/jandb",
        source_title="JAN データベース (モック)",
        confidence=0.81,
    ),
    FieldCandidate(
        field_name="name_kana",
        value="パナビア ブイファイブ ペースト",
        confidence=0.85,
    ),
    FieldCandidate(
        field_name="brand",
        value="クラレノリタケデンタル",
        source_url="https://mock.example.jp/panavia-v5",
        source_title="メーカー公式 (モック)",
        confidence=0.96,
    ),
    FieldCandidate(
        field_name="category",
        value="修復材",
        source_url="https://mock.example.jp/dict",
        source_title="分類辞書 (モック)",
        confidence=0.92,
    ),
    FieldCandidate(
        field_name="barcode",
        value="4548611112233",
        source_url="https://mock.example.jp/jandb",
        source_title="JAN データベース (モック)",
        confidence=0.99,
    ),
    FieldCandidate(
        field_name="price",
        value="12800",
        source_url="https://mock.example.jp/supply",
        source_title="dental-supply.example.jp (モック)",
        confidence=0.71,
    ),
    FieldCandidate(
        field_name="description",
        value=(
            "デュアルキュア型レジンセメント。クラウン・ブリッジ・インレー・"
            "オンレー・ベニアの接着、ポストコアの装着に。"
        ),
        source_url="https://mock.example.jp/panavia-v5",
        source_title="クラレノリタケデンタル — 製品ページ (モック)",
        confidence=0.88,
    ),
]


def _mock_lookup(jan: str | None, title: str | None) -> ExtractionResult:
    """Deterministic mock data used when OPENAI_API_KEY is not set.

    The data is intentionally similar to the prototype's MOCK_AI_SUGGESTIONS
    so the demo experience matches what the design called for.
    """
    note_lines = ["[MOCK MODE] OPENAI_API_KEY is not set — returning canned data."]
    if jan:
        note_lines.append(f"  · 受け取った JAN: {jan}")
    if title:
        note_lines.append(f"  · 受け取った商品名: {title}")
    note_lines.append(
        "  · 実際の AI ルックアップを試すには .env に OPENAI_API_KEY を設定してください。"
    )
    return ExtractionResult(
        found=True,
        candidates=list(_MOCK_CANDIDATES),
        raw_search_notes="\n".join(note_lines),
    )
