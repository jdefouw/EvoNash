# EvoNash Worker Service

The EvoNash Worker is a Python application that runs on your local Windows machine with GPU access. It continuously polls the Vercel-hosted Next.js controller for pending experiments, processes them on your local GPU (RTX 3090), and uploads results incrementally back to Vercel.

## Setup

### 1. Install PyTorch with CUDA Support

**IMPORTANT:** PyTorch must be installed with CUDA support separately. The default `pip install torch` installs a CPU-only version.

```bash
# Install PyTorch with CUDA 12.8 (compatible with CUDA 13.0 drivers)
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu128
```

For other CUDA versions, see: https://pytorch.org/get-started/locally/

**Verify CUDA is working:**
```bash
python -c "import torch; print('CUDA available:', torch.cuda.is_available()); print('GPU:', torch.cuda.get_device_name(0) if torch.cuda.is_available() else 'N/A')"
```

### 2. Install Other Dependencies

```bash
cd worker
pip install -r requirements.txt
```

### 3. Configure Worker

Edit `config/worker_config.json`:

```json
{
  "controller_url": "https://evo-nash-web.vercel.app",
  "poll_interval_seconds": 30,
  "max_retries": 3,
  "retry_delay_seconds": 5,
  "device": "cuda",
  "log_level": "INFO",
  "log_file": "logs/worker.log"
}
```

**Important:** Update `controller_url` to your actual Vercel deployment URL.

### 4. Test Run (CLI Mode)

Test the worker in CLI mode first. You can use either method:

**Option A: Using the batch script (Windows)**
```bash
start_worker.bat
```

**Option B: Direct Python command**
```bash
python run_worker.py --config config/worker_config.json
```

The worker will:
- Poll Vercel every 30 seconds for pending experiments
- Process jobs on your GPU
- Upload generation stats after each generation
- Continue polling for more jobs

Press Ctrl+C to stop.

## Running as Windows Service

### Option 1: Using NSSM (Recommended)

1. **Download NSSM:**
   - Download from: https://nssm.cc/download
   - Extract `nssm.exe` to a folder in your PATH, or place it in the `worker` directory

2. **Install Service:**
   ```bash
   install_service.bat
   ```

3. **Start Service:**
   ```bash
   nssm start EvoNashWorker
   ```

4. **Check Status:**
   ```bash
   nssm status EvoNashWorker
   ```

5. **View Logs:**
   - Console output: Check `logs/worker.log`
   - Service output: Check `logs/service_stdout.log` and `logs/service_stderr.log`

### Option 2: Manual NSSM Installation

```bash
# Install service
nssm install EvoNashWorker python "C:\path\to\worker\run_worker.py"

# Configure
nssm set EvoNashWorker AppDirectory "C:\path\to\worker"
nssm set EvoNashWorker Start SERVICE_AUTO_START

# Start
nssm start EvoNashWorker
```

### Managing the Service

**Start:**
```bash
nssm start EvoNashWorker
```

**Stop:**
```bash
nssm stop EvoNashWorker
```

**Restart:**
```bash
nssm restart EvoNashWorker
```

**Uninstall:**
```bash
nssm stop EvoNashWorker
nssm remove EvoNashWorker confirm
```

**View Status:**
```bash
nssm status EvoNashWorker
```

## How It Works

1. **Polling:** Worker polls `/api/queue` every 30 seconds
2. **Job Request:** If a PENDING experiment exists, Vercel returns job config
3. **Processing:** Worker runs experiment on local GPU:
   - 1,500 generations, 750 ticks each (configurable)
   - A **tick** is one simulation step (dt=0.016s): physics, neural network inference, collisions, and food respawning
   - 750 ticks ≈ 12 seconds of simulated agent lifetime per generation
   - Each generation: Petri Dish simulation + GA evolution
4. **Incremental Upload:** After each generation, stats are uploaded to `/api/results`
5. **Completion:** When all generations complete, experiment status changes to COMPLETED
6. **Continue:** Worker returns to polling for next job

## Monitoring

- **Logs:** Check `logs/worker.log` for detailed operation logs
- **Vercel Dashboard:** View experiment progress in real-time
- **Service Status:** Use `nssm status EvoNashWorker` or Windows Services manager

## Troubleshooting

**GPU not detected / CUDA not available:**
- **Most common issue:** PyTorch was installed without CUDA support (CPU-only version)
- **Solution:** Uninstall CPU-only PyTorch and install CUDA version:
  ```bash
  pip uninstall torch torchvision torchaudio -y
  pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu128
  ```
- Verify CUDA: `python -c "import torch; print('CUDA:', torch.cuda.is_available()); print('GPU:', torch.cuda.get_device_name(0) if torch.cuda.is_available() else 'N/A')"`
- Check NVIDIA drivers: `nvidia-smi` should show your GPU
- Worker will fall back to CPU with a warning if CUDA is not available

**Connection errors:**
- Verify `controller_url` in `worker_config.json` is correct
- Check internet connection
- Verify Vercel deployment is accessible

**Service won't start:**
- Check logs in `logs/service_stderr.log`
- Verify Python path in NSSM configuration
- Ensure all dependencies are installed

**No jobs available:**
- This is normal - worker will continue polling
- Create an experiment in the Vercel dashboard to queue a job
