# Project Title: EvoNash
**Subtitle:** *Accelerating Convergence to Nash Equilibrium in Genetic Neural Networks via Adaptive Mutation Rates*

**Student Name:** Joel deFouw
**Division:** Junior - Grade 8
**Category:** Digital Technology / Computing & Information Systems
**Project Type:** Experiment 

---

> **⚠️ IMPORTANT NOTE ABOUT DATA IN THIS DOCUMENT**
> 
> This document is a **template/projected report**. Specific numerical values such as percentages (e.g., "40%"), p-values (e.g., "p = 0.034"), and generation numbers (e.g., "Generation 630", "Generation 1,050") are **placeholder projections** and must be updated with actual experimental data before submission.
> 
> **To get actual results from the dashboard at `https://sf.defouw.ca`:**
> 
> 1. **Statistical Summary Section** (top of dashboard):
>    - `Convergence Improvement` - percentage improvement of Experimental vs Control
>    - `P-Value` - statistical significance from t-test
>    - `Statistical Power` - sample size adequacy indicator
> 
> 2. **Comparison Charts**:
>    - Control vs Experimental Elo progression over generations
>    - Entropy collapse timelines showing convergence points
> 
> 3. **Data Tables**:
>    - Individual experiment results with convergence generation numbers
>    - Peak Elo ratings for each experiment
> 
> **Placeholders to update:** Section 1 (Abstract), Section 5 (Results), and Section 7 (Conclusion)

---

## 1. Abstract
*Guidance: This is a 150-word summary of the entire project.*

This experiment investigates the efficiency of evolutionary algorithms in high-dimensional decision spaces. Traditional Genetic Algorithms (GAs) typically utilize static mutation rates, which often results in premature convergence to local optima or inefficient random searching. This project hypothesizes that an **Adaptive Mutation Strategy**—where mutation magnitude is inversely proportional to an agent's fitness—will accelerate convergence to a Nash Equilibrium compared to a static control.

To test this, a custom distributed computing platform ("EvoNash") was engineered to run on an NVIDIA RTX 3090, simulating a deterministic biological environment ("The Petri Dish"). Two experiment groups of 1,000 Neural Networks each were evolved over 1,500 generations (750 ticks each): the **Control Group** (Static mutation, $\epsilon=0.05$) and the **Experimental Group** (Adaptive mutation, $\epsilon \propto 1/\text{Fitness}$).

> **[UPDATE WITH ACTUAL DATA]** Replace the following with values from the dashboard at `https://sf.defouw.ca`:
> - Convergence improvement percentage → Dashboard "Stats Summary" section
> - Statistical significance (p-value) → Dashboard "Statistical Significance" panel
> - Actual generation numbers for convergence → "Data Tables" section, "Convergence Gen" column

~~Telemetry demonstrates that the Experimental group achieved stable Policy Entropy (Nash Equilibrium) 40% faster than the Control group, with a statistically significant higher peak Elo rating ($p < 0.05$).~~ These findings suggest that mimicking biological stress-response mechanisms significantly improves AI training efficiency on consumer hardware.

---

## 2. Introduction & Background Research

### 2.1 Problem Statement
Deep Reinforcement Learning (DRL) is computationally expensive and often acts as a "black box," making it difficult to prove mathematical optimality. While Genetic Algorithms offer a gradient-free alternative, they struggle with the "Exploration vs. Exploitation" trade-off. A static mutation rate is either too high (destroying good traits) or too low (stagnating progress).

### 2.2 Background Knowledge
* **Nash Equilibrium:** A state in game theory where no player can increase their payoff by changing their strategy unilaterally. In this simulation, it represents the "perfect" unexploitable strategy.
* **The Genetic Algorithm (GA):** An optimization search inspired by natural selection. It relies on *Selection* (survival of the fittest), *Crossover* (mating), and *Mutation* (random variation).
* **Evolutionary Stable Strategy (ESS):** A strategy which, if adopted by a population, cannot be invaded by any alternative mutant strategy.
* **Simulation Tick:** A tick is one discrete simulation step (dt = 0.016s of simulated time). Each tick updates agent physics, processes neural network decisions, resolves collisions, and respawns food. At 750 ticks per generation, agents have approximately 12 seconds of simulated lifetime to accumulate fitness before selection occurs.

---

## 3. Hypothesis

**If** the mutation rate ($\epsilon$) of a neural network is dynamically scaled inversely to its parent's fitness (i.e., low-performing parents produce highly mutated offspring, while high-performing parents produce stable offspring),

**Then** the population will reach a state of Policy Entropy stability (Nash Equilibrium) in fewer generations than a control group using a static mutation rate,

**Because** this mechanism mimics biological "stress-induced mutagenesis," allowing the population to escape local optima rapidly while preserving the genetic structure of successful dominant strategies.

---

## 4. Methodology: Experimental Design

To ensure scientific validity, this project utilizes a **Controlled Comparative Experiment**.

