<div align="center" style="display:flex;justify-content:center;align-items:center;gap:8px;">
  <img src="./docs/image/logo.svg" alt="CiteVerifier Logo" width="34" />
  <strong>CiteVerifier</strong>
</div>

<p align="center">一个文献引用校验工具包，将参考文献与 DBLP + 谷歌学术/谷歌搜索（英文）和百度学术（中文）进行匹配，支持基于 LLM 的 PDF 提取、多源在线搜索和现代化 Web 界面。</p>

<p align="center">[<a href="./README.md"><strong>EN</strong></a>] | [<a href="./README.zh-CN.md"><strong>CN</strong></a>]</p>

<p align="center">
  <img src="https://img.shields.io/badge/version-0.1.0-1f7a8c" alt="version" />
  <img src="https://img.shields.io/badge/python-3.10%2B-3776AB?logo=python&logoColor=white" alt="python" />
  <img src="https://img.shields.io/badge/FastAPI-0.111%2B-009688?logo=fastapi&logoColor=white" alt="fastapi" />
  <img src="https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white" alt="react" />
  <img src="https://img.shields.io/badge/node-20%2B-339933?logo=node.js&logoColor=white" alt="node" />
</p>

## 功能特性

- **以 DBLP 为核心的校验** — 通过本地 DBLP SQLite 数据库进行快速标题匹配，支持暴力搜索和索引搜索两种模式。
- **百度学术支持** — 通过 Selenium 驱动百度学术进行中文文献校验，结果缓存于 SQLite（24h TTL）。
- **SerpApi 回退链** — 英文标题按 DBLP → 谷歌学术 → 谷歌搜索（均经 SerpApi）逐级回退，每级独立 24h 缓存，仅缓存命中的结果。
- **基于 LLM 的 PDF 提取** — 上传 PDF，经 PyPDF2 提取文本后由 DashScope LLM 解析为结构化参考文献。
- **批量校验** — 通过 Web 界面一次性校验数百条引用。
- **运行时遥测** — 将校验历史和运行时指标存储在 SQLite 中。
- **现代化 Web 前端** — React 19 + TanStack Router 应用，使用 shadcn/ui 组件。
- **用户系统** — 轻量级注册/登录，支持会话管理。
- **高级搜索** — 多字段匹配，支持自定义相似度阈值（标题、作者、年份、期刊/会议）。
- **完整历史记录与导出** — 浏览历史校验记录并将结果导出为 CSV。

## 技术栈

| 层级 | 技术 |
|-------|-----------|
| 后端 | Python 3.10+, FastAPI, Uvicorn |
| 前端 | React 19, TanStack Router/Start, TanStack Query, Vite |
| UI 组件库 | shadcn/ui (Radix primitives + Tailwind CSS 4) |
| PDF 解析 | PyPDF2 文本提取 + DashScope LLM 结构化 |
| 数据源 | DBLP（本地 SQLite）、百度学术（Selenium）、谷歌学术 & 谷歌搜索（SerpApi） |
| 浏览器自动化 | Selenium + webdrivermanager_cn（阿里镜像）+ Chromium |
| 相似度计算 | rapidfuzz（模糊匹配） |
| 文档 | MkDocs + Material 主题 |

## 快速开始

### 前置要求

- Python 3.10+
- Node.js 20+
- Google Chrome 或 Chromium（用于百度学术 Selenium 搜索）

### 必需的 API 密钥

首次运行前**必须**设置以下环境变量：

```bash
# DashScope API 密钥 — 用于基于 LLM 的 PDF 参考文献提取（必需）
# cmd
set DASHSCOPE_API_KEY="your_api_key"
# cmd（管理员，持久化）
setx DASHSCOPE_API_KEY "your_api_key"
# Windows（PowerShell）
$env:DASHSCOPE_API_KEY="your_api_key"
# Linux / macOS
export DASHSCOPE_API_KEY="your_api_key"

# SerpApi 密钥 — 用于谷歌学术 / 谷歌搜索回退（必需）
set SERPAPI_API_KEY="your_api_key"
```

### Windows — 一键启动

直接双击或运行：

```batch
start.bat
```

这会自动检查依赖、安装包、预装 ChromeDriver、启动后端（端口 8092）和前端（端口 8080），然后打开浏览器。

### 手动启动

**1. 后端**

```bash
pip install -r requirements.txt
uvicorn web_app:app --host 0.0.0.0 --port 8092 --reload
```

后端在 http://localhost:8092 提供 REST API（Swagger 文档位于 `/docs`）。启动时通过 `ensure_chromedriver()` 在后台预装 ChromeDriver。

**2. 前端（开发服务器）**

```bash
cd frontend
npm install
npm run dev -- --host 0.0.0.0 --port 8080 --strictPort
```

### Docker

```bash
docker compose up -d --build
```

| 服务 | URL |
|---------|-----|
| Web 前端 | http://localhost:8080 |
| 后端 API | http://localhost:8092 |
| API 文档（Swagger） | http://localhost:8092/docs |
| DBLP 服务 | http://localhost:8093 |

## 配置

### 环境变量

