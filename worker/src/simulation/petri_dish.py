"""
The Petri Dish: A deterministic 2D continuous toroidal space simulation.
Implements frictionless Euler integration physics with agents, food, and projectiles.
"""

import numpy as np
import torch
from typing import List, Tuple, Optional, Dict
from pathlib import Path
import json


class Food:
    """Food pellet entity."""
    
    def __init__(self, x: float, y: float, energy_value: float = 10.0):
        self.x = x
        self.y = y
        self.energy_value = energy_value
        self.consumed = False


class Projectile:
    """Projectile entity for predation."""
    
    def __init__(self, x: float, y: float, vx: float, vy: float, owner_id: int, 
                 speed: float = 10.0, damage: float = 20.0, lifetime: int = 200):
        self.x = x
        self.y = y
        self.vx = vx
        self.vy = vy
        self.owner_id = owner_id
        self.speed = speed
        self.damage = damage
        self.lifetime = lifetime
        self.age = 0
        self.active = True


class PetriDish:
    """
    The Petri Dish: 2D continuous toroidal space simulation environment.
    
    Features:
    - Toroidal topology (wrap-around borders)
    - Frictionless Euler integration physics
    - Agents with energy/metabolism
    - Food pellets
    - Projectile system for predation
    """
    
    def __init__(self, config_path: Optional[str] = None, ticks_per_generation: Optional[int] = None):
        """
        Initialize the Petri Dish.
        
        Args:
            config_path: Path to simulation_config.json. If None, uses defaults.
            ticks_per_generation: Override ticks_per_generation from config. If None, uses config value.
        """
        if config_path:
            with open(config_path, 'r', encoding='utf-8') as f:
                self.config = json.load(f)
        else:
            # Default config
            default_config_path = Path(__file__).parent.parent.parent / 'config' / 'simulation_config.json'
            with open(default_config_path, 'r', encoding='utf-8') as f:
                self.config = json.load(f)
        
        # Extract config values
        pd_config = self.config['petri_dish']
        self.width = pd_config['width']
        self.height = pd_config['height']
        self.toroidal = pd_config['toroidal']
        
        phys_config = self.config['physics']
        self.gravity = phys_config['gravity']
        self.friction = phys_config['friction']
        self.dt = phys_config['dt']
        
        agent_config = self.config['agent']
        self.agent_radius = agent_config['radius']
        self.initial_energy = agent_config['initial_energy']
        self.energy_decay_rate = agent_config['energy_decay_rate']
        self.movement_cost = agent_config['movement_cost']
        self.max_velocity = agent_config['max_velocity']
        self.thrust_force = agent_config['thrust_force']
        self.turn_rate = agent_config['turn_rate']
        self.shoot_cooldown = agent_config['shoot_cooldown']
        self.split_cooldown = agent_config['split_cooldown']
        
        food_config = self.config['food']
        self.food_radius = food_config['radius']
        self.food_energy = food_config['energy_value']
        self.food_spawn_count = food_config['spawn_count']
        self.food_respawn_time = food_config['respawn_time']
        
        proj_config = self.config['projectile']
        self.proj_radius = proj_config['radius']
        self.proj_speed = proj_config['speed']
        self.proj_damage = proj_config['damage']
        self.proj_lifetime = proj_config['lifetime']
        
        sim_config = self.config['simulation']
        # Use provided ticks_per_generation or fall back to config
        self.ticks_per_generation = ticks_per_generation if ticks_per_generation is not None else sim_config['ticks_per_generation']
        
        # State
        self.food: List[Food] = []
        self.projectiles: List[Projectile] = []
        self.tick = 0
        self.food_respawn_timer = 0
        
        # Initialize food
        self._spawn_food()
    
    def _spawn_food(self):
        """Spawn food pellets randomly across the dish."""
        self.food = []
        for _ in range(self.food_spawn_count):
            x = np.random.uniform(0, self.width)
            y = np.random.uniform(0, self.height)
            self.food.append(Food(x, y, self.food_energy))
    
    def _wrap_position(self, x: float, y: float) -> Tuple[float, float]:
        """Wrap position to toroidal space."""
        if self.toroidal:
            x = x % self.width
            y = y % self.height
        else:
            x = np.clip(x, 0, self.width)
            y = np.clip(y, 0, self.height)
        return x, y
    
    def _distance(self, x1: float, y1: float, x2: float, y2: float) -> float:
        """Calculate distance between two points with toroidal wrapping."""
        dx = x2 - x1
        dy = y2 - y1
        
        if self.toroidal:
            dx = min(abs(dx), abs(dx + self.width), abs(dx - self.width), key=abs)
            dy = min(abs(dy), abs(dy + self.height), abs(dy - self.height), key=abs)
        
        return np.sqrt(dx**2 + dy**2)
    
    def step(self, agents: List['Agent']) -> Dict:
        """
        Advance simulation by one tick (OPTIMIZED with vectorized operations).
        
        Args:
            agents: List of Agent objects to simulate
            
        Returns:
            Dictionary with simulation state
        """
        self.tick += 1
        
        # OPTIMIZATION: Vectorize agent updates where possible
        # Collect active agents for batch processing
        active_agents = [a for a in agents if a.energy > 0]
        if not active_agents:
            # All agents dead, skip updates
            pass
        else:
            # Batch update agent physics using numpy arrays
            num_active = len(active_agents)
            agent_x = np.array([a.x for a in active_agents])
            agent_y = np.array([a.y for a in active_agents])
            agent_vx = np.array([a.vx for a in active_agents])
            agent_vy = np.array([a.vy for a in active_agents])
            agent_energies = np.array([a.energy for a in active_agents])
            
            # Energy decay (vectorized)
            agent_energies -= self.energy_decay_rate * self.dt
            
            # Apply friction (vectorized)
            agent_vx *= (1 - self.friction)
            agent_vy *= (1 - self.friction)
            
            # Limit velocity (vectorized)
            speeds = np.sqrt(agent_vx**2 + agent_vy**2)
            speed_mask = speeds > self.max_velocity
            if speed_mask.any():
                scale_factors = np.where(speed_mask, self.max_velocity / speeds, 1.0)
                agent_vx *= scale_factors
                agent_vy *= scale_factors
            
            # Update positions (vectorized)
            agent_x += agent_vx * self.dt
            agent_y += agent_vy * self.dt
            
            # Wrap positions (vectorized)
            if self.toroidal:
                agent_x = agent_x % self.width
                agent_y = agent_y % self.height
            else:
                agent_x = np.clip(agent_x, 0, self.width)
                agent_y = np.clip(agent_y, 0, self.height)
            
            # Write back to agents
            for i, agent in enumerate(active_agents):
                agent.x = float(agent_x[i])
                agent.y = float(agent_y[i])
                agent.vx = float(agent_vx[i])
                agent.vy = float(agent_vy[i])
                agent.energy = max(0.0, float(agent_energies[i]))
        
        # Update cooldowns for ALL agents (cooldowns continue even if dead)
        for agent in agents:
            if agent.shoot_cooldown > 0:
                agent.shoot_cooldown -= 1
            if agent.split_cooldown > 0:
                agent.split_cooldown -= 1
        
        # OPTIMIZATION: Vectorized food consumption check
        # Re-get active agents in case energy changed
        active_agents = [a for a in agents if a.energy > 0]
        if active_agents and len(self.food) > 0:
            # Get unconsumed food
            unconsumed_food = [f for f in self.food if not f.consumed]
            if unconsumed_food:
                # Convert to numpy arrays for vectorized distance calculation
                food_positions = np.array([[f.x, f.y] for f in unconsumed_food])  # (num_food, 2)
                agent_positions = np.array([[a.x, a.y] for a in active_agents])  # (num_agents, 2)
                
                # Calculate all distances at once using broadcasting
                # food_positions: (num_food, 2), agent_positions: (num_agents, 2)
                # Expand for broadcasting: (num_food, 1, 2) - (1, num_agents, 2) = (num_food, num_agents, 2)
                food_expanded = food_positions[:, np.newaxis, :]  # (num_food, 1, 2)
                agent_expanded = agent_positions[np.newaxis, :, :]  # (1, num_agents, 2)
                
                if self.toroidal:
                    # Toroidal distance calculation
                    dx = food_expanded[:, :, 0] - agent_expanded[:, :, 0]  # (num_food, num_agents)
                    dy = food_expanded[:, :, 1] - agent_expanded[:, :, 1]  # (num_food, num_agents)
                    dx = np.minimum(np.minimum(np.abs(dx), np.abs(dx + self.width)), np.abs(dx - self.width))
                    dy = np.minimum(np.minimum(np.abs(dy), np.abs(dy + self.height)), np.abs(dy - self.height))
                    distances = np.sqrt(dx**2 + dy**2)  # (num_food, num_agents)
                else:
                    # Euclidean distance
                    diff = food_expanded - agent_expanded  # (num_food, num_agents, 2)
                    distances = np.linalg.norm(diff, axis=2)  # (num_food, num_agents)
                
                # Check collisions: distance < (agent_radius + food_radius)
                collision_threshold = self.agent_radius + self.food_radius
                collision_matrix = distances < collision_threshold  # (num_food, num_agents)
                
                # Process collisions: each food can only be consumed once
                # Find first agent that collides with each food
                for food_idx, food in enumerate(unconsumed_food):
                    if collision_matrix[food_idx].any():
                        # Find first colliding agent
                        agent_idx = np.argmax(collision_matrix[food_idx])
                        agent = active_agents[agent_idx]
                        # Consume food
                        agent.energy += food.energy_value
                        food.consumed = True
        
        # OPTIMIZATION: Vectorized projectile updates and collision detection
        active_projectiles = [p for p in self.projectiles if p.active]
        if active_projectiles:
            # Batch update projectile positions
            proj_x = np.array([p.x for p in active_projectiles])
            proj_y = np.array([p.y for p in active_projectiles])
            proj_vx = np.array([p.vx for p in active_projectiles])
            proj_vy = np.array([p.vy for p in active_projectiles])
            proj_ages = np.array([p.age for p in active_projectiles])
            proj_owner_ids = np.array([p.owner_id for p in active_projectiles])
            
            # Update ages
            proj_ages += 1
            
            # Move projectiles (vectorized)
            proj_x += proj_vx * self.dt
            proj_y += proj_vy * self.dt
            
            # Wrap positions (vectorized)
            if self.toroidal:
                proj_x = proj_x % self.width
                proj_y = proj_y % self.height
            else:
                proj_x = np.clip(proj_x, 0, self.width)
                proj_y = np.clip(proj_y, 0, self.height)
            
            # Write back positions and ages
            for i, proj in enumerate(active_projectiles):
                proj.x = float(proj_x[i])
                proj.y = float(proj_y[i])
                proj.age = int(proj_ages[i])
                
                # Check lifetime
                if proj.age >= proj.lifetime:
                    proj.active = False
                    continue
            
            # Vectorized collision detection with agents
            # Re-get active agents in case energy changed from food consumption
            active_agents = [a for a in agents if a.energy > 0]
            if active_agents:
                # Get active projectiles again (after lifetime check)
                still_active_projs = [(i, p) for i, p in enumerate(active_projectiles) if p.active]
                if still_active_projs:
                    active_proj_indices, active_projs = zip(*still_active_projs)
                    proj_positions = np.array([[p.x, p.y] for p in active_projs])  # (num_proj, 2)
                    proj_owner_ids_active = np.array([p.owner_id for p in active_projs])  # (num_proj,)
                    agent_positions = np.array([[a.x, a.y] for a in active_agents])  # (num_agents, 2)
                    agent_ids = np.array([a.id for a in active_agents])  # (num_agents,)
                    
                    # Calculate all distances at once
                    # proj_positions: (num_proj, 2), agent_positions: (num_agents, 2)
                    proj_expanded = proj_positions[:, np.newaxis, :]  # (num_proj, 1, 2)
                    agent_expanded = agent_positions[np.newaxis, :, :]  # (1, num_agents, 2)
                    
                    if self.toroidal:
                        dx = proj_expanded[:, :, 0] - agent_expanded[:, :, 0]
                        dy = proj_expanded[:, :, 1] - agent_expanded[:, :, 1]
                        dx = np.minimum(np.minimum(np.abs(dx), np.abs(dx + self.width)), np.abs(dx - self.width))
                        dy = np.minimum(np.minimum(np.abs(dy), np.abs(dy + self.height)), np.abs(dy - self.height))
                        distances = np.sqrt(dx**2 + dy**2)
                    else:
                        diff = proj_expanded - agent_expanded
                        distances = np.linalg.norm(diff, axis=2)
                    
                    # Check collisions: exclude same owner
                    collision_threshold = self.agent_radius + self.proj_radius
                    owner_mask = proj_owner_ids_active[:, np.newaxis] != agent_ids[np.newaxis, :]  # (num_proj, num_agents)
                    collision_matrix = (distances < collision_threshold) & owner_mask  # (num_proj, num_agents)
                    
                    # Process collisions: each projectile can only hit one agent
                    for proj_idx, proj in enumerate(active_projs):
                        if collision_matrix[proj_idx].any():
                            # Find first colliding agent
                            agent_idx = np.argmax(collision_matrix[proj_idx])
                            agent = active_agents[agent_idx]
                            # Apply damage
                            agent.energy = max(0.0, agent.energy - proj.damage)
                            proj.active = False
        
        # Clean up inactive projectiles
        self.projectiles = [p for p in self.projectiles if p.active]
        
        # Respawn food
        self.food_respawn_timer += 1
        if self.food_respawn_timer >= self.food_respawn_time:
            self._spawn_food()
            self.food_respawn_timer = 0
        
        return {
            'tick': self.tick,
            'food_count': sum(1 for f in self.food if not f.consumed),
            'projectile_count': len(self.projectiles)
        }
    
    def get_raycast_data(self, agent: 'Agent', raycast_config: Dict) -> np.ndarray:
        """
        Perform raycasts from agent position (optimized with vectorization).
        
        Args:
            agent: Agent to raycast from
            raycast_config: Configuration with count, max_distance, angles
            
        Returns:
            Array of shape (raycast_count, 4) with [wall_dist, food_dist, enemy_dist, enemy_size]
        """
        raycast_count = raycast_config['count']
        max_distance = raycast_config['max_distance']
        angles = raycast_config.get('angles', np.linspace(0, 360, raycast_count))
        
        results = np.zeros((raycast_count, 4))
        
        # Optimize: pre-filter unconsumed food and convert to numpy array for vectorization
        active_food = [f for f in self.food if not f.consumed]
        if len(active_food) > 0:
            food_positions = np.array([[f.x, f.y] for f in active_food])  # (num_food, 2)
        else:
            food_positions = np.zeros((0, 2))
        
        # Vectorize angle calculations
        angles_rad = np.radians(angles)  # (raycast_count,)
        ray_directions = np.column_stack([np.cos(angles_rad), np.sin(angles_rad)])  # (raycast_count, 2)
        
        # Optimized step size for better performance
        step_size = 10.0  # Larger step size for faster raycasting
        steps = int(max_distance / step_size)
        
        agent_pos = np.array([agent.x, agent.y])
        
        for i, (angle_rad, ray_dir) in enumerate(zip(angles_rad, ray_directions)):
            dx, dy = ray_dir
            
            wall_dist = max_distance
            food_dist = max_distance
            enemy_dist = max_distance
            enemy_size = 0.0
            
            # Vectorized step positions
            step_distances = np.arange(1, steps + 1) * step_size  # (steps,)
            check_positions = agent_pos + ray_dir.reshape(1, 2) * step_distances.reshape(-1, 1)  # (steps, 2)
            
            # Wrap positions
            if self.toroidal:
                check_positions[:, 0] = check_positions[:, 0] % self.width
                check_positions[:, 1] = check_positions[:, 1] % self.height
            else:
                check_positions[:, 0] = np.clip(check_positions[:, 0], 0, self.width)
                check_positions[:, 1] = np.clip(check_positions[:, 1], 0, self.height)
            
            # Check wall collisions (vectorized)
            if not self.toroidal:
                wall_mask = (check_positions[:, 0] < 0) | (check_positions[:, 0] > self.width) | \
                           (check_positions[:, 1] < 0) | (check_positions[:, 1] > self.height)
                if wall_mask.any():
                    first_wall_idx = np.argmax(wall_mask)
                    wall_dist = step_distances[first_wall_idx]
            
            # Check food collisions (vectorized)
            if len(active_food) > 0:
                # Calculate distances from all check positions to all food (vectorized)
                # check_positions: (steps, 2), food_positions: (num_food, 2)
                # Expand for broadcasting: (steps, 1, 2) - (1, num_food, 2) = (steps, num_food, 2)
                check_expanded = check_positions[:, np.newaxis, :]  # (steps, 1, 2)
                food_expanded = food_positions[np.newaxis, :, :]  # (1, num_food, 2)
                
                if self.toroidal:
                    # Toroidal distance
                    dx_tor = check_expanded[:, :, 0] - food_expanded[:, :, 0]
                    dy_tor = check_expanded[:, :, 1] - food_expanded[:, :, 1]
                    dx_tor = np.minimum(np.minimum(np.abs(dx_tor), np.abs(dx_tor + self.width)), np.abs(dx_tor - self.width))
                    dy_tor = np.minimum(np.minimum(np.abs(dy_tor), np.abs(dy_tor + self.height)), np.abs(dy_tor - self.height))
                    distances = np.sqrt(dx_tor**2 + dy_tor**2)  # (steps, num_food)
                else:
                    diff = check_expanded - food_expanded  # (steps, num_food, 2)
                    distances = np.linalg.norm(diff, axis=2)  # (steps, num_food)
                
                # Find food collisions (within food radius)
                food_mask = distances < self.food_radius  # (steps, num_food)
                if food_mask.any():
                    # Find first collision for each step, then first step with collision
                    first_collision_step = np.argmax(food_mask.any(axis=1))
                    if food_mask[first_collision_step].any():
                        food_dist = step_distances[first_collision_step]
            
            # Enemy detection would go here (similar vectorized approach)
            # For now, leave as max_distance
            
            results[i] = [wall_dist, food_dist, enemy_dist, enemy_size]
        
        return results
    
    def reset(self):
        """Reset the simulation to initial state."""
        self.tick = 0
        self.food_respawn_timer = 0
        self.projectiles = []
        self._spawn_food()
