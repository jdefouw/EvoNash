# EvoNash Worker - Windows Package

Welcome to the EvoNash Worker! This package contains everything you need to run the EvoNash worker on your Windows machine with GPU support.

## Quick Start

1. **Extract the zip file** to a folder of your choice (e.g., `C:\EvoNashWorker`)
2. **Run `install.bat`** to install all dependencies
3. **Edit `config\worker_config.json`** and set the `controller_url` to your Vercel app URL
4. **Test the worker** by running `start_worker.bat`
5. **(Optional)** Install as a Windows service using `install_service.bat`

## System Requirements

- **Windows 10/11** (64-bit)
- **Python 3.8 or higher** (will be checked during installation)
- **NVIDIA GPU** with CUDA support (RTX 3090 or similar recommended)
- **NVIDIA CUDA drivers** installed (check with `nvidia-smi` command)
- **Internet connection** to connect to the Vercel controller

## Installation

### Step 1: Install Dependencies

Double-click `install.bat` or run it from the command prompt. This script will:

- Check Python installation
- Upgrade pip
- Install PyTorch with CUDA 12.8 support
- Install all other required Python packages
- Verify CUDA is working

**Note:** The installation may take 10-15 minutes, especially for PyTorch with CUDA support.

### Step 2: Configure the Worker

Edit `config\worker_config.json`:

```json
{
  "controller_url": "https://your-app.vercel.app",
  "poll_interval_seconds": 30,
  "max_retries": 3,
  "retry_delay_seconds": 5,
  "device": "cuda",
  "log_level": "INFO",
  "log_file": "logs/worker.log"
}
```

**Important:** Update `controller_url` to match your Vercel deployment URL.

### Step 3: Test the Worker

Run `start_worker.bat` to test the worker in CLI mode. You should see:

```
Starting EvoNash Worker (CLI Mode)...
[INFO] Worker initialized
[INFO] Polling for jobs...
```

Press `Ctrl+C` to stop the worker.

## Running as a Windows Service

To run the worker automatically in the background:

1. **Run `install_service.bat`** (requires administrator privileges)
2. The service will be installed as "EvoNash Worker Service"
3. The service will start automatically on system boot

### Managing the Service

**Start the service:**
```cmd
nssm start EvoNashWorker
```

**Stop the service:**
```cmd
nssm stop EvoNashWorker
```

**Restart the service:**
```cmd
nssm restart EvoNashWorker
```

**View service status:**
```cmd
nssm status EvoNashWorker
```

**Uninstall the service:**
```cmd
nssm stop EvoNashWorker
nssm remove EvoNashWorker confirm
```

You can also manage the service through Windows Services Manager (`services.msc`).

## How It Works

1. **Polling:** The worker polls the controller every 30 seconds for pending experiments
2. **Job Assignment:** When a job is available, the controller assigns it to the worker
3. **Processing:** The worker runs the experiment on your local GPU:
   - Executes genetic algorithm with neural network evolution
   - Runs Petri Dish simulations
   - Processes multiple generations
4. **Incremental Upload:** After each generation, results are uploaded to the controller
5. **Completion:** When finished, the worker returns to polling for the next job

## Monitoring

### Logs

- **Worker logs:** `logs\worker.log` - Detailed operation logs
- **Service stdout:** `logs\service_stdout.log` - Service standard output
- **Service stderr:** `logs\service_stderr.log` - Service error output

### Web Dashboard

View experiment progress in real-time on the Vercel web dashboard.

## Troubleshooting

### GPU Not Detected / CUDA Not Available

**Symptoms:**
- Worker logs show "CUDA not available" or "Using CPU"
- Performance is very slow

**Solutions:**

1. **Verify NVIDIA drivers are installed:**
   ```cmd
   nvidia-smi
   ```
   This should show your GPU. If not, install/update NVIDIA drivers.

2. **Check PyTorch CUDA installation:**
   ```cmd
   python -c "import torch; print('CUDA available:', torch.cuda.is_available()); print('GPU:', torch.cuda.get_device_name(0) if torch.cuda.is_available() else 'N/A')"
   ```

3. **Reinstall PyTorch with CUDA:**
   ```cmd
   pip uninstall torch torchvision torchaudio -y
   pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu128
   ```

