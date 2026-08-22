from typing import Dict, List, Optional
import json
import os
import re
import asyncio
import time
from pathlib import Path
from weakref import ref
import aiohttp

from parser.format.utils import clean_text, extract_id, split_references
from parser.pdf_parse_cache import (
    compute_pdf_sha256,
    get_cached_references,
    pdf_lock,
    store_cached_references,
)
from parser.utils.pdf_reader import pdf_to_text

MAX_RETRY_TIMES = 3
LLM_BATCH_MAX_ITEMS = 30
LLM_BATCH_MAX_CHARS = 18000
LLM_BATCH_CONCURRENCY = 4

# 尽早加载项目根目录 .env（被 web_app 以外的脚本直接 import 时也能读到配置）
try:
    from dotenv import load_dotenv as _load_dotenv
except ImportError:  # pragma: no cover
    _load_dotenv = None  # type: ignore[assignment]
_LLM_PROJECT_ROOT = Path(__file__).resolve().parent.parent
if _load_dotenv is not None:
    _load_dotenv(_LLM_PROJECT_ROOT / ".env")

# LLM API key should be set via environment variable or .env file
# export DASHSCOPE_API_KEY='your_api_key_here'


def _fallback_title(raw_str: str) -> str:
    """LLM未能提取出title时的兜底：用原始文献文本去掉行首编号后的前100字符作为title。"""
    s = raw_str.strip()
    # 去掉行首的 [数字]、数字.、(数字) 等编号
    s = re.sub(r'^\s*(\[\d+\]|\(\d+\)|\d+\.)\s*', '', s)
    # 折叠空白
    s = re.sub(r'\s+', ' ', s)
    return s[:100].strip()


def llm_parse(text: str, metrics: Optional[Dict] = None) -> List[Dict]:
    return asyncio.run(llm_parse_async(text, metrics=metrics))


def _read_pdf_cache(pdf_hash: str, metrics: Dict) -> Optional[List[Dict]]:
    try:
        return get_cached_references(pdf_hash)
    except Exception as exc:
        metrics["cache_error"] = str(exc)
        print(f"PDF parse cache read failed; parsing normally: {exc}")
        return None


def _write_pdf_cache(pdf_hash: str, references: List[Dict], metrics: Dict) -> bool:
    try:
        return store_cached_references(pdf_hash, references)
    except Exception as exc:
        metrics["cache_error"] = str(exc)
        print(f"PDF parse cache write failed; returning uncached result: {exc}")
        return False


def llm_parse_pdf(pdf_path: str, metrics: Optional[Dict] = None) -> List[Dict]:
    metrics = metrics if metrics is not None else {}
    metrics["hard_fallbacks"] = 0
    metrics.pop("cache_error", None)
    # Hashing the original bytes makes renamed copies share one cache entry.
    pdf_hash = compute_pdf_sha256(pdf_path)
    metrics["pdf_sha256"] = pdf_hash

    cached = _read_pdf_cache(pdf_hash, metrics)
    if cached is not None:
        metrics.update({
            "cache_hit": True,
            "extracted_characters": None,
            "pdf_extraction_seconds": 0.0,
            "llm_parsing_seconds": 0.0,
            "cache_write": False,
        })
        return cached

    # Avoid duplicate LLM work when the same PDF is uploaded concurrently in
    # this process. Recheck after acquiring the per-content lock.
    with pdf_lock(pdf_hash):
        cached = _read_pdf_cache(pdf_hash, metrics)
        if cached is not None:
            metrics.update({
                "cache_hit": True,
                "extracted_characters": None,
                "pdf_extraction_seconds": 0.0,
                "llm_parsing_seconds": 0.0,
                "cache_write": False,
            })
            return cached

        extraction_started = time.perf_counter()
        text = pdf_to_text(pdf_path)
        metrics["extracted_characters"] = len(text)
        metrics["pdf_extraction_seconds"] = time.perf_counter() - extraction_started

        llm_started = time.perf_counter()
        references = llm_parse(text, metrics=metrics)
        metrics["llm_parsing_seconds"] = time.perf_counter() - llm_started
        metrics["cache_hit"] = False
        metrics["cache_write"] = False
        if references and int(metrics.get("hard_fallbacks", 0)) == 0:
            metrics["cache_write"] = _write_pdf_cache(pdf_hash, references, metrics)
        return references
