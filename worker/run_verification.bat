
@echo off
pushd "%~dp0"
echo ===================================================
echo EvoNash Scientific Verification Suite
echo ===================================================

echo.
echo [1/2] Running CUDA Optimization Verification Tests...
python tests/test_cuda_optimizations.py
IF %ERRORLEVEL% NEQ 0 (
    echo [FAIL] Verification Tests Failed!
    exit /b 1
)
echo [PASS] All tests passed and results uploaded.

echo.
echo [2/2] Running Entropy Threshold Calibration (50 generations)...
python calibrate_threshold.py --generations 50 --gpu 0
IF %ERRORLEVEL% NEQ 0 (
    echo [FAIL] Calibration Failed!
    exit /b 1
)
echo [DONE] Calibration complete and results uploaded.

echo.
echo ===================================================
echo VERIFICATION COMPLETE
echo ===================================================
echo Check database 'system_verification' and 'calibration_logs' tables.
pause
