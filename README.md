# EvoNash

**Adaptive vs. Static Mutation: Accelerating Convergence to Nash Equilibrium in Genetic Neural Networks**

A distributed computing platform for experimentally testing whether dynamic (fitness-scaled) mutation rates accelerate the convergence of neural network populations to Nash Equilibrium compared to traditional static mutation rates.

🔗 **Live Dashboard:** [sf.defouw.ca](https://sf.defouw.ca)

---

## Overview

EvoNash is a science fair experiment platform that evolves populations of 1,000 neural-network-controlled organisms in a simulated biological environment ("The Petri Dish"). The platform tests the hypothesis that **adaptive mutation**—where mutation magnitude is inversely proportional to fitness—helps a population reach a stable outcome (Nash equilibrium) faster than a control group that always uses the same fixed mutation rate.

### The Hypothesis

**If** the mutation rate (ε) of a neural network is inversely proportional to its parent's fitness (low-fitness parents produce highly mutated offspring; high-fitness parents produce stable offspring), **then** the population will converge to Nash Equilibrium in fewer generations than a control group with a fixed mutation rate.

### The Experiment

The experiment uses a **controlled comparative design** with two groups:

| Group | Mutation Strategy | Description |
|-------|-------------------|-------------|
| **Control** | Static Mutation | Fixed mutation rate ε = 0.05 applied uniformly to all offspring |
| **Experimental** | Adaptive Mutation | Dynamic rate ε = Base × (1 − CurrentElo / MaxElo) — low-fitness parents produce highly mutated offspring |

> **Note:** Selecting an Experiment Group automatically determines the mutation strategy. Control = Static, Experimental = Adaptive. This enforces proper experimental methodology.

### Key Metrics

- **Convergence Velocity** (primary): Generation number when Nash Equilibrium is reached — detected when entropy variance stays below threshold (0.01) for 20 consecutive generations
- **Peak Fitness** (secondary): Maximum fitness score achieved (Ticks Survived + Remaining Energy)
- **Policy Entropy**: Measures decision randomness vs. certainty across the population

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     EvoNash Platform                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────┐         ┌─────────────────┐               │
│  │   Web Dashboard │◄───────►│   PostgreSQL    │               │
│  │   (Next.js 14)  │         │   Database      │               │
│  │   - nginx       │         │   - Experiments │               │
│  │   - PM2         │         │   - Generations │               │
│  │   - Real-time   │         │   - Workers     │               │
│  │   - Statistics  │         │   - Telemetry   │               │
│  └────────┬────────┘         └─────────────────┘               │
│           │                                                     │
│           │ HTTP API                                            │
│           ▼                                                     │
│  ┌─────────────────┐                                           │
│  │   GPU Workers   │  (distributed — multiple machines)        │
│  │   (Python)      │                                           │
│  │   - PyTorch     │                                           │
│  │   - CUDA        │                                           │
│  │   - RTX 3090    │                                           │
│  └─────────────────┘                                           │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Components

1. **Web Dashboard** (`/web`): Next.js 14 application with TailwindCSS and Recharts for experiment management, real-time monitoring, statistical analysis, and data visualization. Features include:
   - Live experiment monitoring with generation-by-generation charts
   - Automated statistical analysis (t-tests, effect sizes, power analysis)
   - Dynamic conclusions and box-plot comparisons
   - Detailed experiment overview with inline academic citations
   - Worker management and verification testing
   - Deployed on Debian server with nginx reverse proxy and PM2 process manager

2. **GPU Worker** (`/worker`): Python application that runs simulations on NVIDIA GPUs using PyTorch with CUDA. Supports distributed computing — multiple workers can connect to a single dashboard.

3. **Database**: PostgreSQL 16 for experiment data, generation metrics, worker tracking, and telemetry (direct connection via `pg` library).

---

## Quick Start

### Prerequisites

- Node.js 20+ (web dashboard)
- Python 3.8+ (worker)
- NVIDIA GPU with CUDA support (RTX 3090 recommended)
- PostgreSQL 16

### 1. Clone the Repository

```bash
git clone https://github.com/jdefouw/EvoNash.git
cd EvoNash
```

### 2. Set Up the Database

```bash
# Install PostgreSQL and create database
sudo -u postgres psql
CREATE USER evonash WITH PASSWORD 'your_password';
CREATE DATABASE evonash OWNER evonash;

# Apply schema
psql -U evonash -d evonash -f web/lib/sql/schema_standalone.sql
```

### 3. Deploy the Web Dashboard

For detailed deployment instructions, see [DEBIAN_SETUP.md](DEBIAN_SETUP.md).

```bash
cd web
npm install
cp .env.example .env
# Edit .env with your PostgreSQL connection string
npm run build
npm start
```

### 4. Run the Worker

```bash
cd worker

# Install PyTorch with CUDA (see https://pytorch.org for your CUDA version)
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu128

pip install -r requirements.txt

# Edit config/worker_config.json — set controller_url to your dashboard URL
python run_worker.py
```

---

## The Simulation: "The Petri Dish"

The simulation environment is a deterministic biological sandbox:

- **Topology**: 2D continuous toroidal space (wrap-around borders — no walls or corners)
- **Physics**: Frictionless Euler integration (dt = 0.016s per tick)
- **Entities**: 1,000 neural-network-controlled agents and food pellets
- **Mechanics**: Energy decay (metabolism), foraging (eating food), and predation (shooting projectiles to steal energy)
- **Duration**: 750 ticks per generation ≈ 12 seconds of simulated agent lifetime

### Agent Neural Network (24-64-4)

| Layer | Size | Description |
|-------|------|-------------|
| **Input** | 24 | 8 raycasts × 3 values (Food distance, Enemy distance, Boundary wrap distance) |
| **Hidden** | 64 | Single hidden layer with ReLU activation |
| **Output** | 4 | Thrust (0–1), Turn (−1 to +1), Shoot (0–1), Split (0–1) |

### Fitness Score

```
Fitness = Ticks Survived + Remaining Energy
```

An organism that survives all 750 ticks and ends with 150 energy scores 900. This score drives selection (top 20% reproduce), adaptive mutation scaling, and statistical analysis.

---

## Creating Experiments

### Via Web Dashboard

1. Navigate to **Experiments** → **New Experiment**
2. Enter an experiment name (e.g., "Control Run — Seed 42")
3. Select **Experiment Group**:
   - **Control (Static Mutation)**: Uses fixed mutation rate ε = 0.05
   - **Experimental (Adaptive Mutation)**: Uses fitness-scaled mutation
4. Configure parameters (seed, population size, generations)
5. Click **Create Experiment**
6. Click **Start** to begin processing

### Paired Seed Design

Control and Experimental experiments share the same random seed so both groups start with identical initial conditions (same random brains, same world layout). The **only** difference is the mutation strategy, ensuring a fair comparison. Run multiple seeds (e.g., 42, 43, 44, 45, 46) for statistical power.

---

## Statistical Analysis

The dashboard automatically computes:

- **Welch's t-test** comparing convergence generations between groups
- **Cohen's d** effect size
- **Statistical power analysis** for sample size planning
- **Box-plot visualization** of convergence distributions

### Recommended Sample Sizes

| Power Level | Experiments per Group | Generations | Reliability |
|-------------|----------------------|-------------|-------------|
| Minimum | 1+ | 500+ | Basic analysis possible |
| Recommended | 2+ | 1,000+ | Demonstrates reproducibility |
| **Robust** | **5+** | **2,000+** | Publication-quality results |

---

## Nash Equilibrium Detection

Nash equilibrium is detected using **entropy variance** across the population (not mean policy entropy). For each generation, a scalar policy entropy is computed per agent, and the variance of those per-agent entropies across the population is tracked.

**Convergence criterion**: Entropy variance falls below 0.01 and remains below it for 20 consecutive generations, with a post-convergence buffer of 30 additional generations to confirm stability.

---

## GPU Optimizations

The worker includes CUDA optimizations for 10–50× faster processing, all verified to produce scientifically equivalent results:

| Optimization | Speedup | Description |
|-------------|---------|-------------|
| BatchedNetworkEnsemble | 50–100× | Batched `torch.bmm` for all 1,000 agent networks in parallel |
| Analytical Raycasting | 10–20× | Direct ray-circle intersection formulas (more accurate than step-based) |
| Vectorized Collisions | 5–10× | `torch.scatter_add` for parallel food consumption |
| Pre-allocated Buffers | 2–3× | GPU memory reuse across simulation ticks |

Verify optimizations:

```bash
cd worker
python tests/test_cuda_optimizations.py
```

---

## Project Structure

```
EvoNash/
├── web/                          # Next.js 14 web dashboard
│   ├── app/                      # App router pages
│   │   ├── api/                  # API routes (queue, results, workers, dashboard)
│   │   ├── experiments/          # Experiment management pages
│   │   └── overview/             # Detailed experiment overview
│   ├── components/               # React components
│   │   └── dashboard/            # Dashboard components (charts, statistics, references)
│   ├── lib/sql/                  # Database schema & migrations
│   └── types/                    # TypeScript types
├── worker/                       # Python GPU worker
│   ├── config/                   # Configuration files
│   ├── src/                      # Source code
│   │   ├── experiments/          # Experiment runner (optimized)
│   │   ├── ga/                   # Genetic algorithm & selection
│   │   ├── simulation/           # Petri dish simulation (CUDA)
│   │   └── analysis/             # Statistical analysis
│   └── tests/                    # Verification tests
├── shared/                       # Shared configuration
├── PROJECT_SPEC.md               # Full technical specification
├── DEBIAN_SETUP.md               # Server deployment guide
└── README.md                     # This file
```

---

## Configuration Reference

### Experiment Configuration (`worker/config/experiment_config.json`)

| Parameter | Default | Description |
|-----------|---------|-------------|
| `experiment_group` | CONTROL | **Control** (Static) or **Experimental** (Adaptive) |
| `random_seed` | 42 | RNG seed for reproducibility |
| `population_size` | 1000 | Number of agents per generation |
| `max_generations` | 1500 | Total evolutionary cycles |
| `ticks_per_generation` | 750 | Simulation steps per generation (~12s simulated) |
| `mutation_rate` | 0.05 | Static mutation rate (Control only) |
| `mutation_base` | 0.0615 | Base rate for adaptive scaling (chosen so adaptive ≈ static at initial Elo) |
| `selection_pressure` | 0.2 | Top percentage selected (20%) |

### Worker Configuration (`worker/config/worker_config.json`)

| Parameter | Description |
|-----------|-------------|
| `controller_url` | URL of the web dashboard (e.g., `https://sf.defouw.ca`) |
| `device` | Compute device — `cuda` for GPU, `cpu` for CPU-only |
| `worker_name` | Human-readable name for this worker |
| `poll_interval_seconds` | How often to check for new jobs (default: 30) |

---

## License

MIT License — see [LICENSE](LICENSE)

---

## References

1. Nash, J. (1950). *Equilibrium points in n-person games*. PNAS.
2. Nash, J. (1951). *Non-cooperative games*. Annals of Mathematics.
3. von Neumann, J. & Morgenstern, O. (1944). *Theory of Games and Economic Behavior*. Princeton University Press.
4. Maynard Smith, J. (1982). *Evolution and the Theory of Games*. Cambridge University Press.
5. Dawkins, R. (1976). *The Selfish Gene*. Oxford University Press.
6. Goodfellow, I., Bengio, Y. & Courville, A. (2016). *Deep Learning*. MIT Press.
7. Sutton, R. S. & Barto, A. G. (2018). *Reinforcement Learning: An Introduction*. MIT Press.
8. Holland, J. H. (1975). *Adaptation in Natural and Artificial Systems*. University of Michigan Press.
9. Eiben, A. E. & Smith, J. E. (2015). *Introduction to Evolutionary Computing*. Springer.
