"""
Main entry point for EvoNash worker.
Handles CLI interface and Controller API communication.
"""

import argparse
import json
import requests
import sys
from pathlib import Path
from typing import Optional

from .experiments.experiment_manager import ExperimentManager, ExperimentConfig
from .experiments.experiment_runner import ExperimentRunner


def request_job(controller_url: str) -> Optional[dict]:
    """
    Request a job from the controller.
    
    Args:
        controller_url: Base URL of the controller API
        
    Returns:
        Job configuration dictionary, or None if no jobs available
    """
    try:
        response = requests.post(f"{controller_url}/api/queue", json={})
        response.raise_for_status()
        return response.json()
    except requests.exceptions.RequestException as e:
        print(f"Error requesting job: {e}")
        return None


def upload_results(controller_url: str, job_id: str, experiment_id: str, results: dict):
    """
    Upload experiment results to the controller.
    
    Args:
        controller_url: Base URL of the controller API
        job_id: Job ID
        experiment_id: Experiment ID
        results: Results dictionary
    """
    try:
        # Upload all generation stats
        all_stats = results.get('all_stats', [])
        for gen_stats in all_stats:
            payload = {
                "job_id": job_id,
                "experiment_id": experiment_id,
                "generation_stats": gen_stats,
                "matches": []  # Empty for now, would contain match results
            }
            response = requests.post(f"{controller_url}/api/results", json=payload)
            response.raise_for_status()
        
        print("Results uploaded successfully")
    except requests.exceptions.RequestException as e:
        print(f"Error uploading results: {e}")


def run_local_experiment(config_path: str, device: str = 'cuda'):
    """
    Run an experiment locally from a config file.
    
    Args:
        config_path: Path to experiment config JSON file
        device: Device to run on ('cuda' or 'cpu')
    """
    print(f"Loading experiment config from: {config_path}")
    config = ExperimentManager.load_from_file(config_path)
    
    print(f"Initializing experiment runner...")
    runner = ExperimentRunner(config, device=device)
    
    print(f"Running experiment...")
    results = runner.run_experiment()
    
    print(f"\nExperiment completed!")
    print(f"CSV data saved to: {results['csv_path']}")
    print(f"Final stats: {results['final_stats']}")


def run_remote_experiment(controller_url: str, device: str = 'cuda'):
    """
    Run an experiment by requesting a job from the controller.
    
    Args:
        controller_url: Base URL of the controller API
        device: Device to run on ('cuda' or 'cpu')
    """
    print(f"Requesting job from controller: {controller_url}")
    job = request_job(controller_url)
    
    if not job:
        print("No jobs available")
        return
    
    print(f"Received job: {job.get('job_id')}")
    experiment_config = job.get('experiment_config', {})
    
    if not experiment_config:
        print("Invalid job: missing experiment_config")
        return
    
    # Create ExperimentConfig from job
    config = ExperimentManager.load_from_dict(experiment_config)
    
    print(f"Running experiment: {config.experiment_name}")
    runner = ExperimentRunner(config, device=device)
    results = runner.run_experiment()
    
    # Upload results
    upload_results(
        controller_url,
        job.get('job_id'),
        config.experiment_id,
        results
    )


def main():
    """Main entry point."""
    parser = argparse.ArgumentParser(description='EvoNash Worker')
    parser.add_argument(
        '--config',
        type=str,
        help='Path to experiment config JSON file (for local runs)'
    )
    parser.add_argument(
        '--controller',
        type=str,
        help='Controller API base URL (for remote runs)'
    )
    parser.add_argument(
        '--device',
        type=str,
        default='cuda',
        choices=['cuda', 'cpu'],
        help='Device to run on (default: cuda)'
    )
    
    args = parser.parse_args()
    
    if args.config:
        # Local run
        run_local_experiment(args.config, device=args.device)
    elif args.controller:
        # Remote run
        run_remote_experiment(args.controller, device=args.device)
    else:
        # Default: try to run with default config
        default_config = Path(__file__).parent.parent / 'config' / 'experiment_config.json'
        if default_config.exists():
            run_local_experiment(str(default_config), device=args.device)
        else:
            print("Error: Must provide either --config or --controller")
            parser.print_help()
            sys.exit(1)


if __name__ == '__main__':
    main()
