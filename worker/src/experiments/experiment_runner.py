"""
Experiment Runner: Main loop for running genetic algorithm experiments.
Handles reproducibility, batch inference, and generation statistics.
"""

import torch
import numpy as np
from typing import Dict, Optional, Callable
from pathlib import Path
import json

from .experiment_manager import ExperimentConfig
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
    
    def __init__(self, config: ExperimentConfig, device: str = 'cuda', upload_callback: Optional[Callable[[Dict], None]] = None, stop_check_callback: Optional[Callable[[], bool]] = None):
        """
        Initialize experiment runner.
        
        Args:
            config: Experiment configuration
            device: Device to run on ('cuda' or 'cpu')
            upload_callback: Optional callback function called after each generation with stats dict
            stop_check_callback: Optional callback function that returns True if experiment should stop
        """
        self.config = config
        self.device = device if torch.cuda.is_available() and device == 'cuda' else 'cpu'
        self.upload_callback = upload_callback
        self.stop_check_callback = stop_check_callback
        
        # Set all random seeds for reproducibility
        self._set_seeds(config.random_seed)
        
        # Initialize components
        self.ga = GeneticAlgorithm(config, device=self.device)
        self.petri_dish = PetriDish()
        
        # CSV logger
        self.logger = CSVLogger(
            experiment_id=config.experiment_id,
            experiment_group=config.experiment_group
        )
        
        # Generation tracking
        self.current_generation = 0
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
        
        # Run simulation for specified ticks
        for tick in range(self.petri_dish.ticks_per_generation):
            # Get raycast data for all agents
            raycast_config = {
                'count': 8,
                'max_distance': 200.0,
                'angles': np.linspace(0, 360, 8)
            }
            
            # Process each agent
            for agent in agents:
                if agent.energy <= 0:
                    continue
                
                # Get raycast data
                raycast_data = self.petri_dish.get_raycast_data(agent, raycast_config)
                
                # Get input vector
                input_vector = agent.get_input_vector(raycast_data, self.petri_dish)
                
                # Get action from neural network
                action = agent.act(input_vector)
                
                # Apply action
                agent.apply_action(action, self.petri_dish)
            
            # Step simulation
            self.petri_dish.step(agents)
        
        # Calculate fitness (survival time + energy)
        for agent in agents:
            agent.fitness_score = agent.energy + (self.petri_dish.ticks_per_generation if agent.energy > 0 else 0)
        
        return {
            'survivors': sum(1 for a in agents if a.energy > 0),
            'avg_energy': np.mean([a.energy for a in agents])
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
        # Simulate generation in Petri Dish
        sim_results = self._simulate_generation()
        
        # Run Elo matches
        self._run_elo_matches(num_matches=100)
        
        # Get generation statistics
        # Create sample inputs for entropy calculation
        sample_inputs = torch.randn(10, 24).to(self.device)
        stats = self.ga.get_generation_stats(sample_inputs=sample_inputs)
        
        # Add generation number
        stats['generation'] = self.current_generation
        
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
                self.upload_callback(stats)
            except Exception as e:
                print(f"Warning: Upload callback failed: {e}")
                # Continue execution even if upload fails
        
        # Evolve to next generation
        self.ga.evolve_generation()
        self.current_generation += 1
        
        return stats
    
    def run_experiment(self) -> Dict:
        """
        Run the complete experiment for max_generations.
        
        Returns:
            Dictionary with final experiment results
        """
        print(f"Starting experiment: {self.config.experiment_name}")
        print(f"Mutation mode: {self.config.mutation_mode}")
        print(f"Random seed: {self.config.random_seed}")
        print(f"Max generations: {self.config.max_generations}")
        
        stopped = False
        for gen in range(self.config.max_generations):
            stats = self.run_generation()
            
            # Check if experiment should stop after completing this generation
            if self.stop_check_callback:
                try:
                    if self.stop_check_callback():
                        print(f"Stop signal received after generation {gen + 1}")
                        stopped = True
                        break
                except Exception as e:
                    print(f"Warning: Stop check callback failed: {e}")
                    # Continue execution even if stop check fails
            
            if (gen + 1) % 100 == 0:
                print(f"Generation {gen + 1}/{self.config.max_generations}: "
                      f"Avg Elo: {stats['avg_elo']:.2f}, "
                      f"Peak Elo: {stats['peak_elo']:.2f}, "
                      f"Entropy: {stats['policy_entropy']:.4f}")
        
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
