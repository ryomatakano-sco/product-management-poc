"""Async runner: processes JAN codes with retry and concurrency control."""

from __future__ import annotations

import asyncio
import json
import logging
import time
from pathlib import Path

from agents import Runner

import re

from agent import (
    create_search_agent,
    create_extraction_agent,
    create_name_search_agent,
    create_name_extraction_agent,
)
from schema import ProductLookupResult, ProductNameLookupResult

logger = logging.getLogger(__name__)

DEFAULT_MAX_RETRIES = 3
BACKOFF_BASE = 2.0  # seconds


async def lookup_jan(
    jan: str,
    model: str,
    max_retries: int = DEFAULT_MAX_RETRIES,
) -> ProductLookupResult:
    """Look up a single JAN code using the two-agent pattern.

    Returns a ProductLookupResult (possibly with found=false on search failure).
    Raises on exhausted retries.
    """
    search_agent = create_search_agent(model)
    extraction_agent = create_extraction_agent(model)

    user_query = f"JANコード: {jan}\nこの商品を検索して情報を収集してください。"

    last_error: Exception | None = None
    for attempt in range(1, max_retries + 1):
        try:
            # Step 1: web search (plain text)
            search_result = await Runner.run(search_agent, user_query)
            raw_text: str = search_result.final_output

            # Step 2: structured extraction
            extraction_input = f"JANコード: {jan}\n\n以下は検索エージェントの出力です:\n\n{raw_text}"
            extraction_result = await Runner.run(extraction_agent, extraction_input)
            product: ProductLookupResult = extraction_result.final_output

            # Ensure jan_code is set correctly
            product.jan_code = jan
            return product

        except Exception as e:
            last_error = e
            if attempt < max_retries:
                wait = BACKOFF_BASE**attempt
                logger.warning(
                    "JAN %s attempt %d/%d failed: %s. Retrying in %.1fs...",
                    jan,
                    attempt,
                    max_retries,
                    e,
                    wait,
                )
                await asyncio.sleep(wait)
            else:
                logger.error(
                    "JAN %s failed after %d attempts: %s",
                    jan,
                    max_retries,
                    e,
                )
    raise last_error  # type: ignore[misc]


async def run_all(
    jan_codes: list[str],
    model: str,
    concurrency: int,
    output_dir: Path,
    max_retries: int = DEFAULT_MAX_RETRIES,
) -> list[ProductLookupResult | None]:
    """Process all JAN codes with bounded concurrency.

    Returns a list parallel to jan_codes: ProductLookupResult or None (on error).
    Writes individual JSON files as it goes.
    """
    results_dir = output_dir / "results"
    results_dir.mkdir(parents=True, exist_ok=True)

    semaphore = asyncio.Semaphore(concurrency)
    total = len(jan_codes)
    results: list[ProductLookupResult | None] = [None] * total

    async def process(idx: int, jan: str) -> None:
        async with semaphore:
            print(f"[{idx + 1}/{total}] {jan} ...", flush=True)
            start = time.time()
            try:
                result = await lookup_jan(jan, model, max_retries)
                results[idx] = result
                elapsed = time.time() - start
                grounded = result.grounded_count()
                total_f = result.total_fields()
                status = "found=true" if result.found else "found=false"
                if result.found:
                    print(
                        f"  \u2713 {status}, {grounded}/{total_f} fields grounded ({elapsed:.1f}s)"
                    )
                else:
                    print(f"  \u2717 not found ({elapsed:.1f}s)")

                # Write individual JSON
                out_path = results_dir / f"{jan}.json"
                out_path.write_text(
                    result.model_dump_json(indent=2),
                    encoding="utf-8",
                )

            except Exception as e:
                elapsed = time.time() - start
                print(f"  \u2717 ERROR: {e} ({elapsed:.1f}s)")
                logger.error("JAN %s failed: %s", jan, e, exc_info=True)

    tasks = [process(i, jan) for i, jan in enumerate(jan_codes)]
    await asyncio.gather(*tasks)

    return results


# ---------------------------------------------------------------------------
# Product-name-based lookup
# ---------------------------------------------------------------------------

def _sanitize_filename(name: str, max_len: int = 60) -> str:
    """Turn a product name into a safe filename fragment."""
    s = re.sub(r'[\\/:*?"<>|\s]+', "_", name)
    return s[:max_len].rstrip("_")


async def lookup_product_name(
    name: str,
    model: str,
    max_retries: int = DEFAULT_MAX_RETRIES,
) -> ProductNameLookupResult:
    """Look up a single product name using the two-agent pattern."""
    search_agent = create_name_search_agent(model)
    extraction_agent = create_name_extraction_agent(model)

    user_query = f"商品名: {name}\nこの商品を検索して情報を収集してください。"

    last_error: Exception | None = None
    for attempt in range(1, max_retries + 1):
        try:
            search_result = await Runner.run(search_agent, user_query)
            raw_text: str = search_result.final_output

            extraction_input = f"商品名: {name}\n\n以下は検索エージェントの出力です:\n\n{raw_text}"
            extraction_result = await Runner.run(extraction_agent, extraction_input)
            product: ProductNameLookupResult = extraction_result.final_output

            product.product_name = name
            return product

        except Exception as e:
            last_error = e
            if attempt < max_retries:
                wait = BACKOFF_BASE**attempt
                logger.warning(
                    "Product '%s' attempt %d/%d failed: %s. Retrying in %.1fs...",
                    name, attempt, max_retries, e, wait,
                )
                await asyncio.sleep(wait)
            else:
                logger.error(
                    "Product '%s' failed after %d attempts: %s",
                    name, max_retries, e,
                )
    raise last_error  # type: ignore[misc]


async def run_all_names(
    product_names: list[str],
    model: str,
    concurrency: int,
    output_dir: Path,
    max_retries: int = DEFAULT_MAX_RETRIES,
) -> list[ProductNameLookupResult | None]:
    """Process all product names with bounded concurrency."""
    results_dir = output_dir / "results"
    results_dir.mkdir(parents=True, exist_ok=True)

    semaphore = asyncio.Semaphore(concurrency)
    total = len(product_names)
    results: list[ProductNameLookupResult | None] = [None] * total

    async def process(idx: int, name: str) -> None:
        async with semaphore:
            print(f"[{idx + 1}/{total}] {name} ...", flush=True)
            start = time.time()
            try:
                result = await lookup_product_name(name, model, max_retries)
                results[idx] = result
                elapsed = time.time() - start
                grounded = result.grounded_count()
                total_f = result.total_fields()
                if result.found:
                    print(
                        f"  \u2713 found=true, {grounded}/{total_f} fields grounded ({elapsed:.1f}s)"
                    )
                else:
                    print(f"  \u2717 not found ({elapsed:.1f}s)")

                safe_name = _sanitize_filename(name)
                out_path = results_dir / f"{idx + 1:03d}_{safe_name}.json"
                out_path.write_text(
                    result.model_dump_json(indent=2),
                    encoding="utf-8",
                )

            except Exception as e:
                elapsed = time.time() - start
                print(f"  \u2717 ERROR: {e} ({elapsed:.1f}s)")
                logger.error("Product '%s' failed: %s", name, e, exc_info=True)

    tasks = [process(i, name) for i, name in enumerate(product_names)]
    await asyncio.gather(*tasks)

    return results
