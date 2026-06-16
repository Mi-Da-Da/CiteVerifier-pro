from __future__ import annotations

import asyncio
import csv
import hashlib
import io
import logging
import multiprocessing as mp
import os
import re
import sqlite3
import threading
import time
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)

from user_database import init_user_db, register_user, login_user
from fastapi import FastAPI, HTTPException, Request, File, Form, UploadFile
from fastapi.responses import HTMLResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from pydantic import BaseModel, Field

from parser.llm_parser import llm_parse_pdf

from dblp_match import (
    _db_has_word_index,
    _sqlite_readonly_fast,
    _match_worker_init_index,
    _match_one_title_index,
    load_all_titles_from_db,
    search_dblp_brute_force,
    search_dblp_by_index,
)
from runtime_store import RuntimeStore

BASE_DIR = Path(__file__).resolve().parent
DEFAULT_DB_PATH = Path(os.getenv("DBLP_DB_PATH", "dblp.sqlite")).expanduser().resolve()
DATA_DIR = Path(os.getenv("CITEVERIFIER_DATA_DIR", str(BASE_DIR / "data"))).expanduser().resolve()
RUNTIME_DB_PATH = Path(
    os.getenv("CITEVERIFIER_RUNTIME_DB", str(DATA_DIR / "runtime.sqlite"))
).expanduser().resolve()
MAX_BATCH_TITLES = 1000

APP_VERSION = "0.1.0"

# ── 进度状态 ────────────────────────────────────────────────
_progress: dict[str, Any] = {
    "status": "idle",   # idle / parsing / searching / done / error
    "stage": "",
    "total": 0,
    "processed": 0,
    "found": 0,
}
_progress_lock = threading.Lock()


def _set_progress(**kwargs: Any) -> None:
    with _progress_lock:
        _progress.update(kwargs)


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_user_db()
    yield


app = FastAPI(
    title="CiteVerifier Web",
    description="Web UI for DBLP title lookup in CiteVerifier.",
    version=APP_VERSION,
    lifespan=lifespan,
)

templates = Jinja2Templates(directory=str(BASE_DIR / "templates"))
app.mount("/static", StaticFiles(directory=str(BASE_DIR / "static")), name="static")

_brute_cache_lock = threading.Lock()
_brute_cache: dict[str, list[tuple[int, str, str]]] = {}
runtime_store = RuntimeStore(RUNTIME_DB_PATH)


class TitleSearchRequest(BaseModel):
    title: str = Field(..., min_length=1)
    max_candidates: int = Field(default=100000, ge=1, le=500000)
    lang: str = Field(default="en")  # zh 走百度学术, en 走 DBLP


class BatchTitleSearchRequest(BaseModel):
    titles: list[str] = Field(default_factory=list)
    max_candidates: int = Field(default=100000, ge=1, le=500000)
    lang: str = Field(default="en")  # zh 走百度学术, en 走 DBLP


class RegisterRequest(BaseModel):
    username: str = Field(..., min_length=3, max_length=20)
    password: str = Field(..., min_length=6)
    email: str = Field(...)


class LoginRequest(BaseModel):
    username: str
    password: str


def _resolve_db_path() -> Path:
    return DEFAULT_DB_PATH


def _normalize_title(text: str) -> str:
    return " ".join(str(text or "").strip().split())


def _normalize_title_list(values: list[str]) -> list[str]:
    dedup: list[str] = []
    seen: set[str] = set()
    for raw in values:
        title = _normalize_title(raw)
        if not title:
            continue
        key = title.casefold()
        if key in seen:
            continue
        seen.add(key)
        dedup.append(title)
    return dedup


