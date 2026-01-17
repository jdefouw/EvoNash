"""
Genetic Algorithm implementation with STATIC and ADAPTIVE mutation modes.
"""

import numpy as np
import torch
import torch.nn as nn
from typing import List, Tuple, Optional
from ..experiments.experiment_manager import ExperimentConfig


class NeuralNetwork(nn.Module):
    """Neural network for game agent."""
    
    def __init__(self, input_size: int, hidden_layers: List[int], output_size: int):
        super(NeuralNetwork, self).__init__()
        layers = []
        prev_size = input_size
        
        for hidden_size in hidden_layers:
            layers.append(nn.Linear(prev_size, hidden_size))
            layers.append(nn.ReLU())
            prev_size = hidden_size
        
        layers.append(nn.Linear(prev_size, output_size))
        self.network = nn.Sequential(*layers)
    
    def forward(self, x):
        return self.network(x)
    
    def get_weights(self) -> np.ndarray:
        """Get all weights as a flattened numpy array."""
        weights = []
        for param in self.parameters():
            weights.append(param.data.cpu().numpy().flatten())
        return np.concatenate(weights)
    
    def set_weights(self, weights: np.ndarray):
        """Set weights from a flattened numpy array."""
        idx = 0
        for param in self.parameters():
            size = param.data.numel()
            param.data = torch.from_numpy(
                weights[idx:idx+size].reshape(param.data.shape)
            ).float()
            idx += size


class Agent:
    """Represents a single agent in the population."""
    
    def __init__(
        self,
        network: NeuralNetwork,
        elo_rating: float = 1500.0,
        fitness_score: float = 0.0,
        parent_elo: Optional[float] = None
    ):
        self.network = network
        self.elo_rating = elo_rating
        self.fitness_score = fitness_score
        self.parent_elo = parent_elo
        self.mutation_rate_applied: Optional[float] = None


class GeneticAlgorithm:
    """Genetic Algorithm with STATIC and ADAPTIVE mutation modes."""
    
    def __init__(self, config: ExperimentConfig, device: str = 'cuda'):
        """
        Initialize Genetic Algorithm.
        
        Args:
            config: Experiment configuration
            device: Device to run on ('cuda' or 'cpu')
        """
        self.config = config
        self.device = device if torch.cuda.is_available() and device == 'cuda' else 'cpu'
        
        # Set random seed for reproducibility
        np.random.seed(config.random_seed)
        torch.manual_seed(config.random_seed)
        if torch.cuda.is_available():
            torch.cuda.manual_seed(config.random_seed)
        
        # Initialize population
        self.population: List[Agent] = []
        self._initialize_population()
    
    def _initialize_population(self):
        """Initialize population with random neural networks."""
        arch = self.config.network_architecture
        self.population = []
        
        for i in range(self.config.population_size):
            network = NeuralNetwork(
                arch['input_size'],
                arch['hidden_layers'],
                arch['output_size']
            ).to(self.device)
            
            # Initialize with random weights
            for param in network.parameters():
                nn.init.normal_(param, mean=0.0, std=0.1)
            
            agent = Agent(network)
            self.population.append(agent)
    
    def calculate_population_diversity(self) -> float:
        """
        Calculate average Euclidean distance between weight vectors.
        
        Returns:
            Average Euclidean distance (population diversity)
        """
        if len(self.population) < 2:
            return 0.0
        
        weights_list = [agent.network.get_weights() for agent in self.population]
        distances = []
        
        for i in range(len(weights_list)):
            for j in range(i + 1, len(weights_list)):
                dist = np.linalg.norm(weights_list[i] - weights_list[j])
                distances.append(dist)
        
        return np.mean(distances) if distances else 0.0
    
    def select_parents(self) -> List[Agent]:
        """
        Select top k% of population based on fitness.
        
        Returns:
            List of selected parent agents
        """
        # Sort by fitness (descending)
        sorted_population = sorted(
            self.population,
            key=lambda a: a.fitness_score,
            reverse=True
        )
        
        # Select top k%
        num_parents = int(len(self.population) * self.config.selection_pressure)
        return sorted_population[:num_parents]
    
    def crossover(self, parent_a: Agent, parent_b: Agent) -> Agent:
        """
        Create offspring by mixing parent weights.
        
        Args:
            parent_a: First parent agent
            parent_b: Second parent agent
            
        Returns:
            New offspring agent
        """
        weights_a = parent_a.network.get_weights()
        weights_b = parent_b.network.get_weights()
        
        # Uniform crossover: randomly choose weights from each parent
        mask = np.random.random(len(weights_a)) < 0.5
        offspring_weights = np.where(mask, weights_a, weights_b)
        
        # Create new network
        arch = self.config.network_architecture
        network = NeuralNetwork(
            arch['input_size'],
            arch['hidden_layers'],
            arch['output_size']
        ).to(self.device)
        
        network.set_weights(offspring_weights)
        
        # Use average of parent Elo ratings
        parent_elo = (parent_a.elo_rating + parent_b.elo_rating) / 2.0
        
        return Agent(network, parent_elo=parent_elo, elo_rating=parent_elo)
    
    def mutate(self, agent: Agent) -> Agent:
        """
        Mutate agent based on mutation mode.
        
        Args:
            agent: Agent to mutate
            
        Returns:
            Mutated agent (modifies in place, returns for convenience)
        """
        # Calculate mutation rate
        if self.config.mutation_mode == 'STATIC':
            mutation_rate = self.config.get_mutation_rate(0)  # Not used in STATIC
        else:  # ADAPTIVE
            parent_elo = agent.parent_elo if agent.parent_elo is not None else agent.elo_rating
            mutation_rate = self.config.get_mutation_rate(parent_elo)
        
        agent.mutation_rate_applied = mutation_rate
        
        # Apply mutation
        with torch.no_grad():
            for param in agent.network.parameters():
                noise = torch.randn_like(param) * mutation_rate
                param.add_(noise)
        
        return agent
    
    def evolve_generation(self):
        """
        Evolve one generation:
        1. Select parents
        2. Create offspring via crossover
        3. Mutate offspring
        4. Replace population
        """
        parents = self.select_parents()
        new_population = []
        
        # Keep some elite (top performers)
        elite_size = int(len(self.population) * 0.1)  # Top 10%
        new_population.extend(parents[:elite_size])
        
        # Generate offspring
        while len(new_population) < self.config.population_size:
            # Select two random parents
            parent_a = np.random.choice(parents)
            parent_b = np.random.choice(parents)
            
            # Crossover
            offspring = self.crossover(parent_a, parent_b)
            
            # Mutate
            offspring = self.mutate(offspring)
            
            new_population.append(offspring)
        
        self.population = new_population[:self.config.population_size]
    
    def get_generation_stats(self) -> dict:
        """
        Calculate statistics for current generation.
        
        Returns:
            Dictionary with generation statistics
        """
        elo_ratings = [agent.elo_rating for agent in self.population]
        fitness_scores = [agent.fitness_score for agent in self.population]
        mutation_rates = [
            agent.mutation_rate_applied or 0.0
            for agent in self.population
        ]
        
        return {
            'avg_elo': np.mean(elo_ratings),
            'peak_elo': np.max(elo_ratings),
            'avg_fitness': np.mean(fitness_scores),
            'mutation_rate': np.mean(mutation_rates) if mutation_rates else 0.0,
            'population_diversity': self.calculate_population_diversity()
        }
