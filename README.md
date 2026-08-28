<div align="center" style="display:flex;justify-content:center;align-items:center;gap:8px;">
  <img src="./docs/image/logo.svg" alt="CiteVerifier Logo" width="34" />
  <strong>CiteVerifier</strong>
</div>

<p align="center">A citation verification toolkit that matches references against DBLP + Google Scholar/Google Search (English) and Baidu Xueshu (Chinese), with LLM-based PDF extraction, multi-source online search, and a modern web interface.</p>

<p align="center">[<a href="./README.md"><strong>EN</strong></a>] | [<a href="./README.zh-CN.md"><strong>CN</strong></a>]</p>

<p align="center">
  <img src="https://img.shields.io/badge/version-0.1.0-1f7a8c" alt="version" />
  <img src="https://img.shields.io/badge/python-3.10%2B-3776AB?logo=python&logoColor=white" alt="python" />
  <img src="https://img.shields.io/badge/FastAPI-0.111%2B-009688?logo=fastapi&logoColor=white" alt="fastapi" />
  <img src="https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white" alt="react" />
  <img src="https://img.shields.io/badge/node-20%2B-339933?logo=node.js&logoColor=white" alt="node" />
</p>

## Features

- **DBLP-first verification** — Fast title matching against a local DBLP SQLite database with brute-force and indexed search modes.
- **Baidu Xueshu support** — Chinese literature verification driven by Selenium over Baidu Xueshu, with a 24h SQLite result cache.
- **SerpApi fallback chain** — English titles fall back DBLP → Google Scholar → Google Search (all via SerpApi), each with its own 24h cache that only stores found hits.
- **LLM-based PDF extraction** — Upload PDFs and extract structured references via the DashScope LLM parser (PyPDF2 text extraction + LLM structuring), with a persistent cache keyed by PDF sha256.
- **Batch verification** — Verify hundreds of citations at once through the web UI (CSV or PDF upload).
- **Runtime telemetry** — Stores verification history and runtime metrics in SQLite (single + batch runs, CSV export).
- **Modern web frontend** — React 19 + TanStack Router/Start app with shadcn/ui components.
- **User system** — Lightweight register/login with signed-cookie sessions (`itsdangerous` + SQLite).
- **Advanced search** — Multi-field matching with custom similarity thresholds (title, authors, year, venue).
- **AI chat assistant** — Built-in chat route powered by an OpenAI-compatible AI gateway.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Python 3.10+, FastAPI, Uvicorn (multi-worker) |
| Frontend | React 19, TanStack Router/Start, TanStack Query, Vite |
| UI Kit | shadcn/ui (Radix primitives + Tailwind CSS 4) |
| PDF Parsing | PyPDF2 text extraction + DashScope LLM structuring |
| Data Sources | DBLP (local SQLite), Baidu Xueshu (Selenium), Google Scholar & Google Search (SerpApi) |
| Browser Automation | Selenium + webdrivermanager_cn (Ali mirror) + Chromium |
| Similarity | rapidfuzz (fuzzy matching) |
| Session | itsdangerous signed cookies + SQLite |
| Docs | MkDocs + Material theme |

## Quick Start

### Prerequisites

- Python 3.10+
- Node.js 20+
- Google Chrome or Chromium (for Baidu Xueshu Selenium search)

### Required API Keys

The backend loads variables from a `.env` file in the project root at startup (via `python-dotenv`, see `web_app.py`). The recommended way is to create a `.env` there:

```bash
# .env (project root)
DASHSCOPE_API_KEY=your_dashscope_key   # required for LLM-based PDF reference extraction
SERPAPI_API_KEY=your_serpapi_key       # required for Google Scholar / Google Search fallback
```

> `deploy.sh` generates this `.env` automatically on Linux servers — just edit the placeholders and `sudo systemctl restart citeverifier-backend`.