def _titles_from_csv_upload(file: UploadFile) -> list[str]:
    filename = file.filename or "upload.csv"
    if not filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail=f"Only CSV files are allowed: {filename}")

    raw = file.file.read()
    if not raw:
        raise HTTPException(status_code=400, detail="CSV file is empty.")

    try:
        text = raw.decode("utf-8-sig")
    except UnicodeDecodeError:
        text = raw.decode("gb18030", errors="replace")

    sample = text[:4096]
    try:
        dialect = csv.Sniffer().sniff(sample, delimiters=",;\t")
    except csv.Error:
        dialect = csv.excel

    try:
        sniffed_header = csv.Sniffer().has_header(sample)
    except csv.Error:
        sniffed_header = False

    rows = list(csv.reader(io.StringIO(text), dialect=dialect))
    if not rows:
        raise HTTPException(status_code=400, detail="CSV file is empty.")

    header_candidates = {
        "title",
        "query_title",
        "paper_title",
        "publication_title",
        "article_title",
        "标题",
        "论文标题",
        "文献标题",
    }
    first_row = [cell.strip() for cell in rows[0]]
    first_row_keys = [cell.casefold() for cell in first_row]
    candidate_keys = {c.casefold() for c in header_candidates}

    title_index = 0
    has_header = sniffed_header or any(key in candidate_keys for key in first_row_keys)
    if has_header:
        for idx, key in enumerate(first_row_keys):
            if key in candidate_keys:
                title_index = idx
                break
        data_rows = rows[1:]
    else:
        data_rows = rows

    titles = [row[title_index] for row in data_rows if len(row) > title_index]
    return _normalize_title_list(titles)


_CJK_PATTERN = re.compile(r'[\u4e00-\u9fff]')


def _is_chinese_title(title: str) -> bool:
    return bool(_CJK_PATTERN.search(title))


def _run_batch_search(titles: list[str], max_candidates: int, extra_item_fields: dict[str, dict[str, Any]] | None = None, lang: str = "en") -> dict[str, Any]:
    """统一的批量标题检索逻辑，供纯标题、CSV、PDF 批量接口复用。
    逐条按标题是否含中文字符分流：含中文走百度学术，不含中文走 DBLP。
    lang 参数仅用于决定 _set_progress 展示的初始文案，不再整体控制检索路径。
    """
    if not titles:
        raise HTTPException(status_code=400, detail="At least one title is required.")
    if len(titles) > MAX_BATCH_TITLES:
        raise HTTPException(
            status_code=400,
            detail=f"Batch size exceeds limit ({MAX_BATCH_TITLES}).",
        )

    runtime_store.increment_counter("batch_search_requests")
    run_id = runtime_store.start_batch_run(
        total_input=len(titles),
        max_candidates=max_candidates,
    )

    started_at = time.perf_counter()
    found_count = 0
    items: list[dict[str, Any]] = []
    extra_item_fields = extra_item_fields or {}

    zh_titles = [t for t in titles if _is_chinese_title(t)]
    en_titles = [t for t in titles if not _is_chinese_title(t)]

    _set_progress(
        status="searching",
        stage="Searching Baidu Scholar / DBLP",
        total=len(titles),
        processed=0,
        found=0,
    )

    zh_result_map: dict[str, dict[str, Any]] = {}
    if zh_titles:
        from checker.clients.baidu_client import batch_search_baidu
        raw_results = asyncio.run(batch_search_baidu(zh_titles))
        for r in raw_results:
            qt = r.get("query_title", "")
            zh_result_map[qt] = {
                "query_title": qt,
                "found": bool(r.get("found")),
                "dblp_title": r.get("matched_title") if r.get("found") else None,
                "dblp_title_similarity": r.get("similarity") if r.get("found") else None,
                "dblp_id": None,
                "year": None,
                "venue": None,
                "pub_type": None,
                "source": r.get("source", "baidu"),
            }

    en_result_map: dict[str, dict[str, Any]] = {}
    if en_titles:
        db_path = _resolve_db_path()
        if not db_path.exists():
            raise HTTPException(status_code=404, detail="DBLP database not found.")
        en_raw_results = _parallel_batch_search(db_path, en_titles, max_candidates)
        for r in en_raw_results:
            qt = r.get("query_title", "")
            r.setdefault("source", "dblp")
            en_result_map[qt] = r

    # 按原始顺序合并结果，每条标题去各自的结果表里取
    batch_results = []
    for t in titles:
        if _is_chinese_title(t):
            batch_results.append(zh_result_map.get(t, {"query_title": t, "found": False, "source": "baidu"}))
        else:
            batch_results.append(en_result_map.get(t, {"query_title": t, "found": False, "source": "dblp"}))

    for idx, result in enumerate(batch_results, start=1):
        found = bool(result.get("found"))
        if found:
            found_count += 1

        _set_progress(processed=idx, found=found_count)

        title_key = result.get("query_title", titles[idx - 1])
        runtime_store.record_batch_item(
            run_id,
            item_index=idx,
            query_title=title_key,
            found=found,
            dblp_id=result.get("dblp_id") if isinstance(result.get("dblp_id"), int) else None,
            dblp_title=result.get("dblp_title"),
            dblp_title_similarity=result.get("dblp_title_similarity"),
            year=result.get("year"),
            venue=result.get("venue"),
            pub_type=result.get("pub_type"),
            duration_ms=0,
            error_message=None,
        )

        items.append({
            "index": idx,
            **result,
            **extra_item_fields.get(title_key, {}),
            "duration_ms": 0,
            "error_message": None,
        })

    total_duration_ms = max(0, int((time.perf_counter() - started_at) * 1000))
    runtime_store.finish_batch_run(
        run_id,
        total_processed=len(items),
        found_count=found_count,
        duration_ms=total_duration_ms,
        status="completed",
        error_message=None,
    )
    runtime_store.increment_counter("batch_search_items_total", delta=len(items))
    runtime_store.increment_counter("batch_search_found_total", delta=found_count)

    _set_progress(status="done", stage="Done", processed=len(items), found=found_count)

    return {
        "summary": {
            "run_id": run_id,
            "limit": MAX_BATCH_TITLES,
            "total_input": len(titles),
            "total_processed": len(items),
            "found_count": found_count,
            "not_found_count": len(items) - found_count,
            "max_candidates": max_candidates,
            "duration_ms": total_duration_ms,
        },
        "items": items,
    }


