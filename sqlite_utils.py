"""Shared SQLite connection policy for multi-worker server processes."""

from __future__ import annotations

import sqlite3
from contextlib import contextmanager
from pathlib import Path
from typing import Iterator


def connect_sqlite(
    db_path: str | Path,
    *,
    row_factory: bool = False,
    wal: bool = True,
) -> sqlite3.Connection:
    connection = sqlite3.connect(str(db_path), timeout=30)
    if row_factory:
        connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA busy_timeout=30000")
    if wal:
        connection.execute("PRAGMA journal_mode=WAL")
        connection.execute("PRAGMA synchronous=NORMAL")
    return connection


@contextmanager
def sqlite_connection(
    db_path: str | Path,
    *,
    row_factory: bool = False,
    wal: bool = True,
) -> Iterator[sqlite3.Connection]:
    connection = connect_sqlite(db_path, row_factory=row_factory, wal=wal)
    try:
        with connection:
            yield connection
    finally:
        connection.close()
