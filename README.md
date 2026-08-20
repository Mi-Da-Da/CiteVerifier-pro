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
- **LLM-based PDF extraction** — Upload PDFs and extract structured references via the DashScope LLM parser (PyPDF2 text extraction + LLM structuring).
- **Batch verification** — Verify hundreds of citations at once through the web UI.
- **Runtime telemetry** — Stores verification history and runtime metrics in SQLite.
- **Modern web frontend** — React 19 + TanStack Router app with shadcn/ui components.
- **User system** — Lightweight registration/login with session management.
- **Advanced search** — Multi-field matching with custom similarity thresholds (title, authors, year, venue).
- **Full history & export** — Browse past verifications and export results to CSV.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Python 3.10+, FastAPI, Uvicorn |
| Frontend | React 19, TanStack Router/Start, TanStack Query, Vite |
| UI Kit | shadcn/ui (Radix primitives + Tailwind CSS 4) |
| PDF Parsing | PyPDF2 text extraction + DashScope LLM structuring |
| Data Sources | DBLP (local SQLite), Baidu Xueshu (Selenium), Google Scholar & Google Search (SerpApi) |
| Browser Automation | Selenium + webdrivermanager_cn (Ali mirror) + Chromium |
| Similarity | rapidfuzz (fuzzy matching) |
| Docs | MkDocs + Material theme |

## Quick Start

### Prerequisites

- Python 3.10+
- Node.js 20+
- Google Chrome or Chromium (for Baidu Xueshu Selenium search)

### Required API Keys

You **must** set the following environment variables before first run:

```bash
# DashScope API key — required for LLM-based PDF reference extraction
# cmd
set DASHSCOPE_API_KEY="your_api_key"
# cmd (admin, persistent)
setx DASHSCOPE_API_KEY "your_api_key"
# Windows (PowerShell)
$env:DASHSCOPE_API_KEY="your_api_key"
# Linux / macOS
export DASHSCOPE_API_KEY="your_api_key"

# SerpApi key — required for Google Scholar / Google Search fallback
set SERPAPI_API_KEY="your_api_key"
```

### Windows — One-Click Start

Simply double-click or run:

```batch
start.bat
```

This checks dependencies, installs packages, pre-installs ChromeDriver, starts the backend (port 8092) and frontend (port 8080), then opens the browser.

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

### Docker

```bash
docker compose up -d --build
```

| Service | URL |
|---------|-----|
| Web frontend | http://localhost:8080 |
| Backend API | http://localhost:8092 |
| API docs (Swagger) | http://localhost:8092/docs |
| DBLP service | http://localhost:8093 |

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| DBLP_DB_PATH | dblp.sqlite | Path to DBLP SQLite database |
| CITEVERIFIER_DATA_DIR | ./data | Runtime data directory (caches + telemetry) |
| CITEVERIFIER_RUNTIME_DB | {DATA_DIR}/runtime.sqlite | Runtime telemetry database |
| DASHSCOPE_API_KEY | - | DashScope API key (required for LLM PDF parsing) |
| SERPAPI_API_KEY | - | SerpApi key (required for Google Scholar/Search fallback) |
| CHROME_BIN | - | Chromium binary path hint (Docker sets it automatically) |

### Similarity Weights (checker/config.py)

| Field | Weight | Threshold |
|-------|--------|-----------|
| title | 0.50 | 0.85 |
| authors | 0.25 | 0.70 |
| year | 0.15 | 1.00 |
| venue | 0.10 | 0.70 |

## Project Structure

```
CiteVerifier-pro/
+-- web_app.py                    # FastAPI backend entry point
+-- dblp_match.py                 # DBLP title search (brute-force + indexed)
+-- runtime_store.py              # Runtime telemetry & history storage
+-- user_database.py              # User auth (register/login)
+-- build_dblp_sqlite.py          # Build DBLP SQLite database (deploy tool)
+-- start.bat                     # Windows one-click launcher
+-- requirements.txt              # Python dependencies
+-- Dockerfile                    # Backend Docker image
+-- docker-compose.yml            # Multi-service Docker setup
|
+-- checker/                      # Verification engine
|   +-- config.py                 # API config + similarity weights
|   +-- models.py                 # Data models (Reference, ExternalReference)
|   +-- utils.py                  # String/author similarity utilities
|   +-- clients/                  # Online search clients
|       +-- baidu_client.py        # Baidu Xueshu (cache + dispatch)
|       +-- baidu_selenium.py      # Selenium-driven Baidu Xueshu search
|       +-- serpapi_google_scholar_client.py  # Google Scholar (SerpApi)
|       +-- serpapi_google_search_client.py  # Google Search (SerpApi)
|
+-- parser/                       # Reference parser
|   +-- llm_parser.py             # LLM-based reference extraction (DashScope)
|   +-- format/utils.py           # Text cleaning (clean_text, extract_id)
|   +-- utils/pdf_reader.py       # PyPDF2 text extraction
|
+-- frontend/                     # React web application
|   +-- src/
|   |   +-- routes/               # TanStack Router file routes
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
|   |   +-- components/           # AiChat, SiteBackdrop, SiteNav + shadcn/ui
|   |   +-- hooks/                # Custom React hooks
|   |   +-- lib/                  # api-client, auth, i18n, ai-gateway, utils
|   |   +-- styles.css            # Global styles + Tailwind
|   +-- public/                   # Demo video & scene images
|
+-- docs/                         # MkDocs documentation source
    +-- en/                       # English docs
    +-- zh/                       # Chinese docs
```

> Runtime-generated artifacts (not in the repo): `data/` (search caches + runtime.sqlite), `chromedriver/` (ChromeDriver cache), `dblp.sqlite`, `users.db`.

## API Endpoints

Key backend API routes (served on port 8092):

| Endpoint | Method | Description |
|----------|--------|-------------|
| /api/health | GET | Service & DBLP DB health check |
| /api/progress | GET | Batch search progress |
| /api/search/title | POST | Single title search (zh→Baidu, en→DBLP+fallback) |
| /api/search/title/batch | POST | Batch title search |
| /api/parse/pdf | POST | Extract references from a PDF |
| /api/register | POST | User registration |
| /api/login | POST | User login |
| /api/search/baidu | POST | Single Baidu Xueshu search |
| /api/search/baidu/batch | POST | Batch Baidu Xueshu search |

Frontend server-side API routes (`frontend/src/routes/api/`) proxy search, batch, and parse requests to the backend.

## Documentation

- English MkDocs: https://citeverifier.readthedocs.io/en/latest/
- Docs source: docs/en/, docs/zh/
- Local preview: `mkdocs serve`

## License

See the LICENSE file for details.
