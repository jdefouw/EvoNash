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
        Advance simulation by one tick.
        
        Args:
            agents: List of Agent objects to simulate
            
        Returns:
            Dictionary with simulation state
        """
        self.tick += 1
        
        # Update agents
        for agent in agents:
            if agent.energy <= 0:
                continue
            
            # Energy decay (metabolism)
            agent.energy -= self.energy_decay_rate * self.dt
            
            # Apply physics
            agent.vx *= (1 - self.friction)
            agent.vy *= (1 - self.friction)
            
            # Limit velocity
            speed = np.sqrt(agent.vx**2 + agent.vy**2)
            if speed > self.max_velocity:
                agent.vx = (agent.vx / speed) * self.max_velocity
                agent.vy = (agent.vy / speed) * self.max_velocity
            
            # Update position
            agent.x += agent.vx * self.dt
            agent.y += agent.vy * self.dt
            
            # Wrap position
            agent.x, agent.y = self._wrap_position(agent.x, agent.y)
            
            # Update cooldowns
            if agent.shoot_cooldown > 0:
                agent.shoot_cooldown -= 1
            if agent.split_cooldown > 0:
                agent.split_cooldown -= 1
        
        # Check food consumption
        for food in self.food:
            if food.consumed:
                continue
            
            for agent in agents:
                if agent.energy <= 0:
                    continue
                
                dist = self._distance(agent.x, agent.y, food.x, food.y)
                if dist < (self.agent_radius + self.food_radius):
                    agent.energy += food.energy_value
                    food.consumed = True
                    break
        
        # Update projectiles
        for proj in self.projectiles[:]:
            if not proj.active:
                self.projectiles.remove(proj)
                continue
            
            proj.age += 1
            if proj.age >= proj.lifetime:
                proj.active = False
                continue
            
            # Move projectile
            proj.x += proj.vx * self.dt
            proj.y += proj.vy * self.dt
            proj.x, proj.y = self._wrap_position(proj.x, proj.y)
            
            # Check collisions with agents
            for agent in agents:
                if agent.energy <= 0 or agent.id == proj.owner_id:
                    continue
                
                dist = self._distance(agent.x, agent.y, proj.x, proj.y)
                if dist < (self.agent_radius + self.proj_radius):
                    agent.energy -= proj.damage
                    proj.active = False
                    break
        
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
