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
    
    def __init__(self, config_path: Optional[str] = None):
        """
        Initialize the Petri Dish.
        
        Args:
            config_path: Path to simulation_config.json. If None, uses defaults.
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
        self.ticks_per_generation = sim_config['ticks_per_generation']
        
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
        Perform raycasts from agent position.
        
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
        
        # Optimize: pre-filter unconsumed food
        active_food = [f for f in self.food if not f.consumed]
        
        for i, angle_deg in enumerate(angles):
            angle_rad = np.radians(angle_deg)
            dx = np.cos(angle_rad)
            dy = np.sin(angle_rad)
            
            wall_dist = max_distance
            food_dist = max_distance
            enemy_dist = max_distance
            enemy_size = 0.0
            
            # Cast ray
            steps = int(max_distance / 2)
            for step in range(1, steps + 1):
                check_x = agent.x + dx * step * 2
                check_y = agent.y + dy * step * 2
                check_x, check_y = self._wrap_position(check_x, check_y)
                
                dist = step * 2
                
                # Check wall collision
                if not self.toroidal:
                    if check_x < 0 or check_x > self.width or check_y < 0 or check_y > self.height:
                        if dist < wall_dist:
                            wall_dist = dist
                        break
                
                # Check food (optimized: only check if we haven't found food yet, and use pre-filtered list)
                if food_dist >= max_distance:  # Only check if we haven't found food
                    for food in active_food:
                        food_dist_check = self._distance(check_x, check_y, food.x, food.y)
                        if food_dist_check < self.food_radius:
                            food_dist = dist
                            break  # Found food, no need to check further
                
                # Check enemies (would need access to all agents)
                # This is simplified - in full implementation, would check all agents
                # For now, return max_distance as placeholder
            
            results[i] = [wall_dist, food_dist, enemy_dist, enemy_size]
        
        return results
    
    def reset(self):
        """Reset the simulation to initial state."""
        self.tick = 0
        self.food_respawn_timer = 0
        self.projectiles = []
        self._spawn_food()
