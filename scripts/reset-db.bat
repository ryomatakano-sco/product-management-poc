@echo off
REM Wipe + recreate the dev database, then re-seed.
REM Use this when you've made schema changes or want a clean slate.

setlocal
cd /d "%~dp0\.."

set "MYSQL_EXE=C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe"
if not exist "%MYSQL_EXE%" (
    echo ERROR: mysql.exe not found at %MYSQL_EXE%
    exit /b 1
)

echo Dropping + recreating product_management_dev...
"%MYSQL_EXE%" -u root -padmin -e "DROP DATABASE IF EXISTS product_management_dev; CREATE DATABASE product_management_dev CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
if errorlevel 1 (
    echo ERROR: failed to recreate database.
    exit /b 1
)

echo.
echo Running migrations + seed...
pushd backend
call .venv\Scripts\python.exe -m alembic upgrade head
call .venv\Scripts\python.exe -m app.seed
popd

echo.
echo === Reset complete ===
endlocal
