"""Model-vs-latency benchmark over the live POST /ai-suggestions/compare.

Runs each JAN in JANS through every model in MODELS via the existing
compare endpoint (which fans out per-model in parallel server-side), then
writes a comparison report so we can answer "which model is the best
lowest-cost / lowest-latency for production search?"

Outputs land in jan-lookup-poc/outputs/ (gitignored):
    model-bench-<YYYYMMDD-HHMM>.md    human-readable summary + matrix
    model-bench-<YYYYMMDD-HHMM>.json  raw responses for later analysis

Usage:
    cd jan-lookup-poc/src
    PYTHONIOENCODING=utf-8 python bench_models.py

Prerequisites:
    1. Backend running at http://127.0.0.1:8000 (scripts\\dev.bat).
    2. OPENAI_API_KEY set in backend/.env or environment.
    3. ~5 minutes wall-time and ~$0.75 of OpenAI credit.

No imports from the rest of the PoC — just stdlib + urllib. Keeps the
script trivially runnable from anywhere without touching backend internals.
"""

from __future__ import annotations

import json
import os
import statistics
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime
from pathlib import Path

# ---------------------------------------------------------------------------
# Configuration — tweak and re-run.
# ---------------------------------------------------------------------------

# JANs picked from JanCode.docx (2026-05-26 user data).
# 3 "found" + 2 "timed out" → exposes both happy-path and worst-case latency.
JANS: list[tuple[str, str]] = [
    ("4901616213371", "ガム・しかんブラシ (found in prior run)"),
    ("4901616216044", "ガム・プレイ カラーキャップ (found)"),
    ("4901616968790", "オーラ2me ハブラシ 3本パック (found)"),
    ("4901616215351", "TIMED OUT in prior run"),
    ("4901616215474", "TIMED OUT in prior run"),
]

# Search-capable models worth measuring.
# Skips nano/o3-mini (capability matrix fast-fails them), gpt-5 (3-min calls
# in prior arena), o4-mini (zero jan_verified hits in prior arena).
MODELS: list[str] = [
    "gpt-4.1",
    "gpt-4.1-mini",
    "gpt-4o",
    "gpt-4o-mini",
    "gpt-5-mini",
]

API_BASE = os.environ.get("PLX_API_BASE", "http://127.0.0.1:8000")
STORE_ID = os.environ.get("PLX_STORE_ID", "1")
# Per-JAN HTTP timeout. The compare endpoint runs models in parallel
# server-side, so the wall time is bounded by the slowest model. Give it
# room for gpt-5-mini's ~2 min worst-case plus headroom.
REQUEST_TIMEOUT_S = 300

OUTPUTS_DIR = Path(__file__).resolve().parent.parent / "outputs"


# ---------------------------------------------------------------------------
# HTTP helper — urllib so this script has zero pip deps.
# ---------------------------------------------------------------------------

def _post_compare(jan: str, models: list[str]) -> dict:
    body = json.dumps({"jan": jan, "models": models}).encode("utf-8")
    req = urllib.request.Request(
        f"{API_BASE}/ai-suggestions/compare",
        data=body,
        headers={
            "Content-Type": "application/json",
            "X-Store-Id": STORE_ID,
        },
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=REQUEST_TIMEOUT_S) as resp:
        return json.loads(resp.read().decode("utf-8"))


def _preflight() -> None:
    """Fail loud if the backend isn't up — saves a long wait on a typo."""
    try:
        with urllib.request.urlopen(f"{API_BASE}/dev/status", timeout=5) as resp:
            status = json.loads(resp.read().decode("utf-8"))
    except (urllib.error.URLError, TimeoutError) as e:
        print(f"ERROR: backend at {API_BASE} is not responding ({e}).", file=sys.stderr)
        print("Start it with scripts\\dev.bat and re-run.", file=sys.stderr)
        sys.exit(1)
    ai_mode = (status.get("ai") or {}).get("mode")
    if ai_mode != "real":
        print(f"WARNING: ai mode = {ai_mode!r} (expected 'real').", file=sys.stderr)
        print("Set OPENAI_API_KEY in backend/.env to get real measurements.", file=sys.stderr)
        # Continue anyway — mock results have latency too, just not meaningful.


