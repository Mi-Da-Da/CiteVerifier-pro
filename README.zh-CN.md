﻿<div align="center" style="display:flex;justify-content:center;align-items:center;gap:8px;">
  <img src="./static/citeverifier-logo.svg" alt="CiteVerifier Logo" width="34" />
  <strong>CiteVerifier</strong>
</div>

<p align="center">一个文献引用校验工具包，将参考文献与 DBLP 数据库+谷歌学术搜索（英文）和百度学术（中文）进行匹配，支持自动化 PDF 提取、多源在线搜索和现代化 Web 界面。</p>

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
- **百度学术支持** — 通过百度学术 API 进行中文文献校验。
- **多源在线搜索** — 使用 Scrapingdog、Google Scholar 和百度作为困难情况的备用数据源。
- **自动化 PDF 提取** — 上传 PDF 文件，通过 GROBID 或基于 LLM 的解析自动提取参考文献。
- **批量校验** — 通过 Web 界面或命令行一次性校验数百条引用。
- **运行时遥测** — 将校验历史和运行时指标存储在 SQLite 中。
- **现代化 Web 前端** — React 19 + TanStack Router 应用，使用 shadcn/ui 组件。
- **用户系统** — 轻量级注册/登录，支持会话管理。
- **高级搜索** — 多字段匹配，支持自定义相似度阈值（标题、作者、年份、期刊/会议）。
- **完整历史记录与导出** — 浏览历史校验记录并将结果导出为 CSV。

## 技术栈

| 层级 | 技术 |
|-------|-----------|
| 后端 | Python 3.10+, FastAPI, Uvicorn |
| 前端 | React 19, TanStack Router, TanStack Query, Vite |
| UI 组件库 | shadcn/ui (Radix primitives + Tailwind CSS 4) |
| PDF 解析 | GROBID (XML), 基于 LLM 的解析 |
| 数据源 | DBLP (本地 SQLite), Scrapingdog, Google Scholar, 百度学术 |
| 相似度计算 | rapidfuzz (模糊匹配) |
| 文档 | MkDocs + Material 主题 |

## 快速开始

### 前置要求

- Python 3.10+
- Node.js 20+
- pip / npm

**必须**设置 DASHSCOPE_API_KEY 环境变量才能首次使用基于 LLM 的解析：
```bash
#cmd
set DASHSCOPE_API_KEY="your_api_key"
#cmd(admin)
setx DASHSCOPE_API_KEY "your_api_key"
#Windows(powershell)
$env:DASHSCOPE_API_KEY="your_api_key"
#linux/macOS
export DASHSCOPE_API_KEY="your_api_key"
```
### Windows — 一键启动

直接双击或运行：

```batch
start.bat
```

这会自动检查依赖、安装包、启动后端（端口 8092）和前端（端口 8080），然后打开浏览器。

### 手动启动

**1. 后端**

```bash
pip install -r requirements.txt
uvicorn web_app:app --host 0.0.0.0 --port 8092 --reload
```

后端提供 REST API，同时在 http://localhost:8092 提供传统的 Jinja2 模板界面。

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
| API 文档 (Swagger) | http://localhost:8092/docs |
| DBLP 服务 | http://localhost:8093 |

## 命令行使用

verifier.py 脚本可用于无头校验：

```bash
# 校验单个标题
python verifier.py --title "Attention Is All You Need" --dblp-db dblp.sqlite

# 从 JSON 文件批量校验
python verifier.py --input references.json --dblp-db dblp.sqlite

# 使用示例数据运行
python verifier.py --sample

# 查看完整选项
python verifier.py --help
```

## 配置

### 环境变量

| 变量 | 默认值 | 描述 |
|----------|---------|-------------|
| DBLP_DB_PATH | dblp.sqlite | DBLP SQLite 数据库路径 |
| CITEVERIFIER_DATA_DIR | ./data | 运行时数据目录 |
| CITEVERIFIER_RUNTIME_DB | {DATA_DIR}/runtime.sqlite | 运行时遥测数据库 |
| SCRAPINGDOG_API_KEY | - | Scrapingdog API 密钥（可选，用于在线备用） |
| DASHSCOPE_API_KEY | - | DeepSeek API 服务密钥（重要，必须设置才能使用 LLM 解析服务） |

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
+-- verifier.py                   # 命令行校验入口
+-- dblp_match.py                 # DBLP 标题搜索（暴力搜索 + 索引搜索）
+-- runtime_store.py              # 运行时遥测存储
+-- reference_storage_service.py  # 参考文献存储服务
+-- unified_database.py           # 统一数据库层 (ScholarRecord)
+-- user_database.py              # 用户认证（注册/登录）
+-- parsed_references_database.py # 解析后的参考文献持久化
+-- grobid_parser_to_xml.py       # GROBID XML 输出转换
+-- build_dblp_sqlite.py          # 构建 DBLP SQLite 数据库
+-- start.bat                     # Windows 一键启动器
+-- requirements.txt              # Python 依赖
+-- Dockerfile                    # 后端 Docker 镜像
+-- docker-compose.yml            # 多服务 Docker 配置
|
+-- checker/                      # 核心校验引擎
|   +-- config.py                 # API 密钥和相似度配置
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
|       |   +-- simple-search.tsx # 单标题搜索
|       |   +-- advanced-search.tsx # 批量搜索
|       |   +-- english-literature.tsx # DBLP 搜索页面
|       |   +-- chinese-literature.tsx # 百度学术搜索
|       |   +-- detect.tsx        # PDF 上传和提取
|       |   +-- result.tsx        # 校验结果查看器
|       |   +-- history.tsx       # 校验历史
|       |   +-- login.tsx / register.tsx # 用户认证
|       |   +-- more.tsx          # 设置 / 关于
|       |   +-- api/              # 服务端 API 路由处理器
|       +-- components/           # shadcn/ui 组件
|       +-- hooks/                # 自定义 React hooks
|       +-- lib/                  # 工具库
|       +-- styles.css            # 全局样式 + Tailwind
|
+-- docs/                         # MkDocs 文档源代码
|   +-- en/                       # 英文文档
|   +-- zh/                       # 中文文档
|
+-- static/                       # 静态资源（logo, CSS 等）
+-- templates/                    # Jinja2 HTML 模板（传统界面）
+-- assets/                       # 其他资源
```

## API 端点

主要后端 API 路由（在端口 8092 上提供服务）：

| 端点 | 方法 | 描述 |
|----------|--------|-------------|
| /api/search | POST | 单标题 DBLP 搜索 |
| /api/search/batch | POST | 批量标题搜索 |
| /api/parse/pdf | POST | 从 PDF 提取参考文献 |
| /api/register | POST | 用户注册 |
| /api/login | POST | 用户登录 |

前端 API 路由处理器（通过 TanStack Start 在端口 8080 上提供服务）在服务端代理或处理搜索、批量处理和解析请求。

## 文档

- 英文 MkDocs：https://citeverifier.readthedocs.io/en/latest/
- 文档源代码：docs/en/, docs/zh/
- 本地预览：mkdocs serve

## 许可证

详细信息请参阅 LICENSE 文件。