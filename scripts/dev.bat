@echo off
REM Start the dev server natively. Hot-reloads backend code automatically.
REM The frontend is served as static files at /app/ — refresh the browser to
REM pick up frontend changes (no build step).

setlocal
cd /d "%~dp0\.."

if not exist backend\.venv (
    echo No venv found. Run scripts\setup.bat first.
    exit /b 1
)

set "FRONTEND_DIR=%cd%\frontend"

echo.
echo === Starting uvicorn on http://127.0.0.1:8000 ===
echo     Frontend:  http://127.0.0.1:8000/app/
echo     API docs:  http://127.0.0.1:8000/docs
echo.
echo Backend code changes auto-reload.
echo Frontend changes: just refresh the browser.
echo Press Ctrl+C to stop.
echo.

cd backend
call .venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload --reload-dir app

endlocal