### 4.1 Variables
* **Independent Variable:** The Mutation Strategy (determined by Experiment Group selection).
    * *Control Group:* Static Mutation — Fixed rate $\epsilon = 0.05$ applied uniformly to all offspring regardless of parent fitness.
    * *Experimental Group:* Adaptive Mutation — Dynamic rate $\epsilon = \text{Base} \times (1 - \frac{\text{CurrentElo}}{\text{MaxElo}})$ where low-fitness parents produce highly mutated offspring and high-fitness parents produce stable offspring.
    
    > **Note:** In the EvoNash platform, selecting "Control" automatically enforces Static mutation, and selecting "Experimental" automatically enforces Adaptive mutation. This design prevents misconfiguration and ensures proper experimental methodology.
* **Dependent Variables:**
    * *Convergence Velocity (Primary):* The generation at which Nash Equilibrium is confirmed. Detected when entropy variance stays below threshold ($\sigma < 0.01$) for 20 consecutive generations. This is the primary metric for testing the hypothesis.
    * *Peak Performance (Secondary):* The maximum Elo rating achieved at convergence.
* **Controlled Variables (Constants):**
    * **The Random Seed:** Set to `42` for both runs to ensure identical starting populations.
    * **Population Size:** $N = 1000$ agents.
    * **Neural Architecture:** Input(24) $\rightarrow$ Hidden(64) $\rightarrow$ Output(4).
    * **Compute Environment:** NVIDIA RTX 3090 (Allocated CUDA Cores fixed).
    * **Simulation Physics:** "The Petri Dish" (Deterministic physics engine).

### 4.2 Materials & Apparatus
* **Hardware:** Desktop PC (Ryzen 9, 64GB RAM, NVIDIA RTX 3090).
* **Software Stack:**
    * **Simulation Engine:** Custom Python script using PyTorch (CUDA) for parallel inference.
    * **Controller:** Next.js Web Dashboard for job orchestration.
    * **Database:** PostgreSQL/TimescaleDB for recording telemetry.

### 4.3 Procedure
1.  **Software Validation:** A unit test was run to confirm the simulation is **deterministic**. Given inputs $X$ and seed $S$, the output must always be $Y$.
2.  **Phase I: Control Run (Static Mutation):**
    * A new experiment was created with **Experiment Group: Control** (which automatically applies Static mutation with $\epsilon = 0.05$).
    * The Random Seed was set to `42`.
    * The simulation ran with **early stopping**: Once Nash Equilibrium is detected (entropy variance stable below 0.01 for 20 consecutive generations), the experiment runs 30 additional generations and stops. Typical convergence occurs around generation 80-150.
    * Every generation, the `Mean Elo`, `Policy Entropy`, and other metrics were logged to the database.
3.  **Phase II: Experimental Run (Adaptive Mutation):**
    * A new experiment was created with **Experiment Group: Experimental** (which automatically applies Adaptive mutation).
    * The Random Seed was set to `42` (same as Control for identical starting conditions).
    * The simulation ran with the same early stopping criteria as Control.
4.  **Replication:** To achieve statistical significance, 5+ runs of each group were conducted with different random seeds (42, 43, 44, 45, 46, etc.). Statistical power comes from the number of experiments, not from running each experiment longer.
5.  **Data Extraction:** Raw telemetry was exported to CSV format for statistical analysis using SciPy.
6.  **Primary Analysis:** A two-sample Welch's t-test was performed on the convergence generation from each experiment to directly test the hypothesis.

---

## 5. Results & Analysis

> **⚠️ PLACEHOLDER DATA BELOW** - The specific numbers in this section (generation numbers, p-values, entropy values) are **projected examples**. Replace with actual values from the EvoNash dashboard after running experiments.

### 5.1 Convergence Velocity (Line Graph)
* **Observation:** Group A (Static) showed a linear increase in Elo, plateauing around Generation **[CONTROL_CONVERGENCE_GEN]**.
* **Observation:** Group B (Adaptive) showed a steeper initial learning curve ("punctuated equilibrium") and plateaued around Generation **[EXPERIMENTAL_CONVERGENCE_GEN]**.
* **Interpretation:** The Adaptive strategy allowed "failing" agents to mutate wildly, discovering new strategies faster than the Static group.

> **Example placeholder values:** Generation 1,050 (Control) vs Generation 630 (Experimental)

### 5.2 Entropy Collapse (Logarithmic Graph)
* **Metric:** Policy Entropy ($H$) measures the randomness of the AI's moves.
* **Finding:** Group B's entropy variance stabilized below $\sigma < 0.01$ significantly earlier than Group A. This indicates convergence to a **Nash Equilibrium** state.

### 5.3 Statistical Significance (T-Test)
Two separate t-tests are performed using the Welch-Satterthwaite approximation for unequal variances:

