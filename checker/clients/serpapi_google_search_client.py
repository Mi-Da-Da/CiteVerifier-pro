"""
谷歌搜索（Google Search）检索客户端 - 基于 SerpApi

用途：
    当谷歌学术（Google Scholar）无法检索到时，作为最终回退数据源调用谷歌搜索。
    谷歌搜索覆盖面比学术搜索更广，能找到一些非学术来源的文献引用。

特性：
    - SQLite 本地缓存，命中即返回，避免重复消耗 SerpApi 额度
    - 标题相似度匹配（复用 StringUtils.enhanced_title_similarity）
    - 仅缓存命中（found=True）的结果，未命中不缓存
    - 提供与 serpapi_google_scholar_client 同构的接口
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

# ── 基本配置 ───────────────────────────────────────────────────
_CACHE_TTL = 86400  # 缓存 24 小时
_CACHE_DB_PATH = Path(__file__).parent.parent.parent / "data" / "google_search_cache.db"
_SERPAPI_API_KEY_ENV = "SERPAPI_API_KEY"
_DEFAULT_SERPAPI_API_KEY = ""
_SIMILARITY_THRESHOLD = 0.7
_MAX_WORKERS = 4
_MAX_RESULTS_TO_CONSIDER = 5

_YEAR_PATTERN = re.compile(r"\b(19|20)\d{2}\b")

_executor: Optional[ThreadPoolExecutor] = None


def _get_executor() -> ThreadPoolExecutor:
    global _executor
    if _executor is None:
        _executor = ThreadPoolExecutor(max_workers=_MAX_WORKERS)
    return _executor


# ── 本地缓存 ───────────────────────────────────────────────────
class GoogleSearchCache:
    """SQLite 本地缓存，避免重复请求 SerpApi。

    缓存策略与 google_scholar_client 保持一致：仅缓存命中（found=True）的结果，
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
                CREATE TABLE IF NOT EXISTS google_search_cache (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    normalized_title TEXT UNIQUE NOT NULL,
                    result_json TEXT NOT NULL,
                    created_at REAL NOT NULL
                )
                """
            )
            conn.execute(
                "CREATE INDEX IF NOT EXISTS idx_gsearch_title ON google_search_cache(normalized_title)"
            )
            conn.execute(
                "CREATE INDEX IF NOT EXISTS idx_gsearch_created_at ON google_search_cache(created_at)"
            )
            conn.commit()

    def get(self, normalized_title: str) -> Optional[Dict]:
        if not normalized_title:
            return None
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.execute(
                """
                SELECT result_json, created_at FROM google_search_cache
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
                            "DELETE FROM google_search_cache WHERE normalized_title = ?",
                            (normalized_title,),
                        )
                        conn.commit()
                    except json.JSONDecodeError:
                        logger.warning("谷歌搜索缓存 JSON 解析失败")
                        self.delete(normalized_title)
                else:
                    logger.debug(f"缓存过期: {normalized_title[:30]}...")
                    self.delete(normalized_title)
        return None

    def set(self, normalized_title: str, result: Dict) -> None:
        # 缓存层自身兜底：谷歌搜索未找到的结果绝不写入缓存。
        if not normalized_title or not result.get("found"):
            return
        result_json = json.dumps(result, ensure_ascii=False)
        with sqlite3.connect(self.db_path) as conn:
            try:
                conn.execute(
                    """
                    INSERT OR REPLACE INTO google_search_cache
                    (normalized_title, result_json, created_at)
                    VALUES (?, ?, ?)
                    """,
                    (normalized_title, result_json, time.time()),
                )
                conn.commit()
            except sqlite3.Error as e:
                logger.error(f"谷歌搜索缓存写入失败: {e}")

    def delete(self, normalized_title: str) -> None:
        with sqlite3.connect(self.db_path) as conn:
            conn.execute(
                "DELETE FROM google_search_cache WHERE normalized_title = ?",
                (normalized_title,),
            )
            conn.commit()

    def clear_expired(self) -> int:
        cutoff = time.time() - _CACHE_TTL
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.execute(
                "DELETE FROM google_search_cache WHERE created_at < ?", (cutoff,)
            )
            conn.commit()
            return cursor.rowcount

    def get_stats(self) -> Dict[str, int]:
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.execute("SELECT COUNT(*) FROM google_search_cache")
            total = cursor.fetchone()[0]
            cutoff = time.time() - _CACHE_TTL
            cursor = conn.execute(
                "SELECT COUNT(*) FROM google_search_cache WHERE created_at < ?", (cutoff,)
            )
            expired = cursor.fetchone()[0]
            return {"total": total, "expired": expired}


_cache = GoogleSearchCache()


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
        logger.debug(f"谷歌搜索缓存命中: {title[:30]}...")
    return result


def _set_cached_result(title: str, result: Dict) -> None:
    normalized = _normalize_title(title)
    if not normalized:
        return
    _cache.set(normalized, result)
    logger.debug(f"谷歌搜索缓存写入: {title[:30]}...")


def _get_api_key() -> str:
    return os.getenv(_SERPAPI_API_KEY_ENV, _DEFAULT_SERPAPI_API_KEY)


def is_available() -> bool:
    """是否配置了 SerpApi key"""
    return bool(_get_api_key())