def _title_hash(title: str) -> str:
    return hashlib.sha256(title.casefold().encode("utf-8")).hexdigest()[:24]


def _fetch_publication_meta(db_path: Path, pub_id: int | None) -> dict[str, Any]:
    if pub_id is None:
        return {}
    conn = sqlite3.connect(str(db_path))
    conn.row_factory = sqlite3.Row
    try:
        cur = conn.cursor()
        cur.execute("SELECT 1 FROM sqlite_master WHERE type='table' AND name='publications'")
        if cur.fetchone() is None:
            return {}
        cur.execute(
            "SELECT year, venue, pub_type FROM publications WHERE id = ? LIMIT 1",
            (int(pub_id),),
        )
        row = cur.fetchone()
        if row is None:
            return {}
        return {
            "year": row["year"],
            "venue": row["venue"],
            "pub_type": row["pub_type"],
        }
    finally:
        conn.close()


def _search_title(db_path: Path, title: str, max_candidates: int) -> tuple[dict[str, Any] | None, str]:
    conn = sqlite3.connect(str(db_path))
    try:
        if _db_has_word_index(conn):
            _sqlite_readonly_fast(conn)
            result = search_dblp_by_index(conn, title, max_candidates=max_candidates)
            return result, "indexed"
    finally:
        conn.close()

    cache_key = str(db_path)
    with _brute_cache_lock:
        all_titles = _brute_cache.get(cache_key)
        if all_titles is None:
            all_titles = load_all_titles_from_db(db_path, quiet=True)
            _brute_cache[cache_key] = all_titles
    result = search_dblp_brute_force(all_titles, title)
    return result, "bruteforce"


def _single_search_result(db_path: Path, title: str, max_candidates: int) -> dict[str, Any]:
    match, _ = _search_title(db_path, title, max_candidates)
    if not match:
        return {
            "found": False,
            "query_title": title,
        }

    pub_id = match.get("dblp_id")
    meta = _fetch_publication_meta(db_path, pub_id if isinstance(pub_id, int) else None)
    return {
        "found": True,
        "query_title": title,
        "dblp_id": match.get("dblp_id"),
        "dblp_title": match.get("dblp_title"),
        "dblp_title_similarity": match.get("dblp_title_similarity"),
        **meta,
    }


