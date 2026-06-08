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
echo === Starting uvicorn on http://0.0.0.0:8000 (LAN-accessible) ===
echo     This PC:   http://127.0.0.1:8000/app/
echo     Phone/LAN: http://^<this-PC-IP^>:8000/app/   (same Wi-Fi)
echo     API docs:  http://127.0.0.1:8000/docs
echo.
echo Bound to 0.0.0.0 so a phone on the same network can reach it
echo (needed for "scan with phone"). If the phone still can't connect,
echo allow Python through Windows Firewall for Private networks.
echo NOTE: the phone CAMERA needs HTTPS; over plain http the phone can
echo still use the manual JAN entry on the scan page.
echo.
echo Backend code changes auto-reload.
echo Frontend changes: just refresh the browser.
echo Press Ctrl+C to stop.
echo.

cd backend
call .venv\Scripts\python.exe -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload --reload-dir app

endlocal
