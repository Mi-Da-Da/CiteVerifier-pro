import sqlite3
import hashlib
import os
from pathlib import Path

DB_PATH = "users.db"

def get_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_user_db():
    """初始化用户表"""
    conn = get_connection()
    conn.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    conn.commit()
    conn.close()

def hash_password(password: str) -> str:
    """对密码进行哈希处理"""
    return hashlib.sha256(password.encode()).hexdigest()

def register_user(username: str, password: str, email: str) -> dict:
    """注册新用户"""
    conn = get_connection()
    try:
        conn.execute(
            "INSERT INTO users (username, password_hash, email) VALUES (?, ?, ?)",
            (username, hash_password(password), email)
        )
        conn.commit()
        return {"success": True, "message": "注册成功"}
    except sqlite3.IntegrityError as e:
        if "username" in str(e):
            return {"success": False, "message": "用户名已存在"}
        elif "email" in str(e):
            return {"success": False, "message": "邮箱已被注册"}
        return {"success": False, "message": "注册失败"}
    finally:
        conn.close()

def get_user_by_username(username: str) -> dict:
    """根据用户名查询用户"""
    conn = get_connection()
    user = conn.execute(
        "SELECT * FROM users WHERE username = ?", (username,)
    ).fetchone()
    conn.close()
    return dict(user) if user else None
    
def login_user(username: str, password: str) -> dict:
    """用户登录验证"""
    user = get_user_by_username(username)
    if not user:
        return {"success": False, "message": "用户名不存在"}
    if user["password_hash"] != hash_password(password):
        return {"success": False, "message": "密码错误"}
    return {"success": True, "message": "登录成功", "user_id": user["id"], "username": user["username"]}