"""
Experiment Manager for loading and managing experiment configurations.
"""

import json
from pathlib import Path
from typing import Dict, Optional
from dataclasses import dataclass


@dataclass
class ExperimentConfig:
    """Experiment configuration dataclass."""
    experiment_id: str
    experiment_name: str
    mutation_mode: str  # 'STATIC' or 'ADAPTIVE'
    mutation_rate: Optional[float] = None  # For STATIC mode
    mutation_base: Optional[float] = None  # For ADAPTIVE mode
    max_possible_elo: float = 2000.0
    random_seed: int = 42
    population_size: int = 1000
    selection_pressure: float = 0.2
    max_generations: int = 5000
    ticks_per_generation: int = 500  # Number of simulation ticks per generation
    network_architecture: Dict = None
    experiment_group: str = 'CONTROL'  # 'CONTROL' or 'EXPERIMENTAL'
    
    def __post_init__(self):
        if self.network_architecture is None:
            self.network_architecture = {
                "input_size": 24,
                "hidden_layers": [64],
                "output_size": 4
            }
    
    def get_mutation_rate(self, parent_elo: float) -> float:
        """
        Calculate mutation rate based on mode.
        
        Args:
            parent_elo: Elo rating of the parent agent
            
        Returns:
            Mutation rate to apply
        """
        if self.mutation_mode == 'STATIC':
            return self.mutation_rate or 0.05
        elif self.mutation_mode == 'ADAPTIVE':
            base = self.mutation_base or 0.1
            return base * (1 - parent_elo / self.max_possible_elo)
        else:
            raise ValueError(f"Unknown mutation mode: {self.mutation_mode}")


class ExperimentManager:
    """Manages experiment configuration loading and validation."""
    
    @staticmethod
    def load_from_file(config_path: str) -> ExperimentConfig:
        """
        Load experiment configuration from JSON file.
        
        Args:
            config_path: Path to experiment_config.json
            
        Returns:
            ExperimentConfig instance
        """
        path = Path(config_path)
        if not path.exists():
            raise FileNotFoundError(f"Config file not found: {config_path}")
        
        with open(path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        return ExperimentConfig(**data)
    
    @staticmethod
    def load_from_dict(config_dict: dict) -> ExperimentConfig:
        """
        Load experiment configuration from dictionary.
        
        Args:
            config_dict: Configuration dictionary
            
        Returns:
            ExperimentConfig instance
        """
        return ExperimentConfig(**config_dict)
    
    @staticmethod
    def save_to_file(config: ExperimentConfig, config_path: str):
        """
        Save experiment configuration to JSON file.
        
        Args:
            config: ExperimentConfig instance
            config_path: Path to save config file
        """
        path = Path(config_path)
        path.parent.mkdir(parents=True, exist_ok=True)
        
        data = {
            "experiment_id": config.experiment_id,
            "experiment_name": config.experiment_name,
            "mutation_mode": config.mutation_mode,
            "mutation_rate": config.mutation_rate,
            "mutation_base": config.mutation_base,
            "max_possible_elo": config.max_possible_elo,
            "random_seed": config.random_seed,
            "population_size": config.population_size,
            "selection_pressure": config.selection_pressure,
            "max_generations": config.max_generations,
            "ticks_per_generation": config.ticks_per_generation,
            "network_architecture": config.network_architecture,
            "experiment_group": config.experiment_group
        }
        
        with open(path, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2)
