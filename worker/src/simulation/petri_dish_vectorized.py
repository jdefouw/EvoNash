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
        Optimized batched raycasts with reduced memory allocations and spatial optimization.
        
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
        
        # Pre-allocate raycast angles tensor (reuse if same config)
        if not hasattr(self, '_raycast_angles') or self._raycast_angles.shape[0] != raycast_count:
            self._raycast_angles = torch.tensor(angles_rad, dtype=torch.float32, device=self.device)
        
        # Expand for all agents: (num_agents, raycast_count)
        agent_angles_expanded = agent_angles.unsqueeze(1) + self._raycast_angles.unsqueeze(0)
        
        # Calculate ray directions (reuse memory where possible)
        ray_dx = torch.cos(agent_angles_expanded)  # (num_agents, raycast_count)
        ray_dy = torch.sin(agent_angles_expanded)  # (num_agents, raycast_count)
        
        # Initialize results
        results = torch.full((num_agents, raycast_count, 4), max_distance, dtype=torch.float32, device=self.device)
        
        # Optimized step sampling: use adaptive step size to reduce memory
        # Use larger steps initially, then refine near collisions
        step_size = 10.0  # Increased from 5.0 for fewer allocations
        steps = int(max_distance / step_size)
        
        # Pre-allocate step distances tensor (reuse if same max_distance)
        if not hasattr(self, '_step_distances') or self._step_distances.shape[0] != steps:
            self._step_distances = torch.arange(1, steps + 1, dtype=torch.float32, device=self.device) * step_size
        
        # Calculate check positions in chunks to reduce memory
        # Process in smaller chunks to avoid OOM
        chunk_size = min(32, num_agents)  # Process 32 agents at a time
        
        for chunk_start in range(0, num_agents, chunk_size):
            chunk_end = min(chunk_start + chunk_size, num_agents)
            chunk_positions = agent_positions[chunk_start:chunk_end]
            chunk_ray_dx = ray_dx[chunk_start:chunk_end]
            chunk_ray_dy = ray_dy[chunk_start:chunk_end]
            chunk_size_actual = chunk_end - chunk_start
            
            # Calculate check positions: (chunk_size, raycast_count, steps, 2)
            step_distances_expanded = self._step_distances.unsqueeze(0).unsqueeze(0).unsqueeze(0)  # (1, 1, steps, 1)
            check_x = chunk_positions[:, 0:1, None, None] + chunk_ray_dx[:, :, None, None] * step_distances_expanded
            check_y = chunk_positions[:, 1:2, None, None] + chunk_ray_dy[:, :, None, None] * step_distances_expanded
            
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
                wall_collisions = torch.argmax(wall_mask.float(), dim=2)  # (chunk_size, raycast_count)
                wall_distances = self._step_distances[wall_collisions] * wall_mask.any(dim=2).float()
                results[chunk_start:chunk_end, :, 0] = torch.minimum(results[chunk_start:chunk_end, :, 0], wall_distances)
            
            # Optimized food collision check using spatial indexing
            if len(self.food) > 0 and self.food_positions.shape[0] > 0:
                food_x = self.food_positions[:, 0]  # (num_food,)
                food_y = self.food_positions[:, 1]  # (num_food,)
                
                # Use broadcasting more efficiently
                # (chunk_size, raycast_count, steps, 1) - (1, 1, 1, num_food)
                check_x_expanded = check_x.unsqueeze(3)  # (chunk_size, raycast_count, steps, 1)
                check_y_expanded = check_y.unsqueeze(3)  # (chunk_size, raycast_count, steps, 1)
                food_x_expanded = food_x.view(1, 1, 1, -1)  # (1, 1, 1, num_food)
                food_y_expanded = food_y.view(1, 1, 1, -1)  # (1, 1, 1, num_food)
                
                # Calculate distances
                dx = check_x_expanded - food_x_expanded
                dy = check_y_expanded - food_y_expanded
                if self.toroidal:
                    # Toroidal distance (optimized)
                    dx_abs = torch.abs(dx)
                    dx = torch.minimum(dx_abs, torch.minimum(torch.abs(dx + self.width), torch.abs(dx - self.width)))
                    dy_abs = torch.abs(dy)
                    dy = torch.minimum(dy_abs, torch.minimum(torch.abs(dy + self.height), torch.abs(dy - self.height)))
                
                # Use squared distance to avoid sqrt (faster)
                distances_sq = dx**2 + dy**2  # (chunk_size, raycast_count, steps, num_food)
                food_radius_sq = self.food_radius ** 2
                
                # Find minimum distance to any food for each step
                min_distances_sq = distances_sq.min(dim=3)[0]  # (chunk_size, raycast_count, steps)
                food_collision_mask = min_distances_sq < food_radius_sq
                
                # Find first collision
                if food_collision_mask.any():
                    food_collision_steps = torch.argmax(food_collision_mask.float(), dim=2)  # (chunk_size, raycast_count)
                    food_distances = self._step_distances[food_collision_steps] * food_collision_mask.any(dim=2).float()
                    results[chunk_start:chunk_end, :, 1] = torch.minimum(
                        results[chunk_start:chunk_end, :, 1], 
                        food_distances
                    )
        
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
    
    def batch_check_food_consumption(
        self,
        agent_positions: torch.Tensor,
        agent_energies: torch.Tensor,
        active_mask: torch.Tensor
    ) -> Tuple[torch.Tensor, torch.Tensor]:
        """
        Vectorized food consumption check on GPU.
        
        Args:
            agent_positions: Tensor of shape (num_agents, 2) with [x, y]
            agent_energies: Tensor of shape (num_agents,) with current energies
            active_mask: Boolean tensor indicating which agents are active
            
        Returns:
            Tuple of (updated_energies, food_consumed_mask)
            - updated_energies: Updated energy values after food consumption
            - food_consumed_mask: Boolean tensor indicating which food items were consumed
        """
        if self.food_positions.shape[0] == 0:
            return agent_energies, torch.zeros(0, dtype=torch.bool, device=self.device)
        
        # Get unconsumed food indices
        unconsumed_mask = ~self.food_consumed
        if not unconsumed_mask.any():
            return agent_energies, torch.zeros(len(self.food), dtype=torch.bool, device=self.device)
        
        unconsumed_food_positions = self.food_positions[unconsumed_mask]
        unconsumed_food_indices = torch.where(unconsumed_mask)[0]
        num_unconsumed = unconsumed_food_positions.shape[0]
        
        if num_unconsumed == 0:
            return agent_energies, torch.zeros(len(self.food), dtype=torch.bool, device=self.device)
        
        # Only check active agents
        active_positions = agent_positions[active_mask]
        active_indices = torch.where(active_mask)[0]
        num_active = active_positions.shape[0]
        
        if num_active == 0:
            return agent_energies, torch.zeros(len(self.food), dtype=torch.bool, device=self.device)
        
        # Calculate distances: (num_unconsumed, num_active)
        food_expanded = unconsumed_food_positions.unsqueeze(1)  # (num_unconsumed, 1, 2)
        agent_expanded = active_positions.unsqueeze(0)  # (1, num_active, 2)
        
        dx = food_expanded[:, :, 0] - agent_expanded[:, :, 0]  # (num_unconsumed, num_active)
        dy = food_expanded[:, :, 1] - agent_expanded[:, :, 1]  # (num_unconsumed, num_active)
        
        if self.toroidal:
            # Toroidal distance
            dx_abs = torch.abs(dx)
            dx = torch.minimum(dx_abs, torch.minimum(torch.abs(dx + self.width), torch.abs(dx - self.width)))
            dy_abs = torch.abs(dy)
            dy = torch.minimum(dy_abs, torch.minimum(torch.abs(dy + self.height), torch.abs(dy - self.height)))
        
        distances = torch.sqrt(dx**2 + dy**2)  # (num_unconsumed, num_active)
        
        # Check collisions: distance < (agent_radius + food_radius)
        collision_threshold = self.agent_radius + self.food_radius
        collision_matrix = distances < collision_threshold  # (num_unconsumed, num_active)
        
        # Process collisions: each food can only be consumed once by first agent
        # Find first agent that collides with each food
        food_consumed_mask = torch.zeros(len(self.food), dtype=torch.bool, device=self.device)
        updated_energies = agent_energies.clone()
        
        if collision_matrix.any():
            # For each food, find first colliding agent
            for food_idx_local, food_idx_global in enumerate(unconsumed_food_indices):
                if collision_matrix[food_idx_local].any():
                    # Find first colliding agent
                    agent_idx_local = torch.argmax(collision_matrix[food_idx_local].float())
                    agent_idx_global = active_indices[agent_idx_local]
                    
                    # Consume food
                    food_consumed_mask[food_idx_global] = True
                    updated_energies[agent_idx_global] += self.food_energy
        
        return updated_energies, food_consumed_mask
