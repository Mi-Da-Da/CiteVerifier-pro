from PyPDF2 import PdfReader
import re


REFERENCE_PATTERNS = [
    r'^references?\s*$',
    r'^references?\s*\n',
    r'^bibliography\s*$',
    r'^works?\s*cited\s*$',
    r'^参考文献\s*$',
    r'^参考\s*文献?\s*$',
    r'^reference\s*$',
]


def pdf_to_text(pdf_path: str, references_only: bool = True) -> str:
    reader = PdfReader(pdf_path)
    full_text = ""
    for page in reader.pages:
        full_text += page.extract_text() + "\n"

    if not references_only:
        return full_text

    lines = full_text.split('\n')
    ref_start_idx = -1

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

    if ref_start_idx >= 0:
        return '\n'.join(lines[ref_start_idx:])

    return full_text
