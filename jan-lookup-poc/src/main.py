"""CLI entry point for JAN code lookup feasibility test."""

from __future__ import annotations

import argparse
import asyncio
import logging
import time
from pathlib import Path

from dotenv import load_dotenv

from runner import run_all
from reporter import generate_summary

DEFAULT_MODEL = "gpt-4.1"  # Best balance of capability and cost for web search + extraction

# Project root: resolve relative to the script location so it works from any CWD
PROJECT_ROOT = Path(__file__).resolve().parent.parent


def load_jan_codes(path: Path) -> list[str]:
    """Load JAN codes from a text file. Skips comments (#) and blank lines."""
    codes: list[str] = []
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        codes.append(line)
    return codes


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="JAN code lookup feasibility test for dental products"
    )
    parser.add_argument(
        "--input",
        type=Path,
        default=PROJECT_ROOT / "inputs" / "jan_codes.txt",
        help="Path to JAN codes file (default: inputs/jan_codes.txt)",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=None,
        help="Only process first N JAN codes",
    )
    parser.add_argument(
        "--model",
        type=str,
        default=DEFAULT_MODEL,
        help=f"OpenAI model to use (default: {DEFAULT_MODEL})",
    )
    parser.add_argument(
        "--concurrency",
        type=int,
        default=1,
        help="Number of concurrent lookups (default: 1)",
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=PROJECT_ROOT / "outputs",
        help="Output directory (default: outputs/)",
    )
    return parser.parse_args()


def main() -> None:
    # Load .env from project root
    load_dotenv(PROJECT_ROOT / ".env")
    args = parse_args()

    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    )

    # Load JAN codes
    jan_codes = load_jan_codes(args.input)
    if args.limit:
        jan_codes = jan_codes[: args.limit]

    if not jan_codes:
        print("No JAN codes to process.")
        return

    print(f"Loaded {len(jan_codes)} JAN code(s). Model: {args.model}, Concurrency: {args.concurrency}")
    print("=" * 60)

    # Run
    start = time.time()
    results = asyncio.run(
        run_all(
            jan_codes=jan_codes,
            model=args.model,
            concurrency=args.concurrency,
            output_dir=args.output_dir,
        )
    )
    wall_time = time.time() - start

    print("=" * 60)

    # Generate report
    summary = generate_summary(
        results=results,
        jan_codes=jan_codes,
        model=args.model,
        wall_time_s=wall_time,
        output_dir=args.output_dir,
    )
    print(f"\nReport written to {args.output_dir / 'summary.md'}")
    print(f"All results written to {args.output_dir / 'all_results.json'}")
    print(f"Individual results in {args.output_dir / 'results/'}")
    print(f"\nTotal wall time: {wall_time:.1f}s")


def cli() -> None:
    """Entry point for pyproject.toml console_scripts."""
    main()


if __name__ == "__main__":
    main()