async def llm_parse_async(
    text: str,
    is_tidy=False,
    metrics: Optional[Dict] = None,
) -> List[Dict]:
    # Keep batch concurrency deliberately small so concurrent users do not each
    # fan out into dozens of upstream requests. _parse_reference_batches owns
    # one reusable HTTP session for the complete PDF parse.
    semaphore = asyncio.Semaphore(LLM_BATCH_CONCURRENCY)
    if is_tidy:
        ref_str_list = [i for i in re.split(r'(\n+)', text) if i.strip()]
        return await _parse_numbered(ref_str_list, semaphore, metrics=metrics)

    # 检测行首是否有 [数字] 编号 或 数字. 编号
    lines = text.split('\n')
    bracket_lines = [l for l in lines if re.match(r'^\s*\[\d+\]', l.strip())]
    dot_lines = [l for l in lines if re.match(r'^\s*\d+\.', l.strip())]

    has_bracket = len(bracket_lines) > 1
    has_dot = len(dot_lines) > 1

    if has_bracket and has_dot:
        # 中英文文献混排，一边用 [数字] 编号、一边用 数字. 编号：
        # 按行先分组（连续的 [数字] 行归一组，连续的 数字. 行归另一组），
        # 各自用对应规则切割后合并，避免互斥分支漏切其中一种格式的条目。
        groups: list[tuple[str, list[str]]] = []
        current_kind = None
        current_lines: list[str] = []
        for line in lines:
            stripped = line.strip()
            if re.match(r'^\[\d+\]', stripped):
                kind = 'bracket'
            elif re.match(r'^\d+\.', stripped):
                kind = 'dot'
            else:
                kind = current_kind
            if kind != current_kind and current_lines:
                groups.append((current_kind, current_lines))
                current_lines = []
            current_kind = kind
            current_lines.append(line)
        if current_lines:
            groups.append((current_kind, current_lines))

        all_split: list[str] = []
        for kind, group_lines in groups:
            group_text = '\n'.join(group_lines)
            if kind == 'bracket':
                all_split.extend(i for i in re.split(r'(?=\[\d+\])', group_text) if i.strip())
            elif kind == 'dot':
                all_split.extend(i for i in re.split(r'(?=^\s*\d+\.)', group_text, flags=re.MULTILINE) if i.strip())
            else:
                all_split.extend(i for i in re.split(r'(\n+)', group_text) if i.strip())
        return await _parse_numbered(all_split, semaphore, metrics=metrics)
    elif has_bracket:
        # 有 [数字] 编号：在每个 [数字] 处切割，避免 [J]/[M] 等文献类型标识被误判为切割点
        bracket_split = [i for i in re.split(r'(?=\[\d+\])', text) if i.strip()]
        return await _parse_numbered(bracket_split, semaphore, metrics=metrics)
    elif has_dot:
        # 有 数字. 编号（如中文国标格式，每节可能从1重新编号）：按行首切割
        dot_split = [i for i in re.split(r'(?=^\s*\d+\.)', text, flags=re.MULTILINE) if i.strip()]
        return await _parse_numbered(dot_split, semaphore, metrics=metrics)
    else:
        # 无编号：交给 llm_parse_bulk
        return await llm_parse_bulk(text, semaphore=semaphore, metrics=metrics)


async def _parse_numbered(
    ref_str_list: List[str],
    semaphore: asyncio.Semaphore,
    session: Optional[aiohttp.ClientSession] = None,
    metrics: Optional[Dict] = None,
) -> List[Dict]:
    if not ref_str_list:
        return []
    if len(ref_str_list[-1]) > 256:
        ref_str_list[-1] = ref_str_list[-1][:256]
    ref_str_list = [r for r in ref_str_list if len(r.strip()) >= 20]
    return await _parse_reference_batches(ref_str_list, semaphore, session, metrics)


def _make_batches(raw_refs: List[str]) -> List[List[str]]:
    """Split references by both item count and prompt size."""
    batches: List[List[str]] = []
    current: List[str] = []
    current_chars = 0
    for raw in raw_refs:
        if current and (
            len(current) >= LLM_BATCH_MAX_ITEMS
            or current_chars + len(raw) > LLM_BATCH_MAX_CHARS
        ):
            batches.append(current)
            current = []
            current_chars = 0
        current.append(raw)
        current_chars += len(raw)
    if current:
        batches.append(current)
    return batches


async def _parse_reference_batches(
    raw_refs: List[str],
    semaphore: asyncio.Semaphore,
    session: Optional[aiohttp.ClientSession] = None,
    metrics: Optional[Dict] = None,
) -> List[Dict]:
    """Parse references in batches and fall back only for missing items."""
    owns_session = session is None
    if session is None:
        session = aiohttp.ClientSession()
    try:
        batches = _make_batches(raw_refs)
        tasks = [
            _llm_parse_batch(batch, session, semaphore)
            for batch in batches
        ]
        parsed_batches = await asyncio.gather(*tasks)

        results: List[Dict] = []
        for batch, parsed_by_index in zip(batches, parsed_batches):
            missing = [i for i in range(len(batch)) if i not in parsed_by_index]
            fallback_results: Dict[int, Dict] = {}
            if missing:
                fallback_values = await asyncio.gather(*[
                    llm_str2ref(batch[i], semaphore, session=session, metrics=metrics)
                    for i in missing
                ])
                fallback_results = dict(zip(missing, fallback_values))

            for index, raw in enumerate(batch):
                parsed = parsed_by_index.get(index) or fallback_results.get(index) or {
                    "title": _fallback_title(raw),
                    "year": None,
                }
                results.append({
                    "id": extract_id(raw),
                    "raw": raw.strip(),
                    **parsed,
                })
        return results
    finally:
        if owns_session:
            await session.close()


