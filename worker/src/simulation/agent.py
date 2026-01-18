"""
Agent class with PyTorch Neural Network.
Input: 24 floats (8 raycasts × 3 + self state)
Output: 4 floats (Thrust, Turn, Shoot, Split)
"""

import torch
import torch.nn as nn
import numpy as np
from typing import Optional


class NeuralNetwork(nn.Module):
    """Neural network for game agent: Input 24 → Hidden 64 → Output 4."""
    
    def __init__(self, input_size: int = 24, hidden_size: int = 64, output_size: int = 4):
        super(NeuralNetwork, self).__init__()
        self.network = nn.Sequential(
            nn.Linear(input_size, hidden_size),
            nn.ReLU(),
            nn.Linear(hidden_size, output_size)
        )
    
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
            ).float().to(param.data.device)
            idx += size


class Agent:
    """
    Agent entity with neural network controller.
    
    Inputs (24 floats):
    - 8 raycasts × 3 (Wall distance, Food distance, Enemy distance) = 24
    - Self state: Energy, Velocity, Cooldown = 3 (but we'll use 8 raycasts × 3 = 24 total)
    Actually: 8 raycasts × 4 (wall, food, enemy, enemy_size) = 32, but spec says 24
    Let's use: 8 raycasts × 3 (wall, food, enemy) = 24
    
    Outputs (4 floats):
    - Thrust (0-1)
    - Turn (-1 to 1)
    - Shoot (0-1)
    - Split (0-1)
    """
    
    def __init__(
        self,
        agent_id: int,
        x: float = 0.0,
        y: float = 0.0,
        network: Optional[NeuralNetwork] = None,
        initial_energy: float = 100.0,
        device: str = 'cpu'
    ):
        self.id = agent_id
        self.x = x
        self.y = y
        self.vx = 0.0
        self.vy = 0.0
        self.angle = 0.0  # Orientation in radians
        self.energy = initial_energy
        self.shoot_cooldown = 0
        self.split_cooldown = 0
        
        self.device = device
        
        if network is None:
            self.network = NeuralNetwork(input_size=24, hidden_size=64, output_size=4).to(device)
            # Initialize with small random weights
            for param in self.network.parameters():
                nn.init.normal_(param, mean=0.0, std=0.1)
        else:
            self.network = network.to(device)
        
        # Elo rating for genetic algorithm
        self.elo_rating = 1500.0
        self.fitness_score = 0.0
        self.parent_elo: Optional[float] = None
        self.mutation_rate_applied: Optional[float] = None
    
    def get_input_vector(self, raycast_data: np.ndarray, petri_dish) -> torch.Tensor:
        """
        Construct input vector from raycast data and self state.
        
        Args:
            raycast_data: Array of shape (8, 4) from raycasts
            petri_dish: PetriDish instance for additional state
            
        Returns:
            Tensor of shape (24,)
        """
        # Flatten raycast data: 8 raycasts × 3 values (wall, food, enemy distances)
        # Normalize distances
        raycast_flat = raycast_data[:, :3].flatten()  # Take first 3 columns, flatten to 24
        
        # Normalize to [0, 1] range (assuming max_distance is 200)
        max_dist = 200.0
        raycast_flat = np.clip(raycast_flat / max_dist, 0.0, 1.0)
        
        # Self state: energy (normalized), velocity (normalized), cooldown status
        # Actually, we need exactly 24 inputs, so let's use 8 raycasts × 3 = 24
        # We'll incorporate self state into the raycast normalization or use a different approach
        
        # For now, use 8 raycasts × 3 = 24 inputs
        input_vector = raycast_flat[:24]  # Ensure exactly 24
        
        return torch.tensor(input_vector, dtype=torch.float32).to(self.device)
    
    def act(self, input_vector: torch.Tensor) -> Dict[str, float]:
        """
        Get action from neural network.
        
        Args:
            input_vector: Input tensor of shape (24,)
            
        Returns:
            Dictionary with actions: thrust, turn, shoot, split
        """
        # Ensure input is on the correct device
        if input_vector.device != self.network.device:
            input_vector = input_vector.to(self.device)
        
        with torch.no_grad():
            output = self.network(input_vector.unsqueeze(0))
            # Only move to CPU if we're on CUDA (for numpy conversion)
            if self.device == 'cuda':
                output = output.squeeze(0).cpu().numpy()
            else:
                output = output.squeeze(0).numpy()
        
        # Process outputs
        thrust = float(np.clip(output[0], 0.0, 1.0))  # 0-1
        turn = float(np.clip(output[1], -1.0, 1.0))   # -1 to 1
        shoot = float(np.clip(output[2], 0.0, 1.0))   # 0-1
        split = float(np.clip(output[3], 0.0, 1.0))   # 0-1
        
        return {
            'thrust': thrust,
            'turn': turn,
            'shoot': shoot,
            'split': split
        }
    
    def apply_action(self, action: Dict[str, float], petri_dish, thrust_force: float = 0.2, turn_rate: float = 0.1):
        """
        Apply action to agent physics.
        
        Args:
            action: Action dictionary from act()
            petri_dish: PetriDish instance
            thrust_force: Force multiplier for thrust
            turn_rate: Rate of turning
        """
        # Turn
        self.angle += action['turn'] * turn_rate
        
        # Thrust
        if action['thrust'] > 0.1:  # Threshold
            thrust_magnitude = action['thrust'] * thrust_force
            self.vx += np.cos(self.angle) * thrust_magnitude
            self.vy += np.sin(self.angle) * thrust_magnitude
        
        # Shoot (handled by PetriDish)
        # Split (handled by PetriDish)
    
    def get_policy_distribution(self, input_vector: torch.Tensor) -> np.ndarray:
        """
        Get policy distribution for entropy calculation.
        
        Args:
            input_vector: Input tensor
            
        Returns:
            Policy distribution over actions
        """
        with torch.no_grad():
            output = self.network(input_vector.unsqueeze(0))
            output = output.squeeze(0).cpu().numpy()
        
        # Convert to probability distribution using softmax
        # But outputs are continuous, so we'll use a normalized version
        exp_output = np.exp(output - np.max(output))
        policy = exp_output / np.sum(exp_output)
        
        return policy
