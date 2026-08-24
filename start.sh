# 1. 启动后端
sudo systemctl start citeverifier-backend

# 2. 启动前端（PM2）
pm2 start citeverifier-frontend 2>/dev/null || \
pm2 start npm --name citeverifier-frontend --cwd /opt/citeverifier/CiteVerifier-pro/frontend -- \
    run dev -- --host 127.0.0.1 --port 8080 --strictPort

# 3. 启动 nginx
sudo systemctl start nginx