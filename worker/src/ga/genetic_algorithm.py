"""
Genetic Algorithm implementation with STATIC and ADAPTIVE mutation modes.
Implements Elo rating system and policy entropy calculation.
"""

import numpy as np
import torch
from typing import List, Tuple, Optional
from ..simulation.agent import Agent, NeuralNetwork
from ..experiments.experiment_manager import ExperimentConfig


class GeneticAlgorithm:
    """
    Genetic Algorithm with STATIC and ADAPTIVE mutation modes.
    
    Features:
    - Population initialization (N=1000)
    - Selection: Top 20% (selection_pressure)
    - Crossover: Uniform weight mixing
    - Mutation: STATIC (ε=0.05) or ADAPTIVE (ε = Base × (1 - CurrentElo/MaxGlobalElo))
    - Elo rating system
    - Policy entropy calculation
    """
    
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
            torch.cuda.manual_seed_all(config.random_seed)
        import random
        random.seed(config.random_seed)
        
        # Initialize population
        self.population: List[Agent] = []
        self.max_global_elo = 1500.0  # Track max Elo for adaptive mutation
        
        # Enable cuDNN benchmarking for optimal GPU performance
        if self.device == 'cuda' and torch.cuda.is_available():
            torch.backends.cudnn.benchmark = True
        
        self._initialize_population()
    
    def _initialize_population(self):
        """Initialize population with random neural networks."""
        arch = self.config.network_architecture
        self.population = []
        
        for i in range(self.config.population_size):
            network = NeuralNetwork(
                input_size=arch['input_size'],
                hidden_size=arch['hidden_layers'][0],  # First hidden layer size
                output_size=arch['output_size']
            ).to(self.device)
            
            # Initialize with random weights (use GPU-optimized initialization)
            for param in network.parameters():
                torch.nn.init.normal_(param, mean=0.0, std=0.1)
            
            # Compile network for faster inference (PyTorch 2.0+)
            # Note: torch.compile is not supported on Python 3.14+
            try:
                if hasattr(torch, 'compile') and callable(torch.compile) and self.device == 'cuda':
                    # Test if torch.compile actually works (it may exist but not be supported)
                    test_model = torch.nn.Linear(1, 1)
                    try:
                        torch.compile(test_model, mode='reduce-overhead')
                        # If we get here, torch.compile works
                        network = torch.compile(network, mode='reduce-overhead')
                    except (RuntimeError, AttributeError, TypeError):
                        # torch.compile exists but isn't supported (e.g., Python 3.14+)
                        # This is expected and not an error - just skip compilation
                        pass
            except Exception:
                pass  # Continue without compilation if it fails
            
            agent = Agent(
                agent_id=i,
                network=network,
                initial_energy=100.0,
                device=self.device
            )
            agent.elo_rating = 1500.0
            self.population.append(agent)
    
    def calculate_elo_expectation(self, rating_a: float, rating_b: float) -> float:
        """
        Calculate Elo expectation: E_A = 1 / (1 + 10^((R_B - R_A) / 400))
        
        Args:
            rating_a: Elo rating of agent A
            rating_b: Elo rating of agent B
            
        Returns:
            Expected score for agent A (0-1)
        """
        return 1.0 / (1.0 + 10.0 ** ((rating_b - rating_a) / 400.0))
    
    def update_elo(self, agent_a: Agent, agent_b: Agent, score_a: float, k_factor: float = 32.0):
        """
        Update Elo ratings after a match.
        
        Args:
            agent_a: First agent
            agent_b: Second agent
            score_a: Score for agent A (1.0 for win, 0.5 for draw, 0.0 for loss)
            k_factor: K-factor for Elo updates (default 32)
        """
        expected_a = self.calculate_elo_expectation(agent_a.elo_rating, agent_b.elo_rating)
        expected_b = 1.0 - expected_a
        
        agent_a.elo_rating += k_factor * (score_a - expected_a)
        agent_b.elo_rating += k_factor * ((1.0 - score_a) - expected_b)
        
        # Update max global Elo for adaptive mutation
        self.max_global_elo = max(self.max_global_elo, agent_a.elo_rating, agent_b.elo_rating)
    
    def calculate_policy_entropy(self, agent: Agent, sample_inputs: torch.Tensor) -> float:
        """
        Calculate policy entropy: H(π) = -Σ π(a|s) log π(a|s)
        Optimized to keep operations on GPU.
        
        Args:
            agent: Agent to calculate entropy for
            sample_inputs: Sample input states (batch_size, input_size)
            
        Returns:
            Average policy entropy
        """
        with torch.no_grad():
            # Ensure inputs are on correct device
            network_device = next(agent.network.parameters()).device
            if sample_inputs.device != network_device:
                sample_inputs = sample_inputs.to(network_device)
            
            outputs = agent.network(sample_inputs)
            # Apply softmax to get probability distribution
            probs = torch.softmax(outputs, dim=1)
            # Calculate entropy: -Σ p log p (all on GPU)
            entropy = -torch.sum(probs * torch.log(probs + 1e-10), dim=1)
            return float(entropy.mean().item())
    
    def batch_calculate_policy_entropy(self, agents: List[Agent], sample_inputs: torch.Tensor) -> torch.Tensor:
        """
        Batch calculate policy entropy for multiple agents.
        More efficient than calling calculate_policy_entropy individually.
        
        Args:
            agents: List of agents
            sample_inputs: Sample input states (batch_size, input_size)
            
        Returns:
            Tensor of shape (num_agents,) with entropy values
        """
        entropies = []
        with torch.no_grad():
            for agent in agents:
                network_device = next(agent.network.parameters()).device
                inputs = sample_inputs.to(network_device)
                outputs = agent.network(inputs)
                probs = torch.softmax(outputs, dim=1)
                entropy = -torch.sum(probs * torch.log(probs + 1e-10), dim=1)
                entropies.append(entropy.mean())
        
        return torch.stack(entropies)
    
    def calculate_population_diversity(self) -> float:
        """
        Calculate average Euclidean distance between weight vectors.
        Optimized to use GPU tensors when possible.
        
        Returns:
            Average Euclidean distance (population diversity)
        """
        if len(self.population) < 2:
            return 0.0
        
        # Sample pairs to avoid O(n²) computation
        sample_size = min(100, len(self.population))
        indices = np.random.choice(len(self.population), size=sample_size, replace=False)
        sample_agents = [self.population[i] for i in indices]
        
        # Get weights (keep on GPU if possible for faster computation)
        weights_tensors = []
        for agent in sample_agents:
            # Get weights as tensor on GPU
            weight_list = []
            for param in agent.network.parameters():
                weight_list.append(param.data.flatten())
            weights_tensor = torch.cat(weight_list)
            weights_tensors.append(weights_tensor)
        
        # Calculate distances on GPU (much faster)
        if self.device == 'cuda' and len(weights_tensors) > 0:
            distances = []
            for i in range(len(weights_tensors)):
                for j in range(i + 1, len(weights_tensors)):
                    dist = torch.norm(weights_tensors[i] - weights_tensors[j]).item()
                    distances.append(dist)
            return float(np.mean(distances)) if distances else 0.0
        else:
            # Fallback to CPU
            weights_list = [w.cpu().numpy() if isinstance(w, torch.Tensor) else w for w in weights_tensors]
            distances = []
            for i in range(len(weights_list)):
                for j in range(i + 1, len(weights_list)):
                    dist = np.linalg.norm(weights_list[i] - weights_list[j])
                    distances.append(dist)
            return float(np.mean(distances)) if distances else 0.0
    
    def select_parents(self) -> List[Agent]:
        """
        Select top k% of population based on fitness/elo.
        
        Returns:
            List of selected parent agents
        """
        # Sort by Elo rating (descending)
        sorted_population = sorted(
            self.population,
            key=lambda a: a.elo_rating,
            reverse=True
        )
        
        # Select top k%
        num_parents = max(1, int(len(self.population) * self.config.selection_pressure))
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
            input_size=arch['input_size'],
            hidden_size=arch['hidden_layers'][0],
            output_size=arch['output_size']
        ).to(self.device)
        
        network.set_weights(offspring_weights)
        
        # Compile for faster inference
        try:
            if hasattr(torch, 'compile') and self.device == 'cuda':
                network = torch.compile(network, mode='reduce-overhead')
        except Exception:
            pass
        
        # Use average of parent Elo ratings
        parent_elo = (parent_a.elo_rating + parent_b.elo_rating) / 2.0
        
        # Create new agent
        offspring = Agent(
            agent_id=len(self.population),  # Temporary ID
            network=network,
            initial_energy=100.0,
            device=self.device
        )
        offspring.elo_rating = parent_elo
        offspring.parent_elo = parent_elo
        
        return offspring
    
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
            mutation_rate = self.config.mutation_rate or 0.05
        else:  # ADAPTIVE
            parent_elo = agent.parent_elo if agent.parent_elo is not None else agent.elo_rating
            base = self.config.mutation_base or 0.1
            mutation_rate = base * (1.0 - parent_elo / self.config.max_possible_elo)
            # Clamp to reasonable range
            mutation_rate = np.clip(mutation_rate, 0.01, 0.2)
        
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
        elite_size = max(1, int(len(self.population) * 0.1))  # Top 10%
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
        
        # Update agent IDs
        for i, agent in enumerate(new_population[:self.config.population_size]):
            agent.id = i
        
        self.population = new_population[:self.config.population_size]
    
    def get_generation_stats(self, sample_inputs: Optional[torch.Tensor] = None) -> dict:
        """
        Calculate statistics for current generation.
        
        Args:
            sample_inputs: Sample inputs for entropy calculation (optional)
            
        Returns:
            Dictionary with generation statistics
        """
        elo_ratings = [agent.elo_rating for agent in self.population]
        fitness_scores = [agent.fitness_score for agent in self.population]
        mutation_rates = [
            agent.mutation_rate_applied or 0.0
            for agent in self.population
        ]
        
        # Calculate policy entropy (batch process for better GPU utilization)
        policy_entropies = []
        if sample_inputs is not None:
            # Process all agents in batches for better GPU utilization
            sample_size = min(200, len(self.population))  # Increased sample size
            sample_agents = self.population[:sample_size]
            
            # Batch process on GPU
            entropy_tensor = self.batch_calculate_policy_entropy(sample_agents, sample_inputs)
            policy_entropies = entropy_tensor.cpu().numpy().tolist()
        
        avg_policy_entropy = float(np.mean(policy_entropies)) if policy_entropies else 0.0
        
        # Calculate entropy variance
        entropy_variance = float(np.var(policy_entropies)) if len(policy_entropies) > 1 else 0.0
        
        return {
            'avg_elo': float(np.mean(elo_ratings)),
            'peak_elo': float(np.max(elo_ratings)),
            'min_elo': float(np.min(elo_ratings)),
            'std_elo': float(np.std(elo_ratings)),
            'avg_fitness': float(np.mean(fitness_scores)),
            'min_fitness': float(np.min(fitness_scores)),
            'max_fitness': float(np.max(fitness_scores)),
            'std_fitness': float(np.std(fitness_scores)),
            'mutation_rate': float(np.mean(mutation_rates)) if mutation_rates else 0.0,
            'policy_entropy': float(avg_policy_entropy),
            'entropy_variance': float(entropy_variance),
            'population_diversity': float(self.calculate_population_diversity())
        }
    
    def save_population_state(self, experiment_id: str, generation: int) -> Dict:
        """
        Serialize population state for checkpointing.
        
        Args:
            experiment_id: Experiment ID
            generation: Generation number
            
        Returns:
            Dictionary with serialized population state
        """
        import json
        
        population_state = {
            'experiment_id': experiment_id,
            'generation': generation,
            'max_global_elo': float(self.max_global_elo),
            'population_size': len(self.population),
            'agents': []
        }
        
        # Serialize each agent's network weights and metadata
        for i, agent in enumerate(self.population):
            # Get network weights as numpy array
            weights = agent.network.get_weights()
            
            agent_state = {
                'agent_id': agent.id,
                'elo_rating': float(agent.elo_rating),
                'fitness_score': float(agent.fitness_score),
                'parent_elo': float(agent.parent_elo) if agent.parent_elo is not None else None,
                'mutation_rate_applied': float(agent.mutation_rate_applied) if agent.mutation_rate_applied is not None else None,
                'network_weights': weights.tolist(),  # Convert numpy to list for JSON
                'network_architecture': {
                    'input_size': self.config.network_architecture['input_size'],
                    'hidden_size': self.config.network_architecture['hidden_layers'][0],
                    'output_size': self.config.network_architecture['output_size']
                }
            }
            population_state['agents'].append(agent_state)
        
        return population_state
    
    def load_population_state(self, state_dict: Dict):
        """
        Restore population from saved state.
        
        Args:
            state_dict: Dictionary with serialized population state
        """
        import numpy as np
        
        # Clear current population
        self.population = []
        
        # Restore max global Elo
        self.max_global_elo = float(state_dict.get('max_global_elo', 1500.0))
        
        # Restore each agent
        for agent_state in state_dict.get('agents', []):
            # Reconstruct network
            arch = agent_state.get('network_architecture', {})
            network = NeuralNetwork(
                input_size=arch.get('input_size', 24),
                hidden_size=arch.get('hidden_size', 64),
                output_size=arch.get('output_size', 4)
            ).to(self.device)
            
            # Load weights
            weights_array = np.array(agent_state['network_weights'], dtype=np.float32)
            network.set_weights(weights_array)
            
            # Compile network if possible
            try:
                if hasattr(torch, 'compile') and callable(torch.compile) and self.device == 'cuda':
                    test_model = torch.nn.Linear(1, 1)
                    try:
                        torch.compile(test_model, mode='reduce-overhead')
                        network = torch.compile(network, mode='reduce-overhead')
                    except (RuntimeError, AttributeError, TypeError):
                        pass
            except Exception:
                pass
            
            # Create agent
            agent = Agent(
                agent_id=agent_state.get('agent_id', len(self.population)),
                network=network,
                initial_energy=100.0,
                device=self.device
            )
            
            # Restore metadata
            agent.elo_rating = float(agent_state.get('elo_rating', 1500.0))
            agent.fitness_score = float(agent_state.get('fitness_score', 0.0))
            agent.parent_elo = float(agent_state['parent_elo']) if agent_state.get('parent_elo') is not None else None
            agent.mutation_rate_applied = float(agent_state['mutation_rate_applied']) if agent_state.get('mutation_rate_applied') is not None else None
            
            self.population.append(agent)
        
        # Ensure population size matches config
        while len(self.population) < self.config.population_size:
            # Add new random agents if population is smaller
            network = NeuralNetwork(
                input_size=self.config.network_architecture['input_size'],
                hidden_size=self.config.network_architecture['hidden_layers'][0],
                output_size=self.config.network_architecture['output_size']
            ).to(self.device)
            for param in network.parameters():
                torch.nn.init.normal_(param, mean=0.0, std=0.1)
            
            agent = Agent(
                agent_id=len(self.population),
                network=network,
                initial_energy=100.0,
                device=self.device
            )
            agent.elo_rating = 1500.0
            self.population.append(agent)
        
        # Trim if too large
        self.population = self.population[:self.config.population_size]
        
        # Update agent IDs
        for i, agent in enumerate(self.population):
            agent.id = i
