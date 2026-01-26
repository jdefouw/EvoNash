"""
Vectorized Petri Dish operations for GPU acceleration.
Optimized raycast and collision detection using vectorized operations.

Key optimizations:
- Analytical ray-circle intersection (O(1) instead of O(steps))
- Spatial grid for O(1) food lookup
- Fully vectorized collision detection using scatter operations
"""

import numpy as np
import torch
import torch.nn.functional as F
from typing import List, Tuple, Dict, Optional
from .petri_dish import PetriDish, Food, Projectile


class SpatialGrid:
    """
    Spatial hash grid for O(1) food lookup during raycasting.
    Divides the simulation space into cells for fast neighbor queries.
    """
    
    def __init__(self, width: float, height: float, cell_size: float, device: str = 'cuda'):
        """
        Initialize spatial grid.
        
        Args:
            width: World width
            height: World height
            cell_size: Size of each grid cell (should be >= max raycast distance for efficiency)
            device: Device for tensor operations
        """
        self.width = width
        self.height = height
        self.cell_size = cell_size
        self.device = device if torch.cuda.is_available() and device == 'cuda' else 'cpu'
        
        self.num_cells_x = int(np.ceil(width / cell_size))
        self.num_cells_y = int(np.ceil(height / cell_size))
        self.num_cells = self.num_cells_x * self.num_cells_y
        
        # Grid storage: list of food indices per cell (as tensors)
        self.cell_contents = [[] for _ in range(self.num_cells)]
        
    def get_cell_index(self, x: torch.Tensor, y: torch.Tensor) -> torch.Tensor:
        """Get cell indices for positions (vectorized)."""
        cell_x = (x / self.cell_size).long() % self.num_cells_x
        cell_y = (y / self.cell_size).long() % self.num_cells_y
        return cell_y * self.num_cells_x + cell_x
    
    def update(self, positions: torch.Tensor, mask: torch.Tensor):
        """
        Update grid with food positions.
        
        Args:
            positions: Food positions (num_food, 2)
            mask: Boolean mask for unconsumed food
        """
        # Clear grid
        for i in range(self.num_cells):
            self.cell_contents[i] = []
        
        if positions.shape[0] == 0 or not mask.any():
            return
        
        # Get cell indices for all food
        cell_indices = self.get_cell_index(positions[:, 0], positions[:, 1])
        
        # Add food to cells (only unconsumed)
        mask_cpu = mask.cpu()
        cell_indices_cpu = cell_indices.cpu()
        for i in range(positions.shape[0]):
            if mask_cpu[i]:
                cell_idx = int(cell_indices_cpu[i])
                self.cell_contents[cell_idx].append(i)
    
    def get_nearby_cells(self, cell_x: int, cell_y: int, radius: int = 1) -> List[int]:
        """Get indices of nearby cells (handles toroidal wrapping)."""
        cells = []
        for dx in range(-radius, radius + 1):
            for dy in range(-radius, radius + 1):
                nx = (cell_x + dx) % self.num_cells_x
                ny = (cell_y + dy) % self.num_cells_y
                cells.append(ny * self.num_cells_x + nx)
        return cells


