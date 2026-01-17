"""
EvoNash Python Worker
Main script that polls for jobs, runs experiments, and reports results.
"""

import os
import sys
import time
import requests
import json
from pathlib import Path
from typing import Optional

# Add src to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from src.experiments.experiment_manager import ExperimentManager, ExperimentConfig
from src.ga.genetic_algorithm import GeneticAlgorithm
from src.logging.csv_logger import CSVLogger


class Worker:
    """Main worker class that handles job polling and execution."""
    
    def __init__(self, api_url: str, poll_interval: int = 5):
        """
        Initialize worker.
        
        Args:
            api_url: Base URL of the Next.js API
            poll_interval: Seconds between polling for jobs
        """
        self.api_url = api_url.rstrip('/')
        self.poll_interval = poll_interval
        self.current_experiment: Optional[ExperimentConfig] = None
        self.ga: Optional[GeneticAlgorithm] = None
        self.csv_logger: Optional[CSVLogger] = None
    
    def poll_for_job(self) -> Optional[dict]:
        """
        Poll the API for available jobs.
        
        Returns:
            Job request dictionary or None
        """
        try:
            response = requests.get(f"{self.api_url}/api/queue", timeout=10)
            if response.status_code == 200:
                data = response.json()
                return data.get('job')
            return None
        except Exception as e:
            print(f"Error polling for jobs: {e}")
            return None
    
    def submit_results(self, job_id: str, experiment_id: str, generation_stats: dict, matches: list):
        """
        Submit job results to the API.
        
        Args:
            job_id: Job identifier
            experiment_id: Experiment identifier
            generation_stats: Generation statistics
            matches: List of match results
        """
        try:
            result = {
                "job_id": job_id,
                "experiment_id": experiment_id,
                "generation_id": "",  # Will be set by API
                "matches": matches,
                "generation_stats": generation_stats
            }
            
            response = requests.post(
                f"{self.api_url}/api/queue",
                json=result,
                timeout=30
            )
            
            if response.status_code == 200:
                print(f"Successfully submitted results for job {job_id}")
            else:
                print(f"Error submitting results: {response.status_code} - {response.text}")
        except Exception as e:
            print(f"Error submitting results: {e}")
    
    def run_generation(self, generation_num: int) -> dict:
        """
        Run one generation of the genetic algorithm.
        
        Args:
            generation_num: Current generation number
            
        Returns:
            Generation statistics dictionary
        """
        if not self.ga:
            raise RuntimeError("Genetic Algorithm not initialized")
        
        # TODO: Run matches between agents
        # For now, simulate fitness scores
        import numpy as np
        for agent in self.ga.population:
            agent.fitness_score = np.random.random() * agent.elo_rating / 2000.0
        
        # Evolve to next generation
        self.ga.evolve_generation()
        
        # Get statistics
        stats = self.ga.get_generation_stats()
        
        # Calculate policy entropy (simplified)
        # In real implementation, this would be calculated from agent policies
        policy_entropy = 2.0 / (1 + stats['avg_elo'] / 1000.0)
        entropy_variance = 0.1 / (1 + generation_num / 100.0)
        
        stats['policy_entropy'] = policy_entropy
        stats['entropy_variance'] = entropy_variance
        
        # Log to CSV
        if self.csv_logger:
            self.csv_logger.log_generation(
                generation=generation_num,
                avg_elo=stats['avg_elo'],
                peak_elo=stats['peak_elo'],
                policy_entropy=policy_entropy,
                entropy_variance=entropy_variance,
                mutation_rate=stats['mutation_rate'],
                population_diversity=stats['population_diversity'],
                avg_fitness=stats['avg_fitness']
            )
        
        return stats
    
    def execute_job(self, job: dict):
        """
        Execute a job from the API.
        
        Args:
            job: Job request dictionary
        """
        print(f"Executing job {job['job_id']}")
        
        # Load experiment config
        config_dict = job['experiment_config']
        self.current_experiment = ExperimentManager.load_from_dict(config_dict)
        
        # Initialize CSV logger
        self.csv_logger = CSVLogger(
            experiment_id=self.current_experiment.experiment_id,
            experiment_group=self.current_experiment.experiment_group,
            data_dir=str(Path(__file__).parent.parent.parent / "data")
        )
        
        # Initialize Genetic Algorithm
        self.ga = GeneticAlgorithm(self.current_experiment)
        
        # Run generations
        for gen_num in range(1, self.current_experiment.max_generations + 1):
            print(f"Running generation {gen_num}/{self.current_experiment.max_generations}")
            
            # Run generation
            gen_stats = self.run_generation(gen_num)
            
            # Create mock matches (in real implementation, these would be actual game results)
            matches = []
            for i in range(min(10, len(self.ga.population) // 2)):
                agent_a = self.ga.population[i * 2]
                agent_b = self.ga.population[i * 2 + 1]
                
                # Simple win determination based on fitness
                winner = agent_a if agent_a.fitness_score > agent_b.fitness_score else agent_b
                
                matches.append({
                    "agent_a_id": f"agent_{i*2}",
                    "agent_b_id": f"agent_{i*2+1}",
                    "winner_id": f"agent_{i*2}" if winner == agent_a else f"agent_{i*2+1}",
                    "move_history": [],
                    "telemetry": {}
                })
            
            # Submit results
            self.submit_results(
                job_id=job['job_id'],
                experiment_id=job['experiment_id'],
                generation_stats=gen_stats,
                matches=matches
            )
            
            # Check for convergence
            if gen_stats['entropy_variance'] < 0.01:
                print(f"Convergence reached at generation {gen_num}")
                break
        
        print(f"Job {job['job_id']} completed")
    
    def run(self):
        """Main worker loop."""
        print("Worker started. Polling for jobs...")
        
        while True:
            job = self.poll_for_job()
            
            if job:
                try:
                    self.execute_job(job)
                except Exception as e:
                    print(f"Error executing job: {e}")
                    import traceback
                    traceback.print_exc()
            else:
                print(f"No jobs available. Waiting {self.poll_interval} seconds...")
            
            time.sleep(self.poll_interval)


def main():
    """Entry point."""
    api_url = os.getenv('API_URL', 'http://localhost:3000')
    poll_interval = int(os.getenv('POLL_INTERVAL', '5'))
    
    worker = Worker(api_url=api_url, poll_interval=poll_interval)
    worker.run()


if __name__ == '__main__':
    main()
