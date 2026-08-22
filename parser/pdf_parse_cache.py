"""Persistent cache for references parsed from identical PDF bytes."""

from __future__ import annotations

import hashlib
import json
import os
import sqlite3
import threading
from pathlib import Path
from typing import Any

from sqlite_utils import connect_sqlite


PARSER_CACHE_VERSION = "pdf-parse-v1"
PROJECT_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_CACHE_PATH = Path(
    os.getenv(
        "CITEVERIFIER_PDF_PARSE_CACHE",
        str(PROJECT_ROOT / "data" / "pdf_parse_cache.sqlite"),
    )
).expanduser().resolve()

_locks_guard = threading.Lock()
_pdf_locks: dict[str, threading.Lock] = {}


def compute_pdf_sha256(pdf_path: str | Path) -> str:
    digest = hashlib.sha256()
    with open(pdf_path, "rb") as pdf_file:
        for chunk in iter(lambda: pdf_file.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def cache_key(pdf_sha256: str, parser_version: str = PARSER_CACHE_VERSION) -> str:
    return f"{parser_version}:{pdf_sha256}"


def pdf_lock(pdf_sha256: str) -> threading.Lock:
    """Return a process-local single-flight lock for one PDF content hash."""
    key = cache_key(pdf_sha256)
    with _locks_guard:
        return _pdf_locks.setdefault(key, threading.Lock())


def _connect(db_path: str | Path = DEFAULT_CACHE_PATH) -> sqlite3.Connection:
    resolved = Path(db_path).expanduser().resolve()
    resolved.parent.mkdir(parents=True, exist_ok=True)
    connection = connect_sqlite(resolved)
    connection.execute(
        """
        CREATE TABLE IF NOT EXISTS pdf_parse_cache (
            cache_key TEXT PRIMARY KEY,
            pdf_sha256 TEXT NOT NULL,
            parser_version TEXT NOT NULL,
            references_json TEXT NOT NULL,
            reference_count INTEGER NOT NULL,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            last_accessed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
        """
    )
    return connection


def _valid_references(value: Any) -> bool:
    return (
        isinstance(value, list)
        and bool(value)
        and all(isinstance(item, dict) for item in value)
    )


def get_cached_references(
    pdf_sha256: str,
    *,
    db_path: str | Path = DEFAULT_CACHE_PATH,
    parser_version: str = PARSER_CACHE_VERSION,
) -> list[dict] | None:
    key = cache_key(pdf_sha256, parser_version)
    connection = _connect(db_path)
    try:
        row = connection.execute(
            "SELECT references_json FROM pdf_parse_cache WHERE cache_key = ?",
            (key,),
        ).fetchone()
        if row is None:
            return None
        try:
            references = json.loads(row[0])
        except (TypeError, json.JSONDecodeError):
            references = None
        if not _valid_references(references):
            connection.execute("DELETE FROM pdf_parse_cache WHERE cache_key = ?", (key,))
            connection.commit()
            return None
        connection.execute(
            """
            UPDATE pdf_parse_cache
            SET last_accessed_at = CURRENT_TIMESTAMP
            WHERE cache_key = ?
            """,
            (key,),
        )
        connection.commit()
        return references
    finally:
        connection.close()


def store_cached_references(
    pdf_sha256: str,
    references: list[dict],
    *,
    db_path: str | Path = DEFAULT_CACHE_PATH,
    parser_version: str = PARSER_CACHE_VERSION,
) -> bool:
    """Store only non-empty, JSON-serializable successful parse results."""
    if not _valid_references(references):
        return False
    try:
        encoded = json.dumps(references, ensure_ascii=False, allow_nan=False)
    except (TypeError, ValueError):
        return False

    key = cache_key(pdf_sha256, parser_version)
    connection = _connect(db_path)
    try:
        connection.execute(
            """
            INSERT INTO pdf_parse_cache (
                cache_key, pdf_sha256, parser_version,
                references_json, reference_count
            ) VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(cache_key) DO UPDATE SET
                references_json = excluded.references_json,
                reference_count = excluded.reference_count,
                last_accessed_at = CURRENT_TIMESTAMP
            """,
            (key, pdf_sha256, parser_version, encoded, len(references)),
        )
        connection.commit()
    finally:
        connection.close()
    return True
