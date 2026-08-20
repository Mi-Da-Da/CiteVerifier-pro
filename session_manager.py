"""基于 SQLite + itsdangerous 签名 cookie 的 session 管理。

- sessions 表存储 (session_id, user_id, username, created_at, expires_at)
- itsdangerous.URLSafeTimedSerializer 对 session_id 签名后下发 HttpOnly cookie
- 密钥优先从环境变量 SESSION_SECRET 读取；缺失时持久化生成到 data/.session_secret
"""
from __future__ import annotations

import os
import sqlite3
import threading
import time
import uuid
from pathlib import Path
from typing import Any

from itsdangerous import BadSignature, SignatureExpired, URLSafeTimedSerializer

# ── 路径与常量 ───────────────────────────────────────────────
_DATA_DIR = Path(__file__).resolve().parent / "data"
_DATA_DIR.mkdir(parents=True, exist_ok=True)
_SESSION_DB_PATH = _DATA_DIR / "sessions.db"
_SECRET_FILE = _DATA_DIR / ".session_secret"

_COOKIE_NAME = "citeverifier_session"
_COOKIE_MAX_AGE = 7 * 24 * 3600  # 7 天
_SESSION_TTL = 7 * 24 * 3600  # 7 天（秒）

_init_lock = threading.Lock()
_initialized = False

# ── 密钥 ─────────────────────────────────────────────────────
def _load_or_create_secret() -> str:
    """优先环境变量；其次读持久化文件；都没有就生成并写文件。"""
    secret = os.getenv("SESSION_SECRET")
    if secret:
        return secret
    try:
        return _SECRET_FILE.read_text(encoding="utf-8").strip()
    except FileNotFoundError:
        pass
    # 生成新密钥并持久化
    new_secret = uuid.uuid4().hex + uuid.uuid4().hex
    try:
        _SECRET_FILE.write_text(new_secret, encoding="utf-8")
    except OSError:
        # 只读环境或权限不足时回退到内存密钥（重启失效）
        pass
    return new_secret


_SECRET_KEY = _load_or_create_secret()
_serializer = URLSafeTimedSerializer(_SECRET_KEY, salt="citeverifier-session")


# ── 数据库初始化 ─────────────────────────────────────────────
def _connect() -> sqlite3.Connection:
    conn = sqlite3.connect(str(_SESSION_DB_PATH), timeout=30)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA synchronous=NORMAL")
    return conn


def _ensure_initialized() -> None:
    global _initialized
    if _initialized:
        return
    with _init_lock:
        if _initialized:
            return
        conn = _connect()
        try:
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS sessions (
                    session_id TEXT PRIMARY KEY,
                    user_id INTEGER NOT NULL,
                    username TEXT NOT NULL,
                    created_at REAL NOT NULL,
                    expires_at REAL NOT NULL
                )
                """
            )
            conn.execute(
                "CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id)"
            )
            conn.commit()
            _initialized = True
        finally:
            conn.close()


def _purge_expired() -> None:
    """清理过期 session（惰性触发）。"""
    now = time.time()
    conn = _connect()
    try:
        conn.execute("DELETE FROM sessions WHERE expires_at < ?", (now,))
        conn.commit()
    finally:
        conn.close()


# ── 对外接口 ─────────────────────────────────────────────────
def create_session(user_id: int, username: str) -> str:
    """创建 session，返回签名后的 token（用于 cookie 值）。"""
    _ensure_initialized()
    _purge_expired()
    session_id = uuid.uuid4().hex
    now = time.time()
    expires_at = now + _SESSION_TTL
    conn = _connect()
    try:
        conn.execute(
            "INSERT INTO sessions (session_id, user_id, username, created_at, expires_at) VALUES (?, ?, ?, ?, ?)",
            (session_id, int(user_id), username, now, expires_at),
        )
        conn.commit()
    finally:
        conn.close()
    return _serializer.dumps({"sid": session_id})


def verify_session(token: str | None) -> dict[str, Any] | None:
    """校验签名 cookie，返回 {user_id, username} 或 None。"""
    if not token:
        return None
    _ensure_initialized()
    try:
        data = _serializer.loads(token, max_age=_SESSION_TTL)
    except (BadSignature, SignatureExpired):
        return None
    session_id = data.get("sid")
    if not session_id:
        return None
    now = time.time()
    conn = _connect()
    try:
        row = conn.execute(
            "SELECT user_id, username, expires_at FROM sessions WHERE session_id = ?",
            (session_id,),
        ).fetchone()
    finally:
        conn.close()
    if row is None:
        return None
    if row["expires_at"] < now:
        return None
    return {"user_id": int(row["user_id"]), "username": row["username"], "session_id": session_id}


def delete_session(token: str | None) -> None:
    """登出：删除 session 记录。"""
    if not token:
        return
    try:
        data = _serializer.loads(token, max_age=_SESSION_TTL)
    except (BadSignature, SignatureExpired):
        return
    session_id = data.get("sid")
    if not session_id:
        return
    conn = _connect()
    try:
        conn.execute("DELETE FROM sessions WHERE session_id = ?", (session_id,))
        conn.commit()
    finally:
        conn.close()


# ── cookie 配置 ──────────────────────────────────────────────
COOKIE_NAME = _COOKIE_NAME
COOKIE_MAX_AGE = _COOKIE_MAX_AGE
