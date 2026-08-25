#!/usr/bin/env bash
# =============================================================================
# CiteVerifier-Pro 一键部署脚本 (Ubuntu 22.04+ / 公网 VPS)
#
# 用法:
#   sudo env DOMAIN=example.com ADMIN_EMAIL=admin@example.com bash deploy.sh
#   也可直接执行 sudo bash deploy.sh（仅启用 HTTP，使用当前项目目录）
#
# 完成后通过服务器 IP 或配置的域名访问
# =============================================================================
set -euo pipefail

# ─────────────────── 用户配置区（按需修改）─────────────────────────────────
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="${PROJECT_DIR:-$SCRIPT_DIR}" # 默认使用 deploy.sh 所在目录
DOMAIN="${DOMAIN:-_}"                     # 未配置域名时可通过服务器 IP 访问
ADMIN_EMAIL="${ADMIN_EMAIL:-}"
NODE_VER="${NODE_VER:-22}"
ENABLE_SSL="${ENABLE_SSL:-0}"             # 设为 1 时自动申请证书
CONFIGURE_APT_MIRROR="${CONFIGURE_APT_MIRROR:-0}"
SERVICE_USER="${SERVICE_USER:-${SUDO_USER:-root}}"
SERVICE_GROUP="$(id -gn "$SERVICE_USER" 2>/dev/null || echo "$SERVICE_USER")"

# 下方两个 key 必须填，否则批量检测 / PDF 解析不可用
SERPAPI_API_KEY="请改成你的serpapi api key"
DASHSCOPE_API_KEY="请改成你的dashscope api key"
# ────────────────────────────────────────────────────────────────────────────

# 颜色与日志
log()  { echo -e "\033[1;32m[deploy]\033[0m $*"; }
warn() { echo -e "\033[1;33m[warn]\033[0m  $*"; }
err()  { echo -e "\033[1;31m[err]\033[0m   $*" >&2; }
die()  { err "$*"; exit 1; }

# ─────────────────── 前置检查 ───────────────────────────────────────────────
[[ $EUID -eq 0 ]] || die "请使用 sudo / root 运行: sudo bash deploy.sh"
[[ -f /etc/os-release ]] || die "本脚本仅支持 Linux (推荐 Ubuntu 22.04+)"
. /etc/os-release
[[ "$ID" == "ubuntu" ]] || warn "未在 Ubuntu 上验证过，可能需要手动调整包名"

command -v git >/dev/null || die "git 未安装，请先 apt install git"

[[ -f "$PROJECT_DIR/web_app.py" ]] || die "项目根目录 $PROJECT_DIR 下找不到 web_app.py，请先 git clone 项目到该路径，或修改顶部 PROJECT_DIR 变量"

cd "$PROJECT_DIR"

# ─────────────────── 1. 配置国内 apt 源加速 (可选) ────────────────────────────
configure_apt_mirror() {
    [[ "$CONFIGURE_APT_MIRROR" == "1" ]] || {
        log "保留服务器现有 apt 软件源（如需清华源请设置 CONFIGURE_APT_MIRROR=1）"
        apt-get update -y
        return
    }
    if grep -q "mirrors.tuna.tsinghua.edu.cn" /etc/apt/sources.list 2>/dev/null; then
        log "apt 已使用清华镜像，跳过"
        return
    fi
    log "切换 apt 源到清华镜像 (加速国内访问)..."
    cp /etc/apt/sources.list /etc/apt/sources.list.bak.$(date +%s) 2>/dev/null || true
    sed -i \
        -e 's|http://archive.ubuntu.com/ubuntu|https://mirrors.tuna.tsinghua.edu.cn/ubuntu|g' \
        -e 's|http://security.ubuntu.com/ubuntu|https://mirrors.tuna.tsinghua.edu.cn/ubuntu|g' \
        /etc/apt/sources.list 2>/dev/null || true
    export DEBIAN_FRONTEND=noninteractive
    apt-get update -y
}

