# EvoNash: A Complete Study Guide

**Science, Math, and AI — Everything Behind the Experiment**

> This guide explains every scientific principle used in the EvoNash project, how the math works, and where each concept lives in the actual code. It is written for a grade 12 student. No prior knowledge of AI, game theory, or advanced statistics is assumed.

---

## Table of Contents

1. [What Is EvoNash?](#1-what-is-evonash)
2. [Game Theory & Nash Equilibrium](#2-game-theory--nash-equilibrium)
3. [Neural Networks (The Agent's Brain)](#3-neural-networks-the-agents-brain)
4. [The Genetic Algorithm (Artificial Evolution)](#4-the-genetic-algorithm-artificial-evolution)
5. [The Hypothesis & Experimental Design](#5-the-hypothesis--experimental-design)
6. [Statistical Analysis](#6-statistical-analysis)
7. [Math Reference Sheet](#7-math-reference-sheet)
8. [Glossary](#8-glossary)

---

## 1. What Is EvoNash?

EvoNash is a scientific computing platform that tests whether **smart mutation rates** can help a population of AI agents converge to a **Nash Equilibrium** faster than **fixed mutation rates**.

Here is the big picture:

1. **1,000 AI agents** live in a virtual "Petri Dish" (a 2D world).
2. Each agent has a **neural network brain** that decides what to do.
3. Agents that perform well get to **reproduce** (genetic algorithm).
4. Over many **generations**, the population evolves better strategies.
5. Eventually, all agents converge on the **same optimal strategy** — this is Nash Equilibrium.
6. The experiment measures **how many generations** it takes to get there.

The question: **Does making mutation rates adaptive (high for bad agents, low for good agents) speed this up?**

### Where It Lives in the Code

| Concept | File | Purpose |
|---------|------|---------|
| Agent brain | `worker/src/simulation/agent.py` | Neural network that controls each agent |
| Evolution | `worker/src/ga/genetic_algorithm.py` | Selection, crossover, and mutation |
| Physics world | `worker/config/simulation_config.json` | Petri Dish rules (toroidal space, energy, food) |
| Statistics | `worker/src/analysis/statistical_analysis.py` | Hypothesis tests and effect sizes |
| Hypothesis | `PROJECT_SPEC.md` | Full scientific specification |

---

## 2. Game Theory & Nash Equilibrium

### 2.1 What Is Game Theory?

**Game theory** is the mathematical study of strategic decision-making. It was pioneered by **John von Neumann** and **John Nash** (the mathematician from *A Beautiful Mind*). It asks: *When multiple agents interact and each one's outcome depends on what the others do, what's the best strategy?*

**Key idea:** Your best move depends on what everyone else is doing.

### 2.2 The Prisoner's Dilemma (A Classic Example)

Imagine two suspects are arrested. Each can either **cooperate** (stay silent) or **defect** (betray the other):

|  | **B Cooperates** | **B Defects** |
|--|-----------------|--------------|
| **A Cooperates** | Both get 1 year | A gets 3 years, B goes free |
| **A Defects** | A goes free, B gets 3 years | Both get 2 years |

The rational choice for each player is to defect — even though both cooperating would be better for everyone. This tension between individual rationality and collective benefit is at the heart of game theory.

### 2.3 Nash Equilibrium

A **Nash Equilibrium** is a state where **no player can improve their outcome by changing only their own strategy**, assuming all other players keep their strategies the same.

Think of it like this: if every agent in the population is using the same strategy and no agent can do better by switching to a different strategy, the population has reached Nash Equilibrium.

**In EvoNash:** Nash Equilibrium is reached when the population of 1,000 neural networks all converge on the same behavioral strategy. We detect this by measuring **policy entropy** — when all agents are making the same decisions in the same situations, entropy drops to near zero.

### 2.4 How EvoNash Creates a Game-Theoretic Environment

The Petri Dish creates a strategic dilemma for agents:

- **Foraging** (cooperative): Collect food pellets peacefully. Low risk, steady reward.
- **Predation** (competitive): Shoot projectiles at other agents to steal their energy. High risk, high reward.

This creates a dilemma similar to the Prisoner's Dilemma:
- If everyone forages, all survive well.
- But if you can steal energy from a forager, you do even better.
- But if everyone tries to steal, everyone dies.

The population must evolve to find the **equilibrium** strategy — the right balance of foraging vs. aggression where no individual can improve by switching.

### 2.5 Detecting Nash Equilibrium (in code)

**File:** `worker/src/analysis/statistical_analysis.py`, lines 653–710

The code detects Nash Equilibrium using **entropy variance**:

1. Calculate each agent's **policy entropy** (how "uncertain" its decisions are).
2. Calculate the **variance** of entropy across all agents.
3. If variance stays below **0.01** for **20 consecutive generations**, the population has converged.
4. An additional requirement: the population must have **diverged first** (started exploring different strategies) before converging. This prevents false positives from the initial identical population.

```
Convergence conditions:
  σ(entropy) < 0.01        ← strategies are nearly identical
  for 20+ consecutive gens ← not a temporary fluctuation
  after divergence phase    ← population actually explored first
```

### 2.6 Why This Matters

Finding Nash Equilibrium faster has real-world applications:
- **Economics:** Market equilibrium models
- **Network routing:** Optimal packet routing in the internet
- **Auction design:** Bidding strategies (used by Google, eBay, spectrum auctions)
- **Evolutionary biology:** Evolutionarily stable strategies in nature

---

## 3. Neural Networks (The Agent's Brain)

### 3.1 What Is a Neural Network?

A **neural network** is a mathematical function that takes numbers in and puts numbers out, loosely inspired by how biological neurons work. It "learns" by adjusting internal numbers (called **weights**) so that the outputs become useful.

Think of it like a decision-making machine:
- **Input:** What the agent can see (sensor data)
- **Processing:** Math operations that transform the input
- **Output:** What the agent should do (actions)

### 3.2 Architecture: 24 → 64 → 4

**File:** `worker/src/simulation/agent.py`, lines 13–25

EvoNash uses a **feedforward neural network** with this structure:

```
INPUT LAYER (24 neurons)
         ↓
   HIDDEN LAYER (64 neurons) — with ReLU activation
         ↓
OUTPUT LAYER (4 neurons)
```

This gives the network **24 × 64 + 64 + 64 × 4 + 4 = 1,860 weights** (parameters) that the genetic algorithm evolves.

### 3.3 The 24 Inputs (What the Agent "Sees")

**File:** `worker/src/simulation/agent.py`, lines 95–119, and `worker/config/simulation_config.json`

Each agent has **8 raycasts** — imaginary beams that shoot out from the agent in 8 directions (0°, 45°, 90°, 135°, 180°, 225°, 270°, 315°). Each raycast detects 3 things:

| Raycast Data | What It Means |
|-------------|--------------|
| Food distance | How far away is the nearest food in this direction? |
| Enemy distance | How far away is the nearest enemy agent? |
| Wall distance | How far to the edge of the world? (wraps around toroidally) |

8 directions × 3 values = **24 inputs**.

All distances are **normalized** to [0, 1] by dividing by the max raycast distance (200 units):

```python
# From agent.py, line 113:
raycast_flat = np.clip(raycast_flat / max_dist, 0.0, 1.0)
```

**Why normalize?** Neural networks work best when all inputs are on the same scale. A distance of 200 and an energy of 100 would confuse the network — normalization puts everything between 0 and 1.

### 3.4 The 4 Outputs (What the Agent Does)

**File:** `worker/src/simulation/agent.py`, lines 150–161

| Output | Range | Meaning |
|--------|-------|---------|
| **Thrust** | 0 to 1 | How hard to push forward (0 = stop, 1 = full speed) |
| **Turn** | -1 to 1 | Which direction to rotate (-1 = hard left, 1 = hard right) |
| **Shoot** | 0 to 1 | Whether to fire a projectile (> threshold = fire) |
| **Split** | 0 to 1 | Whether to split (divide into two agents) |

### 3.5 How a Neural Network Computes (The Math)

A neural network is just matrix multiplication followed by an activation function.

**Layer 1 (Input → Hidden):**

$$\mathbf{h} = \text{ReLU}(\mathbf{W_1} \cdot \mathbf{x} + \mathbf{b_1})$$

Where:
- **x** is the input vector (24 numbers)
- **W₁** is a 64 × 24 matrix of weights (1,536 numbers)
- **b₁** is a bias vector (64 numbers)
- **ReLU** is the activation function: ReLU(z) = max(0, z)

**Layer 2 (Hidden → Output):**

$$\mathbf{y} = \mathbf{W_2} \cdot \mathbf{h} + \mathbf{b_2}$$

Where:
- **h** is the hidden layer (64 numbers)
- **W₂** is a 4 × 64 matrix of weights (256 numbers)
- **b₂** is a bias vector (4 numbers)

The output **y** is then clamped to valid ranges (e.g., thrust between 0 and 1).

### 3.6 What Is ReLU?

**ReLU** (Rectified Linear Unit) is the simplest activation function:

$$\text{ReLU}(z) = \max(0, z)$$

- If the input is positive, pass it through unchanged.
- If the input is negative, output zero.

**Why do we need it?** Without activation functions, stacking multiple layers would be pointless — the whole network would just be one big linear equation. ReLU introduces **non-linearity**, which lets the network learn complex, curved decision boundaries.

### 3.7 What Is a Weight?

A **weight** is a single number inside the neural network. Think of weights as "knobs" — turning them changes the network's behavior. The genetic algorithm evolves these weights instead of using the traditional approach of backpropagation (gradient-based learning).

**In EvoNash:** Each agent has **1,860 weights**. The population of 1,000 agents means the genetic algorithm is collectively searching through a 1,860-dimensional space.

### 3.8 Softmax and Policy Entropy

**File:** `worker/src/ga/genetic_algorithm.py`, lines 111–134

To measure how "decisive" an agent is, we convert its raw outputs into a **probability distribution** using **softmax**:

$$\text{softmax}(z_i) = \frac{e^{z_i}}{\sum_{j} e^{z_j}}$$

This converts raw numbers into probabilities that sum to 1. For example:
- Raw output: [2.0, 1.0, 0.1, 0.1]
- After softmax: [0.59, 0.22, 0.09, 0.09]

Then we measure **entropy**:

$$H(\pi) = -\sum_{i} \pi(a_i|s) \cdot \log \pi(a_i|s)$$

- **High entropy** = agent is confused (outputs are all roughly equal, like [0.25, 0.25, 0.25, 0.25])
- **Low entropy** = agent is decisive (one action dominates, like [0.90, 0.05, 0.03, 0.02])

When the **variance** of entropy across all agents drops to near zero, the population has reached Nash Equilibrium — everyone is making the same decisions.

### 3.9 Batched Inference (GPU Optimization)

**File:** `PROJECT_SPEC.md` section 4.3

Instead of running 1,000 neural networks one at a time, EvoNash stacks all weights into a single **batched matrix multiplication**:

$$Y = \text{bmm}(X, W^T) + B$$

This is **mathematically identical** to running each network individually, but runs 50–100× faster on a GPU because GPUs are designed for exactly this kind of parallel matrix math.

---

## 4. The Genetic Algorithm (Artificial Evolution)

### 4.1 What Is a Genetic Algorithm?

A **genetic algorithm (GA)** mimics biological evolution to solve optimization problems. Instead of directly programming a solution, you:

1. Create a **population** of random solutions.
2. **Evaluate** how good each solution is (fitness).
3. Let the best solutions **reproduce** (selection).
4. Mix parent solutions to create **children** (crossover).
5. Add random changes to children (mutation).
6. Repeat for many **generations**.

Over time, the population evolves better and better solutions — just like natural evolution.

### 4.2 The EvoNash GA Pipeline

**File:** `worker/src/ga/genetic_algorithm.py`, lines 307–340

Each generation follows this pipeline:

```
┌─────────────────────────────────────────┐
│  1. EVALUATE FITNESS                     │
│     All 1,000 agents live in the Petri  │
│     Dish for 750 ticks (12 sec)         │
│     fitness = lifetime + remaining energy│
├─────────────────────────────────────────┤
│  2. SELECTION (Top 20%)                  │
│     Sort by fitness, keep the best 200  │
│     agents as parents                    │
├─────────────────────────────────────────┤
│  3. ELITISM (Top 10%)                    │
│     Copy the best 100 directly into     │
│     the next generation (no changes)     │
├─────────────────────────────────────────┤
│  4. CROSSOVER                            │
│     Pick 2 random parents               │
│     Mix their weights to make a child    │
├─────────────────────────────────────────┤
│  5. MUTATION                             │
│     Add random noise to child's weights  │
│     STATIC: always ε = 0.05             │
│     ADAPTIVE: ε based on parent fitness  │
├─────────────────────────────────────────┤
│  6. REPEAT until population = 1,000      │
│     Then go back to step 1              │
└─────────────────────────────────────────┘
```

### 4.3 Fitness Function

**File:** `worker/src/experiments/experiment_runner_optimized.py`, line 457

```python
fitness_scores = lifetimes + final_energies
```

An agent's fitness is simply:

$$\text{Fitness} = \text{Ticks Survived} + \text{Remaining Energy}$$

- **Ticks survived:** How long the agent stayed alive (out of 750 ticks max). An agent that survives the full generation gets 750.
- **Remaining energy:** How much energy the agent has at the end. Agents that collected lots of food but didn't waste energy will score higher.

This simple fitness function creates complex emergent behavior because agents must balance energy gathering (food), energy conservation (not moving too much), and survival (avoiding projectiles).

### 4.4 Selection

**File:** `worker/src/ga/genetic_algorithm.py`, lines 204–220

```python
# Sort by fitness score (descending)
sorted_population = sorted(self.population, key=lambda a: a.fitness_score, reverse=True)
# Select top k% (k = 0.20 by default)
num_parents = max(1, int(len(self.population) * self.config.selection_pressure))
return sorted_population[:num_parents]
```

**Selection pressure = 20%** means only the top 200 out of 1,000 agents get to reproduce. This is called **truncation selection**.

**Why only 20%?** This creates strong evolutionary pressure — only the best survive. Too little pressure (e.g., 80%) would make evolution too slow. Too much pressure (e.g., 5%) would reduce genetic diversity and could cause the population to get stuck.

### 4.5 Elitism

**File:** `worker/src/ga/genetic_algorithm.py`, line 319

```python
elite_size = max(1, int(len(self.population) * 0.1))  # Top 10%
new_population.extend(parents[:elite_size])
```

**Elitism** guarantees that the best solutions from the current generation survive unchanged into the next generation. Without elitism, a lucky random mutation could be lost.

Think of it like this: the top 10% of agents are "protected" from mutation—they pass directly into the next generation. This guarantees fitness can **never decrease** from one generation to the next.

### 4.6 Crossover (Sexual Reproduction)

**File:** `worker/src/ga/genetic_algorithm.py`, lines 222–270

```python
# Uniform crossover: randomly choose weights from each parent
mask = np.random.random(len(weights_a)) < 0.5
offspring_weights = np.where(mask, weights_a, weights_b)
```

**Crossover** combines two parent neural networks to create a child. EvoNash uses **uniform crossover**:

For each of the 1,860 weights in the neural network, flip a coin:
- Heads → take this weight from Parent A
- Tails → take this weight from Parent B

This creates a child that inherits a random mix of traits from both parents. In biology, this is analogous to how sexual reproduction combines chromosomes from both parents.

### 4.7 Mutation (The Core of the Hypothesis)

**File:** `worker/src/ga/genetic_algorithm.py`, lines 272–305

Mutation adds random noise to the child's weights:

```python
for param in agent.network.parameters():
    noise = torch.randn_like(param) * mutation_rate
    param.add_(noise)
```

Each weight gets a small random value added to it, drawn from a **normal distribution** with mean 0 and standard deviation equal to the mutation rate (ε).

#### Static Mutation (Control Group)

$$\epsilon = 0.05$$

Every agent mutates by the same amount, regardless of fitness. This is the traditional approach.

#### Adaptive Mutation (Experimental Group)

$$\epsilon = \text{Base} \times \left(1 - \frac{\text{ParentFitness}}{\text{MaxPossibleFitness}}\right)$$

**File:** `worker/src/ga/genetic_algorithm.py`, lines 285–295

```python
base = self.config.mutation_base or 0.0615
max_fitness = self.config.max_possible_fitness
mutation_rate = base * (1.0 - parent_fitness / max_fitness)
mutation_rate = np.clip(mutation_rate, 0.01, 0.2)  # Clamp to [0.01, 0.20]
```

**The intuition:**
- **Bad agents** (low fitness) → high mutation rate → explore radically different strategies
- **Good agents** (high fitness) → low mutation rate → make tiny refinements, don't break what works

This is the biological equivalent of the fact that organisms well-adapted to their environment tend to have lower mutation rates in nature, while organisms under stress show increased mutation rates (a phenomenon called **stress-induced mutagenesis**).

**Numerical example (with base = 0.0615, max_fitness = 8000):**

| Parent Fitness | Mutation Rate (ε) | Interpretation |
|---------------|-------------------|----------------|
| 500 | 0.058 (5.8%) | Very bad parent → mutate heavily |
| 2,000 | 0.046 (4.6%) | Below average → moderate mutation |
| 4,000 | 0.031 (3.1%) | Average → modest mutation |
| 6,000 | 0.015 (1.5%) | Good → small refinements |
| 7,500 | 0.010 (1.0%) | Excellent → barely change (clamped to floor) |

### 4.8 Population Diversity

**File:** `worker/src/ga/genetic_algorithm.py`, lines 160–202

To track whether the population is becoming too uniform (lost diversity), EvoNash calculates the **average Euclidean distance** between agents' weight vectors:

$$\text{Diversity} = \frac{1}{\binom{n}{2}} \sum_{i < j} \|\mathbf{w}_i - \mathbf{w}_j\|_2$$

Where $\|\mathbf{w}_i - \mathbf{w}_j\|_2$ is the Euclidean distance between two agents' flattened weight vectors.

- **High diversity** = agents are very different (early evolution, still exploring)
- **Low diversity** = agents are converging to similar strategies (approaching Nash Equilibrium)

The code samples 100 random pairs to avoid the O(n²) computational cost of comparing all pairs.

---

## 5. The Hypothesis & Experimental Design

### 5.1 The Formal Hypothesis

**File:** `PROJECT_SPEC.md`, section 2.1

> **If** the mutation rate (ε) of a neural network is inversely proportional to its parent's fitness (i.e., lower fitness parents produce highly mutated offspring, high fitness parents produce stable offspring), **then** the population will reach a policy entropy plateau (Nash Equilibrium) in fewer generations than a control group with a fixed mutation rate.

In scientific notation:

- **H₀ (Null Hypothesis):** There is no difference in convergence speed between static and adaptive mutation. μ_control = μ_experimental.
- **H₁ (Alternative Hypothesis):** Adaptive mutation converges in fewer generations. μ_experimental < μ_control.

### 5.2 Experimental Variables

| Variable Type | Variable | Description |
|--------------|----------|-------------|
| **Independent** | Mutation Strategy | STATIC (ε = 0.05) vs. ADAPTIVE (ε = f(fitness)) |
| **Dependent** (Primary) | Convergence Generation | The generation number when Nash Equilibrium is reached |
| **Dependent** (Secondary) | Peak Fitness | Maximum fitness achieved at convergence |
| **Controlled** | Population Size | N = 1,000 (identical for both groups) |
| **Controlled** | Neural Architecture | 24 → 64 → 4 (identical) |
| **Controlled** | Selection Pressure | Top 20% (identical) |
| **Controlled** | Random Seed | Same seed for matched pairs |
| **Controlled** | Petri Dish rules | Same physics, food, energy (identical) |

### 5.3 Paired-Seed Design

EvoNash uses a **paired-seed design**: each experiment has a specific random seed (e.g., seed 42). Both the control and experimental runs use the **same seed**, meaning they start with the exact same initial population and the exact same food placement.

**Why this matters:** It isolates the mutation strategy as the **only** variable. Any difference in outcome must be due to the mutation strategy, not random chance in initialization.

```python
# From genetic_algorithm.py, lines 48-54:
np.random.seed(config.random_seed)
torch.manual_seed(config.random_seed)
```

### 5.4 Sample Size and Statistical Power

Running the experiment once proves nothing — you need many repetitions to establish statistical significance. Each seed produces one data point (the convergence generation for that run).

With enough seeds (experiments), you can perform a **t-test** to determine whether the difference is real or just random noise.

---

## 6. Statistical Analysis

### 6.1 Why Statistics?

Running one experiment and saying "experimental was faster" isn't scientific. Maybe it was just luck. Statistics answers: **What is the probability that this result occurred by chance?**

### 6.2 Welch's Two-Sample T-Test

**File:** `worker/src/analysis/statistical_analysis.py`, lines 767–800+

This is the **primary hypothesis test** in EvoNash. It compares the mean convergence generation between the two groups.

#### What It Calculates

**t-statistic:**

$$t = \frac{\bar{X}_1 - \bar{X}_2}{\sqrt{\frac{s_1^2}{n_1} + \frac{s_2^2}{n_2}}}$$

Where:
- $\bar{X}_1$, $\bar{X}_2$ = mean convergence generation for control and experimental
- $s_1^2$, $s_2^2$ = sample variance of each group
- $n_1$, $n_2$ = number of experiments (converged) in each group

**Degrees of Freedom (Welch-Satterthwaite):**

$$df = \frac{\left(\frac{s_1^2}{n_1} + \frac{s_2^2}{n_2}\right)^2}{\frac{(s_1^2/n_1)^2}{n_1-1} + \frac{(s_2^2/n_2)^2}{n_2-1}}$$

This formula looks complicated, but it's just calculating how many "effective" data points you have after accounting for different variances in the two groups.

#### Why Welch's, Not Student's?

**Student's t-test** assumes both groups have equal variances. **Welch's t-test** does not make this assumption. Since our control and experimental groups might have very different amounts of variation in their convergence times, Welch's is the safer choice.

#### What Is a P-Value?

The **p-value** is the probability of seeing a result as extreme as (or more extreme than) what we observed, **if there truly were no difference** between the groups.

- **p < 0.05** → The result is **statistically significant**. There is less than a 5% chance this happened by random chance.
- **p < 0.001** → Very strong evidence.
- **p < 0.0001** → Extremely strong evidence.

**Analogy:** Imagine flipping a coin 100 times and getting 85 heads. The p-value tells you how likely that is if the coin is fair. A very small p-value means the coin is almost certainly biased.

#### One-Tailed vs. Two-Tailed

- **Two-tailed test:** Tests whether the groups are different in **either direction** (experimental could be faster OR slower).
- **One-tailed test:** Tests whether the experimental group is specifically **faster**.

**EvoNash displays two-tailed as the primary p-value** because it is the more conservative (harder to achieve significance) and widely accepted standard. The one-tailed p-value is reported secondarily for reference.

### 6.3 Significance Level (α = 0.05)

The **significance level** (alpha, α) is the threshold we choose in advance for what counts as "significant." By convention, α = 0.05 (5%).

If p < α, we **reject the null hypothesis** and conclude there is a statistically significant difference.

If p ≥ α, we **fail to reject the null hypothesis** — we don't have enough evidence to say there's a difference (this does NOT mean there is no difference — only that we can't prove one).

### 6.4 Effect Size: Cohen's d and Hedges' g

**File:** `worker/src/analysis/statistical_analysis.py`, lines 238–323

A p-value tells you IF a difference is real, but not HOW BIG it is. A tiny difference can be "statistically significant" with enough data. **Effect size** measures the practical magnitude.

#### Cohen's d

$$d = \frac{\bar{X}_1 - \bar{X}_2}{s_{\text{pooled}}}$$

Where the **pooled standard deviation** is:

$$s_{\text{pooled}} = \sqrt{\frac{(n_1 - 1)s_1^2 + (n_2 - 1)s_2^2}{n_1 + n_2 - 2}}$$

This tells you how many standard deviations apart the two group means are.

#### Interpretation (Cohen's Conventions)

| |d| | Interpretation | Example |
|-----|----------------|---------|
| < 0.2 | **Negligible** | Barely noticeable difference |
| 0.2 – 0.5 | **Small** | The effect exists but is modest |
| 0.5 – 0.8 | **Medium** | A meaningful, noticeable effect |
| > 0.8 | **Large** | A substantial, obvious effect |

#### Hedges' g (Small-Sample Correction)

When sample sizes are small (< 20), Cohen's d slightly overestimates the effect. **Hedges' g** corrects for this:

$$g = d \times J$$

Where the correction factor is:

$$J = 1 - \frac{3}{4 \cdot df - 1}, \quad df = n_1 + n_2 - 2$$

For large samples, J ≈ 1 and Hedges' g ≈ Cohen's d. The correction only matters when you have fewer than about 20 experiments per group.

**In EvoNash:** The sign of d or g tells you the direction:
- **Negative** = experimental converges faster (supports hypothesis)
- **Positive** = control converges faster (contradicts hypothesis)

### 6.5 Statistical Power

**File:** `worker/src/analysis/statistical_analysis.py`, lines 393–456

**Power** is the probability that your test will correctly detect a real effect when one exists. Think of it as the sensitivity of your experiment.

$$\text{Power} = P(\text{reject } H_0 \mid H_1 \text{ is true})$$

| Power | Interpretation |
|-------|---------------|
| < 40% | Very low — you'll probably miss a real effect |
| 40–60% | Low — likely to miss real effects |
| 60–80% | Moderate — coin flip on detecting effects |
| **≥ 80%** | **Adequate** — standard threshold for scientific studies |
| ≥ 95% | Excellent — very sensitive |

**The power depends on:**
1. **Sample size** (more experiments → more power)
2. **Effect size** (bigger differences are easier to detect)
3. **Significance level** α (lower α → harder to detect → lower power)

If power is low, a non-significant result is inconclusive — the effect might exist but your experiment wasn't sensitive enough to detect it.

### 6.6 Required Sample Size

**File:** `worker/src/analysis/statistical_analysis.py`, lines 459–493

Before running experiments, you can calculate how many you'll need:

$$n = 2 \times \left(\frac{z_{\alpha/2} + z_{\beta}}{d}\right)^2$$

Where:
- $z_{\alpha/2}$ = critical z-value for desired significance (1.96 for α = 0.05)
- $z_{\beta}$ = z-value for desired power (0.84 for 80% power)
- $d$ = expected effect size

**Example:** To detect a medium effect (d = 0.5) with 80% power:

$$n = 2 \times \left(\frac{1.96 + 0.84}{0.5}\right)^2 = 2 \times (5.6)^2 = 2 \times 31.36 \approx 63 \text{ per group}$$

You'd need about 63 experiments per group (126 total).

### 6.7 Assumption Checking

Good statistics requires checking that your data meets the assumptions of your test. EvoNash checks three:

#### Shapiro-Wilk Test (Normality)

**File:** `worker/src/analysis/statistical_analysis.py`, lines 27–83

Tests whether the data follows a normal (bell-curve) distribution. The t-test assumes approximately normal data.

- **p ≥ 0.05** → Data is approximately normal ✓
- **p < 0.05** → Data is not normal — consider a non-parametric test

#### Levene's Test (Equal Variances)

**File:** `worker/src/analysis/statistical_analysis.py`, lines 86–127

Tests whether both groups have similar spread (variance). If variances are unequal, Welch's t-test (which EvoNash uses) handles this automatically.

#### IQR Outlier Detection

**File:** `worker/src/analysis/statistical_analysis.py`, lines 130–181

Identifies extreme values using the **Interquartile Range** method:

1. Calculate Q1 (25th percentile) and Q3 (75th percentile)
2. IQR = Q3 − Q1
3. Outliers = values below Q1 − 1.5 × IQR or above Q3 + 1.5 × IQR

Outliers can distort statistical tests, so it's important to know if they exist.

### 6.8 Non-Parametric Alternative: Mann-Whitney U Test

**File:** `worker/src/analysis/statistical_analysis.py`, lines 184–235

If the data isn't normally distributed, the **Mann-Whitney U test** is a non-parametric alternative. Instead of comparing means, it tests whether one group tends to have larger values than the other by ranking all observations.

**Advantages:**
- No assumption of normal distribution
- Works with small samples
- Robust to outliers

**Disadvantage:**
- Less powerful than the t-test when normality holds (it's more conservative)

### 6.9 Confidence Intervals

**File:** `worker/src/analysis/statistical_analysis.py`, lines 496–579

A **confidence interval (CI)** gives a range of plausible values for the true effect.

**95% CI:** If we repeated this experiment 100 times, about 95 of those intervals would contain the true effect.

EvoNash calculates confidence intervals two ways:
1. **Analytical:** From the t-distribution (standard approach)
2. **Bootstrap:** Resampling the data 10,000 times to estimate the CI without distributional assumptions

#### Bootstrap Method

1. From your n data points, randomly draw n values **with replacement** (some values may be picked multiple times, others not at all).
2. Calculate the statistic (e.g., mean difference) on this "resampled" dataset.
3. Repeat 10,000 times.
4. The 2.5th and 97.5th percentiles of the 10,000 statistics form the 95% CI.

**Why bootstrap?** It makes no assumptions about the shape of the distribution, making it especially useful for small or non-normal datasets.

### 6.10 Q-Q Plot

A **Q-Q (Quantile-Quantile) plot** visually checks if data is normally distributed:
- Plot data quantiles (y-axis) against theoretical normal quantiles (x-axis)
- If data is normal, points fall on a straight diagonal line
- Deviations from the line indicate non-normality (skew, heavy tails, etc.)

### 6.11 Box Plot (Distribution Visualization)

**Box plots** show the distribution of convergence generations:
- **Box:** Middle 50% of data (Q1 to Q3)
- **Line in box:** Median
- **Whiskers:** Extend to 1.5 × IQR
- **Dots beyond whiskers:** Outliers

Comparing control vs. experimental box plots side-by-side instantly shows whether one group converges faster.

---

## 7. Math Reference Sheet

### 7.1 Linear Algebra (Neural Networks)

| Concept | Formula | EvoNash Usage |
|---------|---------|--------------|
| Matrix Multiplication | $C = A \times B$ where $C_{ij} = \sum_k A_{ik} B_{kj}$ | Core neural network computation |
| Dot Product | $\mathbf{a} \cdot \mathbf{b} = \sum_i a_i b_i$ | Each neuron computes a weighted sum |
| Euclidean Norm | $\|\mathbf{v}\| = \sqrt{\sum_i v_i^2}$ | Population diversity measurement |

### 7.2 Calculus Concepts

| Concept | Formula | EvoNash Usage |
|---------|---------|--------------|
| Euler Integration | $x_{t+1} = x_t + v_t \cdot dt$ | Agent physics (position updates) |
| Velocity Update | $v_{t+1} = v_t + F \cdot dt$ | Thrust application |

**Note:** EvoNash doesn't use gradients or backpropagation — the genetic algorithm replaces gradient-based optimization.

### 7.3 Probability & Statistics

| Concept | Formula | EvoNash Usage |
|---------|---------|--------------|
| Mean | $\bar{X} = \frac{1}{n}\sum_{i=1}^n x_i$ | Average convergence generation |
| Variance | $s^2 = \frac{1}{n-1}\sum_{i=1}^n (x_i - \bar{X})^2$ | Spread of convergence generations |
| Standard Deviation | $s = \sqrt{s^2}$ | Typical deviation from mean |
| Normal Distribution | $f(x) = \frac{1}{\sigma\sqrt{2\pi}} e^{-\frac{(x-\mu)^2}{2\sigma^2}}$ | Assumed distribution for t-test |
| t-statistic | $t = \frac{\bar{X}_1 - \bar{X}_2}{\sqrt{s_1^2/n_1 + s_2^2/n_2}}$ | Welch's t-test |

### 7.4 Information Theory

| Concept | Formula | EvoNash Usage |
|---------|---------|--------------|
| Shannon Entropy | $H = -\sum p_i \log p_i$ | Policy entropy (agent certainty) |
| Softmax | $\sigma(z_i) = \frac{e^{z_i}}{\sum_j e^{z_j}}$ | Convert outputs to probabilities |

### 7.5 Geometry & Physics

| Concept | Formula | EvoNash Usage |
|---------|---------|--------------|
| Toroidal Distance | $d_x = \min(|x_1 - x_2|, W - |x_1 - x_2|)$ | Wrap-around world |
| Ray-Circle Intersection | Solve $|P + tD - C|^2 = R^2$ | Raycast collision detection |
| Trigonometric Motion | $v_x = \cos(\theta) \cdot F$, $v_y = \sin(\theta) \cdot F$ | Agent thrust application |

---

## 8. Glossary

| Term | Definition |
|------|-----------|
| **α (alpha)** | Significance level; the threshold for rejecting H₀ (typically 0.05) |
| **Activation Function** | A non-linear function applied between neural network layers (EvoNash uses ReLU) |
| **Adaptive Mutation** | Mutation rate that changes based on an agent's fitness |
| **Backpropagation** | Traditional neural network training via gradients (NOT used in EvoNash — replaced by genetic algorithm) |
| **Bootstrap** | Statistical method that resamples data to estimate uncertainty |
| **Cohen's d** | Effect size measure: how many standard deviations apart two groups are |
| **Confidence Interval** | Range of plausible values for the true effect |
| **Convergence** | When the population stabilizes on a single strategy (Nash Equilibrium) |
| **Crossover** | Combining two parent genomes (weight vectors) to create a child |
| **Degrees of Freedom** | A parameter related to sample size that affects the t-distribution shape |
| **Effect Size** | How large a difference is (distinct from statistical significance) |
| **Elitism** | Preserving the best solutions unchanged in the next generation |
| **Entropy** | A measure of uncertainty or disorder in a probability distribution |
| **Epoch / Generation** | One full cycle of the genetic algorithm |
| **Euler Integration** | Simple numerical method for updating physics (position, velocity) |
| **Feedforward Network** | A neural network where data flows in one direction (input → hidden → output) |
| **Fitness** | A numerical score measuring how well an agent performed |
| **Genetic Algorithm** | Optimization method inspired by biological evolution |
| **Hedges' g** | Effect size corrected for small sample bias |
| **Hypothesis Test** | A statistical procedure to decide between two competing explanations |
| **IQR** | Interquartile Range: the middle 50% of data (Q3 - Q1) |
| **Levene's Test** | Tests whether two groups have equal variance |
| **Mann-Whitney U** | Non-parametric test comparing two groups without assuming normality |
| **Mutation** | Adding random noise to weights to explore new solutions |
| **Nash Equilibrium** | A stable state where no agent can improve by unilaterally changing strategy |
| **Neural Network** | A mathematical function composed of layers of weighted sums and activations |
| **Non-parametric** | Statistics that don't assume a specific data distribution |
| **Normality** | Data following a bell-curve (Gaussian) distribution |
| **Null Hypothesis (H₀)** | The assumption that there is no effect or no difference |
| **P-value** | Probability of observing data this extreme if H₀ is true |
| **Parametric** | Statistics that assume a specific data distribution (usually normal) |
| **Policy** | An agent's strategy — mapping from observations to actions |
| **Population** | The entire set of agents being evolved (N = 1,000) |
| **Power** | Probability of detecting a real effect (target: ≥ 80%) |
| **Q-Q Plot** | Visual test for normality (data vs. theoretical quantiles) |
| **Raycast** | A virtual beam that detects objects in a specific direction |
| **ReLU** | Rectified Linear Unit: max(0, x) |
| **Selection Pressure** | Fraction of the population that gets to reproduce (20%) |
| **Shapiro-Wilk Test** | Statistical test for normality of data |
| **Softmax** | Converts raw numbers into a probability distribution summing to 1 |
| **Standard Deviation** | Typical distance of data points from the mean |
| **t-test** | Statistical test comparing the means of two groups |
| **Toroidal Space** | A 2D world where going off one edge wraps around to the other side |
| **Truncation Selection** | Keeping only the top-performing fraction as parents |
| **Variance** | Average squared distance from the mean (s² = SD²) |
| **Welch's t-test** | t-test that doesn't assume equal variances (used in EvoNash) |
| **Weight** | A single adjustable number inside a neural network |

---

*This study guide references the EvoNash codebase as of March 2026. All file paths and line numbers are relative to the project root at `EvoNash/`.*