def _normalize_llm_reference(reference: Dict, raw: str) -> Dict:
    if not str(reference.get('title') or '').strip():
        reference['title'] = _fallback_title(raw)
    year_val = reference.get('year')
    if year_val:
        year_m = re.search(r'\d{4}', str(year_val))
        reference['year'] = int(year_m.group()) if year_m else None
    else:
        reference['year'] = None
    # IDs and raw text are owned by the local splitter, never by model output.
    reference.pop('input_id', None)
    reference.pop('id', None)
    reference.pop('raw', None)
    return reference


async def _llm_parse_batch(
    raw_refs: List[str],
    session: aiohttp.ClientSession,
    semaphore: asyncio.Semaphore,
) -> Dict[int, Dict]:
    inputs = [{"input_id": i, "raw": raw} for i, raw in enumerate(raw_refs)]
    prompt = f"""You are an academic reference parser. Parse every input reference.
Return one JSON object with this exact shape:
{{"references": [{{"input_id": 0, "title": "...", "authors": ["..."], "venue": "...", "year": 2023, "url": "...", "volume": "...", "number": "...", "pages": "...", "reference_type": "article|series|thesis|monograph|unknown"}}]}}
Rules:
- Return exactly one result for every input_id and preserve input_id unchanged.
- Other than input_id and title, omit fields when unavailable.
- Return JSON only.

Inputs:
{json.dumps(inputs, ensure_ascii=False)}"""
    payload = {
        "model": "deepseek-v4-flash",
        "messages": [
            {"role": "system", "content": "You extract structured academic references."},
            {"role": "user", "content": prompt},
        ],
        "max_tokens": 8000,
        "temperature": 0.1,
        "thinking": {"type": "disabled"},
        "response_format": {"type": "json_object"},
    }
    url = "https://api.deepseek.com/chat/completions"
    headers = {
        "Authorization": f"Bearer {os.getenv('DASHSCOPE_API_KEY')}",
        "Content-Type": "application/json",
    }

    for attempt in range(MAX_RETRY_TIMES):
        try:
            async with semaphore:
                async with session.post(url, headers=headers, json=payload) as resp:
                    resp_json = await resp.json()
                    if "choices" not in resp_json:
                        err_msg = resp_json.get("error", {}).get("message", resp_json)
                        raise ValueError(f"API returned HTTP {resp.status}: {err_msg}")
                    raw_output = resp_json["choices"][0]["message"]["content"].strip()
                    decoded = json.loads(raw_output)
                    refs = decoded.get("references", [])
                    if not isinstance(refs, list):
                        raise ValueError("LLM response references is not a list")

                    parsed: Dict[int, Dict] = {}
                    for ref_data in refs:
                        if not isinstance(ref_data, dict):
                            continue
                        input_id = ref_data.get("input_id")
                        if isinstance(input_id, str) and input_id.isdigit():
                            input_id = int(input_id)
                        if not isinstance(input_id, int) or not 0 <= input_id < len(raw_refs):
                            continue
                        if input_id in parsed:
                            continue
                        parsed[input_id] = _normalize_llm_reference(
                            ref_data.copy(), raw_refs[input_id]
                        )
                    return parsed
        except Exception as e:
            print(f"llm batch attempt {attempt + 1} failed: {e}")
    return {}


async def parse_task(text: str, reference: Dict, semaphore: asyncio.Semaphore) -> Dict:
    result = await llm_str2ref(text, semaphore)
    reference.update(result)
    return reference


