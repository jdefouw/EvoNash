"""
Vectorized Petri Dish operations for GPU acceleration.
Optimized raycast and collision detection using vectorized operations.
"""

import numpy as np
import torch
from typing import List, Tuple, Dict
from .petri_dish import PetriDish, Food, Projectile


class VectorizedPetriDish(PetriDish):
    """
    Vectorized version of PetriDish with GPU-accelerated operations.
    """
    
    def __init__(self, config_path: str = None, ticks_per_generation: int = None, device: str = 'cuda'):
        """
        Initialize vectorized Petri Dish.
        
        Args:
            config_path: Path to simulation config
            ticks_per_generation: Ticks per generation
            device: Device for tensor operations
        """
        super().__init__(config_path, ticks_per_generation)
        self.device = device if torch.cuda.is_available() and device == 'cuda' else 'cpu'
        
        # Convert food to tensors for vectorized operations
        self._update_food_tensors()
    
    def _update_food_tensors(self):
        """Update food position tensors for vectorized operations."""
        if len(self.food) > 0:
            food_positions = [[f.x, f.y] for f in self.food if not f.consumed]
            if food_positions:
                self.food_positions = torch.tensor(food_positions, dtype=torch.float32, device=self.device)
                self.food_consumed = torch.tensor([f.consumed for f in self.food], dtype=torch.bool, device=self.device)
            else:
                self.food_positions = torch.zeros((0, 2), dtype=torch.float32, device=self.device)
                self.food_consumed = torch.ones(len(self.food), dtype=torch.bool, device=self.device)
        else:
            self.food_positions = torch.zeros((0, 2), dtype=torch.float32, device=self.device)
            self.food_consumed = torch.zeros(0, dtype=torch.bool, device=self.device)
    
    def batch_raycast(
        self,
        agent_positions: torch.Tensor,
        agent_angles: torch.Tensor,
        raycast_config: Dict,
        active_mask: torch.Tensor
    ) -> torch.Tensor:
        """
        Perform batched raycasts for all agents simultaneously.
        
        Args:
            agent_positions: Tensor of shape (num_agents, 2) with [x, y]
            agent_angles: Tensor of shape (num_agents,) with angles in radians
            raycast_config: Configuration dict with count, max_distance, angles
            active_mask: Boolean tensor indicating which agents are active
            
        Returns:
            Tensor of shape (num_agents, raycast_count, 4) with raycast results
        """
        num_agents = agent_positions.shape[0]
        raycast_count = raycast_config['count']
        max_distance = raycast_config['max_distance']
        angles_deg = raycast_config.get('angles', np.linspace(0, 360, raycast_count))
        angles_rad = np.radians(angles_deg)
        
        # Convert to tensors
        raycast_angles = torch.tensor(angles_rad, dtype=torch.float32, device=self.device)  # (raycast_count,)
        
        # Expand for all agents: (num_agents, raycast_count)
        agent_angles_expanded = agent_angles.unsqueeze(1) + raycast_angles.unsqueeze(0)  # (num_agents, raycast_count)
        
        # Calculate ray directions
        ray_dx = torch.cos(agent_angles_expanded)  # (num_agents, raycast_count)
        ray_dy = torch.sin(agent_angles_expanded)  # (num_agents, raycast_count)
        
        # Initialize results
        results = torch.full((num_agents, raycast_count, 4), max_distance, dtype=torch.float32, device=self.device)
        
        # Vectorized raycast with step sampling
        step_size = 5.0
        steps = int(max_distance / step_size)
        
        # Sample points along rays
        step_distances = torch.arange(1, steps + 1, dtype=torch.float32, device=self.device) * step_size  # (steps,)
        
        # Expand for all agents and raycasts: (num_agents, raycast_count, steps)
        step_distances_expanded = step_distances.unsqueeze(0).unsqueeze(0)  # (1, 1, steps)
        
        # Calculate check positions: (num_agents, raycast_count, steps, 2)
        check_x = agent_positions[:, 0:1, None, None] + ray_dx[:, :, None] * step_distances_expanded
        check_y = agent_positions[:, 1:2, None, None] + ray_dy[:, :, None] * step_distances_expanded
        
        # Wrap positions
        if self.toroidal:
            check_x = check_x % self.width
            check_y = check_y % self.height
        else:
            check_x = torch.clamp(check_x, 0.0, self.width)
            check_y = torch.clamp(check_y, 0.0, self.height)
        
        # Check wall collisions (non-toroidal only)
        if not self.toroidal:
            wall_mask = (check_x < 0) | (check_x > self.width) | (check_y < 0) | (check_y > self.height)
            # Find first wall collision for each ray
            wall_collisions = torch.argmax(wall_mask.float(), dim=2)  # (num_agents, raycast_count)
            wall_distances = step_distances[wall_collisions] * wall_mask.any(dim=2).float()
            results[:, :, 0] = torch.minimum(results[:, :, 0], wall_distances)
        
        # Check food collisions (vectorized)
        if len(self.food) > 0 and self.food_positions.shape[0] > 0:
            # Calculate distances from check points to all food: (num_agents, raycast_count, steps, num_food)
            food_x = self.food_positions[:, 0]  # (num_food,)
            food_y = self.food_positions[:, 1]  # (num_food,)
            
            # Expand dimensions for broadcasting
            check_x_expanded = check_x.unsqueeze(3)  # (num_agents, raycast_count, steps, 1)
            check_y_expanded = check_y.unsqueeze(3)  # (num_agents, raycast_count, steps, 1)
            food_x_expanded = food_x.unsqueeze(0).unsqueeze(0).unsqueeze(0)  # (1, 1, 1, num_food)
            food_y_expanded = food_y.unsqueeze(0).unsqueeze(0).unsqueeze(0)  # (1, 1, 1, num_food)
            
            # Calculate distances
            dx = check_x_expanded - food_x_expanded
            dy = check_y_expanded - food_y_expanded
            if self.toroidal:
                # Toroidal distance
                dx = torch.minimum(torch.minimum(torch.abs(dx), torch.abs(dx + self.width)), torch.abs(dx - self.width))
                dy = torch.minimum(torch.minimum(torch.abs(dy), torch.abs(dy + self.height)), torch.abs(dy - self.height))
            distances = torch.sqrt(dx**2 + dy**2)  # (num_agents, raycast_count, steps, num_food)
            
            # Check if within food radius
            food_mask = distances < self.food_radius  # (num_agents, raycast_count, steps, num_food)
            
            # Find first food collision for each ray
            if food_mask.any():
                # Find minimum distance to food for each step
                min_distances_to_food = distances.min(dim=3)[0]  # (num_agents, raycast_count, steps)
                food_collision_mask = min_distances_to_food < self.food_radius
                
                # Find first collision
                food_collision_steps = torch.argmax(food_collision_mask.float(), dim=2)  # (num_agents, raycast_count)
                food_distances = step_distances[food_collision_steps] * food_collision_mask.any(dim=2).float()
                results[:, :, 1] = torch.minimum(results[:, :, 1], food_distances)
        
        # Enemy detection would go here (similar vectorized approach)
        # For now, leave as max_distance
        
        return results
    
    def batch_get_input_vectors(
        self,
        raycast_data: torch.Tensor,
        agent_energies: torch.Tensor,
        agent_velocities: torch.Tensor,
        agent_cooldowns: torch.Tensor
    ) -> torch.Tensor:
        """
        Convert batched raycast data to input vectors for neural networks.
        
        Args:
            raycast_data: Tensor of shape (num_agents, raycast_count, 4)
            agent_energies: Tensor of shape (num_agents,)
            agent_velocities: Tensor of shape (num_agents, 2) with [vx, vy]
            agent_cooldowns: Tensor of shape (num_agents,)
            
        Returns:
            Tensor of shape (num_agents, 24) with input vectors
        """
        num_agents = raycast_data.shape[0]
        
        # Flatten raycast data: take first 3 columns, normalize
        raycast_flat = raycast_data[:, :, :3].reshape(num_agents, -1)  # (num_agents, raycast_count * 3)
        
        # Normalize distances
        max_dist = 200.0
        raycast_flat = torch.clamp(raycast_flat / max_dist, 0.0, 1.0)
        
        # Take first 24 values (8 raycasts * 3 = 24)
        input_vectors = raycast_flat[:, :24]
        
        return input_vectors
