@echo off
setlocal
cd /d "%~dp0"

echo ========================================
echo    CiteVerifier Quick Start
echo ========================================
echo.

REM Check Python (try both 'python' and 'py' commands)
python --version >nul 2>&1
if errorlevel 1 (
    py --version >nul 2>&1
    if errorlevel 1 (
        echo [ERROR] Python not found. Please install Python 3.10+
        pause
        exit /b 1
    )
)

REM Check Node.js
node --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js not found. Please install Node.js 20+
    pause
    exit /b 1
)

echo [OK] Python and Node.js installed
echo.

REM Install backend dependencies if needed
if not exist "venv\Scripts\python.exe" (
    echo [INSTALL] Creating virtual environment...
    python -m venv venv 2>nul
    if not exist "venv\Scripts\python.exe" py -m venv venv
    if not exist "venv\Scripts\python.exe" (
        echo [ERROR] Failed to create virtual environment
        pause
        exit /b 1
    )
    echo [INSTALL] Installing backend dependencies...
    venv\Scripts\python.exe -m pip install --upgrade pip
    venv\Scripts\python.exe -m pip install -r requirements.txt
    if errorlevel 1 (
        echo [ERROR] Failed to install backend dependencies
        pause
        exit /b 1
    )
) else (
    echo [SKIP] Backend dependencies already installed
)

REM Install frontend dependencies if needed
if not exist "frontend\node_modules" (
    echo [INSTALL] Installing frontend dependencies...
    cd frontend
    call npm install
    cd ..
    if errorlevel 1 (
        echo [ERROR] Failed to install frontend dependencies
        pause
        exit /b 1
    )
) else (
    echo [SKIP] Frontend dependencies already installed
)

echo.
echo ========================================
echo [START] Launching services...
echo ========================================
echo.

REM Stop stale services that may still be using the app ports.
for %%P in (8080 8092) do (
    for /f "tokens=5" %%A in ('netstat -ano ^| findstr /R /C:":%%P .*LISTENING"') do (
        echo [INFO] Stopping existing service on port %%P, PID %%A...
        taskkill /PID %%A /F >nul 2>&1
    )
)

REM Start backend server
if not defined WEB_WORKERS set "WEB_WORKERS=2"
if not defined BAIDU_BROWSER_POOL_SIZE set "BAIDU_BROWSER_POOL_SIZE=2"
if not defined BAIDU_HEADLESS set "BAIDU_HEADLESS=0"
echo [1/2] Starting backend server (port 8092)...
start "CiteVerifier Backend" cmd /k "cd /d %~dp0 && venv\Scripts\python.exe -m uvicorn web_app:app --host 0.0.0.0 --port 8092 --workers %WEB_WORKERS% --timeout-graceful-shutdown 10"

REM Wait for backend to start
timeout /t 3 /nobreak >nul

REM Start frontend dev server
echo [2/2] Starting frontend dev server (port 8080)...
start "CiteVerifier Frontend" cmd /k "cd /d frontend && npm run dev -- --host 0.0.0.0 --port 8080 --strictPort"

REM Wait for frontend to start
timeout /t 5 /nobreak >nul

echo.
echo ========================================
echo    STARTED SUCCESSFULLY!
echo ========================================
echo.
echo  Frontend: http://localhost:8080
echo  Backend:  http://localhost:8092
echo  API Docs: http://localhost:8092/docs
echo.
echo  Press Ctrl+C to stop services
echo ========================================
echo.

REM Open browser automatically
timeout /t 3 /nobreak >nul
start http://localhost:8080

pause
