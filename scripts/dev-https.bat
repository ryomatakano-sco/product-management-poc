@echo off
REM Start the dev server over HTTPS so a PHONE on the same Wi-Fi can use the
REM camera (mobile browsers only allow the camera in a secure context = HTTPS).
REM Uses a self-signed cert in backend\.certs (run scripts\gen-dev-cert.bat once
REM to create it). The phone will show a one-time "not secure" warning — tap
REM Advanced -> proceed; after that the camera works.

setlocal
cd /d "%~dp0\.."

if not exist backend\.venv (
    echo No venv found. Run scripts\setup.bat first.
    exit /b 1
)
if not exist backend\.certs\dev.crt (
    echo No dev cert found. Run scripts\gen-dev-cert.bat first.
    exit /b 1
)

set "FRONTEND_DIR=%cd%\frontend"

echo.
echo === Starting uvicorn over HTTPS on https://0.0.0.0:8000 ===
echo     This PC:   https://127.0.0.1:8000/app/
echo     Phone/LAN: https://^<this-PC-IP^>:8000/app/   (same Wi-Fi)
echo.
echo The cert is self-signed, so the browser shows a one-time warning:
echo   - Chrome/Android: "Advanced" -> "Proceed to ... (unsafe)"
echo   - Safari/iOS:     "Show Details" -> "visit this website"
echo After accepting, the page is a secure context and the camera works.
echo If the phone can't connect, allow Python through Windows Firewall (Private).
echo Press Ctrl+C to stop.
echo.

cd backend
call .venv\Scripts\python.exe -m uvicorn app.main:app --host 0.0.0.0 --port 8000 ^
    --reload --reload-dir app ^
    --ssl-keyfile .certs\dev.key --ssl-certfile .certs\dev.crt

endlocal