# ─────────────────── 2. 安装系统依赖 ────────────────────────────────────────
install_system_deps() {
    log "安装系统依赖 (nginx / python / build deps / certbot)..."
    apt-get install -y \
        nginx \
        certbot python3-certbot-nginx \
        python3 python3-dev python3-venv \
        build-essential libssl-dev libffi-dev libxml2-dev libxslt1-dev \
        libglib2.0-0 libnss3 libnspr4 libatk1.0-0 libatk-bridge2.0-0 \
        libcups2 libdrm2 libxkbcommon0 libxcomposite1 libxdamage1 \
        libxrandr2 libgbm1 libpango-1.0-0 libcairo2 libasound2 \
        fonts-liberation fonts-noto-cjk \
        curl wget git unzip jq
}

# ─────────────────── 3. 安装 Node.js (NodeSource) ──────────────────────────
install_node() {
    if command -v node >/dev/null && [[ "$(node -v)" == v$NODE_VER* ]]; then
        log "Node $(node -v) 已安装，跳过"
        return
    fi
    log "安装 Node.js $NODE_VER.x..."
    curl -fsSL "https://deb.nodesource.com/setup_${NODE_VER}.x" | bash -
    apt-get install -y nodejs
    # 配置 npm 国内镜像
    npm config set registry https://registry.npmmirror.com
    log "Node $(node -v) / npm $(npm -v) 安装完成"
}

# ─────────────────── 4. 安装 Google Chrome ──────────────────────────────────
install_chrome() {
    if command -v google-chrome >/dev/null; then
        log "Google Chrome 已安装：$(google-chrome --version 2>/dev/null || echo '已存在')"
        return
    fi
    log "安装 Google Chrome (用于 Baidu Selenium 抓取)..."
    # 直接下载 deb，避免国内访问 Google 源失败
    local tmpdeb=/tmp/google-chrome.deb
    wget -q --tries=3 --timeout=60 -O "$tmpdeb" \
        "https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb" \
        || die "Chrome 下载失败，请检查网络（国内可能需要换 deb 镜像或代理）"
    apt-get install -y "$tmpdeb" || apt-get -f install -y
    rm -f "$tmpdeb"
    google-chrome --version
}

# ─────────────────── 5. 后端 Python 依赖 ────────────────────────────────────
setup_backend() {
    log "创建 Python venv 并安装后端依赖..."
    if [[ ! -x venv/bin/python ]]; then
        python3 -m venv venv
    fi
    venv/bin/pip install --upgrade pip -i https://pypi.tuna.tsinghua.edu.cn/simple
    venv/bin/pip install -r requirements.txt -i https://pypi.tuna.tsinghua.edu.cn/simple

    # 保留已有配置；首次部署才创建 .env，避免重复部署时覆盖密钥。
    local session_secret
    session_secret=$(venv/bin/python -c 'import secrets; print(secrets.token_hex(32))')
    if [[ ! -f .env ]]; then
        cat > .env <<EOF
# 由 deploy.sh 自动生成
SERPAPI_API_KEY=$SERPAPI_API_KEY
DASHSCOPE_API_KEY=$DASHSCOPE_API_KEY

# 数据目录（绝对路径）
CITEVERIFIER_DATA_DIR=$PROJECT_DIR/data
CITEVERIFIER_RUNTIME_DB=$PROJECT_DIR/data/runtime.sqlite

# DBLP 数据库路径（如使用）
DBLP_DB_PATH=$PROJECT_DIR/dblp.sqlite

# Cookie 安全配置
COOKIE_SECURE=true
SESSION_SECRET=$session_secret

# 并发配置：2 web workers x 每 worker 2 个常驻 Chrome
WEB_WORKERS=2
BAIDU_BROWSER_POOL_SIZE=2
BAIDU_HEADLESS=1
EOF
        chmod 600 .env
        log ".env 已生成"
    else
        log "检测到已有 .env，保留不覆盖"
    fi

    if [[ -z "$SERPAPI_API_KEY" || -z "$DASHSCOPE_API_KEY" ]]; then
        warn "API Key 未通过环境变量传入；请确认 $PROJECT_DIR/.env 中已有正确配置"
    fi

    # 后端需要写入运行时数据库、临时文件和 ChromeDriver 目录。
    mkdir -p data temp chromedriver
    touch users.db
    chown -R "$SERVICE_USER:$SERVICE_GROUP" data temp chromedriver users.db .env
}

