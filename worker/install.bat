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
echo [1/6] Checking Python installation...
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
echo OK: Python found
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

echo [2/6] Upgrading pip...
python -m pip install --upgrade pip
if %ERRORLEVEL% NEQ 0 (
    echo WARNING: Failed to upgrade pip, continuing anyway...
)
echo.

REM Uninstall existing PyTorch to avoid conflicts
echo [3/6] Removing any existing PyTorch installation...
python -m pip uninstall torch torchvision torchaudio -y >nul 2>&1
echo OK: Cleared existing PyTorch
echo.

echo [4/6] Installing PyTorch with CUDA support...
echo.
echo Available CUDA versions:
echo   1. CUDA 12.8 (Latest - requires NVIDIA driver 570+)
echo   2. CUDA 12.4 (Stable - requires NVIDIA driver 550+)
echo   3. CUDA 12.1 (Older - requires NVIDIA driver 530+)
echo   4. CUDA 11.8 (Legacy - requires NVIDIA driver 520+)
echo   5. CPU only (No GPU acceleration)
echo.
echo To check your NVIDIA driver version, run: nvidia-smi
echo.

set /p CUDA_CHOICE="Select CUDA version [1-5, default=2]: "
if "%CUDA_CHOICE%"=="" set CUDA_CHOICE=2

if "%CUDA_CHOICE%"=="1" (
    echo Installing PyTorch with CUDA 12.8...
    python -m pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu128
) else if "%CUDA_CHOICE%"=="2" (
    echo Installing PyTorch with CUDA 12.4...
    python -m pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu124
) else if "%CUDA_CHOICE%"=="3" (
    echo Installing PyTorch with CUDA 12.1...
    python -m pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu121
) else if "%CUDA_CHOICE%"=="4" (
    echo Installing PyTorch with CUDA 11.8...
    python -m pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu118
) else if "%CUDA_CHOICE%"=="5" (
    echo Installing PyTorch CPU-only version...
    python -m pip install torch torchvision torchaudio
) else (
    echo Invalid choice. Installing default (CUDA 12.4)...
    python -m pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu124
)

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo ERROR: Failed to install PyTorch
    echo.
    echo Try running as Administrator or check your internet connection.
    echo.
    pause
    exit /b 1
)
echo OK: PyTorch installed
echo.

echo [5/6] Installing other dependencies...
python -m pip install -r requirements.txt
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo ERROR: Failed to install dependencies from requirements.txt
    echo.
    pause
    exit /b 1
)
echo OK: Dependencies installed
echo.

echo [6/6] Verifying installation...
echo.
echo ----------------------------------------
echo PyTorch and CUDA Diagnostics:
echo ----------------------------------------
python -c "import torch; print(f'PyTorch version: {torch.__version__}'); print(f'CUDA built with: {torch.version.cuda if torch.version.cuda else \"None (CPU build)\"}'); print(f'CUDA available: {torch.cuda.is_available()}'); print(f'Device count: {torch.cuda.device_count() if torch.cuda.is_available() else 0}'); print(f'GPU: {torch.cuda.get_device_name(0) if torch.cuda.is_available() else \"N/A\"}'); print(f'VRAM: {torch.cuda.get_device_properties(0).total_memory // (1024**3)} GB' if torch.cuda.is_available() else '')"
echo ----------------------------------------
echo.

REM Check if CUDA is working
python -c "import torch; exit(0 if torch.cuda.is_available() else 1)" 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo ========================================
    echo WARNING: CUDA is NOT available!
    echo ========================================
    echo.
    echo Possible causes:
    echo   1. No NVIDIA GPU installed
    echo   2. NVIDIA driver not installed or outdated
    echo   3. Wrong CUDA version selected for your driver
    echo   4. PyTorch installed without CUDA support
    echo.
    echo To check your GPU and driver:
    echo   nvidia-smi
    echo.
    echo The worker will run on CPU, which is much slower.
    echo To fix this, run install.bat again and select the correct CUDA version.
    echo.
) else (
    echo OK: CUDA is available and working!
    echo.
)

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
