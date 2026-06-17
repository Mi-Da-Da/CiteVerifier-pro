<div align="center" style="display:flex;justify-content:center;align-items:center;gap:8px;">
  <img src="./static/citeverifier-logo.svg" alt="CiteVerifier Logo" width="34" />
  <strong>CiteVerifier</strong>
</div>

<p align="center">A citation verification toolkit that matches references against DBLP (English) and Baidu Xueshu (Chinese), with automated PDF extraction, multi-source online search, and a modern web interface.</p>

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
- **Baidu Xueshu support** — Chinese literature verification via Baidu Xueshu API.
- **Multi-source online search** — Uses Scrapingdog, Google Scholar, and Baidu as fallback sources for difficult cases.
- **Automated PDF extraction** — Upload PDFs to auto-extract references via GROBID or LLM-based parsing.
- **Batch verification** — Verify hundreds of citations at once through the web UI or CLI.
- **Runtime telemetry** — Stores verification history and runtime metrics in SQLite.
- **Modern web frontend** — React 19 + TanStack Router app with shadcn/ui components.
- **User system** — Lightweight registration/login with session management.
- **Advanced search** — Multi-field matching with custom similarity thresholds (title, authors, year, venue).
- **Full history & export** — Browse past verifications and export results to CSV.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Python 3.10+, FastAPI, Uvicorn |
| Frontend | React 19, TanStack Router, TanStack Query, Vite |
| UI Kit | shadcn/ui (Radix primitives + Tailwind CSS 4) |
| PDF Parsing | GROBID (XML), LLM-based parsing |
| Data Sources | DBLP (local SQLite), Scrapingdog, Google Scholar, Baidu Xueshu |
| Similarity | rapidfuzz (fuzzy matching) |
| Docs | MkDocs + Material theme |

## Quick Start

### Prerequisites

- Python 3.10+
- Node.js 20+
- pip / npm

### Windows — One-Click Start

Simply double-click or run:

```batch
start.bat
```

This automatically checks dependencies, installs packages, starts the backend (port 8092) and frontend (port 8080), then opens the browser.

### Manual Start

**1. Backend**

```bash
pip install -r requirements.txt
uvicorn web_app:app --host 0.0.0.0 --port 8092 --reload
```

The backend provides a REST API and also serves the legacy Jinja2 template UI at http://localhost:8092.

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

## CLI Usage

The verifier.py script can be used for headless verification:

```bash
# Verify a single title
python verifier.py --title "Attention Is All You Need" --dblp-db dblp.sqlite

# Batch verification from a JSON file
python verifier.py --input references.json --dblp-db dblp.sqlite

# Run with sample data
python verifier.py --sample

# Full options
python verifier.py --help
```

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| DBLP_DB_PATH | dblp.sqlite | Path to DBLP SQLite database |
| CITEVERIFIER_DATA_DIR | ./data | Runtime data directory |
| CITEVERIFIER_RUNTIME_DB | {DATA_DIR}/runtime.sqlite | Runtime telemetry database |
| SCRAPINGDOG_API_KEY | - | API key for Scrapingdog (optional, for online fallback) |

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
+-- verifier.py                   # CLI verification entry point
+-- dblp_match.py                 # DBLP title search (brute-force + indexed)
+-- runtime_store.py              # Runtime telemetry storage
+-- reference_storage_service.py  # Reference storage service
+-- unified_database.py           # Unified DB layer (ScholarRecord)
+-- user_database.py              # User auth (register/login)
+-- parsed_references_database.py # Parsed references persistence
+-- grobid_parser_to_xml.py       # GROBID XML output conversion
+-- build_dblp_sqlite.py          # Build DBLP SQLite database
+-- start.bat                     # Windows one-click launcher
+-- requirements.txt              # Python dependencies
+-- Dockerfile                    # Backend Docker image
+-- docker-compose.yml            # Multi-service Docker setup
|
+-- checker/                      # Core verification engine
|   +-- config.py                 # API keys and similarity config
|   +-- models.py                 # Data models (Reference, VerificationResult, etc.)
|   +-- utils.py                  # String/author similarity utilities
|   +-- logger_config.py          # Logging configuration
|   +-- clients/                  # Online search clients
|       +-- base_client.py
|       +-- baidu_client.py
|       +-- baidu_selenium.py
|       +-- google_search_client.py
|       +-- scrapingdog_client.py
|
+-- parser/                       # Reference parser
|   +-- grobid_parser.py          # GROBID-based PDF parsing
|   +-- llm_parser.py             # LLM-based reference extraction
|   +-- format/                   # Output formatting
|   +-- utils/                    # Parser utilities
|
+-- frontend/                     # React web application
|   +-- src/
|       +-- routes/               # TanStack Router routes
|       |   +-- index.tsx         # Home page
|       |   +-- simple-search.tsx # Single title search
|       |   +-- advanced-search.tsx # Batch search
|       |   +-- english-literature.tsx # DBLP search page
|       |   +-- chinese-literature.tsx # Baidu Xueshu search
|       |   +-- detect.tsx        # PDF upload and extract
|       |   +-- result.tsx        # Verification result viewer
|       |   +-- history.tsx       # Verification history
|       |   +-- login.tsx / register.tsx # User auth
|       |   +-- more.tsx          # Settings / about
|       |   +-- api/              # Server-side API route handlers
|       +-- components/           # shadcn/ui components
|       +-- hooks/                # Custom React hooks
|       +-- lib/                  # Utility libraries
|       +-- styles.css            # Global styles + Tailwind
|
+-- docs/                         # MkDocs documentation source
|   +-- en/                       # English docs
|   +-- zh/                       # Chinese docs
|
+-- static/                       # Static assets (logo, CSS, etc.)
+-- templates/                    # Jinja2 HTML templates (legacy UI)
+-- assets/                       # Miscellaneous assets
```

## API Endpoints

Key backend API routes (served on port 8092):

| Endpoint | Method | Description |
|----------|--------|-------------|
| /api/search | POST | Single title DBLP search |
| /api/search/batch | POST | Batch title search |
| /api/parse/pdf | POST | Extract references from PDF |
| /api/register | POST | User registration |
| /api/login | POST | User login |

Frontend API route handlers (served on port 8080 via TanStack Start) proxy or process search, batch, and parse requests on the server side.

## Documentation

- English MkDocs: https://citeverifier.readthedocs.io/en/latest/
- Docs source code: docs/en/, docs/zh/
- Local preview: mkdocs serve

## License

See LICENSE file for details.
