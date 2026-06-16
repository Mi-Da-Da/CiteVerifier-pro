from typing import Dict, List
import json
import os
import re
import asyncio
from weakref import ref
import aiohttp

from parser.format.utils import clean_text, extract_id, split_references
from parser.utils.pdf_reader import pdf_to_text

MAX_RETRY_TIMES = 3

# LLM API key should be set via environment variable
# export DASHSCOPE_API_KEY='your_api_key_here'
if 'DASHSCOPE_API_KEY' not in os.environ:
    os.environ['DASHSCOPE_API_KEY'] = ''


def _fallback_title(raw_str: str) -> str:
    """LLM未能提取出title时的兜底：用原始文献文本去掉行首编号后的前100字符作为title。"""
    s = raw_str.strip()
    # 去掉行首的 [数字]、数字.、(数字) 等编号
    s = re.sub(r'^\s*(\[\d+\]|\(\d+\)|\d+\.)\s*', '', s)
    # 折叠空白
    s = re.sub(r'\s+', ' ', s)
    return s[:100].strip()


def llm_parse(text: str) -> List[Dict]:
    return asyncio.run(llm_parse_async(text))


def llm_parse_pdf(pdf_path: str) -> List[Dict]:
    text = pdf_to_text(pdf_path)
    return llm_parse(text)


async def llm_parse_async(text: str, is_tidy=False) -> List[Dict]:
    semaphore = asyncio.Semaphore(32)

    if is_tidy:
        ref_str_list = [i for i in re.split(r'(\n+)', text) if i.strip()]
        return await _parse_numbered(ref_str_list, semaphore)

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
        return await _parse_numbered(all_split, semaphore)
    elif has_bracket:
        # 有 [数字] 编号：在每个 [数字] 处切割，避免 [J]/[M] 等文献类型标识被误判为切割点
        bracket_split = [i for i in re.split(r'(?=\[\d+\])', text) if i.strip()]
        return await _parse_numbered(bracket_split, semaphore)
    elif has_dot:
        # 有 数字. 编号（如中文国标格式，每节可能从1重新编号）：按行首切割
        dot_split = [i for i in re.split(r'(?=^\s*\d+\.)', text, flags=re.MULTILINE) if i.strip()]
        return await _parse_numbered(dot_split, semaphore)
    else:
        # 无编号：交给 llm_parse_bulk
        return await llm_parse_bulk(text)


async def _parse_numbered(ref_str_list: List[str], semaphore: asyncio.Semaphore) -> List[Dict]:
    if not ref_str_list:
        return []
    if len(ref_str_list[-1]) > 256:
        ref_str_list[-1] = ref_str_list[-1][:256]
    ref_str_list = [r for r in ref_str_list if len(r.strip()) >= 20]
    ref_list = [{'id': extract_id(ref_str), 'raw': ref_str.strip()} for ref_str in ref_str_list]
    tasks = [parse_task(ref_str, ref_list[i], semaphore) for i, ref_str in enumerate(ref_str_list)]
    return await asyncio.gather(*tasks)


async def parse_task(text: str, reference: Dict, semaphore: asyncio.Semaphore) -> Dict:
    result = await llm_str2ref(text, semaphore)
    reference.update(result)
    return reference


async def llm_str2ref(raw_str: str, semaphore: asyncio.Semaphore) -> Dict:
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
        "temperature": 0.1
    }
    retry_times = MAX_RETRY_TIMES
    while retry_times > 0:
        try:
            async with semaphore:
                async with aiohttp.ClientSession() as session:
                    async with session.post(url, headers=headers, json=payload) as resp:
                        resp_json = await resp.json()
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
                        if not str(reference.get('title') or '').strip():
                            # LLM 没能给出 title，用原始文献文本兜底，避免该条目被静默丢弃
                            reference['title'] = _fallback_title(raw_str)
                        year_val = reference.get('year')
                        if year_val:
                            year_m = re.search(r'\d{4}', str(year_val))
                            reference['year'] = int(year_m.group()) if year_m else None
                        else:
                            reference['year'] = None
                        return reference
        except Exception as e:
            retry_times -= 1
            print(f"Error occurred: {e}, ref_str: {raw_str}. Retrying... ({MAX_RETRY_TIMES - retry_times}/{MAX_RETRY_TIMES})")
    # 三次重试均失败：用原始文献文本兜底，避免该条目被静默丢弃
    return {"title": _fallback_title(raw_str), "year": None}


