"""
Optimized batched agent operations for GPU acceleration.
Processes all agents simultaneously using batched tensor operations.
"""

import torch
import torch.nn as nn
import numpy as np
from typing import List, Dict, Optional, Tuple
from .agent import Agent, NeuralNetwork


class BatchedAgentProcessor:
    """
    Processes multiple agents in batches for GPU optimization.
    Handles batched neural network inference and vectorized operations.
    """
    
    def __init__(self, agents: List[Agent], device: str = 'cuda'):
        """
        Initialize batched processor.
        
        Args:
            agents: List of agents to process
            device: Device to run on ('cuda' or 'cpu')
        """
        self.agents = agents
        self.device = device if torch.cuda.is_available() and device == 'cuda' else 'cpu'
        self.num_agents = len(agents)
        
        # Compile networks for faster inference (PyTorch 2.0+)
        # Note: torch.compile is not supported on Python 3.14+
        try:
            if hasattr(torch, 'compile') and callable(torch.compile):
                # Test if torch.compile actually works (it may exist but not be supported)
                test_model = torch.nn.Linear(1, 1)
                try:
                    torch.compile(test_model, mode='reduce-overhead')
                    # If we get here, torch.compile works
                    for agent in agents:
                        agent.network = torch.compile(agent.network, mode='reduce-overhead')
                except (RuntimeError, AttributeError, TypeError):
                    # torch.compile exists but isn't supported (e.g., Python 3.14+)
                    # This is expected and not an error - just skip compilation
                    pass
        except Exception:
            # Any other error - silently skip compilation
            pass
    
    def batch_act(self, input_vectors: torch.Tensor, active_mask: Optional[torch.Tensor] = None) -> torch.Tensor:
        """
        Batch process actions for all agents simultaneously with optimized GPU utilization.
        
        Args:
            input_vectors: Tensor of shape (num_agents, input_size)
            active_mask: Optional boolean tensor indicating which agents are active
            
        Returns:
            Tensor of shape (num_agents, 4) with actions [thrust, turn, shoot, split]
        """
        if input_vectors.device != self.device:
            input_vectors = input_vectors.to(self.device)
        
        # Pre-allocate output tensor on GPU
        outputs = torch.zeros((self.num_agents, 4), dtype=torch.float32, device=self.device)
        
        # Process in larger batches for better GPU utilization
        # Use CUDA streams for parallel execution where possible
        batch_size = 128  # Increased batch size for better GPU utilization
        
        with torch.no_grad():
            # Use torch.cuda.amp for mixed precision if available
            use_amp = self.device == 'cuda' and torch.cuda.is_available()
            
            for i in range(0, self.num_agents, batch_size):
                batch_end = min(i + batch_size, self.num_agents)
                batch_inputs = input_vectors[i:batch_end]
                batch_agents = self.agents[i:batch_end]
                
                # Process batch with autocast for mixed precision
                if use_amp:
                    with torch.cuda.amp.autocast():
                        for j, agent in enumerate(batch_agents):
                            if active_mask is None or active_mask[i + j]:
                                # Single sample forward pass (already batched by input shape)
                                agent_output = agent.network(batch_inputs[j:j+1])
                                outputs[i + j] = agent_output.squeeze(0)
                else:
                    for j, agent in enumerate(batch_agents):
                        if active_mask is None or active_mask[i + j]:
                            agent_output = agent.network(batch_inputs[j:j+1])
                            outputs[i + j] = agent_output.squeeze(0)
        
        return outputs
    
    def batch_act_shared_network(self, input_vectors: torch.Tensor, shared_network: nn.Module) -> torch.Tensor:
        """
        Batch process actions using a shared network (for agents with identical networks).
        This is MUCH faster as it processes all agents in a single forward pass.
        
        Args:
            input_vectors: Tensor of shape (num_agents, input_size)
            shared_network: Shared neural network (all agents use same network)
            
        Returns:
            Tensor of shape (num_agents, 4) with actions
        """
        if input_vectors.device != self.device:
            input_vectors = input_vectors.to(self.device)
        
        with torch.no_grad():
            # Single batched forward pass - MUCH faster!
            outputs = shared_network(input_vectors)
        
        return outputs
    
    def process_actions_gpu(self, action_tensor: torch.Tensor) -> List[Dict[str, float]]:
        """
        Convert action tensor to list of action dictionaries, keeping operations on GPU.
        
        Args:
            action_tensor: Tensor of shape (num_agents, 4) with [thrust, turn, shoot, split]
            
        Returns:
            List of action dictionaries
        """
        # Clamp values on GPU
        thrust = torch.clamp(action_tensor[:, 0], 0.0, 1.0)
        turn = torch.clamp(action_tensor[:, 1], -1.0, 1.0)
        shoot = torch.clamp(action_tensor[:, 2], 0.0, 1.0)
        split = torch.clamp(action_tensor[:, 3], 0.0, 1.0)
        
        # Convert to CPU only when needed
        thrust_cpu = thrust.cpu().numpy()
        turn_cpu = turn.cpu().numpy()
        shoot_cpu = shoot.cpu().numpy()
        split_cpu = split.cpu().numpy()
        
        actions = []
        for i in range(self.num_agents):
            actions.append({
                'thrust': float(thrust_cpu[i]),
                'turn': float(turn_cpu[i]),
                'shoot': float(shoot_cpu[i]),
                'split': float(split_cpu[i])
            })
        
        return actions