def _parallel_batch_search(
    db_path: Path,
    titles: list[str],
    max_candidates: int,
) -> list[dict[str, Any]]:
    """
    批量检索 DBLP，使用 ThreadPoolExecutor 并行搜索。
    多线程共享进程内存，无需 spawn，Windows 下安全可用。
    """
    from concurrent.futures import ThreadPoolExecutor, as_completed

    conn = sqlite3.connect(str(db_path))
    use_index = _db_has_word_index(conn)
    conn.close()

    results: list[dict[str, Any] | None] = [None] * len(titles)
    found_count = 0
    processed_count = 0
    lock = threading.Lock()

    def search_one(idx: int, title: str) -> tuple[int, dict[str, Any]]:
        if use_index:
            try:
                c = sqlite3.connect(str(db_path))
                _sqlite_readonly_fast(c)
                match = search_dblp_by_index(c, title, max_candidates=max_candidates)
                c.close()
            except Exception:
                match = None
        else:
            cache_key = str(db_path)
            with _brute_cache_lock:
                all_titles_data = _brute_cache.get(cache_key)
                if all_titles_data is None:
                    all_titles_data = load_all_titles_from_db(db_path, quiet=True)
                    _brute_cache[cache_key] = all_titles_data
            match = search_dblp_brute_force(all_titles_data, title)

        if not match:
            return idx, {"found": False, "query_title": title}
        pub_id = match.get("dblp_id")
        meta = _fetch_publication_meta(db_path, pub_id if isinstance(pub_id, int) else None)
        return idx, {
            "found": True,
            "query_title": title,
            "dblp_id": match.get("dblp_id"),
            "dblp_title": match.get("dblp_title"),
            "dblp_title_similarity": match.get("dblp_title_similarity"),
            **meta,
        }

    workers = min(8, max(1, len(titles)))
    with ThreadPoolExecutor(max_workers=workers) as executor:
        futures = {executor.submit(search_one, i, t): i for i, t in enumerate(titles)}
        for future in as_completed(futures):
            idx, result = future.result()
            results[idx] = result
            with lock:
                processed_count += 1
                if result.get("found"):
                    found_count += 1
                _set_progress(processed=processed_count, found=found_count)

    return results  # type: ignore[return-value]


def _items_to_csv(items: list[dict[str, Any]]) -> str:
    """把 batch items 列表转成 CSV 字符串。"""
    output = io.StringIO()
    fieldnames = ["index", "query_title", "found", "dblp_title", "dblp_title_similarity", "year", "venue", "pub_type", "duration_ms", "error_message"]
    writer = csv.DictWriter(output, fieldnames=fieldnames, extrasaction="ignore", lineterminator="\n")
    writer.writeheader()
    for item in items:
        row = {k: item.get(k, "") for k in fieldnames}
        if isinstance(row.get("found"), bool):
            row["found"] = "1" if row["found"] else "0"
        writer.writerow(row)
    return output.getvalue()


# ── 页面路由 ────────────────────────────────────────────────

@app.get("/", response_class=HTMLResponse)
def page_home(request: Request) -> HTMLResponse:
    visit_count = runtime_store.increment_counter("web_page_views")
    template_path = BASE_DIR / "templates" / "web_index.html"
    with open(template_path, "r", encoding="utf-8") as f:
        content = f.read()
    content = content.replace("{{ app_version }}", APP_VERSION)
    content = content.replace("{{ visit_count }}", str(visit_count))
    return HTMLResponse(content)




@app.get("/baidu-search", response_class=HTMLResponse)
def page_baidu_search(request: Request) -> HTMLResponse:
    template_path = BASE_DIR / "templates" / "baidu_search.html"
    with open(template_path, "r", encoding="utf-8") as f:
        return HTMLResponse(f.read())

@app.get("/retrieve", response_class=HTMLResponse)
def page_retrieve(request: Request) -> HTMLResponse:
    visit_count = runtime_store.increment_counter("web_page_views")
    template_path = BASE_DIR / "templates" / "web_index.html"
    with open(template_path, "r", encoding="utf-8") as f:
        content = f.read()
    content = content.replace("{{ app_version }}", APP_VERSION)
    content = content.replace("{{ visit_count }}", str(visit_count))
    return HTMLResponse(content)


@app.get("/register", response_class=HTMLResponse)
def page_register(request: Request) -> HTMLResponse:
    visit_count = runtime_store.increment_counter("web_page_views")
    template_path = BASE_DIR / "templates" / "register.html"
    with open(template_path, "r", encoding="utf-8") as f:
        content = f.read()
    content = content.replace("{{ app_version }}", APP_VERSION)
    content = content.replace("{{ visit_count }}", str(visit_count))
    return HTMLResponse(content)


@app.get("/login", response_class=HTMLResponse)
def page_login(request: Request) -> HTMLResponse:
    visit_count = runtime_store.increment_counter("web_page_views")
    template_path = BASE_DIR / "templates" / "login.html"
    with open(template_path, "r", encoding="utf-8") as f:
        content = f.read()
    content = content.replace("{{ app_version }}", APP_VERSION)
    content = content.replace("{{ visit_count }}", str(visit_count))
    return HTMLResponse(content)


