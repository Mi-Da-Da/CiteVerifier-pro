"""
谷歌学术（Google Scholar）检索客户端 - 基于 SerpApi

用途：
    当英文文献在本地 DBLP 中无法检索到时，作为回退数据源调用谷歌学术。
    谷歌学术本身没有官方公开 API，这里使用第三方 SerpApi 的 google_scholar 引擎。

特性：
    - SQLite 本地缓存，命中即返回，避免重复消耗 SerpApi 额度
    - 标题相似度匹配（复用 StringUtils.enhanced_title_similarity）
    - 提供与 baidu_client.batch_search_baidu 同构的 batch_search_google_scholar 接口
      便于在 web_app.py 的批量检索流程中作为 DBLP 的回退调用
"""

import asyncio
import json
import logging
import os
import re
import sqlite3
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from typing import Any, Dict, List, Optional

from checker.utils import StringUtils

logger = logging.getLogger(__name__)

# 尽早加载项目根目录 .env（被单独 import 时也能读到配置）
try:
    from dotenv import load_dotenv as _load_dotenv
except ImportError:  # pragma: no cover
    _load_dotenv = None  # type: ignore[assignment]
_GS_PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
if _load_dotenv is not None:
    _load_dotenv(_GS_PROJECT_ROOT / ".env")

# ── 基本配置 ───────────────────────────────────────────────────
_CACHE_TTL = 86400  # 缓存 24 小时
_CACHE_DB_PATH = Path(__file__).parent.parent.parent / "data" / "google_scholar_cache.db"
_SERPAPI_API_KEY_ENV = "SERPAPI_API_KEY"
# 标题相似度达到此阈值即视为命中
_SIMILARITY_THRESHOLD = 0.7
# 批量检索的线程并发上限（避免触发 SerpApi 限速）
_MAX_WORKERS = 4
# 只看前 N 条 organic_results（position 0..N-1），节省额度并加快匹配
_MAX_RESULTS_TO_CONSIDER = 3

_YEAR_PATTERN = re.compile(r"\b(19|20)\d{2}\b")

_executor: Optional[ThreadPoolExecutor] = None


def _get_executor() -> ThreadPoolExecutor:
    global _executor
    if _executor is None:
        _executor = ThreadPoolExecutor(max_workers=_MAX_WORKERS)
    return _executor


