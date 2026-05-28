import argparse
import html
import os
import re
import sqlite3
import time
from pathlib import Path
from typing import Any, Iterator, List, Optional, Tuple

from lxml import etree


def normalize_title(s: str) -> str:
    return " ".join(str(s).lower().split())


def _fix_bare_ampersands(s: str) -> str:
    return re.sub(r"&(?!(?:[a-zA-Z0-9]+|#\d+|#x[0-9a-fA-F]+);)", "&amp;", s)


def _fix_ampersands_aggressive(s: str) -> str:
    s = html.unescape(s)
    s = s.replace("&", "&amp;")
    s = s.replace("&amp;amp;", "&amp;")
    s = s.replace("&amp;lt;", "&lt;")
    s = s.replace("&amp;gt;", "&gt;")
    s = s.replace("&amp;quot;", "&quot;")
    s = s.replace("&amp;apos;", "&apos;")
    return s


def _sqlite_write_optimizations(conn: sqlite3.Connection) -> None:
    conn.execute("PRAGMA synchronous = OFF")
    conn.execute("PRAGMA journal_mode = MEMORY")
    conn.execute("PRAGMA temp_store = MEMORY")
    conn.execute("PRAGMA cache_size = -256000")
    conn.execute("PRAGMA locking_mode = EXCLUSIVE")


def _supports_fts5(conn: sqlite3.Connection) -> bool:
    try:
        conn.execute("CREATE VIRTUAL TABLE IF NOT EXISTS temp.__fts5_test USING fts5(content)")
        conn.execute("DROP TABLE IF EXISTS temp.__fts5_test")
        return True
    except sqlite3.OperationalError:
        return False


def build_dblp_sqlite(
    dblp_xml: Path,
    db_path: Path,
    batch_size: int = 50000,
    use_fts: bool = True,
) -> None:
    print(f"[build_dblp_sqlite] dblp_xml = {dblp_xml}")
    print(f"[build_dblp_sqlite] db_path = {db_path}")

    if db_path.exists():
        db_path.unlink()

    conn = sqlite3.connect(str(db_path))
    _sqlite_write_optimizations(conn)
    cur = conn.cursor()

    cur.execute("""
        CREATE TABLE titles (
            id INTEGER PRIMARY KEY,
            title TEXT NOT NULL,
            title_norm TEXT NOT NULL
        )
    """)
    cur.execute("""
        CREATE TABLE title_words (
            word TEXT NOT NULL,
            id INTEGER NOT NULL,
            PRIMARY KEY (word, id)
        )
    """)
    conn.commit()

    use_fts5 = use_fts and _supports_fts5(conn)
    if use_fts5:
        cur.execute(
            "CREATE VIRTUAL TABLE title_fts USING fts5(title, tokenize='unicode61')"
        )
        print("[build_dblp_sqlite] Using FTS5 title index.")
    else:
        print("[build_dblp_sqlite] FTS5 not available, using title_words index only.")

    def get_text(elem: Any, tag: str) -> Optional[str]:
        child = elem.find(tag)
        if child is not None and child.text:
            return child.text.strip()
        return None

    total_file_size = dblp_xml.stat().st_size
    xml_path = str(dblp_xml.resolve())
    context = etree.iterparse(
        xml_path,
        events=("end",),
        tag=("article", "inproceedings", "incollection", "book", "proceedings"),
        recover=True,
        load_dtd=True,
        resolve_entities=True,
        no_network=False,
    )

    total = 0
    batch: List[Tuple[int, str, str]] = []
    fts_batch: List[Tuple[int, str]] = []
    start_time = time.perf_counter()

    print("[build_dblp_sqlite] Parsing XML and building database...")
    print(f"[build_dblp_sqlite] File size: {total_file_size / (1024**3):.2f} GB")
    print("[build_dblp_sqlite] Using direct file read (dblp.dtd must be next to dblp.xml).")
    print("[build_dblp_sqlite] Progress every 50k records:", flush=True)

    try:
        for _, elem in context:
            if elem.tag in {"article", "inproceedings", "incollection", "book", "proceedings"}:
                title = get_text(elem, "title")
                if not title:
                    elem.clear()
                    continue

                title_norm = normalize_title(title)
                batch.append((total, title, title_norm))
                if use_fts5:
                    fts_batch.append((total, title))
                total += 1

                if len(batch) >= batch_size:
                    cur.executemany("INSERT INTO titles VALUES (?, ?, ?)", batch)
                    word_batch: List[Tuple[str, int]] = []
                    for tid, _, norm in batch:
                        for w in norm.split():
                            if len(w) >= 2:
                                word_batch.append((w, tid))
                    if word_batch:
                        cur.executemany("INSERT OR IGNORE INTO title_words VALUES (?, ?)", word_batch)
                    if use_fts5 and fts_batch:
                        cur.executemany("INSERT INTO title_fts(rowid, title) VALUES (?, ?)", fts_batch)
                    conn.commit()
                    batch.clear()
                    fts_batch.clear()

                    elapsed = time.perf_counter() - start_time
                    rate = total / elapsed if elapsed > 0 else 0
                    print(f"[build_dblp_sqlite] {total} records | {elapsed/60:.1f} min | ~{rate:.0f} rec/s", flush=True)

            elem.clear()
            while elem.getprevious() is not None:
                del elem.getparent()[0]

    except etree.XMLSyntaxError as e:
        print(f"[build_dblp_sqlite] XML parse error (using partial results): {e}")
    except Exception as e:
        print(f"[build_dblp_sqlite] Unexpected error (using partial results): {e}")
    finally:
        if batch:
            cur.executemany("INSERT INTO titles VALUES (?, ?, ?)", batch)
            word_batch = []
            for tid, _, norm in batch:
                for w in norm.split():
                    if len(w) >= 2:
                        word_batch.append((w, tid))
            if word_batch:
                cur.executemany("INSERT OR IGNORE INTO title_words VALUES (?, ?)", word_batch)
            if use_fts5 and fts_batch:
                cur.executemany("INSERT INTO title_fts(rowid, title) VALUES (?, ?)", fts_batch)
            conn.commit()

        print("[build_dblp_sqlite] Creating indexes...")
        cur.execute("CREATE INDEX idx_title_norm ON titles(title_norm)")
        cur.execute("CREATE INDEX idx_title_words_word ON title_words(word)")
        cur.execute("CREATE INDEX idx_title_words_id ON title_words(id)")
        conn.commit()

        try:
            del context
        except Exception:
            pass

    conn.close()
    print(f"[build_dblp_sqlite] Done. {total} titles stored in {db_path}")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Build a DBLP SQLite database."
    )
    parser.add_argument("--dblp-xml", type=Path, required=True, help="Path to dblp.xml")
    parser.add_argument("--db", type=Path, required=True, help="Output SQLite database path")
    parser.add_argument(
        "--batch-size",
        type=int,
        default=50000,
        help="Number of records per insert batch (default: 50000)",
    )
    parser.add_argument(
        "--no-fts",
        action="store_true",
        help="Disable FTS5 index.",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    build_dblp_sqlite(
        dblp_xml=args.dblp_xml,
        db_path=args.db,
        batch_size=args.batch_size,
        use_fts=not args.no_fts,
    )


if __name__ == "__main__":
    main()