# ── API 路由 ────────────────────────────────────────────────

@app.get("/api/health")
def api_health() -> dict[str, Any]:
    path = _resolve_db_path()
    if not path.exists():
        return {"status": "error", "detail": "DBLP SQLite file not found."}
    return {"status": "ok"}


@app.get("/api/progress")
def api_progress() -> dict[str, Any]:
    with _progress_lock:
        return _progress.copy()


@app.get("/api/runtime/stats")
def api_runtime_stats() -> dict[str, Any]:
    return runtime_store.stats()


@app.post("/api/user/register")
def api_register(payload: RegisterRequest) -> dict:
    return register_user(payload.username, payload.password, payload.email)


@app.post("/api/user/login")
def api_login(payload: LoginRequest) -> dict:
    return login_user(payload.username, payload.password)


@app.post("/api/search/title")
async def api_search_title(payload: TitleSearchRequest) -> dict[str, Any]:
    title = _normalize_title(payload.title)
    if not title:
        raise HTTPException(status_code=400, detail="Title is required.")

    started_at = time.perf_counter()
    found = False
    error_message: str | None = None
    try:
        # 中文文献走百度学术
        if payload.lang == "zh":
            from checker.clients.baidu_client import batch_search_baidu
            raw = await batch_search_baidu([title])
            r = raw[0] if raw else {}
            found = bool(r.get("found"))
            return {
                "found": found,
                "query_title": title,
                "dblp_title": r.get("matched_title") if found else None,
                "dblp_title_similarity": r.get("similarity") if found else None,
                "source": r.get("source", "baidu"),
            }
        # 英文文献走 DBLP
        db_path = _resolve_db_path()
        if not db_path.exists():
            raise HTTPException(status_code=404, detail="DBLP database not found.")
        result = _single_search_result(db_path, title, payload.max_candidates)
        found = bool(result.get("found"))
        return result
    except HTTPException as exc:
        error_message = str(exc.detail)
        raise
    except Exception as exc:
        error_message = str(exc)
        runtime_store.log_event(
            "ERROR",
            "single_title_search_failed",
            {"title": title, "error": str(exc)},
        )
        raise HTTPException(status_code=500, detail="Internal server error.") from exc
    finally:
        duration_ms = max(0, int((time.perf_counter() - started_at) * 1000))
        runtime_store.increment_counter("single_search_requests")
        if found:
            runtime_store.increment_counter("single_search_found")
        if error_message:
            runtime_store.increment_counter("single_search_errors")
        runtime_store.record_single_search(
            query_title=title,
            query_hash=_title_hash(title),
            found=found,
            max_candidates=payload.max_candidates,
            duration_ms=duration_ms,
            error_message=error_message,
        )


@app.post("/api/search/title/batch")
def api_search_title_batch(payload: BatchTitleSearchRequest) -> dict[str, Any]:
    titles = _normalize_title_list(payload.titles)
    return _run_batch_search(titles, payload.max_candidates, lang=payload.lang)


@app.post("/api/search/csv/batch")
def api_search_csv_batch(
    file: UploadFile = File(...),
    max_candidates: int = Form(default=100000, ge=1, le=500000),
) -> dict[str, Any]:
    """上传 CSV，读取标题列并批量检索。前端发送字段名 file。
    中文标题自动走百度学术，英文标题自动走 DBLP（见 _run_batch_search）。
    """
    titles = _titles_from_csv_upload(file)
    return _run_batch_search(titles, max_candidates)


@app.post("/api/parse/pdf")
def api_parse_pdf(files: list[UploadFile] = File(...)):
    """解析 PDF 提取参考文献（不做 DBLP 检索）。前端发送字段名 files。"""
    results: list[dict] = []
    temp_dir = Path("temp")
    temp_dir.mkdir(exist_ok=True)

    for file in files:
        if not (file.filename or "").lower().endswith(".pdf"):
            raise HTTPException(status_code=400, detail=f"Only PDF files are allowed: {file.filename}")
        temp_path = temp_dir / (file.filename or "upload.pdf")
        try:
            with open(temp_path, "wb") as f:
                f.write(file.file.read())
            refs = llm_parse_pdf(str(temp_path))
            results.extend(refs)
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))
        finally:
            if temp_path.exists():
                temp_path.unlink()

    titles = [r.get("title") for r in results if r.get("title")]
    return {"success": True, "references": results, "titles": titles}


