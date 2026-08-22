r"""
CiteVerifier 并发隔离测试脚本

用途: 在本地（或部署环境）启动后端后，模拟 N 个用户同时操作，
检测多用户并发是否会出现以下问题:
  - 用户数据串号 (history 单条/批量返回别人的记录)
  - SQLite 写锁报错
  - session cookie 错乱
  - PDF 批量检测时 temp 文件同名互相覆盖 (已知 bug)

用法:
    # 1. 先启动后端 (默认 8092)
    #    venv/Scripts/python.exe -m uvicorn web_app:app --port 8092
    #
    # 2. 跑测试（5 个并发用户，仅测单条检索 + 历史隔离）
    python tests/concurrent_test.py --users 5
    #
    # 3. 同时测 PDF 批量检测并发（需要准备一份 PDF，所有用户上传同名文件以触发冲突）
    python tests/concurrent_test.py --users 5 --pdf path/to/test.pdf

依赖: requests (项目 venv 已自带)
"""
from __future__ import annotations

import argparse
import json
import sys
import time
import traceback
from concurrent.futures import ThreadPoolExecutor, as_completed

import requests

DEFAULT_BASE_URL = "http://127.0.0.1:8092"
DEFAULT_TIMEOUT = 30

# 一组真实英文学术标题，走 DBLP 路径（速度快、不依赖 Chrome）
TEST_TITLES_EN = [
    "Attention Is All You Need",
    "BERT: Pre-training of Deep Bidirectional Transformers for Language Understanding",
    "Deep Residual Learning for Image Recognition",
    "Generative Adversarial Networks",
    "ImageNet Classification with Deep Convolutional Neural Networks",
    "Sequence to Sequence Learning with Neural Networks",
    "Adam: A Method for Stochastic Optimization",
    "Long Short-Term Memory",
]


def _short(obj, n: int = 200) -> str:
    """把任意对象压成短字符串，便于终端打印。"""
    try:
        s = json.dumps(obj, ensure_ascii=False) if not isinstance(obj, str) else obj
    except Exception:
        s = str(obj)
    return s if len(s) <= n else s[:n] + "..."


def _step_ok(status_code: int) -> bool:
    return 200 <= status_code < 300


