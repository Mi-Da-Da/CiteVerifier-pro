r"""Measure PDF extraction and LLM reference parsing separately.

Usage (from the project root):
    venv\Scripts\python.exe tests\benchmark_llm_batch.py path\to\paper.pdf
"""

from __future__ import annotations

import argparse
import asyncio
import sys
import time
from pathlib import Path
from typing import Any


PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from parser import llm_parser
async def benchmark(pdf_path: Path) -> dict[str, Any]:
    metrics: dict[str, Any] = {
        "batch_sizes": [],
        "fallback_items": 0,
        "http_requests": 0,
    }

    original_batch = llm_parser._llm_parse_batch
    original_single = llm_parser.llm_str2ref
    original_post = llm_parser.aiohttp.ClientSession.post

    async def measured_batch(raw_refs, session, semaphore):
        metrics["batch_sizes"].append(len(raw_refs))
        return await original_batch(raw_refs, session, semaphore)

    async def measured_single(*args, **kwargs):
        metrics["fallback_items"] += 1
        return await original_single(*args, **kwargs)

    def measured_post(self, *args, **kwargs):
        metrics["http_requests"] += 1
        return original_post(self, *args, **kwargs)

    llm_parser._llm_parse_batch = measured_batch
    llm_parser.llm_str2ref = measured_single
    llm_parser.aiohttp.ClientSession.post = measured_post
    try:
        parse_started = time.perf_counter()
        references = await asyncio.to_thread(
            llm_parser.llm_parse_pdf, str(pdf_path), metrics
        )
        total_seconds = time.perf_counter() - parse_started
    finally:
        llm_parser._llm_parse_batch = original_batch
        llm_parser.llm_str2ref = original_single
        llm_parser.aiohttp.ClientSession.post = original_post

    return {
        "pdf": str(pdf_path),
        "references": len(references),
        "total_parse_seconds": total_seconds,
        **metrics,
    }


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Measure PDF extraction and LLM parsing without running literature search."
    )
    parser.add_argument("pdf", type=Path, help="PDF file to benchmark")
    args = parser.parse_args()
    pdf_path = args.pdf.expanduser().resolve()
    if not pdf_path.is_file():
        parser.error(f"PDF does not exist: {pdf_path}")
    if pdf_path.suffix.lower() != ".pdf":
        parser.error(f"Not a PDF file: {pdf_path}")

    result = asyncio.run(benchmark(pdf_path))
    print("\n=== PDF / LLM benchmark ===")
    print(f"PDF: {result['pdf']}")
    print(f"Cache hit: {result['cache_hit']}")
    print(f"Cache write: {result['cache_write']}")
    print(f"Extracted characters: {result['extracted_characters']}")
    print(f"References returned: {result['references']}")
    print(f"Batch sizes: {result['batch_sizes']}")
    print(f"Fallback item calls: {result['fallback_items']}")
    print(f"Actual LLM HTTP requests (including retries): {result['http_requests']}")
    print(f"PDF extraction: {result['pdf_extraction_seconds']:.3f}s")
    print(f"LLM parsing: {result['llm_parsing_seconds']:.3f}s")
    print(f"Extraction + LLM: {result['total_parse_seconds']:.3f}s")


if __name__ == "__main__":
    main()
