"""
中文文献检索客户端
通过 Selenium 驱动百度学术搜索，验证中文文献是否存在
"""

import asyncio
import logging
from concurrent.futures import ThreadPoolExecutor
from typing import Any, Dict, List

from checker.models import Reference, ExternalReference
from checker.utils import StringUtils

logger = logging.getLogger(__name__)

# 线程池（Selenium 是同步的，放线程池里跑避免阻塞 FastAPI）
_executor = ThreadPoolExecutor(max_workers=4)


def _run_selenium_search(titles: List[str]) -> List[Dict]:
    """在线程里同步运行 Selenium 搜索"""
    try:
        from checker.clients.baidu_selenium import batch_validate_parallel
        df = batch_validate_parallel(
            titles_list=titles,
            headless=True,
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
        pass  # 不需要 API Key

    async def search_reference(self, reference: Reference) -> ExternalReference:
        title = (reference.title or "").strip()
        if not title:
            raise ValueError("参考文献标题为空")

        loop = asyncio.get_event_loop()
        results = await loop.run_in_executor(
            _executor, _run_selenium_search, [title]
        )

        if not results:
            raise ValueError("百度学术未返回结果")

        r = results[0]
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
    """
    if not titles:
        return []

    loop = asyncio.get_event_loop()
    results = await loop.run_in_executor(
        _executor, _run_selenium_search, titles
    )

    output = []
    for r in results:
        output.append({
            "query_title":   r.get("搜索标题", ""),
            "found":         bool(r.get("是否存在", False)),
            "matched_title": r.get("匹配标题"),
            "similarity":    round(float(r.get("置信度") or 0), 4),
            "authors":       [r["作者"]] if r.get("作者") else [],
            "source":        "baidu_scholar",
            "error":         r.get("错误信息"),
        })
    return output


# 兼容旧代码
BaiduSearchClient = BaiduScholarClient
