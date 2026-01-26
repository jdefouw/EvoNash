# EvoNash

**Adaptive vs. Static Mutation: Accelerating Convergence to Nash Equilibrium in Genetic Neural Networks**

A distributed computing platform for experimentally testing whether dynamic (fitness-scaled) mutation rates accelerate the convergence of neural network populations to Nash Equilibrium compared to traditional static mutation rates.

---

## Overview

EvoNash is a scientific experiment platform that evolves populations of neural networks in a simulated biological environment ("The Petri Dish"). The platform tests the hypothesis that **adaptive mutation**—where mutation magnitude is inversely proportional to fitness—outperforms static mutation rates.

### The Experiment

The experiment uses a **controlled comparative design** with two groups:

| Experiment Group | Mutation Strategy | Description |
|------------------|-------------------|-------------|
| **Control** | Static Mutation | Fixed mutation rate ε = 0.05 applied uniformly to all offspring |
| **Experimental** | Adaptive Mutation | Dynamic rate ε = Base × (1 - CurrentElo/MaxElo) where low-fitness parents produce highly mutated offspring |

> **Important:** Selecting an Experiment Group automatically determines the mutation strategy. Control = Static, Experimental = Adaptive. This enforces proper experimental methodology and prevents misconfiguration.

### Key Metrics

- **Convergence Velocity**: Generations required to reach stable Policy Entropy (Nash Equilibrium)
- **Peak Performance**: Maximum Elo rating achieved
- **Policy Entropy**: Measures decision randomness vs. certainty

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     EvoNash Platform                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────┐         ┌─────────────────┐               │
│  │   Web Dashboard │◄───────►│    Supabase     │               │
│  │   (Next.js)     │         │   (PostgreSQL)  │               │
│  │   - Vercel      │         │   - Experiments │               │
│  │   - Real-time   │         │   - Generations │               │
│  │   - Analytics   │         │   - Telemetry   │               │
│  └────────┬────────┘         └─────────────────┘               │
│           │                                                     │
│           │ HTTP API                                            │
│           ▼                                                     │
│  ┌─────────────────┐                                           │
│  │   GPU Worker    │                                           │
│  │   (Python)      │                                           │
│  │   - PyTorch     │                                           │
│  │   - CUDA        │                                           │
│  │   - RTX 3090    │                                           │
│  └─────────────────┘                                           │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Components

1. **Web Dashboard** (`/web`): Next.js application for experiment management, real-time monitoring, and data visualization
2. **GPU Worker** (`/worker`): Python application that runs simulations on NVIDIA GPUs
3. **Database**: Supabase (PostgreSQL) for experiment data and telemetry

---

## Quick Start

### Prerequisites

- Node.js 18+ (for web dashboard)
- Python 3.8+ (for worker)
- NVIDIA GPU with CUDA support (RTX 3090 recommended)
- Supabase account (free tier works)

### 1. Set Up the Database

```bash
# Create a Supabase project and run the schema
cd web/lib/supabase
# Copy schema.sql contents to Supabase SQL Editor and execute
```

### 2. Deploy the Web Dashboard

```bash
cd web
npm install
cp .env.example .env.local
# Edit .env.local with your Supabase credentials
npm run dev
```

### 3. Run the Worker

```bash
cd worker
pip install -r requirements.txt
# Edit config/worker_config.json with controller URL
python run_worker.py
```

---

## Creating Experiments

### Via Web Dashboard

1. Navigate to **Experiments** → **New Experiment**
2. Enter an experiment name (e.g., "Control Run - Seed 42")
3. Select **Experiment Group**:
   - **Control (Static Mutation)**: Uses fixed mutation rate ε = 0.05
   - **Experimental (Adaptive Mutation)**: Uses fitness-scaled mutation
4. Configure parameters (seed, population size, generations)
5. Click **Create Experiment**
6. Click **Start** to begin processing

### Experiment Groups Explained

The **Experiment Group** is the only setting you need to choose for the mutation strategy:

#### Control Group (Static Mutation)
- All offspring receive the same mutation rate (default ε = 0.05)
- Traditional genetic algorithm approach
- Serves as the baseline for comparison