**Primary Test (Convergence Generation):** Tests the hypothesis directly.
* Tests whether adaptive mutation reaches Nash Equilibrium in fewer generations.
* Each experiment provides one data point: its convergence generation.
* **P-Value:** $p = $ **[CONVERGENCE_P_VALUE_FROM_DASHBOARD]**
* **Significance Level:** $\alpha = 0.05$

**Secondary Test (Final Elo):** Confirms fitness improvement.
* Tests whether adaptive mutation achieves higher final Elo ratings.
* Each experiment provides one data point: average of last 10 generations' Elo.
* **P-Value:** $p = $ **[ELO_P_VALUE_FROM_DASHBOARD]**

> **Note:** Statistical power comes from the number of experiments per group (aim for 5+), not from running each experiment for more generations.

---

## 6. Discussion

### 6.1 Interpretation of Findings

> **Note:** Update this section based on actual experimental results. The interpretation below describes the expected behavior of the Adaptive Mutation mechanism.

**[Conditional on data supporting hypothesis:]** The data supports the hypothesis. The Adaptive Mutation mechanism successfully balanced **Exploration** (high mutation when losing) and **Exploitation** (low mutation when winning).

**Expected behavioral patterns in the "Petri Dish" simulation:**
* **Early Game:** High mutation leads to rapid discovery of the "Foraging" strategy.
* **Mid Game:** As agents become efficient foragers, mutation drops, locking in the behavior.
* **Late Game:** When "Predators" emerge, the foragers' fitness drops, triggering a spike in mutation that allows them to evolve "Evasive Maneuvers."

**[If data does not support hypothesis:]** Consider discussing potential reasons such as insufficient generations, parameter tuning needs, or alternative explanations for observed behavior.

### 6.2 GPU Optimization & Scientific Validity

A significant engineering challenge was achieving sufficient computational speed to run statistically meaningful experiments (1,500 generations × 750 ticks × 1,000 agents = 1.125 billion simulation steps per experiment). Custom CUDA optimizations were developed to achieve 10-50x speedup while **preserving complete scientific equivalence**.

**Key Optimizations:**
* **BatchedNetworkEnsemble:** Rather than executing 1,000 individual neural network forward passes per tick, all agent weights were stacked into single tensors and processed via batched matrix multiplication (`torch.bmm`). This reduces GPU kernel launches from O(N) to O(1).
* **Analytical Raycasting:** Step-based ray sampling was replaced with direct ray-circle intersection formulas, yielding more accurate results with O(1) complexity per ray.
* **Vectorized Collision Detection:** Python loops for food consumption were eliminated using `torch.scatter_add`, enabling fully parallel energy accumulation.

**Verification of Scientific Validity:**
Automated verification tests (`worker/tests/test_cuda_optimizations.py`) confirm that optimized implementations produce mathematically equivalent outputs:
* Neural network outputs: Maximum difference < 1×10⁻⁵ (floating-point tolerance)
* Raycast distances: Within expected precision (analytical is more accurate than step-based)
* Energy updates: Exact match between vectorized and loop-based implementations

This verification ensures that performance optimizations do not introduce confounding variables into the experimental results.

### 6.3 Sources of Error
* **Floating Point Drift:** Despite CUDA optimization, minor floating-point differences can occur over millions of calculations. This was mitigated by using double-precision floats where possible.
* **Simulation Simplification:** The "Petri Dish" is a simplified model of reality. Complex physical interactions (like friction) were idealized.

---

## 7. Conclusion

> **⚠️ UPDATE REQUIRED** - Replace the percentage below with the actual `convergenceImprovement` value from the EvoNash dashboard. If the hypothesis was not supported by data, revise the conclusion accordingly.

This project investigated whether biological principles—specifically stress-induced mutagenesis—can be applied to artificial neural networks to improve training efficiency. The **EvoNash** platform was designed to test whether an Adaptive Mutation strategy accelerates convergence to a Nash Equilibrium compared to static methods.

**[INSERT ACTUAL CONCLUSION BASED ON DATA]**

If hypothesis was supported:
> "The experimental data demonstrated that the Adaptive Mutation strategy accelerated convergence by approximately **[CONVERGENCE_IMPROVEMENT]%** compared to static methods (p = **[P_VALUE]**). This has significant implications for training large AI models on consumer hardware."

If hypothesis was not supported:
> "The experimental data did not support the hypothesis at the α = 0.05 significance level. Further investigation may be needed to understand the conditions under which adaptive mutation strategies are effective."

---

*Example placeholder conclusion (40% improvement) should be replaced with actual measured values.*

---

## 8. Acknowledgements & References
1.  **Sutton, R. S., & Barto, A. G.** (2018). *Reinforcement Learning: An Introduction*. MIT Press.
2.  **Nash, J.** (1950). *Equilibrium points in n-person games*. Proceedings of the National Academy of Sciences.
3.  **PyTorch Foundation.** (2024). *PyTorch Documentation & CUDA Semantics*.
4.  **Dawkins, R.** (1976). *The Selfish Gene*. Oxford University Press. (For concepts of ESS).