async def llm_str2ref(
    raw_str: str,
    semaphore: asyncio.Semaphore,
    session: Optional[aiohttp.ClientSession] = None,
    metrics: Optional[Dict] = None,
) -> Dict:
    prompt = f"""
        You are an academic writing assistant that can extract references from academic papers. Please extract references from the following text and output in JSON format:
        {{
            "title": "Title",
            "authors": "Authors",
            "venue": "Journal/Conference/Publication platform name",
            "year": "Year",
            "url": "Link (if available)",
            "volume": "Volume (if available)",
            "number": "Issue (if available)",
            "pages": "Pages (if available)",
            "reference_type": "Reference type, one of the following values: ['article', 'series', 'thesis', 'monograph', 'unknown']",
        }},
        Field description:
        - authors: String array containing all author names
        - Other fields can be omitted if no information is available
        - reference_type field should strictly select from the following types and prioritize the most appropriate type based on reference content:
            - 'article': Conference paper or journal article
            - 'series': Book series, serial publications
            - 'thesis': Thesis
            - 'monograph': Monograph, book
            - 'unknown': Use when type cannot be determined
        The following text is a reference:
        {raw_str}
        Please start extracting the reference:
    """
    url = "https://api.deepseek.com/chat/completions"
    headers = {
        "Authorization": f"Bearer {os.getenv('DASHSCOPE_API_KEY')}",
        "Content-Type": "application/json"
    }
    payload = {
        "model": "deepseek-v4-flash",
        "messages": [
            {"role": "system", "content": "You are a helpful assistant that extracts references from academic papers."},
            {"role": "user", "content": prompt}
        ],
        "max_tokens": 1000,
        "temperature": 0.1,
        "thinking": {"type": "disabled"},
        "response_format": {"type": "json_object"},
    }
    owns_session = session is None
    if session is None:
        session = aiohttp.ClientSession()
    retry_times = MAX_RETRY_TIMES
    try:
        while retry_times > 0:
            try:
                async with semaphore:
                    async with session.post(url, headers=headers, json=payload) as resp:
                        resp_json = await resp.json()
                        if "choices" not in resp_json:
                            err_msg = resp_json.get("error", {}).get("message", resp_json)
                            print(f"API 错误 (HTTP {resp.status}): {err_msg}")
                            raise ValueError(f"API 返回错误: {err_msg}")
                        raw_reference = resp_json["choices"][0]["message"]["content"].strip()
                        raw_reference = raw_reference[raw_reference.find('{'):raw_reference.rfind('}')+1]
                        reference = {}
                        try:
                            reference = json.loads(raw_reference)
                        except json.JSONDecodeError:
                            title_m = re.search(r'"title"\s*:\s*"([^"]+)"', raw_reference)
                            if title_m:
                                reference = {"title": title_m.group(1)}
                            else:
                                print(f"Failed to parse JSON: {raw_reference[:100]}")
                        return _normalize_llm_reference(reference, raw_str)
            except Exception as e:
                retry_times -= 1
                print(f"Error occurred: {e}, ref_str: {raw_str}. Retrying... ({MAX_RETRY_TIMES - retry_times}/{MAX_RETRY_TIMES})")
        # 三次重试均失败：用原始文献文本兜底，避免该条目被静默丢弃
        if metrics is not None:
            metrics["hard_fallbacks"] = int(metrics.get("hard_fallbacks", 0)) + 1
        return {"title": _fallback_title(raw_str), "year": None}
    finally:
        if owns_session:
            await session.close()


async def llm_parse_bulk(
    text: str,
    session: Optional[aiohttp.ClientSession] = None,
    semaphore: Optional[asyncio.Semaphore] = None,
    metrics: Optional[Dict] = None,
) -> List[Dict]:
    """
    无编号参考文献：按年份结尾切割成单条，再按条数和字符数批量解析。
    """
    # 过滤掉独立的标题行和页眉行
    lines = [
        l.strip() for l in text.split('\n')
        if l.strip() and not re.match(r'^references?$', l.strip(), re.IGNORECASE)
    ]

    # 按年份结尾切割成单条
    raw_refs = []
    current = []
    for line in lines:
        if not current:
            current.append(line)
            continue
        prev_full = ' '.join(current)
        prev_ends_with_year = bool(re.search(r'\d{4}[a-z]?\.\s*$', prev_full))
        curr_starts_name = bool(re.match(r'^[A-Z][a-z]', line))
        if prev_ends_with_year and curr_starts_name:
            raw_refs.append(prev_full)
            current = [line]
        else:
            current.append(line)
    if current:
        raw_refs.append(' '.join(current))
    # 过滤太短的条目，并截断异常长的条目（超过500字符说明切割有误，取前500字符）
    raw_refs = [r[:500] if len(r) > 500 else r for r in raw_refs if len(r) >= 20]

    if not raw_refs:
        raw_refs = lines
    if not raw_refs:
        return []

    semaphore = semaphore or asyncio.Semaphore(LLM_BATCH_CONCURRENCY)
    refs = await _parse_reference_batches(raw_refs, semaphore, session, metrics)
    # Unnumbered references have no source id, so keep the previous sequential
    # public id behaviour.
    for index, reference in enumerate(refs, start=1):
        reference['id'] = index
    return refs
