#!/usr/bin/env python
"""
Simple entry point for running the EvoNash worker service.
Can be used for CLI testing or as the service executable.
"""

import argparse
import sys
import json
import uuid
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


def prompt_worker_name(config_path: Path, config: dict) -> dict:
    """
    Prompt for worker name if not set in config.
    Also generates worker_id if not present.
    Saves updates back to config file.
    
    Args:
        config_path: Path to the config file
        config: Current config dictionary
        
    Returns:
        Updated config dictionary
    """
    config_changed = False
    
    # NOTE: worker_id is now generated per-machine in worker_service.py using machine_id.txt
    # This ensures each machine has a unique ID even if config files are copied
    
    # Prompt for worker name if not set
    if not config.get('worker_name'):
        print("\n" + "=" * 60)
        print("  EVONASH WORKER SETUP - First Time Configuration")
        print("=" * 60)
        print("\nThis name will identify your worker in the dashboard.")
        print("Examples: 'Gaming-PC', 'Lab-Server-1', 'Home-Desktop'\n")
        
        try:
            worker_name = input("Enter a name for this worker: ").strip()
        except EOFError:
            # Running non-interactively (e.g., as a service)
            worker_name = ""
        
        if not worker_name:
            # Generate a default name using random suffix
            worker_name = f"Worker-{uuid.uuid4().hex[:8]}"
            print(f"Using default name: {worker_name}")
        
        config['worker_name'] = worker_name
        config_changed = True
        print(f"\nWorker name set to: {worker_name}")
        print("=" * 60 + "\n")
    
    # Save config if changed
    if config_changed:
        with open(config_path, 'w', encoding='utf-8') as f:
            json.dump(config, f, indent=2)
    
    return config


def main():
    """Main entry point for worker service."""
    parser = argparse.ArgumentParser(description='EvoNash Worker Service')
    parser.add_argument(
        '--config',
        type=str,
        default='config/worker_config.json',
        help='Path to worker config JSON file (default: config/worker_config.json)'
    )
    parser.add_argument(
        '--name',
        type=str,
        default=None,
        help='Set worker name (overrides config and skips prompt)'
    )
    parser.add_argument(
        '--reset-name',
        action='store_true',
        help='Clear saved worker name and prompt for a new one'
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
    
    # Load and potentially update config with worker name
    with open(config_path, 'r', encoding='utf-8') as f:
        config = json.load(f)
    
    # If --reset-name flag provided, clear the worker name to force re-prompt
    if args.reset_name:
        config['worker_name'] = None
        with open(config_path, 'w', encoding='utf-8') as f:
            json.dump(config, f, indent=2)
        print("Worker name cleared. You will be prompted for a new name.")
    
    # If --name argument provided, use it directly
    if args.name:
        config['worker_name'] = args.name
        # NOTE: worker_id is now generated per-machine in worker_service.py using machine_id.txt
        with open(config_path, 'w', encoding='utf-8') as f:
            json.dump(config, f, indent=2)
        print(f"Worker name set to: {args.name}")
    else:
        # Interactive prompt for name if not set
        config = prompt_worker_name(config_path, config)
    
    # Create and run worker service
    try:
        worker = WorkerService(str(config_path))
        worker.run()
    except Exception as e:
        print(f"Fatal error: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == '__main__':
    main()