# ─────────────────── 6. 前端构建 ────────────────────────────────────────────
build_frontend() {
    log "安装前端依赖并构建 (TanStack Start)..."
    cd "$PROJECT_DIR/frontend"
    # 锁文件同步时优先使用 npm ci；依赖声明已变化时自动修复锁文件。
    if [[ -f package-lock.json ]] && ! npm ci --no-audit --no-fund; then
        warn "package-lock.json 与 package.json 不同步，回退到 npm install"
        npm install --no-audit --no-fund
    elif [[ ! -f package-lock.json ]]; then
        npm install --no-audit --no-fund
    fi
    npm run build
    cd "$PROJECT_DIR"

    # 验证产物
    [[ -f frontend/dist/server/server.js ]] \
        || die "前端构建失败：未找到 frontend/dist/server/server.js"
}

# ─────────────────── 7. PM2 守护前端进程 ────────────────────────────────────
setup_pm2_frontend() {
    log "安装 PM2 并启动前端 SSR 服务..."
    npm install -g pm2

    pm2 delete citeverifier-frontend 2>/dev/null || true

    # 当前构建产物是 Worker fetch handler，不能直接用 node 执行。
    # 使用仓库已定义且经过本地启动脚本验证的 Vite 服务入口。
    pm2 start npm --name citeverifier-frontend --cwd "$PROJECT_DIR/frontend" -- \
        run dev -- --host 127.0.0.1 --port 8080 --strictPort

    pm2 save
    # 开机自启
    local env_line
    env_line=$(pm2 startup systemd -u root --hp /root | grep -E 'sudo env' | head -1 || true)
    if [[ -n "$env_line" ]]; then
        eval "$env_line"
    else
        warn "PM2 开机自启命令未捕获，请手动执行: pm2 startup systemd"
    fi
}

# ─────────────────── 8. systemd 守护后端 ────────────────────────────────────
setup_systemd_backend() {
    log "生成后端 systemd 服务..."
    cat > /etc/systemd/system/citeverifier-backend.service <<EOF
[Unit]
Description=CiteVerifier Backend (FastAPI + uvicorn)
After=network.target

[Service]
Type=simple
User=$SERVICE_USER
Group=$SERVICE_GROUP
WorkingDirectory=$PROJECT_DIR
EnvironmentFile=$PROJECT_DIR/.env
ExecStart=$PROJECT_DIR/venv/bin/python -m uvicorn web_app:app --host 127.0.0.1 --port 8092 --workers 2
Restart=on-failure
RestartSec=3
# ChromeDriver 下载目录允许写
ReadWritePaths=$PROJECT_DIR

[Install]
WantedBy=multi-user.target
EOF

    systemctl daemon-reload
    systemctl enable --now citeverifier-backend
    log "后端服务已启动: systemctl status citeverifier-backend"
}

# ─────────────────── 9. Nginx 反代配置 ──────────────────────────────────────
setup_nginx() {
    log "生成 Nginx 配置..."
    cat > /etc/nginx/conf.d/citeverifier.conf <<EOF
# CiteVerifier 反向代理
server {
    listen 80;
    server_name $DOMAIN;

    # 前端 SSR (TanStack Start)
    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        # TanStack Start 可能需要 WebSocket
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
    }

    # AI 聊天是 TanStack 服务端路由，需要由前端服务处理。
    location = /api/chat {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 600s;
    }

    # 后端 API
    location /api/ {
        proxy_pass http://127.0.0.1:8092/api/;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        # 批量检测耗时，放宽超时
        proxy_read_timeout 600s;
        proxy_send_timeout 600s;
        # 上传 PDF 可能较大
        client_max_body_size 100m;
    }

    # FastAPI docs / openapi.json 直接走后端
    location ~ ^/(docs|openapi.json|redoc) {
        proxy_pass http://127.0.0.1:8092;
        proxy_set_header Host \$host;
    }
}
EOF

    nginx -t || die "Nginx 配置语法错误，请检查 /etc/nginx/conf.d/citeverifier.conf"
    systemctl reload nginx
    log "Nginx 配置已加载"
}

