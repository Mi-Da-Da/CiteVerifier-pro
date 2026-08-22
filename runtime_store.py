from __future__ import annotations

import json
import sqlite3
import threading
from pathlib import Path
from typing import Any

from sqlite_utils import connect_sqlite


class RuntimeStore:
    def __init__(self, db_path: Path) -> None:
        self.db_path = Path(db_path)
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self._init_lock = threading.Lock()
        self._initialized = False
        self._ensure_initialized()

    def _connect(self) -> sqlite3.Connection:
        return connect_sqlite(self.db_path, row_factory=True)

    def _ensure_initialized(self) -> None:
        if self._initialized:
            return
        with self._init_lock:
            if self._initialized:
                return
            conn = self._connect()
            try:
                conn.execute(
                    """
                    CREATE TABLE IF NOT EXISTS runtime_counters (
                        name TEXT PRIMARY KEY,
                        value INTEGER NOT NULL DEFAULT 0,
                        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
                    )
                    """
                )
                conn.execute(
                    """
                    CREATE TABLE IF NOT EXISTS single_search_events (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        user_id INTEGER,
                        query_title TEXT NOT NULL,
                        query_hash TEXT,
                        found INTEGER NOT NULL DEFAULT 0,
                        max_candidates INTEGER NOT NULL,
                        duration_ms INTEGER,
                        error_message TEXT,
                        verification_status TEXT,
                        created_at TEXT NOT NULL DEFAULT (datetime('now'))
                    )
                    """
                )
                # 兼容已有数据库：旧记录没有用户归属，保留但不向任何用户展示。
                single_cols = {
                    r["name"] for r in conn.execute("PRAGMA table_info(single_search_events)")
                }
                if "user_id" not in single_cols:
                    conn.execute("ALTER TABLE single_search_events ADD COLUMN user_id INTEGER")
                if "verification_status" not in single_cols:
                    conn.execute(
                        "ALTER TABLE single_search_events ADD COLUMN verification_status TEXT"
                    )
                    conn.execute(
                        """
                        UPDATE single_search_events
                        SET verification_status = CASE
                            WHEN error_message IS NOT NULL THEN 'search_error'
                            WHEN found = 1 THEN 'verified'
                            ELSE 'unverifiable'
                        END
                        WHERE verification_status IS NULL
                        """
                    )
                conn.execute(
                    "CREATE INDEX IF NOT EXISTS idx_single_search_user "
                    "ON single_search_events(user_id, id DESC)"
                )
                conn.execute(
                    """
                    CREATE TABLE IF NOT EXISTS batch_runs (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        user_id INTEGER,
                        total_input INTEGER NOT NULL,
                        total_processed INTEGER NOT NULL DEFAULT 0,
                        found_count INTEGER NOT NULL DEFAULT 0,
                        max_candidates INTEGER NOT NULL,
                        duration_ms INTEGER,
                        status TEXT NOT NULL DEFAULT 'running',
                        error_message TEXT,
                        created_at TEXT NOT NULL DEFAULT (datetime('now')),
                        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
                    )
                    """
                )
                # 兼容已有表：若 user_id 列不存在则添加
                cols = {r["name"] for r in conn.execute("PRAGMA table_info(batch_runs)")}
                if "user_id" not in cols:
                    conn.execute("ALTER TABLE batch_runs ADD COLUMN user_id INTEGER")
                conn.execute(
                    """
                    CREATE TABLE IF NOT EXISTS batch_items (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        run_id INTEGER NOT NULL,
                        item_index INTEGER NOT NULL,
                        query_title TEXT NOT NULL,
                        found INTEGER NOT NULL DEFAULT 0,
                        dblp_id INTEGER,
                        dblp_title TEXT,
                        dblp_title_similarity REAL,
                        year TEXT,
                        venue TEXT,
                        pub_type TEXT,
                        duration_ms INTEGER,
                        error_message TEXT,
                        verification_status TEXT,
                        source TEXT,
                        created_at TEXT NOT NULL DEFAULT (datetime('now')),
                        FOREIGN KEY(run_id) REFERENCES batch_runs(id) ON DELETE CASCADE
                    )
                    """
                )
                batch_item_cols = {
                    r["name"] for r in conn.execute("PRAGMA table_info(batch_items)")
                }
                if "verification_status" not in batch_item_cols:
                    conn.execute(
                        "ALTER TABLE batch_items ADD COLUMN verification_status TEXT"
                    )
                    conn.execute(
                        """
                        UPDATE batch_items
                        SET verification_status = CASE
                            WHEN error_message IS NOT NULL THEN 'search_error'
                            WHEN found = 1 THEN 'verified'
                            ELSE 'unverifiable'
                        END
                        WHERE verification_status IS NULL
                        """
                    )
                if "source" not in batch_item_cols:
                    conn.execute("ALTER TABLE batch_items ADD COLUMN source TEXT")
                conn.execute(
                    """
                    CREATE TABLE IF NOT EXISTS event_logs (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        level TEXT NOT NULL,
                        message TEXT NOT NULL,
                        detail_json TEXT,
                        created_at TEXT NOT NULL DEFAULT (datetime('now'))
                    )
                    """
                )
                conn.execute(
                    """
                    CREATE TABLE IF NOT EXISTS task_progress (
                        user_id INTEGER NOT NULL,
                        task_id TEXT NOT NULL,
                        progress_json TEXT NOT NULL,
                        updated_at REAL NOT NULL,
                        PRIMARY KEY (user_id, task_id)
                    )
                    """
                )
                conn.execute(
                    "CREATE INDEX IF NOT EXISTS idx_task_progress_updated "
                    "ON task_progress(updated_at)"
                )
                conn.commit()
                self._initialized = True
            finally:
                conn.close()

    def set_task_progress(
        self,
        user_id: int,
        task_id: str,
        defaults: dict[str, Any],
        updates: dict[str, Any],
    ) -> dict[str, Any]:
        self._ensure_initialized()
        conn = self._connect()
        try:
            conn.execute("BEGIN IMMEDIATE")
            row = conn.execute(
                "SELECT progress_json FROM task_progress WHERE user_id = ? AND task_id = ?",
                (int(user_id), task_id),
            ).fetchone()
            progress = dict(defaults)
            if row is not None:
                try:
                    stored = json.loads(row["progress_json"])
                    if isinstance(stored, dict):
                        progress.update(stored)
                except (TypeError, json.JSONDecodeError):
                    pass
            progress.update(updates)
            conn.execute(
                """
                INSERT INTO task_progress (user_id, task_id, progress_json, updated_at)
                VALUES (?, ?, ?, strftime('%s','now'))
                ON CONFLICT(user_id, task_id) DO UPDATE SET
                    progress_json = excluded.progress_json,
                    updated_at = excluded.updated_at
                """,
                (int(user_id), task_id, json.dumps(progress, ensure_ascii=False)),
            )
            conn.commit()
            return progress
        finally:
            conn.close()

    def get_task_progress(
        self, user_id: int, task_id: str, defaults: dict[str, Any]
    ) -> dict[str, Any]:
        self._ensure_initialized()
        conn = self._connect()
        try:
            row = conn.execute(
                "SELECT progress_json FROM task_progress WHERE user_id = ? AND task_id = ?",
                (int(user_id), task_id),
            ).fetchone()
            if row is None:
                return dict(defaults)
            try:
                stored = json.loads(row["progress_json"])
            except (TypeError, json.JSONDecodeError):
                return dict(defaults)
            progress = dict(defaults)
            if isinstance(stored, dict):
                progress.update(stored)
            return progress
        finally:
            conn.close()

    def purge_task_progress(self, max_age_seconds: int = 86400) -> int:
        self._ensure_initialized()
        conn = self._connect()
        try:
            cursor = conn.execute(
                "DELETE FROM task_progress WHERE updated_at < strftime('%s','now') - ?",
                (int(max_age_seconds),),
            )
            conn.commit()
            return int(cursor.rowcount)
        finally:
            conn.close()

    def increment_counter(self, name: str, delta: int = 1) -> int:
        self._ensure_initialized()
        conn = self._connect()
        try:
            conn.execute(
                """
                INSERT INTO runtime_counters (name, value, updated_at)
                VALUES (?, ?, datetime('now'))
                ON CONFLICT(name) DO UPDATE SET
                    value = runtime_counters.value + excluded.value,
                    updated_at = datetime('now')
                """,
                (name, delta),
            )
            row = conn.execute(
                "SELECT value FROM runtime_counters WHERE name = ?",
                (name,),
            ).fetchone()
            conn.commit()
            return int(row["value"]) if row else 0
        finally:
            conn.close()

    def start_batch_run(self, total_input: int, max_candidates: int, user_id: int | None = None) -> int:
        self._ensure_initialized()
        conn = self._connect()
        try:
            cur = conn.cursor()
            cur.execute(
                """
                INSERT INTO batch_runs (user_id, total_input, max_candidates, status, created_at, updated_at)
                VALUES (?, ?, ?, 'running', datetime('now'), datetime('now'))
                """,
                (user_id, total_input, max_candidates),
            )
            run_id = int(cur.lastrowid)
            conn.commit()
            return run_id
        finally:
            conn.close()

    def finish_batch_run(
        self,
        run_id: int,
        *,
        total_processed: int,
        found_count: int,
        duration_ms: int,
        status: str,
        error_message: str | None,
    ) -> None:
        self._ensure_initialized()
        conn = self._connect()
        try:
            conn.execute(
                """
                UPDATE batch_runs
                SET total_processed = ?,
                    found_count = ?,
                    duration_ms = ?,
                    status = ?,
                    error_message = ?,
                    updated_at = datetime('now')
                WHERE id = ?
                """,
                (
                    int(total_processed),
                    int(found_count),
                    int(duration_ms),
                    status,
                    error_message,
                    int(run_id),
                ),
            )
            conn.commit()
        finally:
            conn.close()

    def record_batch_item(
        self,
        run_id: int,
        *,
        item_index: int,
        query_title: str,
        found: bool,
        dblp_id: int | None,
        dblp_title: str | None,
        dblp_title_similarity: float | None,
        year: Any,
        venue: str | None,
        pub_type: str | None,
        duration_ms: int,
        error_message: str | None,
        verification_status: str,
        source: str | None,
    ) -> None:
        self._ensure_initialized()
        conn = self._connect()
        try:
            conn.execute(
                """
                INSERT INTO batch_items (
                    run_id,
                    item_index,
                    query_title,
                    found,
                    dblp_id,
                    dblp_title,
                    dblp_title_similarity,
                    year,
                    venue,
                    pub_type,
                    duration_ms,
                    error_message,
                    verification_status,
                    source
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    int(run_id),
                    int(item_index),
                    query_title,
                    1 if found else 0,
                    dblp_id,
                    dblp_title,
                    dblp_title_similarity,
                    None if year is None else str(year),
                    venue,
                    pub_type,
                    int(duration_ms),
                    error_message,
                    verification_status,
                    source,
                ),
            )
            conn.commit()
        finally:
            conn.close()

    def record_single_search(
        self,
        *,
        user_id: int,
        query_title: str,
        query_hash: str,
        found: bool,
        max_candidates: int,
        duration_ms: int,
        error_message: str | None,
        verification_status: str,
    ) -> None:
        self._ensure_initialized()
        conn = self._connect()
        try:
            conn.execute(
                """
                INSERT INTO single_search_events (
                    user_id,
                    query_title,
                    query_hash,
                    found,
                    max_candidates,
                    duration_ms,
                    error_message,
                    verification_status
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    int(user_id),
                    query_title,
                    query_hash,
                    1 if found else 0,
                    int(max_candidates),
                    int(duration_ms),
                    error_message,
                    verification_status,
                ),
            )
            conn.commit()
        finally:
            conn.close()

    def log_event(self, level: str, message: str, detail: dict[str, Any] | None = None) -> None:
        self._ensure_initialized()
        conn = self._connect()
        try:
            conn.execute(
                """
                INSERT INTO event_logs (level, message, detail_json)
                VALUES (?, ?, ?)
                """,
                (
                    level.upper(),
                    message,
                    json.dumps(detail or {}, ensure_ascii=False, separators=(",", ":")),
                ),
            )
            conn.commit()
        finally:
            conn.close()

    def stats(self) -> dict[str, Any]:
        self._ensure_initialized()
        conn = self._connect()
        try:
            counters = {
                row["name"]: int(row["value"])
                for row in conn.execute("SELECT name, value FROM runtime_counters")
            }
            single_count = conn.execute("SELECT COUNT(1) AS c FROM single_search_events").fetchone()
            batch_count = conn.execute("SELECT COUNT(1) AS c FROM batch_runs").fetchone()
            item_count = conn.execute("SELECT COUNT(1) AS c FROM batch_items").fetchone()
            return {
                "counters": counters,
                "single_search_events": int(single_count["c"]) if single_count else 0,
                "batch_runs": int(batch_count["c"]) if batch_count else 0,
                "batch_items": int(item_count["c"]) if item_count else 0,
            }
        finally:
            conn.close()