# ── SerpApi 调用 ───────────────────────────────────────────────
def _call_serpapi_google_search(query: str) -> List[Dict[str, Any]]:
    """调用 SerpApi 的 google 引擎，返回 organic_results 列表"""
    import serpapi

    api_key = _get_api_key()
    if not api_key:
        raise RuntimeError("SERPAPI_API_KEY 未配置，无法调用谷歌搜索")

    client = serpapi.Client(api_key=api_key)
    data = client.search({
        "engine": "google",
        "q": query,
        "google_domain": "google.com",
        "hl": "en",
        # SerpApi 默认缓存相同查询约一小时；未命中必须重新实时检索。
        "no_cache": True,
    })
    if isinstance(data, dict) and data.get("error"):
        raise RuntimeError(f"SerpApi error: {data['error']}")
    organic = data.get("organic_results") or []
    return organic


def _parse_google_result(
    result: Dict[str, Any], query: str
) -> Optional[Dict[str, Any]]:
    """解析单条 Google 搜索结果，提取标题/作者/年份/链接/来源

    SerpApi google 引擎返回的 organic_results 结构示例：
        {
            "title": "Bulletproof Coffee Recipe",
            "link": "https://...",
            "source": "Bulletproof",
            "snippet": "...",        # 可能有也可能没有
            "displayed_link": "...",  # 可能有也可能没有
            "date": "3 days ago",     # 可能有
            ...
        }
    针对不同类型的搜索结果（网页、食谱、学术等）做兼容处理。
    """
    title = (result.get("title") or "").strip()
    if not title:
        return None
    title = StringUtils.clean_title(title)
    if not title:
        return None

    # snippet 可能有也可能没有，统一收集文本用于提取年份/作者
    text_parts: List[str] = []
    for key in ("snippet", "source", "date", "displayed_link"):
        val = (result.get(key) or "").strip()
        if val:
            text_parts.append(val)
    combined_text = " ".join(text_parts).replace("\xa0", " ")

    # 从组合文本中提取年份
    year: Optional[int] = None
    year_match = _YEAR_PATTERN.search(combined_text)
    if year_match:
        try:
            year = int(year_match.group())
        except ValueError:
            year = None

    # 从 snippet 中尝试提取作者（形如 "J. Smith, ..."）
    authors: List[str] = []
    snippet = (result.get("snippet") or "").strip()
    if snippet:
        head = snippet.split(" - ", 1)[0].strip()
        if "," in head and len(head) < 100:
            candidates = [a.strip() for a in head.split(",") if a.strip()]
            # 简单启发：看起来像人名的片段（含字母、短）
            for c in candidates[:5]:
                if re.match(r"^[A-Z][a-zA-Z.\s]+$", c) and len(c) < 40:
                    authors.append(c)

    link = result.get("link") or ""

    # venue：优先用 source 字段，其次从 displayed_link 或 link 提取域名
    venue: Optional[str] = None
    source_val = (result.get("source") or "").strip()
    if source_val:
        venue = source_val
    else:
        displayed_link = (result.get("displayed_link") or "").strip()
        if displayed_link:
            venue = displayed_link.split("://")[-1].split("/")[0]
        elif link:
            # 从 link URL 提取域名
            from urllib.parse import urlparse
            parsed = urlparse(link)
            if parsed.netloc:
                venue = parsed.netloc.replace("www.", "")

    return {
        "title": title,
        "authors": authors,
        "year": year,
        "venue": venue,
        "url": link,
        "snippet": combined_text,
    }


def _find_best_match(
    results: List[Dict[str, Any]],
    query: str,
    threshold: float = _SIMILARITY_THRESHOLD,
) -> Optional[Dict[str, Any]]:
    """从 Google 搜索结果中挑选最匹配的一项；返回的字典中带 similarity 字段。"""
    if not results:
        return None

    candidates = results[:_MAX_RESULTS_TO_CONSIDER]

    best_score = 0.0
    best: Optional[Dict[str, Any]] = None

    for r in candidates:
        parsed = _parse_google_result(r, query)
        if not parsed:
            continue
        sim = StringUtils.enhanced_title_similarity(query, parsed["title"])
        parsed["similarity"] = sim
        if sim > best_score:
            best_score = sim
            best = parsed
        if sim >= threshold:
            return best

    return best


def _search_one_title(title: str) -> Dict[str, Any]:
    """对单条标题执行谷歌搜索（带缓存）。返回统一格式结果。"""
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
            "source": "google_search",
            "error": "SERPAPI_API_KEY 未配置",
        }

    try:
        organic = _call_serpapi_google_search(title)
    except Exception as e:
        logger.warning(f"谷歌搜索检索失败 [{title[:30]}...]: {e}")
        return {
            "query_title": title,
            "found": False,
            "matched_title": None,
            "similarity": 0.0,
            "authors": [],
            "year": None,
            "venue": None,
            "url": None,
            "source": "google_search",
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
            "source": "google_search",
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
            "source": "google_search",
            "error": None if best else "谷歌搜索无结果",
        }

    # 仅命中时写入缓存，未命中不缓存以便下次重新检索
    if result.get("found"):
        _set_cached_result(title, result)
    return result


async def batch_search_google_search(titles: List[str]) -> List[Dict[str, Any]]:
    """
    批量检索多个标题（谷歌搜索 / SerpApi），返回结果列表。
    供 web_app.py 在谷歌学术也未找到时调用作为最终回退。

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
    """单条标题检索（对外异步入口）"""
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
            "source": "google_search",
            "error": "标题为空",
        }
    loop = asyncio.get_event_loop()
    executor = _get_executor()
    return await loop.run_in_executor(executor, _search_one_title, title.strip())
