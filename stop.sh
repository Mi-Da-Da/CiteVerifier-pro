sudo systemctl stop citeverifier-backend 2>/dev/null
pm2 delete citeverifier-frontend 2>/dev/null
sudo systemctl stop nginx 2>/dev/null
sudo lsof -i :80 -i :8080 -i :8092 2>/dev/null || echo "Ports 80/8080/8092 all free"