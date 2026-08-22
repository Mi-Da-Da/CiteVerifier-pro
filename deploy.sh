#!/usr/bin/env bash
# =============================================================================
# CiteVerifier-Pro 一键部署脚本 (Ubuntu 22.04+ / 公网 VPS)
#
# 用法:
#   1. 把项目代码上传到 /opt/citeverifier（或修改下方 PROJECT_DIR）
#   2. 修改下方 DOMAIN / ADMIN_EMAIL / 后端 API 密钥
#   3. sudo bash deploy.sh
#
# 完成后访问 https://<DOMAIN>
# =============================================================================
set -euo pipefail

# ─────────────────── 用户配置区（按需修改）─────────────────────────────────
PROJECT_DIR="/opt/citeverifier"          # 项目根目录
DOMAIN="citeverifier.example.com"        # 你的域名（必须已解析到本机）
ADMIN_EMAIL="admin@example.com"          # Let's Encrypt 证书通知邮箱
PYTHON_VER="3.11"                         # Python 版本 (>=3.10)
NODE_VER="20"                             # Node.js 主版本

# 下方两个 key 必须填，否则批量检测 / PDF 解析不可用
SERPAPI_API_KEY="请改成你的_serpapi_key"
DASHSCOPE_API_KEY="请改成你的_dashscope_key"
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
    python3 -m venv venv
    venv/bin/pip install --upgrade pip -i https://pypi.tuna.tsinghua.edu.cn/simple
    venv/bin/pip install -r requirements.txt -i https://pypi.tuna.tsinghua.edu.cn/simple

    # 写入 .env（如已存在则备份后覆盖）
    if [[ -f .env ]]; then
        cp .env ".env.bak.$(date +%s)"
    fi
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
EOF
    log ".env 已生成，记得回头改 SERPAPI_API_KEY / DASHSCOPE_API_KEY"

    # 建数据目录
    mkdir -p data
    chown -R www-data:www-data data 2>/dev/null || true
}

# ─────────────────── 6. 前端构建 ────────────────────────────────────────────
build_frontend() {
    log "安装前端依赖并构建 (TanStack Start)..."
    cd "$PROJECT_DIR/frontend"
    npm install --no-audit --no-fund
    npm run build
    cd "$PROJECT_DIR"

    # 验证产物
    if [[ -f frontend/.output/server/index.mjs ]]; then
        log "前端 SSR 产物: frontend/.output/server/index.mjs"
    else
        warn "未找到 .output/server/index.mjs，前端可能不是 Nitro 模式，需手动检查启动方式"
    fi
}

# ─────────────────── 7. PM2 守护前端进程 ────────────────────────────────────
setup_pm2_frontend() {
    log "安装 PM2 并启动前端 SSR 服务..."
    npm install -g pm2

    pm2 delete citeverifier-frontend 2>/dev/null || true

    if [[ -f frontend/.output/server/index.mjs ]]; then
        PORT=3000 pm2 start frontend/.output/server/index.mjs --name citeverifier-frontend
    else
        # 兜底：用 vite preview 静态服务
        warn "回退到 vite preview (端口 3000)"
        cd frontend
        PORT=3000 pm2 start "npm run preview -- --port 3000 --host 127.0.0.1" \
            --name citeverifier-frontend --cwd "$PROJECT_DIR/frontend"
        cd "$PROJECT_DIR"
    fi

    pm2 save
    # 开机自启
    local env_line
    env_line=$(pm2 startup systemd -u root --hp /root | grep -E 'sudo env' | head -1)
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
User=www-data
Group=www-data
WorkingDirectory=$PROJECT_DIR
EnvironmentFile=$PROJECT_DIR/.env
ExecStart=$PROJECT_DIR/venv/bin/python -m uvicorn web_app:app --host 127.0.0.1 --port 8092
Restart=on-failure
RestartSec=3
# ChromeDriver 下载目录允许写
ReadWritePaths=$PROJECT_DIR

[Install]
WantedBy=multi-user.target
EOF

    # 数据目录权限
    chown -R www-data:www-data "$PROJECT_DIR/data" 2>/dev/null || true
    # 项目目录让 www-data 可读可写（chromedriver 缓存等）
    chown -R www-data:www-data "$PROJECT_DIR" 2>/dev/null || true

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
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        # TanStack Start 可能需要 WebSocket
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
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
    log "提示: 请确保 $DOMAIN 已正确 DNS 解析到本机公网 IP"
    read -r -p "现在申请 HTTPS 证书吗? [y/N]: " yn
    if [[ "$yn" =~ ^[Yy]$ ]]; then
        certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos -m "$ADMIN_EMAIL" --redirect
        log "HTTPS 已启用"
    else
        warn "跳过 SSL，可稍后手动执行: certbot --nginx -d $DOMAIN"
    fi
}

# ─────────────────── 11. 健康检查 + 输出 ────────────────────────────────────
health_check() {
    log "等待后端启动..."
    for i in {1..15}; do
        if curl -fsS http://127.0.0.1:8092/docs >/dev/null 2>&1; then
            log "后端已就绪"
            break
        fi
        sleep 2
    done

    log "等待前端启动..."
    for i in {1..15}; do
        if curl -fsS http://127.0.0.1:8080 >/dev/null 2>&1; then
            log "前端已就绪"
            break
        fi
        sleep 2
    done

    echo
    echo "=============================================="
    echo " 部署完成！"
    echo "=============================================="
    echo " 前端访问:   http://$DOMAIN  (申请证书后为 https://$DOMAIN)"
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
    echo "   2. 申请 HTTPS: sudo certbot --nginx -d $DOMAIN"
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
