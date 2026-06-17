<div align="center" style="display:flex;justify-content:center;align-items:center;gap:8px;">
  <img src="./static/citeverifier-logo.svg" alt="CiteVerifier Logo" width="34" />
  <strong>CiteVerifier</strong>
</div>

<p align="center">一款文献引文校验工具，支持基于 DBLP（英文文献）和百度学术（中文文献）的题名匹配，具备自动 PDF 提取、多源在线搜索和现代化 Web 界面。</p>

<p align="center">[<a href="./README.md"><strong>EN</strong></a>] | [<a href="./README.zh-CN.md"><strong>CN</strong></a>]</p>

<p align="center">
  <img src="https://img.shields.io/badge/version-0.1.0-1f7a8c" alt="version" />
  <img src="https://img.shields.io/badge/python-3.10%2B-3776AB?logo=python&logoColor=white" alt="python" />
  <img src="https://img.shields.io/badge/FastAPI-0.111%2B-009688?logo=fastapi&logoColor=white" alt="fastapi" />
  <img src="https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white" alt="react" />
  <img src="https://img.shields.io/badge/node-20%2B-339933?logo=node.js&logoColor=white" alt="node" />
</p>

## 功能特性

- **DBLP 优先校验** — 针对本地 DBLP SQLite 数据库进行快速题名匹配，支持暴力搜索与索引搜索两种模式。
- **百度学术支持** — 通过百度学术 API 进行中文文献校验。
- **多源在线搜索** — 对难以匹配的文献，使用 Scrapingdog、Google Scholar、百度等来源自动兜底。
- **自动 PDF 提取** — 上传 PDF 后自动经由 GROBID 或 LLM 解析提取参考文献。
- **批量校验** — 通过 Web 界面或命令行一次性校验数百条引文。
- **运行时遥测** — 将校验历史与运行指标持久化到 SQLite 中。
- **现代化前端** — 基于 React 19 + TanStack Router + shadcn/ui 构建。
- **用户系统** — 轻量级的注册/登录与会话管理。
- **高级搜索** — 支持多字段匹配，可自定义题名、作者、年份、刊物的相似度阈值。
- **历史记录与导出** — 浏览历史校验记录，并可导出为 CSV。

## 技术栈

| 层 | 技术 |
|-------|-----------|
| 后端 | Python 3.10+, FastAPI, Uvicorn |
| 前端 | React 19, TanStack Router, TanStack Query, Vite |
| UI 组件库 | shadcn/ui (Radix 原语 + Tailwind CSS 4) |
| PDF 解析 | GROBID (XML), LLM 解析 |
| 数据来源 | DBLP（本地 SQLite）, Scrapingdog, Google Scholar, 百度学术 |
| 相似度计算 | rapidfuzz（模糊匹配） |
| 文档 | MkDocs + Material 主题 |

## 快速开始

### 环境要求

- Python 3.10+
- Node.js 20+
- pip / npm

### Windows — 一键启动

双击或运行：

```batch
start.bat
```

该脚本会自动检查环境、安装依赖、启动后端（端口 8092）和前端（端口 8080），然后打开浏览器。

### 手动启动

**1. 后端**

```bash
pip install -r requirements.txt
uvicorn web_app:app --host 0.0.0.0 --port 8092 --reload
```

后端提供 REST API，同时托管旧版 Jinja2 模板界面，访问 http://localhost:8092 即可。

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

| 服务 | 地址 |
|---------|-----|
| Web 前端 | http://localhost:8080 |
| 后端 API | http://localhost:8092 |
| API 文档 (Swagger) | http://localhost:8092/docs |
| DBLP 服务 | http://localhost:8093 |

## CLI 使用

可通过 `verifier.py` 进行无界面校验：

```bash
# 校验单条题名
python verifier.py --title "Attention Is All You Need" --dblp-db dblp.sqlite

# 从 JSON 文件批量校验
python verifier.py --input references.json --dblp-db dblp.sqlite

# 使用示例数据运行
python verifier.py --sample

# 查看全部参数
python verifier.py --help
```

## 配置说明

### 环境变量

| 变量 | 默认值 | 说明 |
|----------|---------|-------------|
| DBLP_DB_PATH | dblp.sqlite | DBLP SQLite 数据库路径 |
| CITEVERIFIER_DATA_DIR | ./data | 运行时数据目录 |
| CITEVERIFIER_RUNTIME_DB | {DATA_DIR}/runtime.sqlite | 运行时遥测数据库 |
| SCRAPINGDOG_API_KEY | - | Scrapingdog API 密钥（可选，用于在线兜底） |

