"""
API 客户端基类
封装 aiohttp 请求、重试、限速逻辑
"""
import asyncio
import logging
import time
from typing import Any, Dict, Optional

import aiohttp

from checker.config import ApiConfig

logger = logging.getLogger(__name__)

MAX_RETRY = 3
RETRY_DELAY = 1.0   # 秒


class BaseApiClient:
    def __init__(self, config: ApiConfig, source_name: str):
        self.config = config
        self.source_name = source_name
        self._last_request_time: float = 0.0

    async def make_request(
        self,
        method: str,
        url: str,
        params: Optional[Dict[str, Any]] = None,
        json: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        发送 HTTP 请求，自动重试和限速。

        Returns:
            解析后的 JSON 响应字典
        Raises:
            ValueError: HTTP 错误或解析失败
        """
        headers = {
            "Accept": "application/json",
            "User-Agent": "CiteVerifierBot/1.0",
            **self.config.headers,
        }

        for attempt in range(MAX_RETRY):
            # 限速
            elapsed = time.monotonic() - self._last_request_time
            if elapsed < self.config.rate_limit:
                await asyncio.sleep(self.config.rate_limit - elapsed)

            try:
                async with aiohttp.ClientSession() as session:
                    async with session.request(
                        method,
                        url,
                        params=params,
                        json=json,
                        headers=headers,
                        timeout=aiohttp.ClientTimeout(total=self.config.timeout),
                    ) as resp:
                        self._last_request_time = time.monotonic()
                        if resp.status != 200:
                            text = await resp.text()
                            raise ValueError(
                                f"[{self.source_name}] HTTP {resp.status}: {text[:200]}"
                            )
                        return await resp.json()

            except aiohttp.ClientError as e:
                logger.warning(
                    f"[{self.source_name}] 请求失败 (attempt {attempt+1}/{MAX_RETRY}): {e}"
                )
                if attempt < MAX_RETRY - 1:
                    await asyncio.sleep(RETRY_DELAY * (attempt + 1))
                else:
                    raise ValueError(f"[{self.source_name}] 请求失败: {e}")

        raise ValueError(f"[{self.source_name}] 超过最大重试次数")
