"""
CSV Logger for EvoNash experiments.
Logs generation statistics to CSV files for statistical analysis.
"""

import csv
import os
from datetime import datetime
from pathlib import Path
from typing import Dict, Optional


class CSVLogger:
    """Logs experiment data to CSV files for analysis."""
    
    def __init__(self, experiment_id: str, experiment_group: str, data_dir: str = "data"):
        """
        Initialize CSV logger.
        
        Args:
            experiment_id: Unique identifier for the experiment
            experiment_group: 'CONTROL' or 'EXPERIMENTAL'
            data_dir: Directory to store CSV files
        """
        self.experiment_id = experiment_id
        self.experiment_group = experiment_group
        self.data_dir = Path(data_dir)
        self.data_dir.mkdir(parents=True, exist_ok=True)
        
        # Determine filename based on experiment group
        if experiment_group == "CONTROL":
            self.filename = self.data_dir / "control_data.csv"
        elif experiment_group == "EXPERIMENTAL":
            self.filename = self.data_dir / "experimental_data.csv"
        else:
            # Fallback to experiment_id
            self.filename = self.data_dir / f"{experiment_id}_generation_stats.csv"
        
        self.file_initialized = False
        self._initialize_file()
    
    def _initialize_file(self):
        """Initialize CSV file with headers if it doesn't exist."""
        if not self.filename.exists():
            with open(self.filename, 'w', newline='') as f:
                writer = csv.writer(f)
                writer.writerow([
                    'generation',
                    'timestamp',
                    'avg_elo',
                    'peak_elo',
                    'policy_entropy',
                    'entropy_variance',
                    'mutation_rate',
                    'population_diversity',
                    'avg_fitness'
                ])
        self.file_initialized = True
    
    def log_generation(
        self,
        generation: int,
        avg_elo: float,
        peak_elo: float,
        policy_entropy: float,
        entropy_variance: float,
        mutation_rate: float,
        population_diversity: float,
        avg_fitness: float
    ):
        """
        Log generation statistics to CSV.
        
        Args:
            generation: Generation number
            avg_elo: Average Elo rating of population
            peak_elo: Highest Elo rating in population
            policy_entropy: Policy entropy value
            entropy_variance: Variance of entropy (for convergence tracking)
            mutation_rate: Mutation rate used in this generation
            population_diversity: Average Euclidean distance between weight vectors
            avg_fitness: Average fitness score
        """
        if not self.file_initialized:
            self._initialize_file()
        
        timestamp = datetime.now().isoformat()
        
        with open(self.filename, 'a', newline='') as f:
            writer = csv.writer(f)
            writer.writerow([
                generation,
                timestamp,
                avg_elo,
                peak_elo,
                policy_entropy,
                entropy_variance,
                mutation_rate,
                population_diversity,
                avg_fitness
            ])
    
    def get_filepath(self) -> Path:
        """Get the filepath of the CSV file."""
        return self.filename
