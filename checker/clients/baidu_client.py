"""
中文文献检索客户端
通过 Selenium 驱动百度学术搜索，验证中文文献是否存在
"""

import asyncio
import json
import logging
import sqlite3
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from typing import Any, Dict, List, Optional

from checker.models import Reference, ExternalReference
from checker.utils import StringUtils

logger = logging.getLogger(__name__)

_executor = ThreadPoolExecutor(max_workers=4)

_CACHE_TTL = 86400
_CACHE_DB_PATH = Path(__file__).parent.parent.parent / "data/baidu_cache.db"


class BaiduCache:
    """SQLite 本地缓存"""

    def __init__(self, db_path: Path = _CACHE_DB_PATH):
        self.db_path = db_path
        self._init_db()

    def _init_db(self):
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        with sqlite3.connect(self.db_path) as conn:
            conn.execute("""
                CREATE TABLE IF NOT EXISTS baidu_search_cache (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    normalized_title TEXT UNIQUE NOT NULL,
                    result_json TEXT NOT NULL,
                    created_at REAL NOT NULL
                )
            """)
            conn.execute("CREATE INDEX IF NOT EXISTS idx_title ON baidu_search_cache(normalized_title)")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_created_at ON baidu_search_cache(created_at)")
            conn.commit()

    def get(self, normalized_title: str) -> Optional[Dict]:
        if not normalized_title:
            return None
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.execute("""
                SELECT result_json, created_at FROM baidu_search_cache
                WHERE normalized_title = ?
            """, (normalized_title,))
            row = cursor.fetchone()
            if row:
                result_json, created_at = row
                if time.time() - created_at < _CACHE_TTL:
                    try:
                        return json.loads(result_json)
                    except json.JSONDecodeError:
                        logger.warning("缓存数据 JSON 解析失败")
                        self.delete(normalized_title)
                else:
                    logger.debug(f"缓存过期: {normalized_title[:30]}...")
                    self.delete(normalized_title)
        return None

    def set(self, normalized_title: str, result: Dict) -> None:
        if not normalized_title:
            return
        result_json = json.dumps(result, ensure_ascii=False)
        with sqlite3.connect(self.db_path) as conn:
            try:
                conn.execute("""
                    INSERT OR REPLACE INTO baidu_search_cache
                    (normalized_title, result_json, created_at)
                    VALUES (?, ?, ?)
                """, (normalized_title, result_json, time.time()))
                conn.commit()
            except sqlite3.Error as e:
                logger.error(f"缓存写入失败: {e}")

    def delete(self, normalized_title: str) -> None:
        with sqlite3.connect(self.db_path) as conn:
            conn.execute("DELETE FROM baidu_search_cache WHERE normalized_title = ?", (normalized_title,))
            conn.commit()

    def clear_expired(self) -> int:
        cutoff = time.time() - _CACHE_TTL
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.execute("DELETE FROM baidu_search_cache WHERE created_at < ?", (cutoff,))
            conn.commit()
            return cursor.rowcount

    def get_stats(self) -> Dict[str, int]:
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.execute("SELECT COUNT(*) FROM baidu_search_cache")
            total = cursor.fetchone()[0]
            cutoff = time.time() - _CACHE_TTL
            cursor = conn.execute("SELECT COUNT(*) FROM baidu_search_cache WHERE created_at < ?", (cutoff,))
            expired = cursor.fetchone()[0]
            return {"total": total, "expired": expired}


_cache = BaiduCache()


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
        logger.debug(f"缓存命中: {title[:30]}...")
    return result


def _set_cached_result(title: str, result: Dict) -> None:
    normalized = _normalize_title(title)
    if not normalized:
        return
    _cache.set(normalized, result)
    logger.debug(f"缓存写入: {title[:30]}...")


def _run_selenium_search(titles: List[str]) -> List[Dict]:
    """在线程里同步运行 Selenium 搜索"""
    try:
        from checker.clients.baidu_selenium import batch_validate_parallel
        df = batch_validate_parallel(
            titles_list=titles,
            headless=False,
            exact_match=False,
            similarity_threshold=0.7,
            max_workers=min(4, len(titles)),
        )
        if df.empty:
            return []
        return df.to_dict(orient="records")
    except Exception as e:
        logger.error(f"Selenium 搜索失败: {e}")
        return []


class BaiduScholarClient:
    """通过 Selenium 驱动百度学术搜索的客户端。"""

    def __init__(self, **kwargs):
        pass

    async def search_reference(self, reference: Reference) -> ExternalReference:
        title = (reference.title or "").strip()
        if not title:
            raise ValueError("参考文献标题为空")

        cached_result = _get_cached_result(title)
        if cached_result:
            r = cached_result
        else:
            loop = asyncio.get_event_loop()
            results = await loop.run_in_executor(
                _executor, _run_selenium_search, [title]
            )

            if not results:
                raise ValueError("百度学术未返回结果")

            r = results[0]
            _set_cached_result(title, r)

        if not r.get("是否存在"):
            raise ValueError(f"百度学术未找到该文献（置信度: {r.get('置信度', 0):.2f}）")

        matched_title = r.get("匹配标题") or title
        sim = float(r.get("置信度") or 0)

        return ExternalReference(
            title=matched_title,
            authors=[r["作者"]] if r.get("作者") else None,
            source="baidu_scholar",
            metadata={
                "search_engine": "baidu_scholar_selenium",
                "similarity": sim,
                "original_query": title,
            },
        )


async def batch_search_baidu(titles: List[str]) -> List[Dict[str, Any]]:
    """
    批量检索多个标题，返回结果列表。
    供 web_app.py 里的批量接口直接调用。
    优先从本地缓存中查询，未命中时才调用 Selenium。
    """
    if not titles:
        return []

    results_map: Dict[str, Dict] = {}
    uncached_titles: List[str] = []

    for title in titles:
        cached = _get_cached_result(title)
        if cached:
            results_map[_normalize_title(title)] = cached
        else:
            uncached_titles.append(title)

    cache_hit_count = len(results_map)
    if cache_hit_count > 0:
        logger.info(f"批量搜索: 缓存命中 {cache_hit_count} 条，需要查询 {len(uncached_titles)} 条")

    if uncached_titles:
        loop = asyncio.get_event_loop()
        fresh_results = await loop.run_in_executor(
            _executor, _run_selenium_search, uncached_titles
        )

        for r in fresh_results:
            search_title = r.get("搜索标题", "")
            if search_title:
                normalized = _normalize_title(search_title)
                results_map[normalized] = r
                _set_cached_result(search_title, r)

    output = []
    for title in titles:
        normalized = _normalize_title(title)
        r = results_map.get(normalized)
        if r:
            output.append({
                "query_title":   r.get("搜索标题", ""),
                "found":         bool(r.get("是否存在", False)),
                "matched_title": r.get("匹配标题"),
                "similarity":    round(float(r.get("置信度") or 0), 4),
                "authors":       [r["作者"]] if r.get("作者") else [],
                "source":        "baidu_scholar",
                "error":         r.get("错误信息"),
            })
        else:
            output.append({
                "query_title":   title,
                "found":         False,
                "matched_title": None,
                "similarity":    0.0,
                "authors":       [],
                "source":        "baidu_scholar",
                "error":         "搜索失败",
            })
    return output


BaiduSearchClient = BaiduScholarClient