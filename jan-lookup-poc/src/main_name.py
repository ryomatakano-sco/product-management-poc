"""CLI entry point for product-name-based lookup feasibility test."""

from __future__ import annotations

import argparse
import asyncio
import logging
import time
from pathlib import Path

from dotenv import load_dotenv

from runner import run_all_names
from reporter import generate_name_summary

DEFAULT_MODEL = "gpt-4.1"

PROJECT_ROOT = Path(__file__).resolve().parent.parent


def load_product_names(path: Path) -> list[str]:
    """Load product names from a text file. Skips comments (#) and blank lines."""
    names: list[str] = []
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        names.append(line)
    return names


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Product name lookup feasibility test for dental products"
    )
    parser.add_argument(
        "--input",
        type=Path,
        default=PROJECT_ROOT / "inputs" / "product_names.txt",
        help="Path to product names file (default: inputs/product_names.txt)",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=None,
        help="Only process first N product names",
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
    load_dotenv(PROJECT_ROOT / ".env")
    args = parse_args()

    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    )

    product_names = load_product_names(args.input)
    if args.limit:
        product_names = product_names[: args.limit]

    if not product_names:
        print("No product names to process.")
        return

    print(f"Loaded {len(product_names)} product name(s). Model: {args.model}, Concurrency: {args.concurrency}")
    print("=" * 60)

    start = time.time()
    results = asyncio.run(
        run_all_names(
            product_names=product_names,
            model=args.model,
            concurrency=args.concurrency,
            output_dir=args.output_dir,
        )
    )
    wall_time = time.time() - start

    print("=" * 60)

    generate_name_summary(
        results=results,
        product_names=product_names,
        model=args.model,
        wall_time_s=wall_time,
        output_dir=args.output_dir,
    )
    print(f"\nReport written to {args.output_dir / 'summary.md'}")
    print(f"All results written to {args.output_dir / 'all_results.json'}")
    print(f"Individual results in {args.output_dir / 'results/'}")
    print(f"\nTotal wall time: {wall_time:.1f}s")


if __name__ == "__main__":
    main()