# ─────────────────── 10. 申请 HTTPS 证书 (Let's Encrypt) ────────────────────
setup_ssl() {
    if [[ "$ENABLE_SSL" == "1" ]]; then
        [[ "$DOMAIN" != "_" ]] || die "ENABLE_SSL=1 时必须设置 DOMAIN"
        [[ -n "$ADMIN_EMAIL" ]] || die "ENABLE_SSL=1 时必须设置 ADMIN_EMAIL"
        log "申请 HTTPS 证书（请确保 $DOMAIN 已解析到本机）..."
        certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos -m "$ADMIN_EMAIL" --redirect
        log "HTTPS 已启用"
    else
        log "跳过 SSL（设置 ENABLE_SSL=1 可自动申请证书）"
    fi
}

# ─────────────────── 11. 健康检查 + 输出 ────────────────────────────────────
health_check() {
    log "等待后端启动..."
    local backend_ok=0
    for i in {1..30}; do
        if curl -fsS http://127.0.0.1:8092/docs >/dev/null 2>&1; then
            log "后端已就绪"
            backend_ok=1
            break
        fi
        sleep 2
    done

    [[ "$backend_ok" == "1" ]] || {
        systemctl --no-pager --full status citeverifier-backend || true
        die "后端健康检查失败，请查看上方状态和 journalctl 日志"
    }

    log "等待前端启动..."
    local frontend_ok=0
    for i in {1..30}; do
        if curl -fsS http://127.0.0.1:8080 >/dev/null 2>&1; then
            log "前端已就绪"
            frontend_ok=1
            break
        fi
        sleep 2
    done
    [[ "$frontend_ok" == "1" ]] || {
        pm2 logs citeverifier-frontend --lines 50 --nostream || true
        die "前端健康检查失败，请查看上方 PM2 日志"
    }

    echo
    echo "=============================================="
    echo " 部署完成！"
    echo "=============================================="
    echo " 前端访问:   http://$DOMAIN"
    echo " 后端 API:   http://$DOMAIN/api"
    echo " API 文档:   http://$DOMAIN/docs"
    echo
    echo " 进程状态:"
    echo "   后端: systemctl status citeverifier-backend"
    echo "   前端: pm2 status"
    echo
    echo " 日志查看:"
    echo "   后端: journalctl -u citeverifier-backend -f"
    echo "   前端: pm2 logs citeverifier-frontend"
    echo
    echo " 后续操作:"
    echo "   1. 修改 $PROJECT_DIR/.env 填入真实的 SERPAPI_API_KEY / DASHSCOPE_API_KEY"
    echo "      然后: systemctl restart citeverifier-backend"
    echo "   2. 启用 HTTPS: sudo env DOMAIN=你的域名 ADMIN_EMAIL=你的邮箱 ENABLE_SSL=1 bash deploy.sh"
    echo "=============================================="
}

# ─────────────────── 主流程 ─────────────────────────────────────────────────
main() {
    log "部署开始 (项目目录: $PROJECT_DIR)"

    # 国内加速（可选）
    configure_apt_mirror
    install_system_deps
    install_node
    install_chrome
    setup_backend
    build_frontend
    setup_pm2_frontend
    setup_systemd_backend
    setup_nginx
    setup_ssl
    health_check

    log "全部步骤完成"
}

main "$@"
