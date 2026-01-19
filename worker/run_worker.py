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

# Ensure src is recognized as a package
import src

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
