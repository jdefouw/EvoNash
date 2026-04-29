@echo off
REM ============================================================
REM  EvoNash Worker - Start Script
REM  1. Ensures worker UUID exists (generates if needed)
REM  2. Prompts for worker name (or keeps existing)
REM  3. Runs data verification if not already verified
REM  4. Starts the worker service
REM ============================================================

echo.
echo ============================================================
echo   EvoNash Worker - Starting...
echo ============================================================
echo.

cd /d "%~dp0"

REM Check if Python is available
where python >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Python not found in PATH
    echo Please ensure Python is installed and in your PATH
    pause
    exit /b 1
)

REM ── Step 1: Setup worker identity ──────────────────────────
echo [Step 1/3] Setting up worker identity...
python setup_worker.py
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo ERROR: Worker setup failed!
    pause
    exit /b 1
)
echo.

REM ── Step 2: Check verification ─────────────────────────────
echo [Step 2/3] Checking data verification status...
python check_verification.py
if %ERRORLEVEL% EQU 0 goto :verified

echo Verification not found or check failed. Running verification suite...
call run_verification.bat
if %ERRORLEVEL% NEQ 0 (
    echo Verification failed! Worker cannot start.
    pause
    exit /b 1
)
goto :start_worker

:verified
echo Worker verified. Skipping verification tests.

:start_worker
echo.

REM ── Step 3: Run the worker ─────────────────────────────────
echo [Step 3/3] Starting worker service...
python run_worker.py --config config/worker_config.json

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo Worker exited with error code %ERRORLEVEL%
    pause
)
