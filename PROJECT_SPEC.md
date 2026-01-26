# Project Specification: EvoNash Experimental Platform

## 1. Executive Summary & Scientific Objective
**Title:** *Adaptive vs. Static Mutation: Quantifying Acceleration in Convergence to Nash Equilibrium in Genetic Neural Networks.*

**Objective:** To develop a distributed high-performance computing platform to experimentally test if dynamic mutation rates (scaled by fitness) accelerate the convergence of a Neural Network population to a Nash Equilibrium compared to traditional static mutation rates.

**Domain:** Evolutionary Computing, Game Theory, Big Data Analytics.
**Hardware Target:** NVIDIA RTX 3090 (CUDA Optimized).

---

## 2. The Scientific Experiment

### 2.1. The Hypothesis
**If** the mutation rate ($\epsilon$) of a neural network is inversely proportional to its parent's fitness (i.e., lower fitness parents produce highly mutated offspring, high fitness parents produce stable offspring), **then** the population will reach a policy entropy plateau (Nash Equilibrium) in fewer generations than a control group with a fixed mutation rate.

### 2.2. Variables
* **Independent Variable:** Mutation Strategy.
    * *Group A (Control):* Static $\epsilon = 0.05$.
    * *Group B (Experimental):* Adaptive $\epsilon = f(\text{Elo})$.
* **Dependent Variables:**
    * *Convergence Velocity:* $\Delta G$ (Generations) to reach $\Delta \text{Entropy} < 0.01$.
    * *Peak Fitness:* Max Elo Rating.
* **Constants:** Population Size ($N=1000$), Simulation Rules (Petri Dish), Selection Pressure (Top 20%), Neural Architecture (Input 24 -> Hidden 64 -> Output 4).

### 2.3. Mathematical Proofs Implemented
The code must calculate and log these metrics in real-time:
* **Elo Expectation ($E_A$):**
    $$E_A = \frac{1}{1 + 10^{(R_B - R_A) / 400}}$$
* **Policy Entropy ($H$):** Measures "Confusion" vs. "Certainty."
    $$H(\pi) = - \sum \pi(a|s) \log \pi(a|s)$$
* **Adaptive Mutation Function (Experimental Group):**
    $$\epsilon_{new} = \text{Base} \times (1 - \frac{\text{CurrentElo}}{\text{MaxGlobalElo}})$$

---

## 3. The Simulation Environment: "The Petri Dish"

To ensure validity, the environment is **deterministic** and **biological**, not a "video game."

* **Topology:** 2D Continuous Toroidal Space (Wrap-around borders).
* **Physics:** Frictionless Euler Integration.

### 3.1. Simulation Ticks
A **tick** is the fundamental unit of simulation time—one discrete step in the Petri Dish environment.

**What happens in one tick (dt = 0.016 seconds of simulated time):**
1. **Physics Update:** Agent positions and velocities are updated via Euler integration.
2. **Energy Decay:** Each agent loses 0.1 energy per tick (metabolism cost).
3. **Neural Network Inference:** Each agent's brain processes sensory inputs and outputs actions.
4. **Action Execution:** Thrust, turn, shoot, and split commands are applied.
5. **Collision Detection:** Food consumption and projectile hits are resolved.
6. **Projectile Lifecycle:** Projectiles move and expire after their lifetime.
7. **Food Respawning:** Consumed food respawns periodically.

**Default Configuration:** 750 ticks per generation ≈ 12 seconds of simulated agent lifetime.

At ~62.5 ticks per simulated second, agents have approximately 12 seconds to forage, evade predators, and accumulate fitness before the generation ends and selection occurs.

* **Entities:**
    * **Agents:** Circles with `Energy` (Health).
    * **Metabolism:** Constant energy decay (-0.1/tick). Movement costs energy.
    * **Food:** Static pellets (+10 Energy).
* **The Dilemma:** Agents can survive by:
    1.  *Foraging:* Passive collection (Low Risk).
    2.  *Predation:* Shooting mass at others to steal energy (High Risk).
* **Inputs (Feature Vector - Size 24):**
    * 8 Raycasts (Distance to Wall, Distance to Food, Distance to Enemy, Enemy Size).
    * Self State (Energy, Velocity, Cooldown).
* **Outputs (Action Vector - Size 4):**
    * Thrust (0-1), Turn (-1 to 1), Shoot (0-1), Split (0-1).

---

## 4. System Architecture

The system uses a **Controller-Worker** pattern to decouple visualization from the heavy CUDA compute.

### 4.1. The Controller (Web - Next.js)
* **Role:** Dashboard, Experiment Orchestrator, Database Viewer.
* **Stack:** Next.js, TypeScript, TailwindCSS, Recharts.
* **Database:** PostgreSQL + TimescaleDB (for handling million-row time-series data).
* **API Routes:**
    * `POST /api/jobs`: Worker requests a simulation config.
    * `POST /api/results`: Worker uploads "Generation Stats" (CSV/JSON blob).

