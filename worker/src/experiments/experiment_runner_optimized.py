"""
Optimized Experiment Runner with GPU-accelerated batched operations.
Uses vectorized operations and batched neural network inference.
"""

import torch
import numpy as np
from typing import Dict, Optional, Callable
from pathlib import Path
import time

from .experiment_manager import ExperimentConfig
from ..ga.genetic_algorithm import GeneticAlgorithm
from ..simulation.petri_dish_vectorized import VectorizedPetriDish
from ..simulation.agent_batched import VectorizedPhysics, BatchedAgentProcessor
from ..simulation.agent import Agent
from ..logging.csv_logger import CSVLogger


class OptimizedExperimentRunner:
    """
    GPU-optimized experiment runner with batched operations.
    
    Key optimizations:
    - Batched neural network inference
    - Vectorized physics updates
    - Vectorized raycast operations
    - Minimal CPU-GPU transfers
    - Keep tensors on GPU throughout simulation
    """
    
    def __init__(
        self,
        config: ExperimentConfig,
        device: str = 'cuda',
        upload_callback: Optional[Callable[[Dict], None]] = None,
        stop_check_callback: Optional[Callable[[], bool]] = None,
        generation_start: int = 0,
        generation_end: Optional[int] = None
    ):
        """
        Initialize optimized experiment runner.
        
        Args:
            config: Experiment configuration
            device: Device to run on ('cuda' or 'cpu')
            upload_callback: Optional callback for generation stats
            stop_check_callback: Optional callback to check if should stop
            generation_start: First generation to process
            generation_end: Last generation to process (inclusive)
        """
        self.config = config
        self.device = device if torch.cuda.is_available() and device == 'cuda' else 'cpu'
        self.upload_callback = upload_callback
        self.stop_check_callback = stop_check_callback
        self.generation_start = generation_start
        self.generation_end = generation_end if generation_end is not None else (config.max_generations - 1)
        
        # Set random seeds
        self._set_seeds(config.random_seed)
        
        # Initialize components
        self.ga = GeneticAlgorithm(config, device=self.device)
        self.petri_dish = VectorizedPetriDish(
            ticks_per_generation=config.ticks_per_generation,
            device=self.device
        )
        
        # Initialize vectorized physics
        self.vectorized_physics = VectorizedPhysics(
            num_agents=config.population_size,
            device=self.device
        )
        
        # Initialize batched agent processor
        self.batched_processor = BatchedAgentProcessor(
            agents=self.ga.population,
            device=self.device
        )
        
        # CSV logger
        self.logger = CSVLogger(
            experiment_id=config.experiment_id,
            experiment_group=config.experiment_group
        )
        
        # Generation tracking
        self.current_generation = generation_start
        self.generation_stats_history = []
        
        # Enable cuDNN benchmarking for optimal performance
        if self.device == 'cuda':
            torch.backends.cudnn.benchmark = True
            torch.backends.cudnn.deterministic = False  # Allow non-deterministic for speed
    
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
        """Convert all NumPy/PyTorch types to native Python types."""
        result = {}
        for key, value in stats.items():
            if isinstance(value, (np.integer, np.floating)):
                result[key] = float(value) if isinstance(value, np.floating) else int(value)
            elif isinstance(value, np.ndarray):
                result[key] = value.tolist()
            elif isinstance(value, torch.Tensor):
                result[key] = float(value.item()) if value.numel() == 1 else value.cpu().numpy().tolist()
            elif hasattr(value, 'item'):
                result[key] = float(value.item())
            else:
                result[key] = value
        return result
    
    def _simulate_generation_optimized(self) -> Dict:
        """
        Optimized simulation using batched GPU operations.
        
        Returns:
            Dictionary with simulation results
        """
        start_time = time.time()
        
        agents = self.ga.population
        num_agents = len(agents)
        self.petri_dish.reset()
        
        # Initialize agent positions randomly (on CPU, then sync to GPU)
        for agent in agents:
            agent.x = np.random.uniform(0, self.petri_dish.width)
            agent.y = np.random.uniform(0, self.petri_dish.height)
            agent.vx = 0.0
            agent.vy = 0.0
            agent.angle = np.random.uniform(0, 2 * np.pi)
            agent.energy = self.petri_dish.initial_energy
        
        # Sync agent state to GPU tensors
        self.vectorized_physics.sync_from_agents(agents)
        
        total_ticks = self.petri_dish.ticks_per_generation
        raycast_config = {
            'count': 8,
            'max_distance': 200.0,
            'angles': np.linspace(0, 360, 8)
        }
        
        print(f"  [SIM] Starting optimized simulation: {num_agents} agents, {total_ticks} ticks on {self.device}")
        
        # Pre-allocate tensors to avoid repeated allocations
        raycast_results = None
        
        for tick in range(total_ticks):
            # Get active agents mask
            active_mask = self.vectorized_physics.active_mask
            
            if not active_mask.any():
                break  # All agents dead
            
            # Batch raycast for all agents
            raycast_results = self.petri_dish.batch_raycast(
                agent_positions=self.vectorized_physics.positions,
                agent_angles=self.vectorized_physics.angles,
                raycast_config=raycast_config,
                active_mask=active_mask
            )
            
            # Batch create input vectors
            input_vectors = self.petri_dish.batch_get_input_vectors(
                raycast_data=raycast_results,
                agent_energies=self.vectorized_physics.energies,
                agent_velocities=torch.norm(self.vectorized_physics.velocities, dim=1),
                agent_cooldowns=self.vectorized_physics.shoot_cooldowns
            )
            
            # Batch neural network inference
            # Since each agent has its own network, we process in batches
            # But we can still optimize by processing multiple agents at once
            action_tensor = torch.zeros((num_agents, 4), dtype=torch.float32, device=self.device)
            
            # Process agents in batches for efficiency
            batch_size = 32  # Process 32 agents at a time
            with torch.no_grad():
                for i in range(0, num_agents, batch_size):
                    batch_end = min(i + batch_size, num_agents)
                    batch_inputs = input_vectors[i:batch_end]
                    
                    # Process each agent's network (they're different after evolution)
                    for j, agent in enumerate(agents[i:batch_end]):
                        if active_mask[i + j]:
                            agent_output = agent.network(batch_inputs[j:j+1])
                            action_tensor[i + j] = agent_output.squeeze(0)
            
            # Apply actions using vectorized physics
            self.vectorized_physics.apply_physics_step(
                actions=action_tensor,
                dt=self.petri_dish.dt,
                friction=self.petri_dish.friction,
                max_velocity=self.petri_dish.max_velocity,
                energy_decay=self.petri_dish.energy_decay_rate,
                thrust_force=self.petri_dish.thrust_force,
                turn_rate=self.petri_dish.turn_rate
            )
            
            # Wrap positions
            self.vectorized_physics.wrap_positions(
                width=self.petri_dish.width,
                height=self.petri_dish.height,
                toroidal=self.petri_dish.toroidal
            )
            
            # Handle food consumption (still need to do this, but can optimize)
            # For now, sync back to agents for food consumption check
            if tick % 10 == 0:  # Only sync every 10 ticks to reduce overhead
                self.vectorized_physics.sync_to_agents(agents)
                self.petri_dish.step(agents)  # Handle food, projectiles
                self.vectorized_physics.sync_from_agents(agents)
            else:
                # Just update food tensors
                self.petri_dish._update_food_tensors()
        
        # Final sync
        self.vectorized_physics.sync_to_agents(agents)
        
        # Final food check
        self.petri_dish.step(agents)
        
        # Calculate fitness
        for agent in agents:
            agent.fitness_score = agent.energy + (self.petri_dish.ticks_per_generation if agent.energy > 0 else 0)
        
        sim_time = time.time() - start_time
        survivors = sum(1 for a in agents if a.energy > 0)
        avg_energy = np.mean([a.energy for a in agents])
        
        print(f"  [SIM] Optimized simulation complete in {sim_time:.2f}s")
        print(f"  [SIM] Results: {survivors}/{num_agents} survivors, avg energy: {avg_energy:.2f}")
        
        return {
            'survivors': survivors,
            'avg_energy': avg_energy
        }
    
    def _run_elo_matches(self, num_matches: int = 100):
        """Run Elo rating matches between agents."""
        agents = self.ga.population
        
        for _ in range(num_matches):
            idx_a, idx_b = np.random.choice(len(agents), size=2, replace=False)
            agent_a = agents[idx_a]
            agent_b = agents[idx_b]
            
            score_a = 1.0 if agent_a.fitness_score > agent_b.fitness_score else 0.0
            if agent_a.fitness_score == agent_b.fitness_score:
                score_a = 0.5
            
            self.ga.update_elo(agent_a, agent_b, score_a)
    
    def run_generation(self) -> Dict:
        """Run one generation with optimized GPU operations."""
        gen_start_time = time.time()
        
        # Simulate generation
        print(f"\n[GEN {self.current_generation}] Step 1/3: Running optimized Petri Dish simulation...")
        sim_results = self._simulate_generation_optimized()
        
        # Run Elo matches
        print(f"[GEN {self.current_generation}] Step 2/3: Running Elo matches...")
        elo_start = time.time()
        self._run_elo_matches(num_matches=100)
        elo_time = time.time() - elo_start
        print(f"  [ELO] Elo matches complete in {elo_time:.2f}s")
        
        # Get generation statistics
        print(f"[GEN {self.current_generation}] Step 3/3: Calculating statistics...")
        stats_start = time.time()
        sample_inputs = torch.randn(100, 24, device=self.device)
        stats = self.ga.get_generation_stats(sample_inputs=sample_inputs)
        stats_time = time.time() - stats_start
        print(f"  [STATS] Statistics calculated in {stats_time:.2f}s")
        
        # Add generation number
        stats['generation'] = self.current_generation
        stats['population_size'] = len(self.ga.population)
        
        # Ensure JSON serializable
        stats = self._ensure_json_serializable(stats)
        
        gen_total_time = time.time() - gen_start_time
        print(f"[GEN {self.current_generation}] Generation complete in {gen_total_time:.2f}s total")
        
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
        
        # Upload if callback provided
        if self.upload_callback:
            try:
                self.upload_callback(stats)
            except Exception as e:
                print(f"[GENERATION {self.current_generation}] ✗ Upload callback failed: {e}")
        
        # Evolve to next generation
        self.ga.evolve_generation()
        self.current_generation += 1
        
        return stats
    
    def run_experiment(self) -> Dict:
        """Run the experiment for the specified generation range."""
        num_generations = self.generation_end - self.generation_start + 1
        
        print(f"\n{'='*80}")
        print(f"🚀 STARTING OPTIMIZED GPU EXPERIMENT EXECUTION")
        print(f"{'='*80}")
        print(f"Experiment: {self.config.experiment_name}")
        print(f"Device: {self.device}")
        print(f"Generation range: {self.generation_start} to {self.generation_end} (inclusive)")
        print(f"Batch size: {num_generations} generations")
        print(f"Population size: {self.config.population_size}")
        print(f"{'='*80}\n")
        
        stopped = False
        experiment_start_time = time.time()
        
        for gen in range(self.generation_start, self.generation_end + 1):
            batch_progress = gen - self.generation_start + 1
            progress_pct = (batch_progress / num_generations) * 100
            elapsed_total = time.time() - experiment_start_time
            
            print(f"\n{'─'*80}")
            print(f"Generation {gen} (Batch: {batch_progress}/{num_generations}, {progress_pct:.1f}%)")
            print(f"Total elapsed time: {elapsed_total:.1f}s")
            print(f"{'─'*80}")
            
            gen_start = time.time()
            stats = self.run_generation()
            gen_elapsed = time.time() - gen_start
            
            print(f"\n✓ Generation {gen} Complete (took {gen_elapsed:.2f}s)")
            print(f"  Avg Elo: {stats.get('avg_elo', 0):7.2f} | "
                  f"Peak Elo: {stats.get('peak_elo', 0):7.2f} | "
                  f"Min Elo: {stats.get('min_elo', 0):7.2f}")
            
            # Check if should stop
            if self.stop_check_callback:
                try:
                    if self.stop_check_callback():
                        print(f"\n⚠ Stop signal received after generation {gen}")
                        stopped = True
                        break
                except Exception as e:
                    print(f"Warning: Stop check callback failed: {e}")
        
        if stopped:
            print("Experiment stopped by user")
        else:
            print("Experiment completed!")
        
        return {
            'final_stats': self.generation_stats_history[-1] if self.generation_stats_history else {},
            'all_stats': self.generation_stats_history,
            'csv_path': str(self.logger.get_filepath()),
            'stopped': stopped
        }
