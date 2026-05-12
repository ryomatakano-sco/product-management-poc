@echo off
REM One-time native setup. Run this once per fresh clone.
REM Requires: Python 3.11+ on PATH, MySQL 8 running locally.

setlocal
cd /d "%~dp0\.."

echo.
echo === [1/4] Creating Python venv in backend\.venv ===
if not exist backend\.venv (
    python -m venv backend\.venv
    if errorlevel 1 (
        echo ERROR: failed to create venv. Is Python on your PATH?
        exit /b 1
    )
)

echo.
echo === [2/4] Installing backend deps ===
call backend\.venv\Scripts\python.exe -m pip install --upgrade pip
call backend\.venv\Scripts\python.exe -m pip install -e .\backend
if errorlevel 1 (
    echo ERROR: pip install failed.
    exit /b 1
)

echo.
echo === [3/4] Creating database (product_management_dev) ===
set "MYSQL_EXE=C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe"
if not exist "%MYSQL_EXE%" (
    echo WARNING: mysql.exe not found at %MYSQL_EXE%
    echo Skipping DB creation. Make sure 'product_management_dev' exists in your MySQL.
) else (
    "%MYSQL_EXE%" -u root -padmin -e "CREATE DATABASE IF NOT EXISTS product_management_dev CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
)

echo.
echo === [4/4] Running migrations + seed ===
pushd backend
call .venv\Scripts\python.exe -m alembic upgrade head
call .venv\Scripts\python.exe -m app.seed
popd

echo.
echo === DONE ===
echo Run scripts\dev.bat to start the dev server.
endlocal
