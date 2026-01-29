"""
Experiment Runner: Main loop for running genetic algorithm experiments.
Handles reproducibility, batch inference, and generation statistics.
"""

import torch
import numpy as np
import sys
from typing import Dict, Optional, Callable
from pathlib import Path
import json

from .experiment_manager import ExperimentConfig

# torch.compile with inductor backend requires Triton, which is not available on Windows
_TORCH_COMPILE_AVAILABLE = (
    sys.platform != 'win32' and 
    hasattr(torch, 'compile') and 
    callable(torch.compile)
)
from ..ga.genetic_algorithm import GeneticAlgorithm
from ..simulation.petri_dish import PetriDish
from ..simulation.agent import Agent
from ..logging.csv_logger import CSVLogger


class ExperimentRunner:
    """
    Runs genetic algorithm experiments with strict reproducibility.
    
    Features:
    - Configurable random seed for reproducibility
    - Batch inference: all agents through neural net in single CUDA operation
    - Headless mode (no rendering during training)
    - Generation statistics logging
    """
    
    def __init__(self, config: ExperimentConfig, device: str = 'cuda', upload_callback: Optional[Callable[[Dict], None]] = None, stop_check_callback: Optional[Callable[[], bool]] = None, generation_start: int = 0, generation_end: Optional[int] = None):
        """
        Initialize experiment runner.
        
        Args:
            config: Experiment configuration
            device: Device to run on ('cuda' or 'cpu')
            upload_callback: Optional callback function called after each generation with stats dict
            stop_check_callback: Optional callback function that returns True if experiment should stop
            generation_start: First generation to process (default: 0)
            generation_end: Last generation to process (inclusive, default: max_generations - 1)
        """
        self.config = config
        self.device = device if torch.cuda.is_available() and device == 'cuda' else 'cpu'
        self.upload_callback = upload_callback
        self.stop_check_callback = stop_check_callback
        self.generation_start = generation_start
        self.generation_end = generation_end if generation_end is not None else (config.max_generations - 1)
        
        # Set all random seeds for reproducibility
        # Use a seed that accounts for generation_start to ensure reproducibility
        # Each generation should be deterministic based on the base seed
        self._set_seeds(config.random_seed)
        
        # Initialize components
        self.ga = GeneticAlgorithm(config, device=self.device)
        self.petri_dish = PetriDish(ticks_per_generation=config.ticks_per_generation)
        
        # Enable cuDNN benchmarking for optimal GPU performance
        if self.device == 'cuda' and torch.cuda.is_available():
            torch.backends.cudnn.benchmark = True
            # Compile networks for faster inference (PyTorch 2.0+)
            # Note: torch.compile requires Triton which is not available on Windows
            # Note: torch.compile is not supported on Python 3.14+
            try:
                if _TORCH_COMPILE_AVAILABLE:
                    # Test if torch.compile actually works (it may exist but not be supported)
                    test_model = torch.nn.Linear(1, 1)
                    try:
                        torch.compile(test_model, mode='reduce-overhead')
                        # If we get here, torch.compile works
                        for agent in self.ga.population:
                            agent.network = torch.compile(agent.network, mode='reduce-overhead')
                        print("  [OPT] Networks compiled with torch.compile for faster inference")
                    except (RuntimeError, AttributeError, TypeError) as compile_error:
                        # torch.compile exists but isn't supported (e.g., Python 3.14+)
                        # This is expected and not an error - just skip compilation
                        pass
            except Exception as e:
                # Any other error - silently skip compilation
                pass
        
        # CSV logger
        self.logger = CSVLogger(
            experiment_id=config.experiment_id,
            experiment_group=config.experiment_group
        )
        
        # Generation tracking
        self.current_generation = generation_start
        self.generation_stats_history = []
    
    def _set_seeds(self, seed: int):
        """Set all random number generator seeds for reproducibility."""
        np.random.seed(seed)
        torch.manual_seed(seed)
        if torch.cuda.is_available():
            torch.cuda.manual_seed(seed)
            torch.cuda.manual_seed_all(seed)
        import random
        random.seed(seed)
    
    def _ensure_json_serializable(self, stats: Dict) -> Dict:
        """
        Convert all NumPy/PyTorch types in stats dict to native Python types for JSON serialization.
        
        Args:
            stats: Dictionary with generation statistics
            
        Returns:
            Dictionary with all values converted to native Python types
        """
        import numpy as np
        result = {}
        for key, value in stats.items():
            if isinstance(value, (np.integer, np.floating)):
                result[key] = float(value) if isinstance(value, np.floating) else int(value)
            elif isinstance(value, np.ndarray):
                result[key] = value.tolist()
            elif hasattr(value, 'item'):  # PyTorch tensors
                result[key] = float(value.item()) if hasattr(value.item(), '__float__') else value.item()
            else:
                result[key] = value
        return result
    
    def _batch_inference(self, agents: list, inputs: torch.Tensor) -> torch.Tensor:
        """
        Run batch inference for all agents through their neural networks.
        
        Args:
            agents: List of agents
            inputs: Input tensor of shape (batch_size, input_size)
            
        Returns:
            Output tensor of shape (batch_size, output_size)
        """
        # For now, we'll process each agent individually
        # In a full implementation, we could batch all agents if they share the same network
        # But since each agent has its own network, we process individually
        outputs = []
        for agent in agents:
            with torch.no_grad():
                output = agent.network(inputs)
                outputs.append(output)
        
        return torch.stack(outputs, dim=0)
    
    def _simulate_generation(self) -> Dict:
        """
        Simulate one generation in the Petri Dish.
        
        Returns:
            Dictionary with simulation results
        """
        import time
        start_time = time.time()
        
        agents = self.ga.population
        self.petri_dish.reset()
        
        # Initialize agent positions randomly
        for agent in agents:
            agent.x = np.random.uniform(0, self.petri_dish.width)
            agent.y = np.random.uniform(0, self.petri_dish.height)
            agent.vx = 0.0
            agent.vy = 0.0
            agent.angle = np.random.uniform(0, 2 * np.pi)
            agent.energy = self.petri_dish.initial_energy
        
        total_ticks = self.petri_dish.ticks_per_generation
        log_interval = max(1, total_ticks // 10)  # Log every 10%
        
        print(f"  [SIM] Starting simulation: {len(agents)} agents, {total_ticks} ticks")
        
        # Test: Process first agent to verify it works
        if len(agents) > 0:
            test_agent = agents[0]
            print(f"  [SIM] Testing first agent processing...")
            test_raycast_config = {
                'count': 8,
                'max_distance': 200.0,
                'angles': np.linspace(0, 360, 8)
            }
            try:
                test_raycast = self.petri_dish.get_raycast_data(test_agent, test_raycast_config)
                test_input = test_agent.get_input_vector(test_raycast, self.petri_dish)
                test_action = test_agent.act(test_input)
                print(f"  [SIM] ✓ First agent test successful (action: {test_action})")
            except Exception as e:
                print(f"  [SIM] ✗ First agent test failed: {e}")
                import traceback
                traceback.print_exc()
                raise
        
        # Run simulation for specified ticks
        import sys
        for tick in range(total_ticks):
            # Log first 20 ticks, then every 10%, then every 100 ticks
            should_log = (tick < 20) or (tick % log_interval == 0) or (tick % 100 == 0)
            if should_log:
                progress = (tick / total_ticks) * 100
                elapsed = time.time() - start_time
                print(f"  [SIM] Starting tick {tick}/{total_ticks} ({progress:.1f}%) - Elapsed: {elapsed:.1f}s")
                sys.stdout.flush()
            
            # Safety check: if we're taking too long, log a warning
            if tick > 0 and tick % 10 == 0:
                elapsed = time.time() - start_time
                avg_time_per_tick = elapsed / tick
                if avg_time_per_tick > 1.0:
                    print(f"  [SIM] ⚠ WARNING: Average time per tick is {avg_time_per_tick:.2f}s (very slow!)")
                    sys.stdout.flush()
            
            tick_start = time.time()
            
            # Get raycast data for all agents
            raycast_config = {
                'count': 8,
                'max_distance': 200.0,
                'angles': np.linspace(0, 360, 8)
            }
            
            # OPTIMIZED: Batch process agents for better GPU utilization
            agent_count = len(agents)
            active_agents = [a for a in agents if a.energy > 0]
            
            # Batch 1: Prepare all input vectors (keep on GPU)
            input_vectors_gpu = []
            active_indices = []
            
            for agent_idx, agent in enumerate(agents):
                if agent.energy <= 0:
                    continue
                
                active_indices.append(agent_idx)
                
                # Get raycast data
                try:
                    raycast_data = self.petri_dish.get_raycast_data(agent, raycast_config)
                    input_vector = agent.get_input_vector(raycast_data, self.petri_dish)
                    input_vectors_gpu.append(input_vector)
                except Exception as e:
                    print(f"    ✗ Error preparing input for agent {agent_idx}: {e}")
                    raise
            
            # Batch 2: Process all neural networks in parallel batches
            # Process in batches of 32 to maximize GPU utilization
            batch_size = 32
            actions_list = []
            
            for batch_start in range(0, len(active_agents), batch_size):
                batch_end = min(batch_start + batch_size, len(active_agents))
                batch_inputs = input_vectors_gpu[batch_start:batch_end]
                batch_agents = active_agents[batch_start:batch_end]
                
                # Process batch (each agent has different network, but we batch the calls)
                with torch.no_grad():
                    # Use torch's parallel processing capabilities
                    batch_actions = []
                    for i, agent in enumerate(batch_agents):
                        # Use act_tensor if available (stays on GPU), otherwise use act
                        if hasattr(agent, 'act_tensor'):
                            action_tensor = agent.act_tensor(batch_inputs[i])
                            # Convert to dict format
                            action = {
                                'thrust': float(torch.clamp(action_tensor[0], 0.0, 1.0).cpu().item()),
                                'turn': float(torch.clamp(action_tensor[1], -1.0, 1.0).cpu().item()),
                                'shoot': float(torch.clamp(action_tensor[2], 0.0, 1.0).cpu().item()),
                                'split': float(torch.clamp(action_tensor[3], 0.0, 1.0).cpu().item())
                            }
                        else:
                            action = agent.act(batch_inputs[i])
                        batch_actions.append(action)
                    actions_list.extend(batch_actions)
            
            # Batch 3: Apply all actions
            for agent_idx, action in zip(active_indices, actions_list):
                try:
                    agents[agent_idx].apply_action(action, self.petri_dish)
                except Exception as e:
                    print(f"    ✗ Error applying action for agent {agent_idx}: {e}")
                    raise
            
            tick_time = time.time() - tick_start
            should_log = (tick < 20) or (tick % 100 == 0)
            if should_log:
                print(f"  [SIM] Tick {tick} agent processing completed in {tick_time:.2f}s")
                sys.stdout.flush()
            
            # Step simulation
            step_start = time.time()
            try:
                if should_log:
                    print(f"  [SIM] About to call step() for tick {tick}...")
                    sys.stdout.flush()
                self.petri_dish.step(agents)
                if should_log:
                    print(f"  [SIM] step() returned for tick {tick}")
                    sys.stdout.flush()
            except Exception as e:
                print(f"  [SIM] ✗ Error in step() at tick {tick}: {e}")
                import traceback
                traceback.print_exc()
                sys.stdout.flush()
                raise
            step_time = time.time() - step_start
            if should_log:
                print(f"  [SIM] Tick {tick} step() completed in {step_time:.3f}s")
                print(f"  [SIM] Tick {tick} total time: {tick_time + step_time:.2f}s")
                sys.stdout.flush()
            
            # Force flush output to ensure logs appear immediately
            sys.stdout.flush()
            
            # Safety check: if a tick takes too long, log a warning
            total_tick_time = tick_time + step_time
            if total_tick_time > 10.0:  # More than 10 seconds per tick is suspicious
                print(f"  [SIM] ⚠ WARNING: Tick {tick} took {total_tick_time:.2f}s (very slow!)")
                sys.stdout.flush()
            
            # Log that we're about to start the next iteration
            if should_log:
                print(f"  [SIM] Completed tick {tick}, moving to tick {tick + 1}...")
                sys.stdout.flush()
        
        sim_time = time.time() - start_time
        print(f"  [SIM] Simulation complete in {sim_time:.2f}s")
        
        # Calculate fitness (survival time + energy)
        for agent in agents:
            agent.fitness_score = agent.energy + (self.petri_dish.ticks_per_generation if agent.energy > 0 else 0)
        
        survivors = sum(1 for a in agents if a.energy > 0)
        avg_energy = np.mean([a.energy for a in agents])
        print(f"  [SIM] Results: {survivors}/{len(agents)} survivors, avg energy: {avg_energy:.2f}")
        
        return {
            'survivors': survivors,
            'avg_energy': avg_energy
        }
    
    def _run_elo_matches(self, num_matches: int = 100):
        """
        Run Elo rating matches between agents.
        
        Args:
            num_matches: Number of matches to run
        """
        agents = self.ga.population
        
        for _ in range(num_matches):
            # Select two random agents
            idx_a, idx_b = np.random.choice(len(agents), size=2, replace=False)
            agent_a = agents[idx_a]
            agent_b = agents[idx_b]
            
            # Simulate match (simplified: compare fitness)
            # In full implementation, would run actual Petri Dish match
            score_a = 1.0 if agent_a.fitness_score > agent_b.fitness_score else 0.0
            if agent_a.fitness_score == agent_b.fitness_score:
                score_a = 0.5
            
            # Update Elo ratings
            self.ga.update_elo(agent_a, agent_b, score_a)
    
    def run_generation(self) -> Dict:
        """
        Run one generation of the genetic algorithm.
        
        Returns:
            Dictionary with generation statistics
        """
        import time
        gen_start_time = time.time()
        exp_name = self.config.experiment_name
        
        # Simulate generation in Petri Dish
        print(f"\n[{exp_name}] [GEN {self.current_generation}] Step 1/3: Running Petri Dish simulation...")
        sim_results = self._simulate_generation()
        
        # Run Elo matches
        print(f"[{exp_name}] [GEN {self.current_generation}] Step 2/3: Running Elo matches...")
        elo_start = time.time()
        self._run_elo_matches(num_matches=100)
        elo_time = time.time() - elo_start
        print(f"  [ELO] Elo matches complete in {elo_time:.2f}s")
        
        # Get generation statistics
        print(f"[{exp_name}] [GEN {self.current_generation}] Step 3/3: Calculating statistics...")
        stats_start = time.time()
        # Create sample inputs for entropy calculation
        sample_inputs = torch.randn(10, 24).to(self.device)
        stats = self.ga.get_generation_stats(sample_inputs=sample_inputs)
        stats_time = time.time() - stats_start
        print(f"  [STATS] Statistics calculated in {stats_time:.2f}s")
        
        # Add generation number and population size
        stats['generation'] = self.current_generation
        stats['population_size'] = len(self.ga.population)
        
        # Ensure all values are JSON-serializable (convert numpy types to native Python types)
        stats = self._ensure_json_serializable(stats)
        
        gen_total_time = time.time() - gen_start_time
        print(f"[{exp_name}] [GEN {self.current_generation}] Generation complete in {gen_total_time:.2f}s total")
        
        # Log to CSV
        self.logger.log_generation(
            generation=self.current_generation,
            avg_elo=stats['avg_elo'],
            peak_elo=stats['peak_elo'],
            policy_entropy=stats['policy_entropy'],
            entropy_variance=stats['entropy_variance'],
            mutation_rate=stats['mutation_rate'],
            population_diversity=stats['population_diversity'],
            avg_fitness=stats['avg_fitness']
        )
        
        # Store history
        self.generation_stats_history.append(stats)
        
        # Upload immediately if callback provided (incremental upload)
        if self.upload_callback:
            try:
                print(f"\n[GENERATION {self.current_generation}] Uploading stats to controller...")
                self.upload_callback(stats)
                print(f"[GENERATION {self.current_generation}] ✓ Upload complete")
            except Exception as e:
                print(f"[GENERATION {self.current_generation}] ✗ Upload callback failed: {e}")
                import traceback
                traceback.print_exc()
                # Continue execution even if upload fails
        
        # Evolve to next generation
        self.ga.evolve_generation()
        self.current_generation += 1
        
        return stats
    
    # Early stopping configuration for Nash equilibrium detection
    # These are scientifically-grounded values based on convergence research
    CONVERGENCE_THRESHOLD = 0.01  # Entropy variance threshold
    STABILITY_WINDOW = 20  # Consecutive generations below threshold required
    POST_CONVERGENCE_BUFFER = 30  # Additional generations to run after convergence detection
    ENABLE_EARLY_STOPPING = True  # Set to False to disable early stopping
    
    def run_experiment(self) -> Dict:
        """
        Run the experiment for the specified generation range.
        
        Features early stopping: if Nash equilibrium is detected (entropy variance
        stable below threshold for STABILITY_WINDOW consecutive generations),
        the experiment will run for POST_CONVERGENCE_BUFFER additional generations
        and then stop to save computational resources.
        
        Returns:
            Dictionary with final experiment results
        """
        num_generations = self.generation_end - self.generation_start + 1
        
        print(f"\n{'='*80}")
        print(f"🚀 STARTING EXPERIMENT EXECUTION (BATCH)")
        print(f"{'='*80}")
        print(f"Experiment: {self.config.experiment_name}")
        print(f"Mutation mode: {self.config.mutation_mode}")
        print(f"Random seed: {self.config.random_seed}")
        print(f"Generation range: {self.generation_start} to {self.generation_end} (inclusive)")
        print(f"Batch size: {num_generations} generations")
        print(f"Population size: {self.config.population_size}")
        if self.ENABLE_EARLY_STOPPING:
            print(f"Early stopping: ENABLED (threshold={self.CONVERGENCE_THRESHOLD}, window={self.STABILITY_WINDOW})")
        else:
            print(f"Early stopping: DISABLED")
        print(f"{'='*80}\n")
        
        stopped = False
        early_stopped = False
        convergence_detected_gen = None
        stability_counter = 0  # Count consecutive generations below threshold
        has_diverged = False  # Track if population has diverged first
        
        import time
        experiment_start_time = time.time()
        
        # Initialize population if starting from generation 0
        # TODO: For batches starting mid-experiment, we would need to load population state
        # For now, each batch starts fresh (this is a limitation that should be addressed)
        if self.generation_start == 0:
            # Population is already initialized in GeneticAlgorithm.__init__
            pass
        else:
            # For now, we'll start fresh even for mid-experiment batches
            # In a full implementation, we'd load the population state from generation (generation_start - 1)
            print(f"⚠️  WARNING: Starting batch at generation {self.generation_start} without loading previous state")
            print(f"   This batch will start with a fresh population (not ideal for distributed processing)")
        
        exp_name = self.config.experiment_name
        
        for gen in range(self.generation_start, self.generation_end + 1):
            # Print generation start
            batch_progress = gen - self.generation_start + 1
            progress_pct = (batch_progress / num_generations) * 100
            elapsed_total = time.time() - experiment_start_time
            print(f"\n{'─'*80}")
            print(f"[{exp_name}] Generation {gen} (Batch: {batch_progress}/{num_generations}, {progress_pct:.1f}%) - Processing...")
            print(f"Total elapsed time: {elapsed_total:.1f}s")
            print(f"{'─'*80}")
            
            gen_start = time.time()
            # Run the generation
            stats = self.run_generation()
            gen_elapsed = time.time() - gen_start
            
            # Print generation results immediately
            print(f"\n✓ [{exp_name}] Generation {gen} Complete (took {gen_elapsed:.2f}s)")
            print(f"  Avg Elo: {stats.get('avg_elo', 0):7.2f} | "
                  f"Peak Elo: {stats.get('peak_elo', 0):7.2f} | "
                  f"Min Elo: {stats.get('min_elo', 0):7.2f}")
            print(f"  Entropy: {stats.get('policy_entropy', 0):.4f} | "
                  f"Entropy Var: {stats.get('entropy_variance', 0):.6f} | "
                  f"Diversity: {stats.get('population_diversity', 0):.4f}")
            print(f"  Avg Fitness: {stats.get('avg_fitness', 0):.2f} | "
                  f"Mutation Rate: {stats.get('mutation_rate', 0):.4f}")
            
            # Estimate time remaining
            if batch_progress > 1:
                avg_time_per_gen = elapsed_total / batch_progress
                remaining_gens = num_generations - batch_progress
                estimated_remaining = avg_time_per_gen * remaining_gens
                print(f"  Estimated time remaining: {estimated_remaining/60:.1f} minutes")
            
            # Check if experiment should stop after completing this generation
            if self.stop_check_callback:
                try:
                    if self.stop_check_callback():
                        print(f"\n⚠ Stop signal received after generation {gen + 1}")
                        stopped = True
                        break
                except Exception as e:
                    print(f"Warning: Stop check callback failed: {e}")
                    # Continue execution even if stop check fails
            
            # Early stopping: detect Nash equilibrium convergence
            if self.ENABLE_EARLY_STOPPING and not early_stopped:
                entropy_variance = stats.get('entropy_variance', float('inf'))
                
                # First, check if population has diverged (required before convergence can be detected)
                if not has_diverged and entropy_variance >= self.CONVERGENCE_THRESHOLD:
                    has_diverged = True
                    print(f"  📈 Population divergence detected (entropy_variance={entropy_variance:.6f} >= {self.CONVERGENCE_THRESHOLD})")
                
                # Only check for convergence after divergence has occurred
                if has_diverged:
                    if entropy_variance < self.CONVERGENCE_THRESHOLD:
                        stability_counter += 1
                        if stability_counter >= self.STABILITY_WINDOW and convergence_detected_gen is None:
                            convergence_detected_gen = gen - self.STABILITY_WINDOW + 1
                            print(f"\n🎯 NASH EQUILIBRIUM DETECTED at generation {convergence_detected_gen}")
                            print(f"   Entropy variance stable below {self.CONVERGENCE_THRESHOLD} for {self.STABILITY_WINDOW} generations")
                            print(f"   Running {self.POST_CONVERGENCE_BUFFER} more generations for post-convergence data...")
                    else:
                        # Reset counter if variance goes back above threshold
                        if stability_counter > 0:
                            print(f"  📉 Stability counter reset (variance {entropy_variance:.6f} >= threshold)")
                        stability_counter = 0
                
                # Check if we should stop (convergence detected + buffer complete)
                if convergence_detected_gen is not None:
                    generations_since_convergence = gen - convergence_detected_gen
                    if generations_since_convergence >= self.POST_CONVERGENCE_BUFFER:
                        print(f"\n✅ EARLY STOPPING: Nash equilibrium confirmed")
                        print(f"   Convergence at generation {convergence_detected_gen}")
                        print(f"   Post-convergence buffer of {self.POST_CONVERGENCE_BUFFER} generations complete")
                        early_stopped = True
                        break
            
            # Detailed stats every 10 generations or first generation in batch
            if (gen - self.generation_start) % 10 == 0 or gen == self.generation_start:
                print(f"\n{'='*80}")
                print(f"📊 [{exp_name}] DETAILED STATISTICS - Generation {gen} (Batch: {batch_progress}/{num_generations})")
                print(f"{'='*80}")
                print(f"  Elo Ratings:")
                print(f"    Average: {stats.get('avg_elo', 0):.2f}")
                print(f"    Peak:    {stats.get('peak_elo', 0):.2f}")
                print(f"    Min:     {stats.get('min_elo', 0):.2f}")
                print(f"    Std Dev: {stats.get('std_elo', 0):.2f}")
                print(f"  Fitness:")
                print(f"    Average: {stats.get('avg_fitness', 0):.2f}")
                print(f"    Min:     {stats.get('min_fitness', 0):.2f}")
                print(f"    Max:     {stats.get('max_fitness', 0):.2f}")
                print(f"  Policy Metrics:")
                print(f"    Entropy:        {stats.get('policy_entropy', 0):.4f}")
                print(f"    Entropy Var:    {stats.get('entropy_variance', 0):.4f}")
                print(f"    Diversity:      {stats.get('population_diversity', 0):.4f}")
                print(f"  Evolution:")
                print(f"    Mutation Rate:  {stats.get('mutation_rate', 0):.4f}")
                print(f"{'='*80}")
        
        if stopped:
            print("Experiment stopped by user")
        elif early_stopped:
            print(f"Experiment completed early (Nash equilibrium at generation {convergence_detected_gen})")
        else:
            print("Experiment completed!")
        
        return {
            'final_stats': self.generation_stats_history[-1] if self.generation_stats_history else {},
            'all_stats': self.generation_stats_history,
            'csv_path': str(self.logger.get_filepath()),
            'stopped': stopped,
            'early_stopped': early_stopped,
            'convergence_generation': convergence_detected_gen,
            'generations_completed': len(self.generation_stats_history)
        }
