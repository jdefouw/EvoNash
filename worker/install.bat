@echo off
REM EvoNash Worker Installation Script
REM This script installs all required dependencies for the EvoNash worker

echo ========================================
echo EvoNash Worker - Dependency Installer
echo ========================================
echo.

REM Get the directory where this script is located
set SCRIPT_DIR=%~dp0
cd /d %SCRIPT_DIR%

REM Check if Python is installed
echo [1/5] Checking Python installation...
where python >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo ERROR: Python is not installed or not in PATH
    echo.
    echo Please install Python 3.8 or higher from https://www.python.org/downloads/
    echo Make sure to check "Add Python to PATH" during installation.
    echo.
    pause
    exit /b 1
)

python --version
echo ✓ Python found
echo.

REM Check Python version (should be 3.8+)
for /f "tokens=2" %%i in ('python --version 2^>^&1') do set PYTHON_VERSION=%%i
for /f "tokens=1 delims=." %%i in ("%PYTHON_VERSION%") do set MAJOR=%%i
for /f "tokens=2 delims=." %%i in ("%PYTHON_VERSION%") do set MINOR=%%i

if %MAJOR% LSS 3 (
    echo ERROR: Python 3.8 or higher is required. Found: %PYTHON_VERSION%
    pause
    exit /b 1
)
if %MAJOR% EQU 3 if %MINOR% LSS 8 (
    echo ERROR: Python 3.8 or higher is required. Found: %PYTHON_VERSION%
    pause
    exit /b 1
)

echo [2/5] Upgrading pip...
python -m pip install --upgrade pip
if %ERRORLEVEL% NEQ 0 (
    echo WARNING: Failed to upgrade pip, continuing anyway...
)
echo.

echo [3/5] Installing PyTorch with CUDA support...
echo IMPORTANT: This will install PyTorch with CUDA 12.8 support.
echo If you need a different CUDA version, see: https://pytorch.org/get-started/locally/
echo.
python -m pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu128
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo ERROR: Failed to install PyTorch with CUDA support
    echo.
    echo If you don't have a CUDA-compatible GPU, you can install CPU-only PyTorch:
    echo   python -m pip install torch torchvision torchaudio
    echo.
    echo However, the worker will run much slower on CPU.
    echo.
    pause
    exit /b 1
)
echo ✓ PyTorch installed
echo.

echo [4/5] Installing other dependencies...
python -m pip install -r requirements.txt
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo ERROR: Failed to install dependencies from requirements.txt
    echo.
    pause
    exit /b 1
)
echo ✓ Dependencies installed
echo.

echo [5/5] Verifying CUDA installation...
python -c "import torch; print('CUDA available:', torch.cuda.is_available()); print('GPU:', torch.cuda.get_device_name(0) if torch.cuda.is_available() else 'N/A')"
if %ERRORLEVEL% NEQ 0 (
    echo WARNING: Could not verify CUDA installation
) else (
    echo ✓ CUDA verification complete
)
echo.

echo ========================================
echo Installation Complete!
echo ========================================
echo.
echo Next steps:
echo 1. Edit config\worker_config.json and set the controller_url
echo 2. Test the worker by running: start_worker.bat
echo 3. (Optional) Install as Windows service: install_service.bat
echo.
echo For troubleshooting, see README.md
echo.
pause
