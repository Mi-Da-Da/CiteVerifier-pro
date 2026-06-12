import re


def clean_text(text: str) -> str:
    if not text:
        return ""
    text = " ".join(text.strip().split())
    text = re.sub(r'[^\w\s.,;:!?()\[\]{}<>"\'‐-]', '', text)
    return text


def extract_id(ref_str: str) -> int | None:
    s = ref_str.strip()
    m = re.match(r'^\[(\d+)\]', s)
    if m:
        return int(m.group(1))
    m = re.match(r'^(\d+)\.', s)
    if m:
        return int(m.group(1))
    m = re.match(r'^\((\d+)\)', s)
    if m:
        return int(m.group(1))
    return None


def detect_reference_format(text: str) -> str:
    lines = [l.strip() for l in text.split('\n') if l.strip()]
    total = len(lines) if lines else 1
    bracket_count = sum(1 for l in lines if re.match(r'^\[\d+\]', l))
    dot_count     = sum(1 for l in lines if re.match(r'^\d+\.', l))
    paren_count   = sum(1 for l in lines if re.match(r'^\(\d+\)', l))
    threshold = 0.15
    if bracket_count / total >= threshold:
        return 'bracket'
    if dot_count / total >= threshold:
        return 'dot'
    if paren_count / total >= threshold:
        return 'paren'
    return 'none'


def _is_new_ref_line(line: str, prev_line: str) -> bool:
    """
    判断当前行是否是新参考文献的起始行。
    条件：上一行以句号/年份结尾，且当前行以大写字母+小写字母开头（作者姓名格式）
    """
    s = line.strip()
    p = prev_line.strip()
    if not s or not p:
        return False
    prev_ends = bool(re.search(r'\.\s*$|\d{4}[a-z]?\.\s*$', p))
    curr_starts_name = bool(re.match(r'^[A-Z][a-záéíóúàèìòùäëïöü\-]+', s))
    return prev_ends and curr_starts_name


def split_references(text: str) -> list[str]:
    fmt = detect_reference_format(text)

    if fmt == 'bracket':
        parts = re.split(r'(?=^\s*\[\d+\])', text, flags=re.MULTILINE)
        return [p.strip() for p in parts if len(p.strip()) >= 15]

    elif fmt == 'dot':
        parts = re.split(r'(?=^\d+\.)', text, flags=re.MULTILINE)
        return [p.strip() for p in parts if len(p.strip()) >= 15]

    elif fmt == 'paren':
        parts = re.split(r'(?=^\(\d+\))', text, flags=re.MULTILINE)
        return [p.strip() for p in parts if len(p.strip()) >= 15]

    else:
        # 无编号格式

        # 策略1：按空行分割
        parts = [p.strip() for p in re.split(r'\n{2,}', text) if len(p.strip()) >= 15]
        if len(parts) > 1:
            # 合并跨段落的同一条文献（上一段不以年份结尾说明是续行）
            merged = [parts[0]]
            for p in parts[1:]:
                prev = merged[-1]
                if not re.search(r'\d{4}[a-z]?\.\s*$', prev) and _is_new_ref_line(p, prev) is False:
                    merged[-1] = prev + ' ' + p
                else:
                    merged.append(p)
            return [p for p in merged if len(p) >= 15]

        # 策略2：按行分组，识别新文献起始行
        lines = [l for l in text.split('\n') if l.strip()]
        if not lines:
            return []

        groups = []
        current = [lines[0].strip()]
        for i in range(1, len(lines)):
            if _is_new_ref_line(lines[i], lines[i-1]):
                groups.append(' '.join(current))
                current = [lines[i].strip()]
            else:
                current.append(lines[i].strip())
        if current:
            groups.append(' '.join(current))

        result = [g for g in groups if len(g) >= 15]
        if len(result) > 1:
            return result

        # 策略3：每行一条（最后兜底）
        return [l.strip() for l in lines if len(l.strip()) >= 15]