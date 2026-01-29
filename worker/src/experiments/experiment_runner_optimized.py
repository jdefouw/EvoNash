"""
Optimized Experiment Runner with GPU-accelerated batched operations.
Uses vectorized operations and batched neural network inference.

Key optimizations:
- TensorBuffers: Pre-allocated tensors reused across ticks (eliminates allocation overhead)
- CUDA Graphs: Capture and replay simulation loops (reduces kernel launch overhead)
- BatchedNetworkEnsemble: True batched neural network inference
- Analytical raycasting: Direct geometric calculations instead of step sampling
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


# Nash Equilibrium Detection Constants
CONVERGENCE_THRESHOLD = 0.01  # Entropy variance threshold for detecting convergence
STABILITY_WINDOW = 20  # Consecutive generations below threshold required to confirm convergence
POST_CONVERGENCE_BUFFER = 30  # Additional generations to run after convergence for post-equilibrium data
ENABLE_EARLY_STOPPING = True  # Set to False to disable early stopping


class TensorBuffers:
    """
    Pre-allocated tensor buffers for reuse across simulation ticks.
    
    Eliminates per-tick allocation overhead by reusing memory.
    All tensors are allocated once at initialization and reused throughout the generation.
    """
    
    def __init__(self, num_agents: int, num_rays: int = 8, input_size: int = 24, device: str = 'cuda'):
        """
        Initialize pre-allocated tensor buffers.
        
        Args:
            num_agents: Number of agents in population
            num_rays: Number of raycast rays per agent
            input_size: Neural network input size
            device: Device for tensor allocation
        """
        self.device = device if torch.cuda.is_available() and device == 'cuda' else 'cpu'
        self.num_agents = num_agents
        self.num_rays = num_rays
        self.input_size = input_size
        
        # Raycast results buffer: (num_agents, num_rays, 4)
        # [wall_dist, food_dist, enemy_dist, enemy_size]
        self.raycast_results = torch.zeros(
            (num_agents, num_rays, 4), dtype=torch.float32, device=self.device
        )
        
        # Neural network input buffer: (num_agents, input_size)
        self.input_vectors = torch.zeros(
            (num_agents, input_size), dtype=torch.float32, device=self.device
        )
        
        # Action output buffer: (num_agents, 4)
        # [thrust, turn, shoot, split]
        self.action_outputs = torch.zeros(
            (num_agents, 4), dtype=torch.float32, device=self.device
        )
        
        # Fitness scores buffer: (num_agents,)
        self.fitness_scores = torch.zeros(num_agents, dtype=torch.float32, device=self.device)
        
        # Energy update buffer (for food consumption)
        self.energy_updates = torch.zeros(num_agents, dtype=torch.float32, device=self.device)
        
        # Temporary buffers for raycast calculations
        self.ray_dx = torch.zeros((num_agents, num_rays), dtype=torch.float32, device=self.device)
        self.ray_dy = torch.zeros((num_agents, num_rays), dtype=torch.float32, device=self.device)
        
        # Pre-compute raycast angles (fixed across simulation)
        angles_deg = np.linspace(0, 360, num_rays)
        angles_rad = np.radians(angles_deg)
        self.raycast_angles = torch.tensor(angles_rad, dtype=torch.float32, device=self.device)
    
    def resize(self, num_agents: int):
        """Resize buffers if population size changes."""
        if num_agents == self.num_agents:
            return
        
        self.num_agents = num_agents
        self.raycast_results = torch.zeros(
            (num_agents, self.num_rays, 4), dtype=torch.float32, device=self.device
        )
        self.input_vectors = torch.zeros(
            (num_agents, self.input_size), dtype=torch.float32, device=self.device
        )
        self.action_outputs = torch.zeros(
            (num_agents, 4), dtype=torch.float32, device=self.device
        )
        self.fitness_scores = torch.zeros(num_agents, dtype=torch.float32, device=self.device)
        self.energy_updates = torch.zeros(num_agents, dtype=torch.float32, device=self.device)
        self.ray_dx = torch.zeros((num_agents, self.num_rays), dtype=torch.float32, device=self.device)
        self.ray_dy = torch.zeros((num_agents, self.num_rays), dtype=torch.float32, device=self.device)


class CUDAGraphManager:
    """
    Manages CUDA graph capture and replay for simulation loops.
    
    CUDA graphs reduce kernel launch overhead by capturing a sequence of operations
    and replaying them as a single unit. This is especially beneficial when the
    same operations are repeated many times (like in simulation ticks).
    """
    
    def __init__(self, enabled: bool = True, warmup_iterations: int = 3):
        """
        Initialize CUDA graph manager.
        
        Args:
            enabled: Whether to use CUDA graphs
            warmup_iterations: Number of warmup iterations before capture
        """
        self.enabled = enabled and torch.cuda.is_available()
        self.warmup_iterations = warmup_iterations
        self.graph = None
        self.static_inputs = {}
        self.static_outputs = {}
        self.is_captured = False
        self.warmup_count = 0
    
    def should_capture(self) -> bool:
        """Check if we should capture the graph now."""
        if not self.enabled or self.is_captured:
            return False
        self.warmup_count += 1
        return self.warmup_count == self.warmup_iterations
    
    def capture_begin(self):
        """Begin capturing CUDA graph."""
        if not self.enabled:
            return
        self.graph = torch.cuda.CUDAGraph()
        return torch.cuda.graph(self.graph)
    
    def capture_end(self):
        """End graph capture."""
        self.is_captured = True
    
    def replay(self):
        """Replay captured graph."""
        if self.graph is not None:
            self.graph.replay()
    
    def reset(self):
        """Reset for new generation."""
        self.graph = None
        self.is_captured = False
        self.warmup_count = 0


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
        generation_end: Optional[int] = None,
        checkpoint_callback: Optional[Callable[[Dict], None]] = None,
        generation_check_callback: Optional[Callable[[int], bool]] = None,
        checkpoint_loader_callback: Optional[Callable[[int], Optional[Dict]]] = None,
        equilibrium_reached_callback: Optional[Callable[[int], None]] = None
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
            checkpoint_callback: Optional callback to save checkpoints
            generation_check_callback: Optional callback to check if generation already exists
            checkpoint_loader_callback: Optional callback to load checkpoints (takes gen_num, returns state dict or None)
            equilibrium_reached_callback: Optional callback when Nash equilibrium is detected (takes convergence_generation)
        """
        self.config = config
        self.device = device if torch.cuda.is_available() and device == 'cuda' else 'cpu'
        self.upload_callback = upload_callback
        self.stop_check_callback = stop_check_callback
        self.checkpoint_callback = checkpoint_callback
        self.generation_check_callback = generation_check_callback
        self.checkpoint_loader_callback = checkpoint_loader_callback
        self.equilibrium_reached_callback = equilibrium_reached_callback
        self.generation_start = generation_start
        self.generation_end = generation_end if generation_end is not None else (config.max_generations - 1)
        
        # Set random seeds
        self._set_seeds(config.random_seed)
        
        # Initialize components
        self.ga = GeneticAlgorithm(config, device=self.device)
        
        # Note: Population state will be loaded after initialization if checkpoint is provided
        # This is done in worker_service.py after runner creation
        
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
        
        # Initialize pre-allocated tensor buffers
        self.tensor_buffers = TensorBuffers(
            num_agents=config.population_size,
            num_rays=8,
            input_size=24,
            device=self.device
        )
        
        # Initialize CUDA graph manager (disabled by default for stability)
        # Can be enabled for additional 10-20% speedup after testing
        self.cuda_graph_manager = CUDAGraphManager(enabled=False)
        
        # Pre-allocate raycast config (avoid dict creation per tick)
        self._raycast_config = {
            'count': 8,
            'max_distance': 200.0,
            'angles': np.linspace(0, 360, 8)
        }
        
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
            # Pre-warm CUDA for more accurate first-generation timing
            torch.cuda.synchronize()
    
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
        
        Key optimizations used:
        - Pre-allocated tensor buffers (TensorBuffers class)
        - True batched neural network inference (BatchedNetworkEnsemble)
        - Analytical raycasting (O(1) per ray vs O(steps))
        - Fully vectorized food consumption (no Python loops)
        - Minimal CPU-GPU synchronization
        
        Returns:
            Dictionary with simulation results
        """
        start_time = time.time()
        
        agents = self.ga.population
        num_agents = len(agents)
        
        # Resize buffers if population changed
        self.tensor_buffers.resize(num_agents)
        
        # Reset petri dish and food tensors
        self.petri_dish.reset()
        
        # Initialize agent positions directly on GPU (avoid CPU-GPU sync)
        # Generate random positions on GPU
        with torch.no_grad():
            self.vectorized_physics.positions[:, 0] = torch.rand(
                num_agents, device=self.device
            ) * self.petri_dish.width
            self.vectorized_physics.positions[:, 1] = torch.rand(
                num_agents, device=self.device
            ) * self.petri_dish.height
            self.vectorized_physics.velocities.zero_()
            self.vectorized_physics.angles = torch.rand(
                num_agents, device=self.device
            ) * (2 * np.pi)
            self.vectorized_physics.energies.fill_(self.petri_dish.initial_energy)
            self.vectorized_physics.shoot_cooldowns.zero_()
            self.vectorized_physics.split_cooldowns.zero_()
            self.vectorized_physics.active_mask.fill_(True)
        
        total_ticks = self.petri_dish.ticks_per_generation
        
        print(f"  [SIM] Starting optimized simulation: {num_agents} agents, {total_ticks} ticks on {self.device}")
        
        # Cache frequently accessed values
        dt = self.petri_dish.dt
        friction = self.petri_dish.friction
        max_velocity = self.petri_dish.max_velocity
        energy_decay_rate = self.petri_dish.energy_decay_rate
        thrust_force = self.petri_dish.thrust_force
        turn_rate = self.petri_dish.turn_rate
        width = self.petri_dish.width
        height = self.petri_dish.height
        toroidal = self.petri_dish.toroidal
        
        # Food check frequency
        food_check_interval = 5
        
        # Main simulation loop - optimized for GPU
        for tick in range(total_ticks):
            # Get active agents mask (reference, not copy)
            active_mask = self.vectorized_physics.active_mask
            
            # Early exit if all agents dead
            if not active_mask.any():
                break
            
            # Batch raycast for all agents (analytical method)
            raycast_results = self.petri_dish.batch_raycast(
                agent_positions=self.vectorized_physics.positions,
                agent_angles=self.vectorized_physics.angles,
                raycast_config=self._raycast_config,
                active_mask=active_mask
            )
            
            # Batch create input vectors
            input_vectors = self.petri_dish.batch_get_input_vectors(
                raycast_data=raycast_results,
                agent_energies=self.vectorized_physics.energies,
                agent_velocities=torch.norm(self.vectorized_physics.velocities, dim=1),
                agent_cooldowns=self.vectorized_physics.shoot_cooldowns
            )
            
            # TRUE BATCHED neural network inference
            # This is the major optimization - single batched forward pass for all agents
            with torch.amp.autocast('cuda', enabled=(self.device == 'cuda')):
                action_tensor = self.batched_processor.batch_act(input_vectors, active_mask=active_mask)
            
            # Apply physics step (fully vectorized)
            self.vectorized_physics.apply_physics_step(
                actions=action_tensor,
                dt=dt,
                friction=friction,
                max_velocity=max_velocity,
                energy_decay=energy_decay_rate,
                thrust_force=thrust_force,
                turn_rate=turn_rate
            )
            
            # Wrap positions (fully vectorized)
            self.vectorized_physics.wrap_positions(width, height, toroidal)
            
            # Food consumption check (vectorized, no Python loops)
            if tick % food_check_interval == 0:
                updated_energies, food_consumed_mask = self.petri_dish.batch_check_food_consumption(
                    agent_positions=self.vectorized_physics.positions,
                    agent_energies=self.vectorized_physics.energies,
                    active_mask=active_mask
                )
                
                # Update energies directly on GPU
                self.vectorized_physics.energies = updated_energies
                
                # Update food consumed status (vectorized tensor update)
                if food_consumed_mask.any():
                    # Update food_consumed tensor directly
                    self.petri_dish.food_consumed = self.petri_dish.food_consumed | food_consumed_mask
                
                # Update active mask
                self.vectorized_physics.active_mask = self.vectorized_physics.energies > 0.0
        
        # Final food check
        updated_energies, food_consumed_mask = self.petri_dish.batch_check_food_consumption(
            agent_positions=self.vectorized_physics.positions,
            agent_energies=self.vectorized_physics.energies,
            active_mask=self.vectorized_physics.active_mask
        )
        self.vectorized_physics.energies = updated_energies
        if food_consumed_mask.any():
            self.petri_dish.food_consumed = self.petri_dish.food_consumed | food_consumed_mask
        
        # Calculate fitness on GPU
        self.tensor_buffers.fitness_scores = self.vectorized_physics.energies + (
            total_ticks * (self.vectorized_physics.energies > 0).float()
        )
        
        # Sync to agents only at end (single CPU transfer)
        self.vectorized_physics.sync_to_agents(agents)
        
        # Set fitness scores
        fitness_cpu = self.tensor_buffers.fitness_scores.cpu().numpy()
        for i, agent in enumerate(agents):
            agent.fitness_score = float(fitness_cpu[i])
        
        sim_time = time.time() - start_time
        survivors = int(self.vectorized_physics.active_mask.sum().item())
        avg_energy = float(self.vectorized_physics.energies.mean().item())
        
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
        exp_name = self.config.experiment_name
        
        # Simulate generation
        print(f"\n[{exp_name}] [GEN {self.current_generation}] Step 1/3: Running optimized Petri Dish simulation...")
        sim_results = self._simulate_generation_optimized()
        
        # Run Elo matches
        print(f"[{exp_name}] [GEN {self.current_generation}] Step 2/3: Running Elo matches...")
        elo_start = time.time()
        self._run_elo_matches(num_matches=100)
        elo_time = time.time() - elo_start
        print(f"  [ELO] Elo matches complete in {elo_time:.2f}s")
        
        # Get generation statistics
        print(f"[{exp_name}] [GEN {self.current_generation}] Step 3/3: Calculating statistics...")
        stats_start = time.time()
        sample_inputs = torch.randn(100, 24, device=self.device, dtype=torch.float16 if self.device == 'cuda' else torch.float32)
        with torch.amp.autocast('cuda', enabled=(self.device == 'cuda')):
            stats = self.ga.get_generation_stats(sample_inputs=sample_inputs)
        stats_time = time.time() - stats_start
        print(f"  [STATS] Statistics calculated in {stats_time:.2f}s")
        
        # Add generation number
        stats['generation'] = self.current_generation
        stats['population_size'] = len(self.ga.population)
        
        # Ensure JSON serializable
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
        
        # Save checkpoint BEFORE upload so that when gen N is in DB, checkpoint N exists for resume
        if self.checkpoint_callback:
            try:
                population_state = self.ga.save_population_state(
                    experiment_id=self.config.experiment_id,
                    generation=self.current_generation
                )
                self.checkpoint_callback(population_state)
                print(f"[GENERATION {self.current_generation}] ✓ Checkpoint saved")
            except Exception as e:
                print(f"[GENERATION {self.current_generation}] ✗ Checkpoint save failed: {e}")
        
        # Upload if callback provided (after checkpoint so resume has correct population state)
        if self.upload_callback:
            try:
                self.upload_callback(stats)
            except Exception as e:
                print(f"[GENERATION {self.current_generation}] ✗ Upload callback failed: {e}")
        
        # Evolve to next generation
        self.ga.evolve_generation()
        
        # CRITICAL: Sync batched processor with new population weights
        # This updates the stacked weight tensors used for true batched inference
        self.batched_processor.sync_networks(self.ga.population)
        
        # Reset CUDA graph manager for new generation
        self.cuda_graph_manager.reset()
        
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
        print(f"Early stopping: {'ENABLED' if ENABLE_EARLY_STOPPING else 'DISABLED'}")
        print(f"{'='*80}\n")
        
        stopped = False
        early_stopped = False
        experiment_start_time = time.time()
        
        # Nash Equilibrium detection state
        has_diverged = False  # Must diverge before we can detect convergence
        stability_counter = 0  # Count consecutive generations below threshold
        convergence_detected_gen = None  # Generation where convergence was first detected
        equilibrium_notified = False  # Track if we've already notified the API
        
        exp_name = self.config.experiment_name
        
        for gen in range(self.generation_start, self.generation_end + 1):
            batch_progress = gen - self.generation_start + 1
            progress_pct = (batch_progress / num_generations) * 100
            elapsed_total = time.time() - experiment_start_time
            
            print(f"\n{'─'*80}")
            print(f"[{exp_name}] Generation {gen} (Batch: {batch_progress}/{num_generations}, {progress_pct:.1f}%)")
            print(f"Total elapsed time: {elapsed_total:.1f}s")
            print(f"{'─'*80}")
            
            # Check if generation already exists before processing
            if self.generation_check_callback:
                try:
                    if self.generation_check_callback(gen):
                        print(f"⏭️  Generation {gen} already exists in database, skipping to save GPU time")
                        # CRITICAL: Load checkpoint from this generation to get the evolved population state
                        # This is necessary because the next generation needs the evolved population from this one
                        if self.checkpoint_loader_callback:
                            try:
                                population_state = self.checkpoint_loader_callback(gen)
                                if population_state:
                                    self.ga.load_population_state(population_state)
                                    print(f"✓ Loaded checkpoint from generation {gen} to maintain population state continuity")
                                else:
                                    print(f"⚠️  Warning: No checkpoint found for generation {gen}, population state may be incorrect")
                            except Exception as checkpoint_error:
                                print(f"⚠️  Warning: Error loading checkpoint for generation {gen}: {checkpoint_error}")
                                print(f"   Population state may be incorrect for subsequent generations")
                        else:
                            print(f"⚠️  Warning: No checkpoint loader available, population state may be incorrect after skipping generation {gen}")
                        
                        # Update current generation counter
                        self.current_generation = gen + 1
                        continue
                except Exception as e:
                    print(f"Warning: Generation check callback failed: {e}, proceeding with generation")
            
            gen_start = time.time()
            stats = self.run_generation()
            gen_elapsed = time.time() - gen_start
            
            print(f"\n✓ [{exp_name}] Generation {gen} Complete (took {gen_elapsed:.2f}s)")
            print(f"  Avg Elo: {stats.get('avg_elo', 0):7.2f} | "
                  f"Peak Elo: {stats.get('peak_elo', 0):7.2f} | "
                  f"Min Elo: {stats.get('min_elo', 0):7.2f}")
            
            # Check if should stop (manual stop signal)
            if self.stop_check_callback:
                try:
                    if self.stop_check_callback():
                        print(f"\n⚠ Stop signal received after generation {gen}")
                        stopped = True
                        break
                except Exception as e:
                    print(f"Warning: Stop check callback failed: {e}")
            
            # Early stopping: detect Nash equilibrium convergence
            if ENABLE_EARLY_STOPPING and not early_stopped:
                entropy_variance = stats.get('entropy_variance', float('inf'))
                
                # First, check if population has diverged (required before convergence can be detected)
                if not has_diverged and entropy_variance >= CONVERGENCE_THRESHOLD:
                    has_diverged = True
                    print(f"  📈 Population divergence detected (entropy_variance={entropy_variance:.6f} >= {CONVERGENCE_THRESHOLD})")
                
                # Only check for convergence after divergence has occurred
                if has_diverged:
                    if entropy_variance < CONVERGENCE_THRESHOLD:
                        stability_counter += 1
                        if stability_counter >= STABILITY_WINDOW and convergence_detected_gen is None:
                            convergence_detected_gen = gen - STABILITY_WINDOW + 1
                            print(f"\n🎯 NASH EQUILIBRIUM DETECTED at generation {convergence_detected_gen}")
                            print(f"   Entropy variance stable below {CONVERGENCE_THRESHOLD} for {STABILITY_WINDOW} generations")
                            print(f"   Running {POST_CONVERGENCE_BUFFER} more generations for post-convergence data...")
                            
                            # Notify the API that equilibrium was reached
                            if self.equilibrium_reached_callback and not equilibrium_notified:
                                try:
                                    self.equilibrium_reached_callback(convergence_detected_gen)
                                    equilibrium_notified = True
                                    print(f"   ✓ Notified API of Nash equilibrium at generation {convergence_detected_gen}")
                                except Exception as e:
                                    print(f"   ⚠ Warning: Failed to notify API of equilibrium: {e}")
                    else:
                        # Reset counter if variance goes back above threshold
                        if stability_counter > 0:
                            print(f"  📉 Stability counter reset (variance {entropy_variance:.6f} >= threshold)")
                        stability_counter = 0
                
                # Check if we should stop (convergence detected + buffer complete)
                if convergence_detected_gen is not None:
                    generations_since_convergence = gen - convergence_detected_gen
                    if generations_since_convergence >= POST_CONVERGENCE_BUFFER:
                        print(f"\n✅ EARLY STOPPING: Nash equilibrium confirmed")
                        print(f"   Convergence at generation {convergence_detected_gen}")
                        print(f"   Post-convergence buffer of {POST_CONVERGENCE_BUFFER} generations complete")
                        early_stopped = True
                        break
        
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