async def llm_parse_bulk(text: str) -> List[Dict]:
    """
    无编号参考文献：按年份结尾切割成单条，每20条一批发给LLM解析。
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

    # 每20条一批
    BATCH = 10
    batches = [raw_refs[i:i+BATCH] for i in range(0, len(raw_refs), BATCH)]
    if not batches:
        batches = [lines]

    all_refs = []
    id_offset = 0

    for batch in batches:
        batch_text = '\n'.join(batch)
        prompt = f"""You are an academic reference parser. The following text contains references from an academic paper.
Extract ALL references and return them as a JSON array. Each element:
{{
    "title": "Paper title",
    "authors": ["Author1", "Author2"],
    "venue": "Journal or conference name",
    "year": 2023,
    "url": "URL if available",
    "reference_type": "article|series|thesis|monograph|unknown"
}}
Return ONLY the JSON array, no markdown, no explanation.

References:
{batch_text}"""

        url = "https://api.deepseek.com/chat/completions"
        headers = {
            "Authorization": f"Bearer {os.getenv('DASHSCOPE_API_KEY')}",
            "Content-Type": "application/json"
        }
        payload = {
            "model": "deepseek-v4-flash",
            "messages": [
                {"role": "system", "content": "You are a reference extractor. Always return valid JSON array only."},
                {"role": "user", "content": prompt}
            ],
            "max_tokens": 4000,
            "temperature": 0.1
        }

        print(f"DEBUG 发送第{id_offset//20+1}批，条数: {len(batch)}, 字符数: {sum(len(r) for r in batch)}")
        for attempt in range(MAX_RETRY_TIMES):
            try:
                async with aiohttp.ClientSession() as session:
                    async with session.post(url, headers=headers, json=payload) as resp:
                        resp_json = await resp.json()
                        raw = resp_json["choices"][0]["message"]["content"].strip()
                        print(f"DEBUG LLM返回字符数: {len(raw)}")
                        start = raw.find('[')
                        end = raw.rfind(']') + 1
                        if start == -1 or end == 0:
                            print(f"DEBUG LLM返回: {raw[:200]}")
                            raise ValueError("No JSON array found")
                        try:
                            refs = json.loads(raw[start:end])
                        except json.JSONDecodeError:
                            # JSON有特殊字符，清理后重试
                            cleaned_raw = raw[start:end]
                            # 替换常见破坏JSON的特殊字符
                            cleaned_raw = cleaned_raw.replace('’', "'").replace('‘', "'")
                            cleaned_raw = cleaned_raw.replace('´', "'").replace('`', "'")
                            cleaned_raw = cleaned_raw.replace('“', '"').replace('”', '"')
                            try:
                                refs = json.loads(cleaned_raw)
                            except json.JSONDecodeError:
                                titles = re.findall(r'"title"\s*:\s*"((?:[^"\\]|\\.)*)"', raw)
                                refs = [{"title": t} for t in titles if t.strip()]
                                if not refs:
                                    raise
                        cleaned = []
                        for r in refs:
                            if not r.get('title', '').strip():
                                continue
                            year_val = r.get('year')
                            if year_val:
                                year_m = re.search(r'\d{4}', str(year_val))
                                r['year'] = int(year_m.group()) if year_m else None
                            else:
                                r['year'] = None
                            r['id'] = id_offset + len(cleaned) + 1
                            r.setdefault('raw', r.get('title', ''))
                            cleaned.append(r)
                        id_offset += len(cleaned)
                        all_refs.extend(cleaned)
                        break
            except Exception as e:
                print(f"llm_parse_bulk batch attempt {attempt+1} failed: {e}")

    return all_refs