# ---------------------------------------------------------------------------
# Run + collect.
# ---------------------------------------------------------------------------

def _run_all() -> list[dict]:
    """Returns a flat list of cell dicts (one per JAN×model)."""
    cells = []
    for i, (jan, label) in enumerate(JANS, 1):
        print(f"[{i}/{len(JANS)}] JAN {jan} — {label}")
        t0 = time.perf_counter()
        try:
            resp = _post_compare(jan, MODELS)
        except Exception as e:  # noqa: BLE001
            elapsed = time.perf_counter() - t0
            print(f"    ERROR after {elapsed:.1f}s: {e}")
            for m in MODELS:
                cells.append({
                    "jan": jan, "label": label, "model": m,
                    "found": False, "wall_time_ms": None,
                    "candidates_count": 0, "jan_verified_count": 0,
                    "total_cost_usd": None,
                    "error_message": f"HTTP error: {e}",
                })
            continue
        wall = time.perf_counter() - t0
        print(f"    HTTP round-trip: {wall:.1f}s")
        for r in resp.get("results", []):
            cells.append({
                "jan": jan, "label": label,
                "model": r.get("model"),
                "found": r.get("found", False),
                "wall_time_ms": r.get("wall_time_ms"),
                "candidates_count": len(r.get("candidates") or []),
                "jan_verified_count": sum(
                    1 for c in (r.get("candidates") or []) if c.get("jan_verified")
                ),
                "total_cost_usd": r.get("total_cost_usd"),
                "error_message": r.get("error_message"),
            })
            # Inline per-cell echo so progress is visible even without the
            # final report.
            model = r.get("model", "?")
            ms = r.get("wall_time_ms")
            ms_s = f"{ms/1000:.1f}s" if isinstance(ms, (int, float)) else "—"
            usd = r.get("total_cost_usd")
            usd_s = f"${usd:.4f}" if isinstance(usd, (int, float)) else "—"
            status = "✓" if r.get("found") else ("✗" if not r.get("error_message") else "!")
            print(f"      {status} {model:14s} {ms_s:>7s} {usd_s}")
    return cells


# ---------------------------------------------------------------------------
# Reporting.
# ---------------------------------------------------------------------------

def _per_model_summary(cells: list[dict]) -> list[dict]:
    by_model: dict[str, list[dict]] = {}
    for c in cells:
        by_model.setdefault(c["model"], []).append(c)
    rows = []
    for model, cs in by_model.items():
        times = [c["wall_time_ms"] for c in cs if isinstance(c["wall_time_ms"], (int, float))]
        costs = [c["total_cost_usd"] for c in cs if isinstance(c["total_cost_usd"], (int, float))]
        rows.append({
            "model": model,
            "runs": len(cs),
            "found": sum(1 for c in cs if c["found"]),
            "errors": sum(1 for c in cs if c.get("error_message")),
            "avg_ms": int(statistics.mean(times)) if times else None,
            "median_ms": int(statistics.median(times)) if times else None,
            "max_ms": max(times) if times else None,
            "total_usd": round(sum(costs), 4) if costs else 0.0,
            "total_candidates": sum(c["candidates_count"] for c in cs),
            "jan_verified": sum(c["jan_verified_count"] for c in cs),
        })
    # Sort by (found-rate desc, median latency asc) so the "best lowest" is at top.
    rows.sort(key=lambda r: (-(r["found"] or 0), r["median_ms"] or 10**9))
    return rows


def _fmt_ms(v) -> str:
    if v is None:
        return "—"
    return f"{v/1000:.1f}s"


def _fmt_usd(v) -> str:
    if v is None:
        return "—"
    return f"${v:.4f}"


