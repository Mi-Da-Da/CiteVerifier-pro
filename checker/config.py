"""
checker 模块配置
API Key 统一从环境变量读取，也可以直接在此文件中填写（不推荐提交到 git）
"""
import os
from dataclasses import dataclass, field
from typing import Dict, Any


@dataclass
class ApiConfig:
    base_url: str
    api_key: str
    timeout: int = 10
    headers: Dict[str, str] = field(default_factory=dict)
    rate_limit: float = 1.0   # 请求间隔秒数


class _Config:
    # ── 相似度权重 ──────────────────────────────────────────
    SIMILARITY_CONFIG: Dict[str, Any] = {
        "field_weights": {
            "title":   0.5,
            "authors": 0.25,
            "year":    0.15,
            "venue":   0.10,
        },
        "thresholds": {
            "title":   0.85,
            "authors": 0.70,
            "year":    1.00,
            "venue":   0.70,
        },
    }

    def get_api_config(self, name: str) -> ApiConfig:
        """根据名称返回 API 配置，Key 从环境变量读取"""
        name = name.lower()

        raise ValueError(f"未知的 API 配置名称: {name}")

    def get_similarity_threshold(self, field: str) -> float:
        return self.SIMILARITY_CONFIG["thresholds"].get(field, 0.8)


config = _Config()
