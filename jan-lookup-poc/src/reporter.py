"""Generate outputs/summary.md from lookup results."""

from __future__ import annotations

import json
from datetime import datetime, timezone, timedelta
from pathlib import Path

from schema import ProductLookupResult, ProductNameLookupResult

JST = timezone(timedelta(hours=9))


def generate_summary(
    results: list[ProductLookupResult | None],
    jan_codes: list[str],
    model: str,
    wall_time_s: float,
    output_dir: Path,
) -> str:
    """Generate and write summary.md. Returns the markdown string."""

    # Separate found / not-found / error
    completed = [(jan, r) for jan, r in zip(jan_codes, results) if r is not None]
    errors = [(jan, r) for jan, r in zip(jan_codes, results) if r is None]
    found = [(jan, r) for jan, r in completed if r.found]
    not_found = [(jan, r) for jan, r in completed if not r.found]

    total = len(jan_codes)
    found_count = len(found)
    found_rate = found_count / total * 100 if total else 0

    # --- Field fill-rate ---
    # Two columns:
    #   - has_value: field has a value (Tier 3a — what users see / can edit)
    #   - grounded:  field has both value AND source_url (cited)
    field_names = ProductLookupResult.GROUNDED_FIELD_NAMES
    field_fill: dict[str, int] = {name: 0 for name in field_names}
    field_value_only: dict[str, int] = {name: 0 for name in field_names}
    for _, r in found:
        for name in field_names:
            f = getattr(r, name)
            if f.value is not None:
                field_value_only[name] += 1
            if f.value is not None and f.source_url is not None:
                field_fill[name] += 1

    field_fill_sorted = sorted(
        field_fill.items(),
        key=lambda x: (field_value_only[x[0]], x[1]),
        reverse=True,
    )

    # --- Build markdown ---
    lines: list[str] = []
    lines.append("# JAN Code Lookup Feasibility Report\n")

    # Run metadata
    lines.append("## Run Metadata\n")
    lines.append(f"- **Timestamp**: {datetime.now(JST).strftime('%Y-%m-%d %H:%M:%S JST')}")
    lines.append(f"- **Model**: {model}")
    lines.append(f"- **JANs tested**: {total}")
    lines.append(f"- **Wall time**: {wall_time_s:.1f}s")
    lines.append(f"- **Errors (agent failure)**: {len(errors)}")
    lines.append("")

    # Headline metric
    lines.append("## Headline Metric\n")
    lines.append(f"**`found=true` rate: {found_count}/{total} JANs = {found_rate:.0f}%**\n")

    # Field fill-rate table
    lines.append("## Field Fill Rate (among found=true JANs)\n")
    lines.append("`has_value` = field populated (Tier 3a metric). `grounded` = value AND URL.\n")
    lines.append("| Field | has_value | grounded | value rate |")
    lines.append("|-------|-----------|----------|------------|")
    for name, count in field_fill_sorted:
        v_count = field_value_only[name]
        v_rate = v_count / found_count * 100 if found_count else 0
        lines.append(
            f"| {name} | {v_count}/{found_count} | {count}/{found_count} | {v_rate:.0f}% |"
        )
    lines.append("")

    # Per-JAN table
    lines.append("## Per-JAN Results\n")
    lines.append("| JAN | Found | Grounded | Title | Top Source |")
    lines.append("|-----|-------|----------|-------|------------|")
    for jan, r in completed:
        title_val = r.title.value if r.title.value else "-"
        # Truncate long titles for table readability
        if isinstance(title_val, str) and len(title_val) > 40:
            title_val = title_val[:37] + "..."
        lines.append(
            f"| {jan} | {'Yes' if r.found else 'No'} | "
            f"{r.grounded_count()}/{r.total_fields()} | "
            f"{title_val} | {r.top_source_domain()} |"
        )
    for jan, _ in errors:
        lines.append(f"| {jan} | ERROR | - | - | - |")
    lines.append("")

    # Failure cases
    lines.append("## Failure Cases (found=false)\n")
    if not_found:
        for jan, r in not_found:
            lines.append(f"### {jan}\n")
            lines.append(f"```\n{r.raw_search_notes}\n```\n")
    else:
        lines.append("None.\n")

    # Error cases
    if errors:
        lines.append("## Agent Errors\n")
        for jan, _ in errors:
            lines.append(f"- **{jan}**: agent raised an exception (see logs)\n")
        lines.append("")

    # Conflicts
    lines.append("## Conflicts / Issues\n")
    conflict_jans = [
        (jan, r)
        for jan, r in completed
        if r.raw_search_notes and any(
            kw in r.raw_search_notes for kw in ["矛盾", "異なる", "conflict", "disagree", "不一致"]
        )
    ]
    if conflict_jans:
        for jan, r in conflict_jans:
            lines.append(f"### {jan}\n")
            lines.append(f"```\n{r.raw_search_notes}\n```\n")
    else:
        lines.append("No source conflicts detected.\n")

    # Feasibility verdict
    lines.append("## Feasibility Verdict\n")
    lines.append("> TODO: human fills this in\n")

    md = "\n".join(lines)

    # Write files
    output_dir.mkdir(parents=True, exist_ok=True)
    (output_dir / "summary.md").write_text(md, encoding="utf-8")

    # Write all_results.json
    all_results = []
    for jan, r in zip(jan_codes, results):
        if r is not None:
            all_results.append(r.model_dump())
        else:
            all_results.append({"jan_code": jan, "error": True})
    (output_dir / "all_results.json").write_text(
        json.dumps(all_results, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    return md


def generate_name_summary(
    results: list[ProductNameLookupResult | None],
    product_names: list[str],
    model: str,
    wall_time_s: float,
    output_dir: Path,
) -> str:
    """Generate and write summary.md for product-name-based lookup."""

    completed = [(n, r) for n, r in zip(product_names, results) if r is not None]
    errors = [(n, r) for n, r in zip(product_names, results) if r is None]
    found = [(n, r) for n, r in completed if r.found]
    not_found = [(n, r) for n, r in completed if not r.found]

    total = len(product_names)
    found_count = len(found)
    found_rate = found_count / total * 100 if total else 0

    field_names = ProductNameLookupResult.GROUNDED_FIELD_NAMES
    field_fill: dict[str, int] = {name: 0 for name in field_names}
    for _, r in found:
        for name in field_names:
            f = getattr(r, name)
            if f.value is not None and f.source_url is not None:
                field_fill[name] += 1

    field_fill_sorted = sorted(field_fill.items(), key=lambda x: x[1], reverse=True)

    lines: list[str] = []
    lines.append("# Product Name Lookup Feasibility Report\n")

    lines.append("## Run Metadata\n")
    lines.append(f"- **Timestamp**: {datetime.now(JST).strftime('%Y-%m-%d %H:%M:%S JST')}")
    lines.append(f"- **Model**: {model}")
    lines.append(f"- **Products tested**: {total}")
    lines.append(f"- **Wall time**: {wall_time_s:.1f}s")
    lines.append(f"- **Errors (agent failure)**: {len(errors)}")
    lines.append("")

    lines.append("## Headline Metric\n")
    lines.append(f"**`found=true` rate: {found_count}/{total} products = {found_rate:.0f}%**\n")

    lines.append("## Field Fill Rate (among found=true products)\n")
    lines.append("| Field | Grounded | Rate |")
    lines.append("|-------|----------|------|")
    for name, count in field_fill_sorted:
        rate = count / found_count * 100 if found_count else 0
        lines.append(f"| {name} | {count}/{found_count} | {rate:.0f}% |")
    lines.append("")

    lines.append("## Per-Product Results\n")
    lines.append("| Product Name | Found | Grounded | JAN (if found) | Top Source |")
    lines.append("|--------------|-------|----------|----------------|------------|")
    for pname, r in completed:
        display_name = pname if len(pname) <= 30 else pname[:27] + "..."
        jan_val = r.jan_code.value if r.jan_code.value else "-"
        lines.append(
            f"| {display_name} | {'Yes' if r.found else 'No'} | "
            f"{r.grounded_count()}/{r.total_fields()} | "
            f"{jan_val} | {r.top_source_domain()} |"
        )
    for pname, _ in errors:
        display_name = pname if len(pname) <= 30 else pname[:27] + "..."
        lines.append(f"| {display_name} | ERROR | - | - | - |")
    lines.append("")

    lines.append("## Failure Cases (found=false)\n")
    if not_found:
        for pname, r in not_found:
            lines.append(f"### {pname}\n")
            lines.append(f"```\n{r.raw_search_notes}\n```\n")
    else:
        lines.append("None.\n")

    if errors:
        lines.append("## Agent Errors\n")
        for pname, _ in errors:
            lines.append(f"- **{pname}**: agent raised an exception (see logs)\n")
        lines.append("")

    lines.append("## Conflicts / Issues\n")
    conflict_items = [
        (n, r)
        for n, r in completed
        if r.raw_search_notes and any(
            kw in r.raw_search_notes for kw in ["矛盾", "異なる", "conflict", "disagree", "不一致"]
        )
    ]
    if conflict_items:
        for pname, r in conflict_items:
            lines.append(f"### {pname}\n")
            lines.append(f"```\n{r.raw_search_notes}\n```\n")
    else:
        lines.append("No source conflicts detected.\n")

    lines.append("## Feasibility Verdict\n")
    lines.append("> TODO: human fills this in\n")

    md = "\n".join(lines)

    output_dir.mkdir(parents=True, exist_ok=True)
    (output_dir / "summary.md").write_text(md, encoding="utf-8")

    all_results = []
    for pname, r in zip(product_names, results):
        if r is not None:
            all_results.append(r.model_dump())
        else:
            all_results.append({"product_name": pname, "error": True})
    (output_dir / "all_results.json").write_text(
        json.dumps(all_results, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    return md