### 4.2. The Worker (Compute - Python)
* **Role:** The "Lab Bench." Runs the biological simulation and GA loop.
* **Stack:** Python 3.9, PyTorch, NumPy.
* **Optimization:**
    * **BatchedNetworkEnsemble:** Stacks all 1,000 agent neural network weights into single tensors for true parallel inference using `torch.bmm` (batched matrix multiplication). This reduces GPU kernel launches from O(N) to O(1) per simulation tick.
    * **Analytical Raycasting:** Replaces step-based ray sampling with direct ray-circle intersection formulas, reducing raycast complexity from O(steps) to O(1) per ray.
    * **Vectorized Collision Detection:** Uses `torch.scatter_add` for food consumption, eliminating Python loops entirely.
    * **Pre-allocated Tensor Buffers:** Reuses GPU memory across ticks to eliminate allocation overhead.
    * **Headless:** No rendering during training. Rendering only generated for "Replay Files."
* **Workflow:**
    1.  Request Config (e.g., "Run Experiment Group B").
    2.  Init Population (Random Seed `42`).
    3.  Loop 1,500 Generations (750 ticks each).
    4.  Log metrics to CSV.
    5.  Upload results to Controller.

### 4.3. GPU Optimization & Scientific Validity

The CUDA optimizations achieve 10-50x speedup while **preserving complete scientific equivalence**. This is critical for experimental integrity.

#### Optimization Techniques

| Component | Before | After | Speedup | Scientific Impact |
|-----------|--------|-------|---------|-------------------|
| Neural Network Inference | Individual forward passes per agent | Single batched `torch.bmm` operation | 50-100x | **None** - Identical matrix multiplication |
| Raycasting | Step sampling (10px steps) | Analytical ray-circle intersection | 10-20x | **More accurate** - Exact geometric solution |
| Food Consumption | Python loop over collisions | Vectorized `scatter_add` | 5-10x | **None** - Identical energy accumulation |
| Tensor Allocation | Per-tick allocation | Pre-allocated buffers | 2-3x | **None** - Memory optimization only |

#### Mathematical Equivalence Proofs

1. **Batched Matrix Multiplication:** For neural network layer $y = Wx + b$:
   - Individual: $y_i = W_i x_i + b_i$ for each agent $i$
   - Batched: $Y = \text{bmm}(X, W^T) + B$ where $Y_{i,:} = y_i$
   - **Theorem:** These are mathematically identical by the definition of batched matrix multiplication.

2. **Analytical vs. Step-Based Raycasting:**
   - Step-based: Samples points along ray at fixed intervals, checks distance to circles
   - Analytical: Solves quadratic $|P + tD - C|^2 = R^2$ directly
   - **Theorem:** Analytical method produces the **exact** intersection distance, while step-based has error up to step_size. Analytical is strictly more accurate.

3. **Scatter Add for Collisions:**
   - Loop: `for food in collisions: energies[agent] += food.energy`
   - Scatter: `energies.scatter_add_(0, agent_indices, energy_values)`
   - **Theorem:** `scatter_add` is defined to produce identical results to sequential addition (order-independent for floating point with same values).

#### Verification Testing

The worker includes automated tests (`worker/tests/test_cuda_optimizations.py`) that verify:

```bash
cd worker
python tests/test_cuda_optimizations.py
```

These tests compare outputs from optimized vs. legacy implementations:
- **BatchedNetworkEnsemble:** Max difference < 1e-5 (floating point tolerance)
- **Analytical Raycast:** Results within step_size margin (more accurate)
- **Vectorized Food Consumption:** Exact match for energy updates and consumed food masks

**Result:** All optimizations produce scientifically equivalent results while achieving 10-50x performance improvement.

---

## 5. Development Roadmap (Cursor Prompting Strategy)

### Phase 1: The Lab Bench (Python Core)
1.  Implement `VectorEnv` class (The Petri Dish physics).
2.  Implement `Agent` class (PyTorch Neural Network).
3.  Create `ExperimentRunner` class that handles the `Seed` and `MutationMode` logic.

### Phase 2: The Data Pipeline (API)
1.  Design PostgreSQL Schema:
    * `Experiments` (id, type, status)
    * `Generations` (experiment_id, gen_number, avg_elo, entropy, timestamp)
2.  Build the Next.js API to accept these streams.

### Phase 3: The Dashboard (UI)
1.  Build "Comparative Graph" component (Group A vs Group B lines).
2.  Build "Replay Viewer" (HTML5 Canvas to render a saved match JSON).

---

## 6. Critical Implementation Rules (The "Platinum" Standard)
1.  **Strict Reproducibility:** The Random Seed must be configurable. If I run Seed 42 twice, I must get the *exact same* result down to the floating point.
2.  **No Magic Numbers:** All constants (gravity, friction, mutation rate) must be in a `config.json` file.
3.  **Statistical Logging:** Do not just log "Score." Log `Variance`, `Standard Deviation`, and `Min/Max` to allow for error bars in the final graphs.