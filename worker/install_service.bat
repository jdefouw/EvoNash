@echo off
REM Install EvoNash Worker as Windows Service using NSSM
REM NSSM (Non-Sucking Service Manager) must be installed first
REM Download from: https://nssm.cc/download

echo Installing EvoNash Worker as Windows Service...

REM Get the directory where this script is located
set SCRIPT_DIR=%~dp0
REM Try to find Python executable
where python >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    set PYTHON_EXE=python
) else (
    REM Try python3
    where python3 >nul 2>&1
    if %ERRORLEVEL% EQU 0 (
        set PYTHON_EXE=python3
    ) else (
        echo ERROR: Python not found in PATH
        echo Please ensure Python is installed and in your PATH
        pause
        exit /b 1
    )
)
set WORKER_SCRIPT=%SCRIPT_DIR%run_worker.py
set SERVICE_NAME=EvoNashWorker
set SERVICE_DISPLAY_NAME=EvoNash Worker Service
set SERVICE_DESCRIPTION=EvoNash GPU Worker - Processes genetic algorithm experiments

REM Check if NSSM is available
where nssm >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: NSSM is not installed or not in PATH
    echo Please download NSSM from https://nssm.cc/download
    echo Extract nssm.exe and add it to your PATH, or place it in this directory
    pause
    exit /b 1
)

REM Check if service already exists
nssm status %SERVICE_NAME% >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo Service %SERVICE_NAME% already exists. Removing old service...
    nssm stop %SERVICE_NAME%
    nssm remove %SERVICE_NAME% confirm
)

REM Install the service
echo Installing service...
nssm install %SERVICE_NAME% "%PYTHON_EXE%" "%WORKER_SCRIPT%"

REM Configure service
echo Configuring service...
nssm set %SERVICE_NAME% DisplayName "%SERVICE_DISPLAY_NAME%"
nssm set %SERVICE_NAME% Description "%SERVICE_DESCRIPTION%"
nssm set %SERVICE_NAME% Start SERVICE_AUTO_START
nssm set %SERVICE_NAME% AppDirectory "%SCRIPT_DIR%"
nssm set %SERVICE_NAME% AppStdout "%SCRIPT_DIR%logs\service_stdout.log"
nssm set %SERVICE_NAME% AppStderr "%SCRIPT_DIR%logs\service_stderr.log"

REM Set service to restart on failure
nssm set %SERVICE_NAME% AppRestartDelay 5000
nssm set %SERVICE_NAME% AppExit Default Restart

echo.
echo Service installed successfully!
echo.
echo To start the service, run:
echo   nssm start %SERVICE_NAME%
echo.
echo Or use Windows Services manager (services.msc)
echo.
echo To uninstall the service, run:
echo   nssm stop %SERVICE_NAME%
echo   nssm remove %SERVICE_NAME% confirm
echo.
pause
