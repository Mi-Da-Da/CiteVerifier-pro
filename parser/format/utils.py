import re


def clean_text(text: str) -> str:
    if not text:
        return ""
    text = " ".join(text.strip().split())
    text = re.sub(r'[^\w\s.,;:!?()\[\]{}<>"\'-]', '', text)
    return text


def extract_id(ref_str: str) -> int | None:
    match = re.match(r'^\[(\d+)\]', ref_str.strip())
    if match:
        return int(match.group(1))
    match = re.match(r'^(\d+)\.', ref_str.strip())
    if match:
        return int(match.group(1))
    return None
