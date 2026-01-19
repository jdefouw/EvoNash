#!/usr/bin/env python
"""
Simple entry point for running the EvoNash worker service.
Can be used for CLI testing or as the service executable.
"""

import argparse
import sys
from pathlib import Path

# Add the worker directory to Python path so imports work
worker_dir = Path(__file__).parent.resolve()
if str(worker_dir) not in sys.path:
    sys.path.insert(0, str(worker_dir))

# Import src package and all subpackages first
# This ensures Python recognizes the package structure before worker_service
# tries to use relative imports
import src
# Import subpackages to ensure they're registered in sys.modules
# This is necessary for relative imports in worker_service.py to resolve correctly
import src.experiments
import src.experiments.experiment_manager
import src.experiments.experiment_runner
import src.experiments.experiment_runner_optimized
import src.ga
import src.ga.genetic_algorithm
import src.simulation
import src.simulation.agent
import src.simulation.agent_batched
import src.simulation.petri_dish
import src.simulation.petri_dish_vectorized
import src.logging
import src.logging.csv_logger
import src.logging.worker_logger
import src.analysis
import src.analysis.statistical_analysis
import src.main

# Now import worker_service - all relative imports should resolve correctly
from src.worker_service import WorkerService


def main():
    """Main entry point for worker service."""
    parser = argparse.ArgumentParser(description='EvoNash Worker Service')
    parser.add_argument(
        '--config',
        type=str,
        default='config/worker_config.json',
        help='Path to worker config JSON file (default: config/worker_config.json)'
    )
    
    args = parser.parse_args()
    
    # Resolve config path (Windows-compatible)
    config_path = Path(args.config)
    if not config_path.is_absolute():
        # Make relative to worker directory
        worker_dir = Path(__file__).parent.resolve()
        config_path = (worker_dir / config_path).resolve()
    
    if not config_path.exists():
        print(f"Error: Config file not found: {config_path}", file=sys.stderr)
        print(f"Current directory: {Path.cwd()}", file=sys.stderr)
        print(f"Worker directory: {Path(__file__).parent.resolve()}", file=sys.stderr)
        sys.exit(1)
    
    # Create and run worker service
    try:
        worker = WorkerService(str(config_path))
        worker.run()
    except Exception as e:
        print(f"Fatal error: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == '__main__':
    main()