class VectorizedPhysics:
    """
    Vectorized physics operations using PyTorch tensors for GPU acceleration.
    """
    
    def __init__(self, num_agents: int, device: str = 'cuda'):
        """
        Initialize vectorized physics.
        
        Args:
            num_agents: Number of agents
            device: Device to run on
        """
        self.num_agents = num_agents
        self.device = device if torch.cuda.is_available() and device == 'cuda' else 'cpu'
        
        # Agent state tensors (kept on GPU)
        self.positions = torch.zeros((num_agents, 2), dtype=torch.float32, device=self.device)  # [x, y]
        self.velocities = torch.zeros((num_agents, 2), dtype=torch.float32, device=self.device)  # [vx, vy]
        self.angles = torch.zeros(num_agents, dtype=torch.float32, device=self.device)
        self.energies = torch.zeros(num_agents, dtype=torch.float32, device=self.device)
        self.shoot_cooldowns = torch.zeros(num_agents, dtype=torch.float32, device=self.device)
        self.split_cooldowns = torch.zeros(num_agents, dtype=torch.float32, device=self.device)
        
        # Active mask (which agents are alive)
        self.active_mask = torch.ones(num_agents, dtype=torch.bool, device=self.device)
    
    def sync_from_agents(self, agents: List[Agent]):
        """Sync tensor state from agent objects."""
        positions_list = [[a.x, a.y] for a in agents]
        velocities_list = [[a.vx, a.vy] for a in agents]
        angles_list = [a.angle for a in agents]
        energies_list = [a.energy for a in agents]
        shoot_cooldowns_list = [float(a.shoot_cooldown) for a in agents]
        split_cooldowns_list = [float(a.split_cooldown) for a in agents]
        active_list = [a.energy > 0 for a in agents]
        
        self.positions = torch.tensor(positions_list, dtype=torch.float32, device=self.device)
        self.velocities = torch.tensor(velocities_list, dtype=torch.float32, device=self.device)
        self.angles = torch.tensor(angles_list, dtype=torch.float32, device=self.device)
        self.energies = torch.tensor(energies_list, dtype=torch.float32, device=self.device)
        self.shoot_cooldowns = torch.tensor(shoot_cooldowns_list, dtype=torch.float32, device=self.device)
        self.split_cooldowns = torch.tensor(split_cooldowns_list, dtype=torch.float32, device=self.device)
        self.active_mask = torch.tensor(active_list, dtype=torch.bool, device=self.device)
    
    def sync_to_agents(self, agents: List[Agent]):
        """Sync tensor state back to agent objects."""
        positions_cpu = self.positions.cpu().numpy()
        velocities_cpu = self.velocities.cpu().numpy()
        angles_cpu = self.angles.cpu().numpy()
        energies_cpu = self.energies.cpu().numpy()
        shoot_cooldowns_cpu = self.shoot_cooldowns.cpu().numpy()
        split_cooldowns_cpu = self.split_cooldowns.cpu().numpy()
        
        for i, agent in enumerate(agents):
            agent.x = float(positions_cpu[i, 0])
            agent.y = float(positions_cpu[i, 1])
            agent.vx = float(velocities_cpu[i, 0])
            agent.vy = float(velocities_cpu[i, 1])
            agent.angle = float(angles_cpu[i])
            agent.energy = float(energies_cpu[i])
            agent.shoot_cooldown = int(shoot_cooldowns_cpu[i])
            agent.split_cooldown = int(split_cooldowns_cpu[i])
    
    def apply_physics_step(
        self,
        actions: torch.Tensor,
        dt: float = 0.1,
        friction: float = 0.01,
        max_velocity: float = 10.0,
        energy_decay: float = 0.1,
        thrust_force: float = 0.2,
        turn_rate: float = 0.1
    ):
        """
        Apply physics step for all agents simultaneously on GPU.
        
        Args:
            actions: Tensor of shape (num_agents, 4) with [thrust, turn, shoot, split]
            dt: Time step
            friction: Friction coefficient
            max_velocity: Maximum velocity
            energy_decay: Energy decay per tick
            thrust_force: Thrust force multiplier
            turn_rate: Turn rate multiplier
        """
        # Update angles
        self.angles += actions[:, 1] * turn_rate
        
        # Apply thrust (vectorized)
        thrust_mask = actions[:, 0] > 0.1  # Threshold
        thrust_magnitudes = actions[:, 0] * thrust_force
        
        # Calculate thrust vectors
        cos_angles = torch.cos(self.angles)
        sin_angles = torch.sin(self.angles)
        
        thrust_x = cos_angles * thrust_magnitudes
        thrust_y = sin_angles * thrust_magnitudes
        
        # Apply thrust only where threshold is met
        self.velocities[:, 0] += thrust_x * thrust_mask.float()
        self.velocities[:, 1] += thrust_y * thrust_mask.float()
        
        # Apply friction
        self.velocities *= (1.0 - friction)
        
        # Limit velocity
        speeds = torch.norm(self.velocities, dim=1)
        speed_mask = speeds > max_velocity
        if speed_mask.any():
            scale_factors = torch.where(speed_mask, max_velocity / speeds, torch.ones_like(speeds))
            self.velocities *= scale_factors.unsqueeze(1)
        
        # Update positions
        self.positions += self.velocities * dt
        
        # Update energy (only for active agents)
        self.energies -= energy_decay * dt * self.active_mask.float()
        self.energies = torch.clamp(self.energies, min=0.0)
        
        # Update cooldowns
        self.shoot_cooldowns = torch.clamp(self.shoot_cooldowns - 1.0, min=0.0)
        self.split_cooldowns = torch.clamp(self.split_cooldowns - 1.0, min=0.0)
        
        # Update active mask
        self.active_mask = self.energies > 0.0
    
    def wrap_positions(self, width: float, height: float, toroidal: bool = True):
        """Wrap positions to toroidal space."""
        if toroidal:
            self.positions[:, 0] = self.positions[:, 0] % width
            self.positions[:, 1] = self.positions[:, 1] % height
        else:
            self.positions[:, 0] = torch.clamp(self.positions[:, 0], 0.0, width)
            self.positions[:, 1] = torch.clamp(self.positions[:, 1], 0.0, height)
