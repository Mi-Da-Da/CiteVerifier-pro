@echo off
echo ========================================
echo    CiteVerifier Quick Start
echo ========================================
echo.

REM Check Python
python --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Python not found. Please install Python 3.10+
    pause
    exit /b 1
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
if not exist "venv" (
    echo [INSTALL] Installing backend dependencies...
    pip install -r requirements.txt
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

REM Start backend server
echo [1/2] Starting backend server (port 8092)...
start "CiteVerifier Backend" cmd /k "python -m uvicorn web_app:app --host 0.0.0.0 --port 8092"

REM Wait for backend to start
timeout /t 3 /nobreak >nul

REM Start frontend dev server
echo [2/2] Starting frontend dev server (port 8080)...
start "CiteVerifier Frontend" cmd /k "cd frontend && npm run dev"

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