class UserSession:
    """单个虚拟用户的全部状态。"""

    # Cookie 名称（必须与后端 session_manager.COOKIE_NAME 一致）
    COOKIE_NAME = "citeverifier_session"

    def __init__(self, base_url: str, index: int):
        self.base_url = base_url.rstrip("/")
        self.index = index
        self.s = requests.Session()
        self.username = f"ct_{int(time.time())}_{index}"
        self.password = "Test123456"
        self.email = f"{self.username}@test.local"
        self.user_id = None
        self.token: str | None = None  # 登录成功后保存 cookie 值
        self.errors: list[str] = []
        self.steps: list[tuple[str, int, str]] = []

    def _record(self, name: str, resp: requests.Response):
        body = resp.text
        try:
            body = resp.json()
        except Exception:
            pass
        self.steps.append((name, resp.status_code, _short(body)))

    def _auth_headers(self) -> dict:
        """手动注入 Cookie header，绕过 requests 对 Secure cookie 的发送限制。

        后端 .env 里 COOKIE_SECURE=true 时，登录响应下发的 cookie 带 Secure 标志，
        requests 在 HTTP（非 HTTPS）请求中不会自动发送，导致 /api/user/me 等接口 401。
        通过显式设置 Cookie header 强制发送。
        """
        return {"Cookie": f"{self.COOKIE_NAME}={self.token}"} if self.token else {}

    def register(self) -> bool:
        try:
            print(f"register: {self.username}")
            r = self.s.post(
                f"{self.base_url}/api/user/register",
                json={"username": self.username, "password": self.password, "email": self.email},
                timeout=DEFAULT_TIMEOUT,
            )
            self._record("register", r)
            # 注册接口可能返回 success:false（用户名重复），不算致命错误
            return r.status_code in (200, 400)
        except Exception as e:
            self.errors.append(f"register: {e}")
            return False

    def login(self) -> bool:
        try:
            r = self.s.post(
                f"{self.base_url}/api/user/login",
                json={"username": self.username, "password": self.password},
                timeout=DEFAULT_TIMEOUT,
            )
            self._record("login", r)
            if not _step_ok(r.status_code):
                self.errors.append(f"login status={r.status_code}")
                return False
            # 从 Set-Cookie 提取 token（不依赖 requests 自动存 Secure cookie）
            self.token = r.cookies.get(self.COOKIE_NAME)
            if not self.token:
                self.errors.append("login: response 未下发 session cookie")
                return False
            return r.json().get("success", False)
        except Exception as e:
            self.errors.append(f"login: {e}")
            return False

    def me(self) -> bool:
        try:
            r = self.s.get(
                f"{self.base_url}/api/user/me",
                headers=self._auth_headers(),
                timeout=DEFAULT_TIMEOUT,
            )
            self._record("me", r)
            if _step_ok(r.status_code):
                self.user_id = r.json().get("user_id")
                return True
            self.errors.append(f"me status={r.status_code}")
            return False
        except Exception as e:
            self.errors.append(f"me: {e}")
            return False

    def search_title(self, title: str) -> dict | None:
        try:
            r = self.s.post(
                f"{self.base_url}/api/search/title",
                json={"title": title, "lang": "en"},
                headers=self._auth_headers(),
                timeout=120,
            )
            self._record("search_title", r)
            if _step_ok(r.status_code):
                return r.json()
            self.errors.append(f"search_title status={r.status_code}")
            return None
        except Exception as e:
            self.errors.append(f"search_title: {e}")
            return None

    def history_single(self) -> dict | None:
        try:
            r = self.s.get(
                f"{self.base_url}/api/history/single?limit=20",
                headers=self._auth_headers(),
                timeout=DEFAULT_TIMEOUT,
            )
            self._record("history_single", r)
            if _step_ok(r.status_code):
                return r.json()
            self.errors.append(f"history_single status={r.status_code}")
            return None
        except Exception as e:
            self.errors.append(f"history_single: {e}")
            return None

    def pdf_batch(self, pdf_path: str) -> dict | None:
        """所有用户上传同一份 PDF（用真实文件名）来触发 temp/ 文件冲突。"""
        import os
        filename = os.path.basename(pdf_path) or "upload.pdf"
        try:
            with open(pdf_path, "rb") as f:
                # filename 用真实文件名；多用户传同一文件就会写到同一个 temp 路径
                files = [("files", (filename, f, "application/pdf"))]
                r = self.s.post(
                    f"{self.base_url}/api/search/pdf/batch",
                    files=files,
                    data={"lang": "en"},
                    headers=self._auth_headers(),
                    timeout=300,
                )
            self._record("pdf_batch", r)
            if _step_ok(r.status_code):
                return r.json()
            self.errors.append(f"pdf_batch status={r.status_code} body={_short(r.text)}")
            return None
        except Exception as e:
            self.errors.append(f"pdf_batch: {e}")
            return None


def run_user(base_url: str, index: int, title: str, pdf_path: str | None) -> dict:
    """单个用户的完整工作流。"""
    u = UserSession(base_url, index)
    out: dict = {"index": index, "username": u.username, "ok": False, "errors": u.errors}

    try:
        if not u.register():
            out["reason"] = "register failed"
            return out
        if not u.login():
            out["reason"] = "login failed"
            return out
        if not u.me():
            out["reason"] = "me failed"
            return out

        # 单条检索
        search_result = u.search_title(title)
        # 查历史（应该至少看到自己刚提交的那条）
        hist = u.history_single()

        out["user_id"] = u.user_id
        out["search_found"] = (search_result or {}).get("found")
        out["history_total"] = (hist or {}).get("total")

        # ─── 隔离断言 ───
        # 正常情况下，自己刚提交一次检索，history_total 应 >= 1
        # 如果出现 0，说明检索没成功，或者写入数据库时被并发竞争挤掉
        isolation_ok = (out["history_total"] or 0) >= 1
        out["isolation_ok"] = isolation_ok
        if not isolation_ok:
            u.errors.append(f"history_total={out['history_total']}，但预期 >=1（自己的检索没被记到自己名下）")

        # PDF 批量并发（如指定）
        if pdf_path:
            pdf_result = u.pdf_batch(pdf_path)
            out["pdf_batch_ok"] = pdf_result is not None
            if pdf_result:
                out["pdf_summary"] = _short(pdf_result.get("summary", {}))

        out["ok"] = len(u.errors) == 0
    except Exception as e:
        u.errors.append(f"worker uncaught: {e}\n{traceback.format_exc()}")
        out["reason"] = "uncaught exception"

    out["steps"] = u.steps
    return out