| 变量 | 默认值 | 描述 |
|----------|---------|-------------|
| DBLP_DB_PATH | dblp.sqlite | DBLP SQLite 数据库路径 |
| CITEVERIFIER_DATA_DIR | ./data | 运行时数据目录（缓存 + 遥测） |
| CITEVERIFIER_RUNTIME_DB | {DATA_DIR}/runtime.sqlite | 运行时遥测数据库 |
| DASHSCOPE_API_KEY | - | DashScope API 密钥（LLM PDF 解析必需） |
| SERPAPI_API_KEY | - | SerpApi 密钥（谷歌学术/搜索回退必需） |
| CHROME_BIN | - | Chromium 二进制路径提示（Docker 自动设置） |

### 相似度权重 (checker/config.py)

| 字段 | 权重 | 阈值 |
|-------|--------|-----------|
| 标题 | 0.50 | 0.85 |
| 作者 | 0.25 | 0.70 |
| 年份 | 0.15 | 1.00 |
| 期刊/会议 | 0.10 | 0.70 |

## 项目结构

```
CiteVerifier-pro/
+-- web_app.py                    # FastAPI 后端入口
+-- dblp_match.py                 # DBLP 标题搜索（暴力 + 索引）
+-- runtime_store.py              # 运行时遥测与历史存储
+-- user_database.py              # 用户认证（注册/登录）
+-- build_dblp_sqlite.py          # 构建 DBLP SQLite 数据库（部署工具）
+-- start.bat                     # Windows 一键启动器
+-- requirements.txt              # Python 依赖
+-- Dockerfile                    # 后端 Docker 镜像
+-- docker-compose.yml            # 多服务 Docker 配置
|
+-- checker/                      # 校验引擎
|   +-- config.py                 # API 配置 + 相似度权重
|   +-- models.py                 # 数据模型（Reference, ExternalReference）
|   +-- utils.py                  # 字符串/作者相似度工具
|   +-- clients/                  # 在线搜索客户端
|       +-- baidu_client.py        # 百度学术（缓存 + 调度）
|       +-- baidu_selenium.py      # Selenium 驱动的百度学术搜索
|       +-- serpapi_google_scholar_client.py  # 谷歌学术（SerpApi）
|       +-- serpapi_google_search_client.py  # 谷歌搜索（SerpApi）
|
+-- parser/                       # 参考文献解析器
|   +-- llm_parser.py             # 基于 LLM 的参考文献提取（DashScope）
|   +-- format/utils.py           # 文本清洗（clean_text, extract_id）
|   +-- utils/pdf_reader.py       # PyPDF2 文本提取
|
+-- frontend/                     # React Web 应用
|   +-- src/
|   |   +-- routes/               # TanStack Router 文件路由
|   |   |   +-- index.tsx         # 首页
|   |   |   +-- simple-search.tsx # 单标题搜索
|   |   |   +-- advanced-search.tsx # 批量搜索
|   |   |   +-- english-literature.tsx # DBLP 搜索页面
|   |   |   +-- chinese-literature.tsx # 百度学术搜索
|   |   |   +-- detect.tsx        # PDF 上传和提取
|   |   |   +-- result.tsx        # 校验结果查看器
|   |   |   +-- history.tsx       # 校验历史
|   |   |   +-- login.tsx / register.tsx # 用户认证
|   |   |   +-- more.tsx          # 设置 / 关于
|   |   |   +-- api/              # TanStack Start 服务端 API 路由
|   |   +-- components/           # AiChat, SiteBackdrop, SiteNav + shadcn/ui
|   |   +-- hooks/                # 自定义 React hooks
|   |   +-- lib/                  # api-client, auth, i18n, ai-gateway, utils
|   |   +-- styles.css            # 全局样式 + Tailwind
|   +-- public/                   # 演示视频与场景图片
|
+-- docs/                         # MkDocs 文档源代码
    +-- en/                       # 英文文档
    +-- zh/                       # 中文文档
```

> 运行时生成的产物（不在仓库中）：`data/`（搜索缓存 + runtime.sqlite）、`chromedriver/`（ChromeDriver 缓存）、`dblp.sqlite`、`users.db`。

## API 端点

主要后端 API 路由（在端口 8092 上提供服务）：

| 端点 | 方法 | 描述 |
|----------|--------|-------------|
| /api/health | GET | 服务与 DBLP 数据库健康检查 |
| /api/progress | GET | 批量搜索进度 |
| /api/search/title | POST | 单标题搜索（中文→百度，英文→DBLP+回退） |
| /api/search/title/batch | POST | 批量标题搜索 |
| /api/parse/pdf | POST | 从 PDF 提取参考文献 |
| /api/register | POST | 用户注册 |
| /api/login | POST | 用户登录 |
| /api/search/baidu | POST | 单条百度学术搜索 |
| /api/search/baidu/batch | POST | 批量百度学术搜索 |

前端服务端 API 路由（`frontend/src/routes/api/`）将搜索、批量与解析请求代理到后端。

## 文档

- 英文 MkDocs：https://citeverifier.readthedocs.io/en/latest/
- 文档源代码：docs/en/, docs/zh/
- 本地预览：`mkdocs serve`

## 许可证

详细信息请参阅 LICENSE 文件。
