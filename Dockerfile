FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

# 百度学术 Selenium 检索需要 Chromium 浏览器二进制与中文字体；
# 软链 google-chrome 让 Selenium 默认能定位到浏览器。
RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium \
    fonts-noto-cjk \
    && rm -rf /var/lib/apt/lists/* \
    && ln -s /usr/bin/chromium /usr/bin/google-chrome

COPY requirements.txt /app/requirements.txt
RUN pip install -r /app/requirements.txt

# 后端 Web 运行所需文件（templates/static 已随 React 前端迁移移除，verifier CLI 通路不打包）
COPY web_app.py dblp_match.py runtime_store.py user_database.py session_manager.py sqlite_utils.py /app/
COPY parser /app/parser
COPY checker /app/checker

# ChromeDriver 由 webdrivermanager_cn 运行时下载到 /app/chromedriver 子目录
# 运行时数据（runtime.sqlite、各搜索缓存 db）落到 /runtime，由 docker-compose 挂卷
VOLUME ["/runtime"]
EXPOSE 8092

CMD ["sh", "-c", "uvicorn web_app:app --host 0.0.0.0 --port 8092 --workers ${WEB_WORKERS:-2} --timeout-graceful-shutdown 10"]