#### Experimental Group (Adaptive Mutation)
- Mutation rate scales inversely with parent fitness
- Formula: `ε = Base × (1 - CurrentElo/MaxElo)`
- Low-performing agents mutate more (exploration)
- High-performing agents mutate less (exploitation)
- Mimics biological stress-induced mutagenesis

---

## Statistical Significance

To achieve statistically significant results, run multiple experiments:

| Power Level | Experiments per Group | Generations | Reliability |
|-------------|----------------------|-------------|-------------|
| Minimum | 1+ | 500+ | Basic analysis possible |
| Recommended | 2+ | 1,000+ | Demonstrates reproducibility |
| **Robust** | **5+** | **2,000+** | Publication-quality results |

**Best Practice**: Run 5 Control experiments and 5 Experimental experiments, each with a different random seed (e.g., 42, 43, 44, 45, 46) but identical other parameters.

---

## Project Structure

```
EvoNash/
├── web/                          # Next.js web dashboard
│   ├── app/                      # App router pages
│   │   ├── api/                  # API routes
│   │   └── experiments/          # Experiment pages
│   ├── components/               # React components
│   │   └── dashboard/            # Dashboard components
│   ├── lib/supabase/             # Database schema & client
│   └── types/                    # TypeScript types
├── worker/                       # Python GPU worker
│   ├── config/                   # Configuration files
│   ├── src/                      # Source code
│   │   ├── experiments/          # Experiment management
│   │   ├── ga/                   # Genetic algorithm
│   │   ├── simulation/           # Petri dish simulation
│   │   └── analysis/             # Statistical analysis
│   └── tests/                    # Verification tests
├── shared/                       # Shared configuration
│   ├── experiment_config.json    # Example config
│   └── protocol.json             # API protocol schema
├── PROJECT_SPEC.md               # Technical specification
├── CWSF_REPORT.md               # Science fair report
└── README.md                     # This file
```

---

## GPU Optimizations

The worker includes CUDA optimizations for 10-50x faster processing:

| Optimization | Speedup | Description |
|-------------|---------|-------------|
| BatchedNetworkEnsemble | 50-100x | Batched matrix multiplication for all agents |
| Analytical Raycasting | 10-20x | Direct ray-circle intersection formulas |
| Vectorized Collisions | 5-10x | `torch.scatter_add` for parallel processing |
| Pre-allocated Buffers | 2-3x | Memory reuse across simulation ticks |

All optimizations are verified to produce scientifically equivalent results:

```bash
cd worker
python tests/test_cuda_optimizations.py
```

---

## Configuration Reference

### Experiment Configuration

| Parameter | Default | Description |
|-----------|---------|-------------|
| `experiment_group` | CONTROL | **Control** (Static) or **Experimental** (Adaptive) |
| `random_seed` | 42 | RNG seed for reproducibility |
| `population_size` | 1000 | Number of agents per generation |
| `max_generations` | 1500 | Total evolutionary cycles |
| `ticks_per_generation` | 750 | Simulation steps per generation (~12s simulated) |
| `mutation_rate` | 0.05 | Static mutation rate (Control only) |
| `mutation_base` | 0.1 | Base rate for adaptive scaling (Experimental only) |
| `selection_pressure` | 0.2 | Top percentage selected (20%) |

---

## The Petri Dish Simulation

The simulation environment is a deterministic biological sandbox:

- **Topology**: 2D continuous toroidal space (wrap-around borders)
- **Physics**: Frictionless Euler integration
- **Entities**: Agents (neural networks) and food pellets
- **Mechanics**: Energy decay, foraging, predation (shooting)

### Agent Neural Network

- **Inputs** (24): 8 raycasts × 3 values + self-state
- **Hidden**: 64 neurons (configurable)
- **Outputs** (4): Thrust, Turn, Shoot, Split

---

## License

MIT License - see [LICENSE](LICENSE)

---

## References

1. Sutton, R. S., & Barto, A. G. (2018). *Reinforcement Learning: An Introduction*. MIT Press.
2. Nash, J. (1950). *Equilibrium points in n-person games*. PNAS.
3. Dawkins, R. (1976). *The Selfish Gene*. Oxford University Press.