class VectorizedPetriDish(PetriDish):
    """
    Vectorized version of PetriDish with GPU-accelerated operations.
    
    Key features:
    - Analytical ray-circle intersection for raycasting
    - Spatial grid for efficient food lookup
    - Fully vectorized collision detection
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
        
        # Initialize spatial grid for food lookup
        # Cell size = max raycast distance for optimal query performance
        self.spatial_grid = SpatialGrid(
            self.width, self.height,
            cell_size=50.0,  # Query nearby cells for raycasting
            device=self.device
        )
        
        # Pre-compute constants for ray-circle intersection
        self._max_distance_sq = 200.0 ** 2  # Default max distance squared
    
    def _update_food_tensors(self):
        """Update food position tensors for vectorized operations."""
        if len(self.food) > 0:
            # Include ALL food items (not just unconsumed) to match food_consumed mask
            food_positions = [[f.x, f.y] for f in self.food]
            self.food_positions = torch.tensor(food_positions, dtype=torch.float32, device=self.device)
            self.food_consumed = torch.tensor([f.consumed for f in self.food], dtype=torch.bool, device=self.device)
        else:
            self.food_positions = torch.zeros((0, 2), dtype=torch.float32, device=self.device)
            self.food_consumed = torch.zeros(0, dtype=torch.bool, device=self.device)
        
        # Update spatial grid
        if hasattr(self, 'spatial_grid'):
            unconsumed_mask = ~self.food_consumed if len(self.food) > 0 else torch.zeros(0, dtype=torch.bool, device=self.device)
            self.spatial_grid.update(self.food_positions, unconsumed_mask)
    
    def batch_raycast(
        self,
        agent_positions: torch.Tensor,
        agent_angles: torch.Tensor,
        raycast_config: Dict,
        active_mask: torch.Tensor
    ) -> torch.Tensor:
        """
        ANALYTICAL batched raycasts using ray-circle intersection formula.
        
        This replaces step-based sampling with direct geometric calculations,
        reducing complexity from O(agents * rays * steps * food) to O(agents * rays * food).
        
        Ray-circle intersection formula:
        For ray P + t*D and circle C with radius R:
        - v = C - P (vector to circle center)
        - t_closest = dot(v, D) (parameter at closest approach)
        - d² = |v|² - t_closest² (squared distance at closest approach)
        - If d² > R²: no intersection
        - Else: t = t_closest - sqrt(R² - d²)
        
        Args:
            agent_positions: Tensor of shape (num_agents, 2) with [x, y]
            agent_angles: Tensor of shape (num_agents,) with angles in radians
            raycast_config: Configuration dict with count, max_distance, angles
            active_mask: Boolean tensor indicating which agents are active
            
        Returns:
            Tensor of shape (num_agents, raycast_count, 4) with raycast results
            [wall_dist, food_dist, enemy_dist, enemy_size]
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
        
        # Calculate ray directions: (num_agents, raycast_count)
        ray_dx = torch.cos(agent_angles_expanded)
        ray_dy = torch.sin(agent_angles_expanded)
        
        # Initialize results with max_distance
        results = torch.full((num_agents, raycast_count, 4), max_distance, dtype=torch.float32, device=self.device)
        
        # Wall detection (non-toroidal only)
        if not self.toroidal:
            # Calculate intersection with each wall boundary
            # For positive direction rays hitting right/top walls
            # For negative direction rays hitting left/bottom walls
            agent_x = agent_positions[:, 0:1]  # (num_agents, 1)
            agent_y = agent_positions[:, 1:2]  # (num_agents, 1)
            
            # Distance to each wall along ray direction
            # Right wall: (width - x) / dx where dx > 0
            # Left wall: -x / dx where dx < 0
            # Top wall: (height - y) / dy where dy > 0
            # Bottom wall: -y / dy where dy < 0
            
            eps = 1e-6
            t_right = torch.where(ray_dx > eps, (self.width - agent_x) / ray_dx, torch.full_like(ray_dx, float('inf')))
            t_left = torch.where(ray_dx < -eps, -agent_x / ray_dx, torch.full_like(ray_dx, float('inf')))
            t_top = torch.where(ray_dy > eps, (self.height - agent_y) / ray_dy, torch.full_like(ray_dy, float('inf')))
            t_bottom = torch.where(ray_dy < -eps, -agent_y / ray_dy, torch.full_like(ray_dy, float('inf')))
            
            # Minimum positive distance to any wall
            wall_dist = torch.minimum(torch.minimum(t_right, t_left), torch.minimum(t_top, t_bottom))
            wall_dist = torch.clamp(wall_dist, 0.0, max_distance)
            results[:, :, 0] = wall_dist
        
        # Food detection using analytical ray-circle intersection
        if len(self.food) > 0 and self.food_positions.shape[0] > 0:
            unconsumed_mask = ~self.food_consumed
            if unconsumed_mask.any():
                food_positions = self.food_positions[unconsumed_mask]  # (num_food, 2)
                num_food = food_positions.shape[0]
                
                # Expand dimensions for broadcasting
                # agent_positions: (num_agents, 2) -> (num_agents, 1, 1, 2)
                # ray directions: (num_agents, raycast_count) -> (num_agents, raycast_count, 1)
                # food_positions: (num_food, 2) -> (1, 1, num_food, 2)
                
                agent_pos_exp = agent_positions.unsqueeze(1).unsqueeze(2)  # (N, 1, 1, 2)
                food_pos_exp = food_positions.unsqueeze(0).unsqueeze(0)    # (1, 1, F, 2)
                
                # Vector from agent to food center: v = C - P
                # Shape: (num_agents, 1, num_food, 2)
                v = food_pos_exp - agent_pos_exp
                
                # Handle toroidal wrapping - find closest "ghost" of each food
                if self.toroidal:
                    # For each axis, check if wrapping gives shorter distance
                    v_x = v[..., 0]  # (N, 1, F)
                    v_y = v[..., 1]  # (N, 1, F)
                    
                    # Choose shortest wrapped distance for x
                    v_x_wrapped = torch.where(
                        torch.abs(v_x) > self.width / 2,
                        v_x - torch.sign(v_x) * self.width,
                        v_x
                    )
                    # Choose shortest wrapped distance for y
                    v_y_wrapped = torch.where(
                        torch.abs(v_y) > self.height / 2,
                        v_y - torch.sign(v_y) * self.height,
                        v_y
                    )
                    
                    v = torch.stack([v_x_wrapped, v_y_wrapped], dim=-1)  # (N, 1, F, 2)
                
                # Expand ray directions for broadcasting
                # ray_dx, ray_dy: (N, R) -> (N, R, 1)
                ray_dx_exp = ray_dx.unsqueeze(2)  # (N, R, 1)
                ray_dy_exp = ray_dy.unsqueeze(2)  # (N, R, 1)
                
                # v needs to broadcast with rays: (N, 1, F, 2) -> (N, R, F, 2)
                v_broadcast = v.expand(num_agents, raycast_count, num_food, 2)
                
                # t_closest = dot(v, D) - parameter along ray at closest approach
                # v: (N, R, F, 2), D components: (N, R, 1)
                t_closest = v_broadcast[..., 0] * ray_dx_exp + v_broadcast[..., 1] * ray_dy_exp  # (N, R, F)
                
                # |v|² - squared distance from agent to food center
                v_sq = (v_broadcast[..., 0] ** 2 + v_broadcast[..., 1] ** 2)  # (N, R, F)
                
                # d² = |v|² - t_closest² - squared perpendicular distance
                d_sq = v_sq - t_closest ** 2  # (N, R, F)
                
                # Check if ray passes through circle: d² < R²
                r_sq = self.food_radius ** 2
                discriminant = r_sq - d_sq  # (N, R, F)
                
                # Calculate intersection distance: t = t_closest - sqrt(R² - d²)
                # Only valid where discriminant >= 0 and t > 0
                sqrt_disc = torch.sqrt(torch.clamp(discriminant, min=0.0))
                t_intersect = t_closest - sqrt_disc  # (N, R, F)
                
                # Mask for valid intersections:
                # 1. discriminant >= 0 (ray passes through or touches circle)
                # 2. t > 0 (intersection is ahead of ray origin)
                # 3. t <= max_distance
                valid_mask = (discriminant >= 0) & (t_intersect > 0) & (t_intersect <= max_distance)
                
                # Set invalid intersections to max_distance
                t_intersect = torch.where(valid_mask, t_intersect, torch.full_like(t_intersect, max_distance))
                
                # Find minimum distance across all food items for each ray
                min_food_dist, _ = t_intersect.min(dim=2)  # (N, R)
                
                # Update results
                results[:, :, 1] = min_food_dist
        
        # Enemy detection would go here (similar approach)
        # Currently leaving as max_distance
        
        return results
    
    def batch_raycast_legacy(
        self,
        agent_positions: torch.Tensor,
        agent_angles: torch.Tensor,
        raycast_config: Dict,
        active_mask: torch.Tensor
    ) -> torch.Tensor:
        """
        Legacy step-based raycast (kept for comparison/verification).
        """
        num_agents = agent_positions.shape[0]
        raycast_count = raycast_config['count']
        max_distance = raycast_config['max_distance']
        angles_deg = raycast_config.get('angles', np.linspace(0, 360, raycast_count))
        angles_rad = np.radians(angles_deg)
        
        if not hasattr(self, '_raycast_angles') or self._raycast_angles.shape[0] != raycast_count:
            self._raycast_angles = torch.tensor(angles_rad, dtype=torch.float32, device=self.device)
        
        agent_angles_expanded = agent_angles.unsqueeze(1) + self._raycast_angles.unsqueeze(0)
        ray_dx = torch.cos(agent_angles_expanded)
        ray_dy = torch.sin(agent_angles_expanded)
        results = torch.full((num_agents, raycast_count, 4), max_distance, dtype=torch.float32, device=self.device)
        
        step_size = 10.0
        steps = int(max_distance / step_size)
        
        if not hasattr(self, '_step_distances') or self._step_distances.shape[0] != steps:
            self._step_distances = torch.arange(1, steps + 1, dtype=torch.float32, device=self.device) * step_size
        
        chunk_size = min(32, num_agents)
        
        for chunk_start in range(0, num_agents, chunk_size):
            chunk_end = min(chunk_start + chunk_size, num_agents)
            chunk_positions = agent_positions[chunk_start:chunk_end]
            chunk_ray_dx = ray_dx[chunk_start:chunk_end]
            chunk_ray_dy = ray_dy[chunk_start:chunk_end]
            
            step_distances_expanded = self._step_distances.view(1, 1, -1)
            check_x = chunk_positions[:, 0:1].unsqueeze(2) + chunk_ray_dx.unsqueeze(2) * step_distances_expanded
            check_y = chunk_positions[:, 1:2].unsqueeze(2) + chunk_ray_dy.unsqueeze(2) * step_distances_expanded
            
            if self.toroidal:
                check_x = check_x % self.width
                check_y = check_y % self.height
            
            if len(self.food) > 0 and self.food_positions.shape[0] > 0:
                unconsumed_mask = ~self.food_consumed
                if unconsumed_mask.any():
                    unconsumed_food_positions = self.food_positions[unconsumed_mask]
                    food_x = unconsumed_food_positions[:, 0]
                    food_y = unconsumed_food_positions[:, 1]
                    
                    check_x_expanded = check_x.unsqueeze(3)
                    check_y_expanded = check_y.unsqueeze(3)
                    food_x_expanded = food_x.unsqueeze(0).unsqueeze(0).unsqueeze(0)
                    food_y_expanded = food_y.unsqueeze(0).unsqueeze(0).unsqueeze(0)
                    
                    dx = check_x_expanded - food_x_expanded
                    dy = check_y_expanded - food_y_expanded
                    if self.toroidal:
                        dx_abs = torch.abs(dx)
                        dx = torch.minimum(dx_abs, torch.minimum(torch.abs(dx + self.width), torch.abs(dx - self.width)))
                        dy_abs = torch.abs(dy)
                        dy = torch.minimum(dy_abs, torch.minimum(torch.abs(dy + self.height), torch.abs(dy - self.height)))
                    
                    distances_sq = dx**2 + dy**2
                    food_radius_sq = self.food_radius ** 2
                    min_distances_sq = distances_sq.min(dim=3)[0]
                    food_collision_mask = min_distances_sq < food_radius_sq
                    
                    if food_collision_mask.any():
                        food_collision_steps = torch.argmax(food_collision_mask.float(), dim=2)
                        food_distances = self._step_distances[food_collision_steps] * food_collision_mask.any(dim=2).float()
                        results[chunk_start:chunk_end, :, 1] = torch.minimum(
                            results[chunk_start:chunk_end, :, 1], 
                            food_distances
                        )
        
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
        FULLY VECTORIZED food consumption check on GPU.
        
        Eliminates Python loops by using:
        - Vectorized distance calculations
        - torch.scatter_add for energy accumulation
        - Pure tensor operations for collision resolution
        
        Args:
            agent_positions: Tensor of shape (num_agents, 2) with [x, y]
            agent_energies: Tensor of shape (num_agents,) with current energies
            active_mask: Boolean tensor indicating which agents are active
            
        Returns:
            Tuple of (updated_energies, food_consumed_mask)
            - updated_energies: Updated energy values after food consumption
            - food_consumed_mask: Boolean tensor indicating which food items were consumed
        """
        num_food_total = len(self.food)
        num_agents = agent_positions.shape[0]
        
        if self.food_positions.shape[0] == 0:
            return agent_energies, torch.zeros(0, dtype=torch.bool, device=self.device)
        
        # Get unconsumed food mask
        unconsumed_mask = ~self.food_consumed
        if not unconsumed_mask.any():
            return agent_energies, torch.zeros(num_food_total, dtype=torch.bool, device=self.device)
        
        unconsumed_food_positions = self.food_positions[unconsumed_mask]
        unconsumed_indices = torch.where(unconsumed_mask)[0]  # Global indices of unconsumed food
        num_unconsumed = unconsumed_food_positions.shape[0]
        
        if num_unconsumed == 0:
            return agent_energies, torch.zeros(num_food_total, dtype=torch.bool, device=self.device)
        
        # Only check active agents
        if not active_mask.any():
            return agent_energies, torch.zeros(num_food_total, dtype=torch.bool, device=self.device)
        
        active_positions = agent_positions[active_mask]
        active_indices = torch.where(active_mask)[0]  # Global indices of active agents
        num_active = active_positions.shape[0]
        
        if num_active == 0:
            return agent_energies, torch.zeros(num_food_total, dtype=torch.bool, device=self.device)
        
        # Calculate distances: (num_unconsumed, num_active)
        # Using squared distances to avoid sqrt for threshold check
        food_expanded = unconsumed_food_positions.unsqueeze(1)  # (F, 1, 2)
        agent_expanded = active_positions.unsqueeze(0)  # (1, A, 2)
        
        dx = food_expanded[:, :, 0] - agent_expanded[:, :, 0]  # (F, A)
        dy = food_expanded[:, :, 1] - agent_expanded[:, :, 1]  # (F, A)
        
        if self.toroidal:
            # Toroidal distance - vectorized
            dx = torch.where(
                torch.abs(dx) > self.width / 2,
                dx - torch.sign(dx) * self.width,
                dx
            )
            dy = torch.where(
                torch.abs(dy) > self.height / 2,
                dy - torch.sign(dy) * self.height,
                dy
            )
        
        # Use squared distance for faster comparison
        distances_sq = dx**2 + dy**2  # (F, A)
        collision_threshold_sq = (self.agent_radius + self.food_radius) ** 2
        
        # Collision matrix: (num_unconsumed, num_active)
        collision_matrix = distances_sq < collision_threshold_sq
        
        # Initialize output
        food_consumed_mask = torch.zeros(num_food_total, dtype=torch.bool, device=self.device)
        
        if not collision_matrix.any():
            return agent_energies, food_consumed_mask
        
        # FULLY VECTORIZED collision resolution:
        # For each food that has any collision, find the closest agent
        
        # Mask invalid distances (non-colliding) with inf for argmin
        distances_masked = torch.where(collision_matrix, distances_sq, torch.full_like(distances_sq, float('inf')))
        
        # Find closest agent for each food (local indices within active agents)
        closest_agent_local = distances_masked.argmin(dim=1)  # (F,)
        
        # Which food items have any collision?
        food_has_collision = collision_matrix.any(dim=1)  # (F,)
        
        # Get global agent indices for foods with collisions
        # closest_agent_local is index into active_indices
        closest_agent_global = active_indices[closest_agent_local]  # (F,) - global agent indices
        
        # Accumulate energy using scatter_add
        # Only for foods that actually had a collision
        energy_to_add = torch.zeros(num_agents, dtype=torch.float32, device=self.device)
        
        # Create energy values for each food (food_energy for colliding, 0 otherwise)
        food_energy_values = torch.where(
            food_has_collision,
            torch.full((num_unconsumed,), self.food_energy, dtype=torch.float32, device=self.device),
            torch.zeros(num_unconsumed, dtype=torch.float32, device=self.device)
        )
        
        # Scatter add: accumulate energy for each agent
        energy_to_add.scatter_add_(0, closest_agent_global, food_energy_values)
        
        # Update energies
        updated_energies = agent_energies + energy_to_add
        
        # Mark consumed food (map back to global food indices)
        # unconsumed_indices[food_has_collision] gives global indices of consumed food
        consumed_global_indices = unconsumed_indices[food_has_collision]
        food_consumed_mask[consumed_global_indices] = True
        
        return updated_energies, food_consumed_mask
    
    def batch_check_food_consumption_legacy(
        self,
        agent_positions: torch.Tensor,
        agent_energies: torch.Tensor,
        active_mask: torch.Tensor
    ) -> Tuple[torch.Tensor, torch.Tensor]:
        """
        Legacy food consumption check with Python loop (kept for verification).
        """
        if self.food_positions.shape[0] == 0:
            return agent_energies, torch.zeros(0, dtype=torch.bool, device=self.device)
        
        unconsumed_mask = ~self.food_consumed
        if not unconsumed_mask.any():
            return agent_energies, torch.zeros(len(self.food), dtype=torch.bool, device=self.device)
        
        unconsumed_food_positions = self.food_positions[unconsumed_mask]
        unconsumed_food_indices = torch.where(unconsumed_mask)[0]
        num_unconsumed = unconsumed_food_positions.shape[0]
        
        if num_unconsumed == 0:
            return agent_energies, torch.zeros(len(self.food), dtype=torch.bool, device=self.device)
        
        active_positions = agent_positions[active_mask]
        active_indices = torch.where(active_mask)[0]
        num_active = active_positions.shape[0]
        
        if num_active == 0:
            return agent_energies, torch.zeros(len(self.food), dtype=torch.bool, device=self.device)
        
        food_expanded = unconsumed_food_positions.unsqueeze(1)
        agent_expanded = active_positions.unsqueeze(0)
        
        dx = food_expanded[:, :, 0] - agent_expanded[:, :, 0]
        dy = food_expanded[:, :, 1] - agent_expanded[:, :, 1]
        
        if self.toroidal:
            dx_abs = torch.abs(dx)
            dx = torch.minimum(dx_abs, torch.minimum(torch.abs(dx + self.width), torch.abs(dx - self.width)))
            dy_abs = torch.abs(dy)
            dy = torch.minimum(dy_abs, torch.minimum(torch.abs(dy + self.height), torch.abs(dy - self.height)))
        
        distances = torch.sqrt(dx**2 + dy**2)
        collision_threshold = self.agent_radius + self.food_radius
        collision_matrix = distances < collision_threshold
        
        food_consumed_mask = torch.zeros(len(self.food), dtype=torch.bool, device=self.device)
        updated_energies = agent_energies.clone()
        
        if collision_matrix.any():
            for food_idx_local, food_idx_global in enumerate(unconsumed_food_indices):
                if collision_matrix[food_idx_local].any():
                    agent_idx_local = torch.argmax(collision_matrix[food_idx_local].float())
                    agent_idx_global = active_indices[agent_idx_local]
                    food_consumed_mask[food_idx_global] = True
                    updated_energies[agent_idx_global] += self.food_energy
        
        return updated_energies, food_consumed_mask