4. **Check CUDA version compatibility:**
   - PyTorch CUDA 12.8 works with CUDA 11.8+ drivers
   - For other versions, see: https://pytorch.org/get-started/locally/

### Connection Errors

**Symptoms:**
- Worker can't connect to controller
- "Connection refused" or "Timeout" errors

**Solutions:**

1. **Verify controller URL:**
   - Check `config\worker_config.json` has the correct `controller_url`
   - Test the URL in a browser to ensure it's accessible

2. **Check internet connection:**
   ```cmd
   ping your-app.vercel.app
   ```

3. **Check firewall:**
   - Ensure Windows Firewall allows Python to access the internet
   - Check if corporate firewall is blocking connections

### Service Won't Start

**Symptoms:**
- Service fails to start
- Service starts then immediately stops

**Solutions:**

1. **Check service logs:**
   - Review `logs\service_stderr.log` for errors
   - Review `logs\service_stdout.log` for output

2. **Verify Python path:**
   - Ensure Python is in the system PATH
   - Try running `python --version` from command prompt

3. **Check dependencies:**
   - Re-run `install.bat` to ensure all dependencies are installed
   - Verify `requirements.txt` packages are installed

4. **Run manually first:**
   - Test with `start_worker.bat` to identify issues
   - Fix any errors before installing as a service

### No Jobs Available

**Symptoms:**
- Worker logs show "No pending jobs" repeatedly

**This is normal!** The worker will continue polling. To get jobs:

1. Create an experiment in the web dashboard
2. Start the experiment
3. The worker will automatically pick it up

### Python Not Found

**Symptoms:**
- "Python is not installed or not in PATH" error

**Solutions:**

1. **Install Python:**
   - Download from https://www.python.org/downloads/
   - During installation, check "Add Python to PATH"

2. **Add Python to PATH manually:**
   - Find Python installation (usually `C:\Python3x` or `C:\Users\YourName\AppData\Local\Programs\Python\Python3x`)
   - Add to System PATH in Environment Variables

3. **Verify installation:**
   ```cmd
   python --version
   ```

### Permission Errors

**Symptoms:**
- "Access denied" errors
- Can't write to logs directory

**Solutions:**

1. **Run as Administrator:**
   - Right-click Command Prompt → "Run as administrator"
   - Navigate to worker directory and run commands

2. **Check folder permissions:**
   - Right-click worker folder → Properties → Security
   - Ensure your user has full control

### Out of Memory Errors

**Symptoms:**
- "CUDA out of memory" errors
- Worker crashes during processing

**Solutions:**

1. **Close other GPU applications:**
   - Close games, other ML workloads, etc.

2. **Reduce batch size:**
   - Edit `config\experiment_config.json` or `config\simulation_config.json`
   - Reduce population size or batch sizes

3. **Check GPU memory:**
   ```cmd
   nvidia-smi
   ```
   Monitor memory usage during processing

## Getting Help

If you encounter issues not covered here:

1. **Check the logs:**
   - `logs\worker.log` - Most detailed information
   - `logs\service_stderr.log` - Service errors

2. **Verify system requirements:**
   - Python version: `python --version`
   - GPU detection: `nvidia-smi`
   - CUDA in PyTorch: `python -c "import torch; print(torch.cuda.is_available())"`

3. **Test components individually:**
   - Test Python: `python --version`
   - Test PyTorch: `python -c "import torch; print(torch.__version__)"`
   - Test CUDA: `python -c "import torch; print(torch.cuda.is_available())"`

## File Structure

```
evonash-worker/
├── config/              # Configuration files
│   ├── worker_config.json
│   ├── experiment_config.json
│   └── simulation_config.json
├── src/                 # Python source code
│   ├── worker_service.py
│   ├── experiments/
│   ├── ga/
│   ├── simulation/
│   └── ...
├── logs/                # Log files (created automatically)
├── data/                # Data directory (created automatically)
├── run_worker.py        # Main entry point
├── requirements.txt     # Python dependencies
├── install.bat          # Dependency installer
├── install_service.bat  # Service installer
├── start_worker.bat     # Test runner
├── nssm.exe            # Service manager
└── README.md           # This file
```

## License

See LICENSE file in the main repository.

## Support

For issues, questions, or contributions, please refer to the main project repository.