### 相似度权重（checker/config.py）

| 字段 | 权重 | 阈值 |
|-------|--------|-----------|
| title | 0.50 | 0.85 |
| authors | 0.25 | 0.70 |
| year | 0.15 | 1.00 |
| venue | 0.10 | 0.70 |

## 项目结构

```
CiteVerifier-pro/
+-- web_app.py                    # FastAPI 后端入口
+-- verifier.py                   # CLI 校验入口
+-- dblp_match.py                 # DBLP 题名搜索（暴力 + 索引）
+-- runtime_store.py              # 运行时遥测存储
+-- reference_storage_service.py  # 参考文献存储服务
+-- unified_database.py           # 统一数据库层（ScholarRecord）
+-- user_database.py              # 用户认证（注册/登录）
+-- parsed_references_database.py # 已解析参考文献持久化
+-- grobid_parser_to_xml.py       # GROBID XML 输出转换
+-- build_dblp_sqlite.py          # 构建 DBLP SQLite 数据库
+-- start.bat                     # Windows 一键启动脚本
+-- requirements.txt              # Python 依赖
+-- Dockerfile                    # 后端 Docker 镜像
+-- docker-compose.yml            # 多服务 Docker 配置
|
+-- checker/                      # 核心校验引擎
|   +-- config.py                 # API 密钥与相似度配置
|   +-- models.py                 # 数据模型（Reference, VerificationResult 等）
|   +-- utils.py                  # 字符串/作者相似度工具
|   +-- logger_config.py          # 日志配置
|   +-- clients/                  # 在线搜索客户端
|       +-- base_client.py
|       +-- baidu_client.py
|       +-- baidu_selenium.py
|       +-- google_search_client.py
|       +-- scrapingdog_client.py
|
+-- parser/                       # 参考文献解析器
|   +-- grobid_parser.py          # 基于 GROBID 的 PDF 解析
|   +-- llm_parser.py             # 基于 LLM 的参考文献提取
|   +-- format/                   # 输出格式化
|   +-- utils/                    # 解析器工具
|
+-- frontend/                     # React Web 应用
|   +-- src/
|       +-- routes/               # TanStack Router 路由
|       |   +-- index.tsx         # 首页
|       |   +-- simple-search.tsx # 单条题名搜索
|       |   +-- advanced-search.tsx # 批量搜索
|       |   +-- english-literature.tsx # DBLP 搜索页
|       |   +-- chinese-literature.tsx # 百度学术搜索
|       |   +-- detect.tsx        # PDF 上传与提取
|       |   +-- result.tsx        # 校验结果查看
|       |   +-- history.tsx       # 校验历史
|       |   +-- login.tsx / register.tsx # 用户认证
|       |   +-- more.tsx          # 设置/关于
|       |   +-- api/              # 服务端 API 路由处理
|       +-- components/           # shadcn/ui 组件
|       +-- hooks/                # 自定义 React Hooks
|       +-- lib/                  # 工具库
|       +-- styles.css            # 全局样式 + Tailwind
|
+-- docs/                         # MkDocs 文档源码
|   +-- en/                       # 英文文档
|   +-- zh/                       # 中文文档
|
+-- static/                       # 静态资源（logo、CSS 等）
+-- templates/                    # Jinja2 HTML 模板（旧版 UI）
+-- assets/                       # 杂项资源
```

## API 端点

后端主要 API 路由（运行在 8092 端口）：

| 端点 | 方法 | 说明 |
|----------|--------|-------------|
| /api/search | POST | 单条题名 DBLP 搜索 |
| /api/search/batch | POST | 批量题名搜索 |
| /api/parse/pdf | POST | 从 PDF 提取参考文献 |
| /api/register | POST | 用户注册 |
| /api/login | POST | 用户登录 |

前端 API 路由处理（运行在 8080 端口，通过 TanStack Start 实现）在服务端代理或处理搜索、批量、解析等请求。

## 文档

- 英文 MkDocs：https://citeverifier.readthedocs.io/en/latest/
- 文档源码：docs/en/、docs/zh/
- 本地预览：mkdocs serve

## 许可证

详见 LICENSE 文件。