Alternatively, set them as shell environment variables (only if you don't use `.env`):

```bash
# Windows cmd (persistent)
setx DASHSCOPE_API_KEY "your_api_key"
setx SERPAPI_API_KEY   "your_api_key"
# Windows PowerShell (current session)
$env:DASHSCOPE_API_KEY="your_api_key"
$env:SERPAPI_API_KEY="your_api_key"
# Linux / macOS
export DASHSCOPE_API_KEY="your_api_key"
export SERPAPI_API_KEY="your_api_key"
```

### Windows — One-Click Start

Simply double-click or run:

```batch
start.bat
```

This creates a `venv`, installs Python + frontend dependencies, pre-installs ChromeDriver, stops any stale services on ports 8080/8092, starts the backend (port 8092) and frontend (port 8080), then opens the browser. Default concurrency: `WEB_WORKERS=2`, `BAIDU_BROWSER_POOL_SIZE=2`, `BAIDU_HEADLESS=0`.

To stop the services, just close the two spawned `CiteVerifier Backend` / `CiteVerifier Frontend` console windows.

### Manual Start

**1. Backend**

```bash
pip install -r requirements.txt
uvicorn web_app:app --host 0.0.0.0 --port 8092 --reload
```

The backend exposes a REST API at http://localhost:8092 (Swagger docs at `/docs`). ChromeDriver is pre-installed in the background on startup via `ensure_chromedriver()`.

**2. Frontend (development server)**

```bash
cd frontend
npm install
npm run dev -- --host 0.0.0.0 --port 8080 --strictPort
```

| Service | URL |
|---------|-----|
| Web frontend | http://localhost:8080 |
| Backend API | http://localhost:8092 |
| API docs (Swagger) | http://localhost:8092/docs |

### Linux Server — Production Deploy (Ubuntu 22.04+)

The repo ships a one-shot VPS deploy script that wires up systemd + PM2 + Nginx (no Docker required):

```bash
# HTTP only, accessed via server IP
sudo bash deploy.sh

# With a domain + automatic HTTPS (Let's Encrypt)
sudo env DOMAIN=example.com ADMIN_EMAIL=admin@example.com ENABLE_SSL=1 bash deploy.sh
```

`deploy.sh` automatically: installs system deps, Node.js 22, Google Chrome; creates a Python venv and installs `requirements.txt`; builds the frontend (`npm run build`); starts the frontend under PM2 (`citeverifier-frontend`); installs a `citeverifier-backend` systemd unit (port 8092, 2 workers); writes `/etc/nginx/conf.d/citeverifier.conf` (port 80 → 8080, `/api/` → 8092, `/api/chat` → 8080, `/docs` → 8092); optionally issues an SSL cert.

Stop / restart services:

```bash
bash stop.sh                                    # stop frontend, backend, nginx
sudo systemctl restart citeverifier-backend    # restart backend
pm2 restart citeverifier-frontend              # restart frontend
```

> The first run of `deploy.sh` generates a `.env` (with `SERPAPI_API_KEY` / `DASHSCOPE_API_KEY` placeholders and a random `SESSION_SECRET`). Edit it and `sudo systemctl restart citeverifier-backend`.

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| DBLP_DB_PATH | dblp.sqlite | Path to DBLP SQLite database |
| CITEVERIFIER_DATA_DIR | ./data | Runtime data directory (caches + telemetry + sessions) |
| CITEVERIFIER_RUNTIME_DB | {DATA_DIR}/runtime.sqlite | Runtime telemetry database |
| CITEVERIFIER_PDF_PARSE_CACHE | {DATA_DIR}/pdf_parse_cache.sqlite | PDF parse result cache |
| DASHSCOPE_API_KEY | - | DashScope API key (required for LLM PDF parsing) |
| SERPAPI_API_KEY | - | SerpApi key (required for Google Scholar/Search fallback) |
| CHROME_BIN | - | Chromium binary path hint |
| WEB_WORKERS | 2 | Uvicorn worker count (backend concurrency) |
| BAIDU_BROWSER_POOL_SIZE | 2 | Persistent Chrome instances per worker for Baidu Xueshu |
| BAIDU_HEADLESS | 0 | 1 = run Chrome headless (recommended on servers) |
| SESSION_SECRET | auto-generated in `data/.session_secret` | Signing key for session cookies |
| COOKIE_SECURE | false | Set `true` behind HTTPS to mark cookies `Secure` |

### Similarity Weights (checker/config.py)

| Field | Weight | Threshold |
|-------|--------|-----------|
| title | 0.50 | 0.85 |
| authors | 0.25 | 0.70 |
| year | 0.15 | 1.00 |
| venue | 0.10 | 0.70 |

## Project Structure

```
CiteVerifier/
+-- web_app.py                    # FastAPI backend entry point
+-- dblp_match.py                 # DBLP title search (brute-force + indexed)
+-- runtime_store.py              # Runtime telemetry & history storage
+-- user_database.py              # User storage (register/login)
+-- session_manager.py            # Signed-cookie sessions (itsdangerous + SQLite)
+-- sqlite_utils.py               # Shared SQLite connection policy (WAL, busy_timeout)
+-- build_dblp_sqlite.py          # Build DBLP SQLite database (deploy tool)
+-- start.bat                     # Windows one-click launcher
+-- start.sh                      # Linux: start systemd backend + PM2 frontend + nginx
+-- stop.sh                       # Linux: stop all services
+-- deploy.sh                     # Ubuntu VPS one-shot deploy (systemd + PM2 + nginx)
+-- requirements.txt              # Python dependencies
+-- mkdocs.yml                    # Docs site config
+-- .readthedocs.yml              # ReadTheDocs build config
|
+-- checker/                      # Verification engine
|   +-- config.py                 # API config + similarity weights
|   +-- models.py                 # Data models (Reference, ExternalReference)
|   +-- utils.py                  # String/author similarity utilities
|   +-- logger_config.py          # File + console logging setup
|   +-- clients/                  # Online search clients
|       +-- baidu_client.py        # Baidu Xueshu (cache + dispatch)
|       +-- baidu_selenium.py      # Selenium-driven Baidu Xueshu search
|       +-- serpapi_google_scholar_client.py  # Google Scholar (SerpApi)
|       +-- serpapi_google_search_client.py  # Google Search (SerpApi)
|
+-- parser/                       # Reference parser
|   +-- llm_parser.py             # LLM-based reference extraction (DashScope)
|   +-- pdf_parse_cache.py        # Persistent cache keyed by PDF sha256
|   +-- format/utils.py           # Text cleaning (clean_text, extract_id)
|   +-- utils/pdf_reader.py       # PyPDF2 text extraction
|
+-- frontend/                     # React web application
|   +-- src/
|   |   +-- routes/               # TanStack Router file routes
|   |   |   +-- __root.tsx        # Root layout
|   |   |   +-- index.tsx         # Home page
|   |   |   +-- simple-search.tsx # Single title search
|   |   |   +-- advanced-search.tsx # Batch search
|   |   |   +-- english-literature.tsx # DBLP search page
|   |   |   +-- chinese-literature.tsx # Baidu Xueshu search
|   |   |   +-- detect.tsx        # PDF upload and extract
|   |   |   +-- result.tsx        # Verification result viewer
|   |   |   +-- history.tsx       # Verification history
|   |   |   +-- login.tsx / register.tsx # User auth
|   |   |   +-- more.tsx          # Settings / about
|   |   |   +-- api/              # TanStack Start server-side API routes
|   |   |       +-- chat.ts            # AI chat gateway
|   |   |       +-- parse/pdf.ts       # PDF parse proxy
|   |   |       +-- search/pdf/batch.ts # PDF batch search proxy
|   |   +-- components/           # AiChat, SiteBackdrop, SiteNav + shadcn/ui
|   |   +-- hooks/                # Custom React hooks (use-mobile)
|   |   +-- lib/                  # api-client, auth, i18n, ai-gateway, config.server, utils
|   |   +-- styles.css            # Global styles + Tailwind
|   +-- public/                   # Demo video & scene images
|   +-- package.json, vite.config.ts, tsconfig.json, wrangler.jsonc
|
+-- tests/                        # Pytest suite (parsing, pool, lifecycle, runtime)
+-- docs/                         # MkDocs documentation source
    +-- en/                       # English docs
    +-- zh/                       # Chinese docs
    +-- image/logo.svg
```

> Runtime-generated artifacts (not in the repo): `venv/` (Python venv), `data/` (search caches, runtime.sqlite, pdf_parse_cache.sqlite, sessions.db), `chromedriver/` (ChromeDriver cache), `dblp.sqlite`, `users.db`, `frontend/node_modules/`, `frontend/dist/`.

## API Endpoints

Key backend API routes (served on port 8092):

| Endpoint | Method | Description |
|----------|--------|-------------|
| /api/health | GET | Service & DBLP DB health check |
| /api/progress | GET | Batch search progress |
| /api/runtime/stats | GET | Runtime telemetry statistics |
| /api/user/register | POST | User registration |
| /api/user/login | POST | User login |
| /api/user/logout | POST | User logout (clears session) |
| /api/user/me | GET | Current logged-in user info |
| /api/search/title | POST | Single title search (zh→Baidu, en→DBLP+fallback) |
| /api/search/title/batch | POST | Batch title search |
| /api/search/csv/batch | POST | Batch search from uploaded CSV |
| /api/search/baidu | POST | Single Baidu Xueshu search |
| /api/search/baidu/batch | POST | Batch Baidu Xueshu search |
| /api/parse/pdf | POST | Extract references from a PDF |
| /api/search/pdf/batch | POST | Parse a PDF and batch-verify its references |
| /api/history/single | GET | Single-title verification history |
| /api/history/batch | GET | Batch verification runs |
| /api/history/batch/{run_id}/items | GET | Items of a specific batch run |
| /api/history/batch/{run_id}/csv | GET | Export a batch run as CSV |

Frontend server-side API routes (`frontend/src/routes/api/`) proxy chat, parse, and PDF batch search requests to the backend or AI gateway.

## Documentation

- English MkDocs: https://citeverifier.readthedocs.io/en/latest/
- Docs source: docs/en/, docs/zh/
- Local preview: `mkdocs serve`

## License

See the LICENSE file for details.
