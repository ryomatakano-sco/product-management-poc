@echo off
REM Generate a self-signed TLS cert for local HTTPS dev (phone-camera path).
REM Includes localhost, 127.0.0.1 and this PC's current LAN IPv4 in the SAN so
REM the phone can open https://<PC-IP>:8000 and (after accepting the one-time
REM warning) use the camera. Re-run this if your PC's LAN IP changes.
REM Requires openssl on PATH (ships with Git for Windows).

setlocal enabledelayedexpansion
cd /d "%~dp0\.."

REM --- detect primary LAN IPv4 (first non-loopback IPv4 from ipconfig) ---
set "LANIP="
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4"') do (
    if not defined LANIP (
        set "LANIP=%%a"
        set "LANIP=!LANIP: =!"
    )
)
if not defined LANIP set "LANIP=127.0.0.1"
echo Detected LAN IP: !LANIP!

where openssl >nul 2>nul
if errorlevel 1 (
    echo openssl not found on PATH. Install Git for Windows ^(includes openssl^) and retry.
    exit /b 1
)

if not exist backend\.certs mkdir backend\.certs

openssl req -x509 -newkey rsa:2048 -nodes ^
  -keyout backend\.certs\dev.key -out backend\.certs\dev.crt -days 825 ^
  -subj "/CN=paylightx-dev" ^
  -addext "subjectAltName=DNS:localhost,IP:127.0.0.1,IP:!LANIP!"

if errorlevel 1 (
    echo Cert generation failed.
    exit /b 1
)
echo.
echo Created backend\.certs\dev.crt + dev.key  ^(SAN includes !LANIP!^)
echo Now run scripts\dev-https.bat and open https://!LANIP!:8000/app/ on your phone.
endlocal