@app.post("/api/search/pdf/batch")
def api_search_pdf_batch(files: list[UploadFile] = File(...), lang: str = Form(default="en")):
    """上传一个或多个 PDF，解析参考文献并批量检索。前端发送字段名 files。lang=zh 走百度学术，否则走 DBLP。"""
    temp_dir = Path("temp")
    temp_dir.mkdir(exist_ok=True)

    all_references: list[dict] = []

    # ── 阶段1：逐个 PDF 解析 ──────────────────────────────
    _set_progress(status="parsing", stage="Parsing PDF references", total=0, processed=0, found=0)
    for file in files:
        if not (file.filename or "").lower().endswith(".pdf"):
            raise HTTPException(status_code=400, detail=f"Only PDF files are allowed: {file.filename}")
        temp_path = temp_dir / (file.filename or "upload.pdf")
        try:
            with open(temp_path, "wb") as f:
                f.write(file.file.read())
            refs = llm_parse_pdf(str(temp_path))
            for ref in refs:
                ref["source_file"] = file.filename or ""
            all_references.extend(refs)
        except Exception as e:
            _set_progress(status="error", stage=str(e))
            raise HTTPException(status_code=500, detail=str(e))
        finally:
            if temp_path.exists():
                temp_path.unlink()

    titles = _normalize_title_list([ref.get("title") for ref in all_references if ref.get("title")])
    source_map: dict[str, dict[str, Any]] = {
        _normalize_title(ref.get("title", "")): {"source_file": ref.get("source_file", "")}
        for ref in all_references if ref.get("title")
    }

    if not titles:
        _set_progress(status="done", stage="Done", total=0, processed=0, found=0)
        return {
            "summary": {
                "run_id": None,
                "file_count": len(files),
                "total_input": 0,
                "total_processed": 0,
                "found_count": 0,
                "not_found_count": 0,
                "max_candidates": 0,
                "duration_ms": 0,
            },
            "items": [],
            "references": all_references,
        }

    result = _run_batch_search(titles, max_candidates=100000, extra_item_fields=source_map, lang=lang)
    result["summary"]["file_count"] = len(files)
    result["references"] = all_references
    return result


# ── 历史记录 ────────────────────────────────────────────────

@app.get("/api/history/batch")
def api_history_batch(limit: int = 20, offset: int = 0) -> dict[str, Any]:
    """返回最近的批量检索历史列表。"""
    conn = runtime_store._connect()
    try:
        rows = conn.execute(
            """
            SELECT id, total_input, total_processed, found_count,
                   max_candidates, duration_ms, status, error_message, created_at
            FROM batch_runs
            ORDER BY id DESC
            LIMIT ? OFFSET ?
            """,
            (limit, offset),
        ).fetchall()
        total_row = conn.execute("SELECT COUNT(1) AS c FROM batch_runs").fetchone()
        total = int(total_row["c"]) if total_row else 0
        items = [dict(r) for r in rows]
        return {"total": total, "offset": offset, "limit": limit, "runs": items}
    finally:
        conn.close()


@app.get("/api/history/batch/{run_id}/items")
def api_history_batch_items(run_id: int) -> dict[str, Any]:
    """返回某次批量检索的所有结果条目。"""
    conn = runtime_store._connect()
    try:
        run_row = conn.execute(
            "SELECT * FROM batch_runs WHERE id = ?", (run_id,)
        ).fetchone()
        if run_row is None:
            raise HTTPException(status_code=404, detail="Run not found.")
        item_rows = conn.execute(
            """
            SELECT item_index, query_title, found, dblp_title,
                   dblp_title_similarity, year, venue, pub_type,
                   duration_ms, error_message
            FROM batch_items WHERE run_id = ? ORDER BY item_index
            """,
            (run_id,),
        ).fetchall()
        return {
            "run": dict(run_row),
            "items": [dict(r) for r in item_rows],
        }
    finally:
        conn.close()


