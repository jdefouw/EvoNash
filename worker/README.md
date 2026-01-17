# EvoNash Python Worker

The Python worker executes genetic algorithm experiments on the RTX 3090 GPU.

## Setup

1. Install dependencies:
```bash
pip install -r requirements.txt
```

2. Configure environment variables (copy `.env.example` to `.env`):
```bash
API_URL=http://localhost:3000
POLL_INTERVAL=5
```

3. Run the worker:
```bash
python src/main.py
```

## Features

- Polls Next.js API for experiment jobs
- Supports STATIC and ADAPTIVE mutation modes
- Logs generation statistics to CSV files
- Reports results back to the API
- CUDA acceleration for neural network operations

## Experiment Configuration

Experiments are configured via `config/experiment_config.json` or received from the API.

## CSV Output

CSV files are saved to the `data/` directory:
- `control_data.csv` - Control group experiments
- `experimental_data.csv` - Experimental group experiments