# ── 本地缓存 ───────────────────────────────────────────────────
class GoogleScholarCache:
    """SQLite 本地缓存，避免重复请求 SerpApi。

    缓存策略与 baidu_client 保持一致：仅缓存命中（found=True）的结果，
    未命中结果不写入，便于下次重新检索。
    """

    def __init__(self, db_path: Path = _CACHE_DB_PATH):
        self.db_path = db_path
        self._init_db()

    def _init_db(self):
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        with sqlite3.connect(self.db_path) as conn:
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS google_scholar_cache (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    normalized_title TEXT UNIQUE NOT NULL,
                    result_json TEXT NOT NULL,
                    created_at REAL NOT NULL
                )
                """
            )
            conn.execute(
                "CREATE INDEX IF NOT EXISTS idx_gs_title ON google_scholar_cache(normalized_title)"
            )
            conn.execute(
                "CREATE INDEX IF NOT EXISTS idx_gs_created_at ON google_scholar_cache(created_at)"
            )
            conn.commit()

    def get(self, normalized_title: str) -> Optional[Dict]:
        if not normalized_title:
            return None
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.execute(
                """
                SELECT result_json, created_at FROM google_scholar_cache
                WHERE normalized_title = ?
                """,
                (normalized_title,),
            )
            row = cursor.fetchone()
            if row:
                result_json, created_at = row
                if time.time() - created_at < _CACHE_TTL:
                    try:
                        result = json.loads(result_json)
                        if isinstance(result, dict) and result.get("found"):
                            return result
                        # 未命中结果不属于有效缓存；兼容清理历史脏数据。
                        conn.execute(
                            "DELETE FROM google_scholar_cache WHERE normalized_title = ?",
                            (normalized_title,),
                        )
                        conn.commit()
                    except json.JSONDecodeError:
                        logger.warning("谷歌学术缓存 JSON 解析失败")
                        self.delete(normalized_title)
                else:
                    logger.debug(f"缓存过期: {normalized_title[:30]}...")
                    self.delete(normalized_title)
        return None

    def set(self, normalized_title: str, result: Dict) -> None:
        # 缓存层自身兜底：谷歌学术未找到的结果绝不写入缓存。
        if not normalized_title or not result.get("found"):
            return
        result_json = json.dumps(result, ensure_ascii=False)
        with sqlite3.connect(self.db_path) as conn:
            try:
                conn.execute(
                    """
                    INSERT OR REPLACE INTO google_scholar_cache
                    (normalized_title, result_json, created_at)
                    VALUES (?, ?, ?)
                    """,
                    (normalized_title, result_json, time.time()),
                )
                conn.commit()
            except sqlite3.Error as e:
                logger.error(f"谷歌学术缓存写入失败: {e}")

    def delete(self, normalized_title: str) -> None:
        with sqlite3.connect(self.db_path) as conn:
            conn.execute(
                "DELETE FROM google_scholar_cache WHERE normalized_title = ?",
                (normalized_title,),
            )
            conn.commit()

    def clear_expired(self) -> int:
        cutoff = time.time() - _CACHE_TTL
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.execute(
                "DELETE FROM google_scholar_cache WHERE created_at < ?", (cutoff,)
            )
            conn.commit()
            return cursor.rowcount

    def get_stats(self) -> Dict[str, int]:
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.execute("SELECT COUNT(*) FROM google_scholar_cache")
            total = cursor.fetchone()[0]
            cutoff = time.time() - _CACHE_TTL
            cursor = conn.execute(
                "SELECT COUNT(*) FROM google_scholar_cache WHERE created_at < ?", (cutoff,)
            )
            expired = cursor.fetchone()[0]
            return {"total": total, "expired": expired}


_cache = GoogleScholarCache()


# ── 工具函数 ───────────────────────────────────────────────────
def _normalize_title(title: str) -> str:
    if not title:
        return ""
    return title.strip().lower()


def _get_cached_result(title: str) -> Optional[Dict]:
    normalized = _normalize_title(title)
    if not normalized:
        return None
    result = _cache.get(normalized)
    if result:
        logger.debug(f"谷歌学术缓存命中: {title[:30]}...")
    return result


def _set_cached_result(title: str, result: Dict) -> None:
    normalized = _normalize_title(title)
    if not normalized:
        return
    _cache.set(normalized, result)
    logger.debug(f"谷歌学术缓存写入: {title[:30]}...")


def _get_api_key() -> str:
    # 只从环境变量读取，未配置即返回空字符串
    return os.getenv(_SERPAPI_API_KEY_ENV) or ""


def is_available() -> bool:
    """是否配置了 SerpApi key（回退前可调用此函数判断是否启用回退）"""
    return bool(_get_api_key())


# ── SerpApi 调用 ───────────────────────────────────────────────
def _call_serpapi_google_scholar(query: str) -> List[Dict[str, Any]]:
    """调用 SerpApi 的 google_scholar 引擎，返回 organic_results 列表"""
    import serpapi

    api_key = _get_api_key()
    if not api_key:
        raise RuntimeError("SERPAPI_API_KEY 未配置，无法调用谷歌学术")

    client = serpapi.Client(api_key=api_key)
    data = client.search({
        "engine": "google_scholar",
        "q": query,
        "hl": "en",
        # SerpApi 默认缓存相同查询约一小时；未命中必须重新实时检索。
        "no_cache": True,
    })
    if isinstance(data, dict) and data.get("error"):
        raise RuntimeError(f"SerpApi error: {data['error']}")
    organic = data.get("organic_results") or []
    return organic


def _parse_serpapi_result(
    result: Dict[str, Any], query: str
) -> Optional[Dict[str, Any]]:
    """解析单条 SerpApi 谷歌学术结果，提取标题/作者/年份/链接/venue"""
    title = (result.get("title") or "").strip()
    if not title:
        return None
    title = StringUtils.clean_title(title)
    if not title:
        return None

    pub_info = result.get("publication_info") or {}
    summary = pub_info.get("summary", "") or ""
    summary = summary.replace("\xa0", " ")

    authors: List[str] = []
    authors_list = pub_info.get("authors") or []
    for a in authors_list:
        name = (a.get("name") or "").strip()
        if name:
            authors.append(name)

    if not authors and summary:
        # summary 形如 "C Wang, Y Yang - arXiv preprint arXiv:..., 2023"
        head = summary.split(" - ", 1)[0].strip()
        if "," in head:
            authors = [a.strip() for a in head.split(",") if a.strip()]
        elif head:
            authors = [head]

    year: Optional[int] = None
    year_match = _YEAR_PATTERN.search(summary)
    if year_match:
        try:
            year = int(year_match.group())
        except ValueError:
            year = None

    venue: Optional[str] = None
    if " - " in summary:
        after_dash = summary.split(" - ", 1)[1]
        # 形如 "arXiv preprint arXiv:..., 2023" 或 "ConferenceName, 2020"
        venue_part = after_dash.split(",", 1)[0].strip()
        venue_part = _YEAR_PATTERN.sub("", venue_part).strip(" ,")
        if venue_part:
            venue = venue_part

    link = result.get("link") or result.get("result_id")

    return {
        "title": title,
        "authors": authors,
        "year": year,
        "venue": venue,
        "url": link,
        "summary": summary,
    }


def _find_best_match(
    results: List[Dict[str, Any]],
    query: str,
    threshold: float = _SIMILARITY_THRESHOLD,
) -> Optional[Dict[str, Any]]:
    """从谷歌学术结果中挑选最匹配的一项；返回的字典中带 similarity 字段。

    只看前 _MAX_RESULTS_TO_CONSIDER 条（position 0..N-1），
    既节省 SerpApi 解析开销，也避免长尾低相关结果干扰匹配。
    """
    if not results:
        return None

    # 只取前 N 条；position 递增代表下一条结果
    candidates = results[:_MAX_RESULTS_TO_CONSIDER]

    best_score = 0.0
    best: Optional[Dict[str, Any]] = None

    for r in candidates:
        parsed = _parse_serpapi_result(r, query)
        if not parsed:
            continue
        sim = StringUtils.enhanced_title_similarity(query, parsed["title"])
        parsed["similarity"] = sim
        if sim > best_score:
            best_score = sim
            best = parsed
        # 达到阈值即可早退
        if sim >= threshold:
            return best

    return best


def _search_one_title(title: str) -> Dict[str, Any]:
    """对单条标题执行谷歌学术检索（带缓存）。返回统一格式结果。

    返回结构：
        {
            "query_title": str,
            "found": bool,
            "matched_title": Optional[str],
            "similarity": float,
            "authors": List[str],
            "year": Optional[int],
            "venue": Optional[str],
            "url": Optional[str],
            "source": "google_scholar",
            "error": Optional[str],
        }
    """
    cached = _get_cached_result(title)
    if cached is not None:
        return cached

    if not is_available():
        return {
            "query_title": title,
            "found": False,
            "matched_title": None,
            "similarity": 0.0,
            "authors": [],
            "year": None,
            "venue": None,
            "url": None,
            "source": "google_scholar",
            "error": "SERPAPI_API_KEY 未配置",
        }

    try:
        organic = _call_serpapi_google_scholar(title)
    except Exception as e:
        logger.warning(f"谷歌学术检索失败 [{title[:30]}...]: {e}")
        # 检索异常不缓存，便于下次重试
        return {
            "query_title": title,
            "found": False,
            "matched_title": None,
            "similarity": 0.0,
            "authors": [],
            "year": None,
            "venue": None,
            "url": None,
            "source": "google_scholar",
            "error": str(e),
        }

    best = _find_best_match(organic, title)
    if best and best.get("similarity", 0.0) >= _SIMILARITY_THRESHOLD:
        result = {
            "query_title": title,
            "found": True,
            "matched_title": best["title"],
            "similarity": round(float(best["similarity"]), 4),
            "authors": best.get("authors") or [],
            "year": best.get("year"),
            "venue": best.get("venue"),
            "url": best.get("url"),
            "source": "google_scholar",
            "error": None,
        }
    else:
        result = {
            "query_title": title,
            "found": False,
            "matched_title": best["title"] if best else None,
            "similarity": round(float(best["similarity"]), 4) if best else 0.0,
            "authors": best.get("authors") if best else [],
            "year": best.get("year") if best else None,
            "venue": best.get("venue") if best else None,
            "url": best.get("url") if best else None,
            "source": "google_scholar",
            "error": None if best else "谷歌学术无结果",
        }

    # 仅命中时写入缓存，未命中不缓存以便下次重新检索
    # （与 baidu_client 的缓存策略保持一致）
    if result.get("found"):
        _set_cached_result(title, result)
    return result


async def batch_search_google_scholar(titles: List[str]) -> List[Dict[str, Any]]:
    """
    批量检索多个标题（谷歌学术 / SerpApi），返回结果列表。
    供 web_app.py 的批量接口在 DBLP 未命中时调用作为回退。

    顺序与输入 titles 保持一致。
    """
    if not titles:
        return []

    loop = asyncio.get_event_loop()
    executor = _get_executor()
    results = await loop.run_in_executor(
        executor, lambda: [_search_one_title(t) for t in titles]
    )
    return results


async def search_single_title(title: str) -> Dict[str, Any]:
    """单条标题检索（对外异步入口，便于 web_app 的单条检索接口调用）"""
    if not title or not title.strip():
        return {
            "query_title": title,
            "found": False,
            "matched_title": None,
            "similarity": 0.0,
            "authors": [],
            "year": None,
            "venue": None,
            "url": None,
            "source": "google_scholar",
            "error": "标题为空",
        }
    loop = asyncio.get_event_loop()
    executor = _get_executor()
    return await loop.run_in_executor(executor, _search_one_title, title.strip())
