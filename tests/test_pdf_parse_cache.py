from __future__ import annotations

import json
import sqlite3
import tempfile
import unittest
from contextlib import closing
from pathlib import Path
from unittest.mock import patch

from parser import llm_parser
from parser.pdf_parse_cache import (
    cache_key,
    compute_pdf_sha256,
    get_cached_references,
    store_cached_references,
)


class PdfParseCacheTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp_dir = tempfile.TemporaryDirectory()
        self.root = Path(self.temp_dir.name)
        self.db_path = self.root / "pdf-cache.sqlite"

    def tearDown(self) -> None:
        self.temp_dir.cleanup()

    def test_same_bytes_with_different_names_have_same_hash(self) -> None:
        first = self.root / "first.pdf"
        second = self.root / "renamed.pdf"
        first.write_bytes(b"same PDF bytes")
        second.write_bytes(b"same PDF bytes")
        self.assertEqual(compute_pdf_sha256(first), compute_pdf_sha256(second))

    def test_changed_bytes_have_different_hash(self) -> None:
        first = self.root / "first.pdf"
        second = self.root / "changed.pdf"
        first.write_bytes(b"PDF bytes A")
        second.write_bytes(b"PDF bytes B")
        self.assertNotEqual(compute_pdf_sha256(first), compute_pdf_sha256(second))

    def test_round_trip_and_version_invalidation(self) -> None:
        pdf_hash = "abc123"
        references = [{"id": 1, "title": "Example", "year": 2024}]
        self.assertIsNone(get_cached_references(pdf_hash, db_path=self.db_path))
        self.assertTrue(
            store_cached_references(pdf_hash, references, db_path=self.db_path)
        )
        self.assertEqual(
            get_cached_references(pdf_hash, db_path=self.db_path), references
        )
        self.assertIsNone(
            get_cached_references(
                pdf_hash, db_path=self.db_path, parser_version="pdf-parse-v2"
            )
        )

    def test_empty_and_non_json_results_are_not_cached(self) -> None:
        self.assertFalse(store_cached_references("empty", [], db_path=self.db_path))
        self.assertFalse(
            store_cached_references(
                "nan", [{"title": "Bad", "score": float("nan")}], db_path=self.db_path
            )
        )

    def test_corrupt_row_is_removed_and_treated_as_miss(self) -> None:
        pdf_hash = "corrupt"
        # Create the schema through the public API, then inject a broken row.
        store_cached_references(
            "seed", [{"title": "Seed"}], db_path=self.db_path
        )
        with closing(sqlite3.connect(self.db_path)) as connection:
            connection.execute(
                """
                INSERT INTO pdf_parse_cache (
                    cache_key, pdf_sha256, parser_version,
                    references_json, reference_count
                ) VALUES (?, ?, ?, ?, ?)
                """,
                (cache_key(pdf_hash), pdf_hash, "pdf-parse-v1", "{broken", 1),
            )
            connection.commit()
        self.assertIsNone(get_cached_references(pdf_hash, db_path=self.db_path))
        with closing(sqlite3.connect(self.db_path)) as connection:
            remaining = connection.execute(
                "SELECT COUNT(*) FROM pdf_parse_cache WHERE cache_key = ?",
                (cache_key(pdf_hash),),
            ).fetchone()[0]
        self.assertEqual(remaining, 0)

    def test_llm_parse_pdf_uses_cache_on_second_upload(self) -> None:
        pdf_path = self.root / "paper.pdf"
        pdf_path.write_bytes(b"identical PDF content")
        references = [{"id": 1, "title": "Cached reference", "year": 2024}]
        parse_calls = 0

        def fake_parse(text, metrics=None):
            nonlocal parse_calls
            parse_calls += 1
            return references

        def cache_get(pdf_hash):
            return get_cached_references(pdf_hash, db_path=self.db_path)

        def cache_store(pdf_hash, parsed):
            return store_cached_references(pdf_hash, parsed, db_path=self.db_path)

        with (
            patch.object(llm_parser, "pdf_to_text", return_value="references text") as extract,
            patch.object(llm_parser, "llm_parse", side_effect=fake_parse),
            patch.object(llm_parser, "get_cached_references", side_effect=cache_get),
            patch.object(llm_parser, "store_cached_references", side_effect=cache_store),
        ):
            first_metrics = {}
            second_metrics = {}
            first = llm_parser.llm_parse_pdf(str(pdf_path), first_metrics)
            second = llm_parser.llm_parse_pdf(str(pdf_path), second_metrics)

        self.assertEqual(first, references)
        self.assertEqual(second, references)
        self.assertEqual(parse_calls, 1)
        self.assertEqual(extract.call_count, 1)
        self.assertFalse(first_metrics["cache_hit"])
        self.assertTrue(first_metrics["cache_write"])
        self.assertTrue(second_metrics["cache_hit"])
        self.assertEqual(second_metrics["llm_parsing_seconds"], 0.0)

    def test_hard_fallback_result_is_not_cached(self) -> None:
        pdf_path = self.root / "fallback.pdf"
        pdf_path.write_bytes(b"PDF that triggers fallback")
        references = [{"id": 1, "title": "Fallback title", "year": None}]
        parse_calls = 0

        def fallback_parse(text, metrics=None):
            nonlocal parse_calls
            parse_calls += 1
            metrics["hard_fallbacks"] = 1
            return references

        def cache_get(pdf_hash):
            return get_cached_references(pdf_hash, db_path=self.db_path)

        def cache_store(pdf_hash, parsed):
            return store_cached_references(pdf_hash, parsed, db_path=self.db_path)

        with (
            patch.object(llm_parser, "pdf_to_text", return_value="references text"),
            patch.object(llm_parser, "llm_parse", side_effect=fallback_parse),
            patch.object(llm_parser, "get_cached_references", side_effect=cache_get),
            patch.object(llm_parser, "store_cached_references", side_effect=cache_store),
        ):
            first_metrics = {}
            second_metrics = {}
            llm_parser.llm_parse_pdf(str(pdf_path), first_metrics)
            llm_parser.llm_parse_pdf(str(pdf_path), second_metrics)

        self.assertEqual(parse_calls, 2)
        self.assertFalse(first_metrics["cache_write"])
        self.assertFalse(second_metrics["cache_hit"])

    def test_cache_failure_falls_back_to_normal_parsing(self) -> None:
        pdf_path = self.root / "cache-error.pdf"
        pdf_path.write_bytes(b"valid PDF bytes for cache error test")
        references = [{"id": 1, "title": "Parsed despite cache error"}]

        with (
            patch.object(llm_parser, "pdf_to_text", return_value="references text"),
            patch.object(llm_parser, "llm_parse", return_value=references),
            patch.object(
                llm_parser,
                "get_cached_references",
                side_effect=sqlite3.DatabaseError("corrupt cache"),
            ),
            patch.object(
                llm_parser,
                "store_cached_references",
                side_effect=sqlite3.DatabaseError("corrupt cache"),
            ),
        ):
            metrics = {}
            result = llm_parser.llm_parse_pdf(str(pdf_path), metrics)

        self.assertEqual(result, references)
        self.assertFalse(metrics["cache_hit"])
        self.assertFalse(metrics["cache_write"])
        self.assertIn("corrupt cache", metrics["cache_error"])


if __name__ == "__main__":
    unittest.main()