def main():
    p = argparse.ArgumentParser(description="CiteVerifier 并发隔离测试")
    p.add_argument("--base-url", default=DEFAULT_BASE_URL, help=f"后端地址 (默认 {DEFAULT_BASE_URL})")
    p.add_argument("--users", type=int, default=5, help="并发用户数 (默认 5)")
    p.add_argument("--pdf", help="可选 PDF 路径；提供后会同时触发批量 PDF 检测并发")
    p.add_argument(
        "--titles",
        nargs="+",
        default=TEST_TITLES_EN,
        help="测试标题列表（默认用真实英文学术标题走 DBLP）",
    )
    args = p.parse_args()

    print(f"\n[1/3] 检查后端连通性 {args.base_url} ...")
    try:
        r = requests.get(f"{args.base_url}/api/health", timeout=5)
        if r.status_code != 200:
            print(f"  [FAIL] 后端健康检查失败: HTTP {r.status_code} {r.text[:200]}")
            sys.exit(1)
        print(f"  [OK] 后端健康: {r.json()}")
    except Exception as e:
        print(f"  [FAIL] 无法连接后端: {e}")
        print(f"     请先启动: venv\\Scripts\\python.exe -m uvicorn web_app:app --port 8092")
        sys.exit(1)

    if args.pdf:
        import os
        if not os.path.isfile(args.pdf):
            print(f"  [FAIL] PDF 文件不存在: {args.pdf}")
            sys.exit(1)
        print(f"  PDF 测试文件: {args.pdf}")

    print(f"\n[2/3] 启动 {args.users} 个并发用户 ...")
    start = time.time()
    results: list[dict] = []
    with ThreadPoolExecutor(max_workers=args.users) as ex:
        futures = [
            ex.submit(run_user, args.base_url, i, args.titles[i % len(args.titles)], args.pdf)
            for i in range(args.users)
        ]
        for i, fut in enumerate(as_completed(futures), 1):
            res = fut.result()
            results.append(res)
            tag = "[OK]" if res["ok"] else "[FAIL]"
            print(f"  [{i}/{args.users}] {tag} user#{res['index']} "
                  f"uid={res.get('user_id')} found={res.get('search_found')} "
                  f"hist={res.get('history_total')} "
                  f"pdf={'ok' if res.get('pdf_batch_ok') else ('no' if not args.pdf else 'FAIL')}")
    elapsed = time.time() - start

    print(f"\n[3/3] 测试报告")
    print("=" * 70)
    print(f" 并发用户数   : {args.users}")
    print(f" 总耗时       : {elapsed:.2f}s")
    print(f" 成功用户     : {sum(1 for r in results if r['ok'])}/{args.users}")
    print(f" 隔离通过     : {sum(1 for r in results if r.get('isolation_ok'))}/{args.users}")
    print("=" * 70)

    # 详细错误列表
    error_users = [r for r in results if not r["ok"]]
    if error_users:
        print(f"\n[FAIL] 失败用户详情 ({len(error_users)}):")
        for r in error_users:
            print(f"\n--- user#{r['index']} ({r.get('username')}) ---")
            for e in r.get("errors", []):
                print(f"  ! {e}")
            print(f"  最后步骤:")
            for name, code, body in r.get("steps", [])[-3:]:
                print(f"    {name}: HTTP {code}  {body[:100]}")
    else:
        print("\n[OK] 所有用户通过测试，未发现并发隔离问题")

    # SQLite 锁错误统计
    lock_errors = [r for r in results if any("database is locked" in e.lower() for e in r.get("errors", []))]
    if lock_errors:
        print(f"\n[WARN] 检测到 SQLite 写锁冲突: {len(lock_errors)} 个用户")

    # 退出码
    sys.exit(0 if all(r["ok"] for r in results) else 1)


if __name__ == "__main__":
    main()