@app.get("/api/history/batch/{run_id}/csv")
def api_history_batch_csv(run_id: int):
    """下载某次批量检索结果的 CSV 文件。"""
    conn = runtime_store._connect()
    try:
        run_row = conn.execute(
            "SELECT id FROM batch_runs WHERE id = ?", (run_id,)
        ).fetchone()
        if run_row is None:
            raise HTTPException(status_code=404, detail="Run not found.")
        item_rows = conn.execute(
            """
            SELECT item_index, query_title, found, dblp_title,
                   dblp_title_similarity, year, venue, pub_type,
                   duration_ms, error_message
            FROM batch_items WHERE run_id = ? ORDER BY item_index
            """,
            (run_id,),
        ).fetchall()
        items = [dict(r) for r in item_rows]
    finally:
        conn.close()

    csv_text = _items_to_csv(items)
    filename = f"citeverifier_run_{run_id}.csv"
    return StreamingResponse(
        iter([csv_text]),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# ── 百度学术 / 百度搜索 接口 ─────────────────────────────────────────────────

class BaiduSearchRequest(BaseModel):
    title: str = Field(..., min_length=1, description="要检索的论文标题")
    authors: list[str] = Field(default_factory=list, description="作者列表（可选，提高匹配精度）")
    year: int | None = Field(None, description="发表年份（可选）")
    use_fallback: bool = Field(True, description="百度学术无结果时是否降级到百度搜索")


class BaiduBatchSearchRequest(BaseModel):
    items: list[BaiduSearchRequest] = Field(..., min_length=1)


def _build_baidu_ref(req: BaiduSearchRequest, idx: int = 1):
    """将 BaiduSearchRequest 转成 checker.models.Reference"""
    from checker.models import Reference
    return Reference(
        id=idx,
        title=req.title,
        authors=req.authors,
        year=req.year,
        raw=req.title,
    )


async def _search_baidu_one(req: BaiduSearchRequest, idx: int = 1) -> dict[str, Any]:
    """对单条请求执行百度学术检索（Selenium）"""
    from checker.clients.baidu_client import batch_search_baidu
    results = await batch_search_baidu([req.title])
    if not results:
        return {"query_title": req.title, "found": False, "source": None, "result": None, "error": "未返回结果"}
    r = results[0]
    if r["found"]:
        return {
            "query_title": req.title,
            "found": True,
            "source": r["source"],
            "similarity": r["similarity"],
            "result": {
                "title":   r["matched_title"],
                "authors": r["authors"],
                "year":    None,
                "venue":   None,
                "url":     None,
            },
            "error": None,
        }
    return {"query_title": req.title, "found": False, "source": None, "result": None, "error": r.get("error")}


@app.post("/api/search/baidu")
async def api_search_baidu(req: BaiduSearchRequest) -> dict[str, Any]:
    """
    百度学术单条检索。
    优先查百度学术，失败时（use_fallback=true）降级到百度搜索。
    需在环境变量中配置 SCRAPINGDOG_API_KEY（用于代理百度学术）。
    无 API Key 时将直接请求百度学术，部分 JS 渲染内容可能缺失。
    """
    runtime_store.increment_counter("baidu_search_requests")
    return await _search_baidu_one(req)


@app.post("/api/search/baidu/batch")
async def api_search_baidu_batch(req: BaiduBatchSearchRequest) -> dict[str, Any]:
    """
    百度学术批量检索（最多 50 条）。
    一次性传给 Selenium 多浏览器并行处理，效率更高。
    """
    if len(req.items) > 50:
        raise HTTPException(status_code=400, detail="批量检索上限为 50 条。")

    runtime_store.increment_counter("baidu_batch_search_requests")

    from checker.clients.baidu_client import batch_search_baidu
    titles = [item.title for item in req.items]
    raw_results = await batch_search_baidu(titles)

    # 转成统一格式
    results = []
    for item, r in zip(req.items, raw_results):
        if r["found"]:
            results.append({
                "query_title": item.title,
                "found": True,
                "source": r["source"],
                "similarity": r["similarity"],
                "result": {
                    "title":   r["matched_title"],
                    "authors": r["authors"],
                    "year":    None,
                    "venue":   None,
                    "url":     None,
                },
                "error": None,
            })
        else:
            results.append({
                "query_title": item.title,
                "found": False,
                "source": None,
                "result": None,
                "error": r.get("error"),
            })

    found_count = sum(1 for r in results if r["found"])
    return {
        "total": len(results),
        "found": found_count,
        "not_found": len(results) - found_count,
        "items": results,
    }