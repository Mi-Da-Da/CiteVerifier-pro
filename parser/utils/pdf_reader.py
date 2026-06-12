from PyPDF2 import PdfReader
import re

REFERENCE_PATTERNS = [
    r'^references?\s*$',
    r'^bibliography\s*$',
    r'^bibliographies\s*$',
    r'^works?\s*cited\s*$',
    r'^cited\s*references?\s*$',
    r'^literature\s*cited\s*$',
    r'^sources?\s*cited\s*$',
    r'^notes?\s*and\s*references?\s*$',
    r'^endnotes?\s*$',
    r'^\d+[\.\s]+references?\s*$',
    r'^[ivxlcdmIVXLCDM]+[\.\s]+references?\s*$',
    r'^参考文献\s*$',
    r'^参\s*考\s*文\s*献\s*$',
    r'^参考资料\s*$',
    r'^引用文献\s*$',
    r'^文献\s*$',
    r'^引\s*文\s*$',
    r'^\d+[\.\s]+参考文献\s*$',
]

LOOSE_PATTERNS = [
    r'^.{0,20}references?\s*$',
    r'^.{0,20}bibliography\s*$',
    r'^.{0,10}参考文献\s*$',
    r'^.{0,10}参考资料\s*$',
    r'^.{0,10}引用文献\s*$',
]

HEADER_PATTERNS = [
    r'published as',
    r'conference paper at',
    r'workshop on',
    r'preprint server',
    r'under review',
]

# ===== 以下为中文论文专属规则，仅在检测到中文参考文献时启用 =====

# 中文论文页眉（学校名+论文类型行）
CHINESE_HEADER_PATTERNS = [
    r'^.{0,15}大学.{0,10}(博士|硕士|学位)论文\s*$',
]

# 中文参考文献章节标题（需要过滤）
SECTION_TITLE_PATTERNS = [
    r'^[（(][一二三四五六七八九十百][）)]\s*.{0,15}\s*$',   # （一）著作类
    r'^[一二三四五六七八九十][、､]\s*.{0,15}\s*$',          # 一、中文资料 / 二､英文资料
    r'^[（(][一二三四五六七八九十百][）)]\s*$',
]

_CJK_PATTERN = re.compile(r'[\u4e00-\u9fff]')


def _fix_ocr_bracket(line: str) -> str:
    """修正PyPDF2常见OCR错误：方括号编号中小写l/O/I被误读，如 [l] -> [1]"""
    def _fix(m):
        inner = m.group(1)
        inner = re.sub(r'[lLIi]', '1', inner)
        inner = re.sub(r'[Oo]', '0', inner)
        return f'[{inner}]'
    return re.sub(r'^\[([lLOoIi\d]+)\]', _fix, line)


def _clean_leading_page_num(s: str) -> str:
    """去除行首粘连的页码，如 '4453-64.' -> '53-64.'"""
    return re.sub(r'^\d{2,3}(?=[^\d.])', '', s)


def pdf_to_text(pdf_path: str, references_only: bool = True) -> str:
    reader = PdfReader(pdf_path)
    full_text = ""
    for page in reader.pages:
        text = page.extract_text() or ""
        full_text += text + "\n"

    if not references_only:
        return full_text

    lines = full_text.split('\n')
    ref_start_idx = -1

    # 第一遍：严格匹配
    for i, line in enumerate(lines):
        stripped = line.strip()
        if not stripped:
            continue
        for pattern in REFERENCE_PATTERNS:
            if re.match(pattern, stripped, re.IGNORECASE):
                ref_start_idx = i
                break
        if ref_start_idx >= 0:
            break

    # 第二遍：严格匹配失败才用宽松匹配
    if ref_start_idx < 0:
        for i, line in enumerate(lines):
            stripped = line.strip()
            if not stripped:
                continue
            for pattern in LOOSE_PATTERNS:
                if re.match(pattern, stripped, re.IGNORECASE):
                    ref_start_idx = i
                    break
            if ref_start_idx >= 0:
                break

    if ref_start_idx >= 0:
        content_lines = lines[ref_start_idx + 1:]
    else:
        fallback_start = int(len(lines) * 0.7)
        content_lines = lines[fallback_start:]

    # 判断这部分内容是否为中文参考文献（含有中文字符即认为是中文论文）
    is_chinese = any(_CJK_PATTERN.search(l) for l in content_lines)

    # 过滤噪声行（原有通用逻辑，对英文论文行为保持不变）
    filtered = []
    for l in content_lines:
        s = l.strip()
        if not s:
            filtered.append(l)
            continue
        # 纯页码行
        if re.match(r'^\d+$', s):
            continue
        # 英文页眉
        if any(re.search(p, s, re.IGNORECASE) for p in HEADER_PATTERNS) and len(s) < 100:
            continue

        if is_chinese:
            # 中文页眉（学校名/论文标题行）
            if any(re.match(p, s) for p in CHINESE_HEADER_PATTERNS):
                continue
            # 中文参考文献章节标题行
            if any(re.match(p, s) for p in SECTION_TITLE_PATTERNS):
                continue
            # 粘连了页码的"43参考文献"/"216参考文献"这类行
            if re.match(r'^\d{2,3}参考文献', s):
                continue
            # 清理行首粘连页码，再做OCR修正（仅中文论文启用）
            s = _clean_leading_page_num(s)
            s = _fix_ocr_bracket(s)

        filtered.append(s)

    return '\n'.join(filtered)