def _build_markdown(cells: list[dict], summary: list[dict]) -> str:
    out: list[str] = []
    now_jst = datetime.now().strftime("%Y-%m-%d %H:%M %Z").strip()
    out.append("# Model-vs-latency benchmark\n")
    out.append(f"- Timestamp: {now_jst}")
    out.append(f"- API: `{API_BASE}` (store_id={STORE_ID})")
    out.append(f"- JANs tested: {len(JANS)}")
    out.append(f"- Models: {', '.join(MODELS)}")
    out.append("")

    # Per-model summary
    out.append("## Per-model summary\n")
    out.append("Sorted by (found-rate desc, median latency asc) — first row is the **best lowest**.\n")
    out.append("| Model | Found / runs | Errors | Median latency | Avg | Max | Total $ | Candidates | JAN-verified |")
    out.append("|-------|--------------|--------|----------------|-----|-----|---------|------------|--------------|")
    for r in summary:
        out.append(
            f"| `{r['model']}` "
            f"| {r['found']}/{r['runs']} "
            f"| {r['errors']} "
            f"| {_fmt_ms(r['median_ms'])} "
            f"| {_fmt_ms(r['avg_ms'])} "
            f"| {_fmt_ms(r['max_ms'])} "
            f"| ${r['total_usd']:.4f} "
            f"| {r['total_candidates']} "
            f"| {r['jan_verified']} |"
        )
    out.append("")

    # Per-JAN matrix
    out.append("## Per-JAN × model matrix\n")
    header = "| JAN | Label | " + " | ".join(f"`{m}`" for m in MODELS) + " |"
    sep    = "|-----|-------|" + "|".join(["---"] * len(MODELS)) + "|"
    out.append(header)
    out.append(sep)
    by_jan: dict[str, list[dict]] = {}
    for c in cells:
        by_jan.setdefault(c["jan"], []).append(c)
    for jan, label in JANS:
        row = [f"| `{jan}` | {label}"]
        for m in MODELS:
            cell = next((c for c in by_jan.get(jan, []) if c["model"] == m), None)
            if cell is None:
                row.append("—")
                continue
            if cell.get("error_message"):
                row.append(f"⏱ {cell['error_message'][:30]}")
            elif not cell["found"]:
                row.append(f"✗ not found ({_fmt_ms(cell['wall_time_ms'])})")
            else:
                row.append(
                    f"✓ {_fmt_ms(cell['wall_time_ms'])} "
                    f"{_fmt_usd(cell['total_cost_usd'])} "
                    f"({cell['candidates_count']} cand)"
                )
        out.append(" | ".join(row) + " |")
    out.append("")

    # Raw JSON tail
    out.append("## Raw cells (JSON)\n")
    out.append("<details><summary>Click to expand</summary>\n")
    out.append("```json")
    out.append(json.dumps(cells, ensure_ascii=False, indent=2))
    out.append("```")
    out.append("</details>")
    return "\n".join(out)


def main() -> None:
    _preflight()
    OUTPUTS_DIR.mkdir(parents=True, exist_ok=True)
    print(f"Bench: {len(JANS)} JANs × {len(MODELS)} models = {len(JANS)*len(MODELS)} cells")
    print(f"API base: {API_BASE}\n")

    started = time.perf_counter()
    cells = _run_all()
    elapsed = time.perf_counter() - started

    summary = _per_model_summary(cells)
    stamp = datetime.now().strftime("%Y%m%d-%H%M")
    md_path = OUTPUTS_DIR / f"model-bench-{stamp}.md"
    json_path = OUTPUTS_DIR / f"model-bench-{stamp}.json"

    md_path.write_text(_build_markdown(cells, summary), encoding="utf-8")
    json_path.write_text(
        json.dumps({"cells": cells, "summary": summary}, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    print()
    print(f"Wall time: {elapsed:.1f}s")
    print(f"Wrote: {md_path}")
    print(f"Wrote: {json_path}")
    print()
    print("Per-model summary (sorted: best lowest first):")
    for r in summary:
        print(
            f"  {r['model']:14s}  "
            f"found {r['found']}/{r['runs']}  "
            f"median {_fmt_ms(r['median_ms'])}  "
            f"total ${r['total_usd']:.4f}"
        )


if __name__ == "__main__":
    main()
