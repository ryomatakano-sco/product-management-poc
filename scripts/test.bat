@echo off
REM Run the backend test suite (review-improvements C2).
REM Uses the dedicated `product_management_test` MySQL schema — created on
REM demand, truncated per test. Never touches maindb or product_management_dev.
REM AI calls run in mock mode (free, deterministic). For the real-recall
REM golden run: set RUN_AI_GOLDEN=1 first (spends OpenAI budget).

setlocal
cd /d "%~dp0\..\backend"

if not exist .venv (
    echo No venv found. Run scripts\setup.bat first.
    exit /b 1
)

.venv\Scripts\python.exe -m pytest tests -q %*
