@echo off
REM Simple batch script to start the worker in CLI mode for testing
REM This is useful for testing before installing as a service

echo Starting EvoNash Worker (CLI Mode)...
echo.

cd /d %~dp0

REM Check if Python is available
where python >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Python not found in PATH
    echo Please ensure Python is installed and in your PATH
    pause
    exit /b 1
    exit /b 1
)

echo Checking for existing verification...
python check_verification.py
if %ERRORLEVEL% NEQ 0 (
    echo Verification not found or check failed. Running verification suite...
    call run_verification.bat
    if %ERRORLEVEL% NEQ 0 (
        echo Verification failed! Worker cannot start.
        pause
        exit /b 1
    )
) else (
    echo Worker verified. Skipping verification tests.
)

REM Run the worker
python run_worker.py --config config/worker_config.json

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo Worker exited with error code %ERRORLEVEL%
    pause
)
