"""
Main entry point for EvoNash worker.
Handles CLI interface and Controller API communication.
"""

import argparse
import json
import requests
import sys
import time
import logging
from pathlib import Path
from typing import Optional, Dict, Callable

from .experiments.experiment_manager import ExperimentManager, ExperimentConfig
from .experiments.experiment_runner import ExperimentRunner

# Set up logger for this module
logger = logging.getLogger(__name__)

# If no handlers are configured, add a basic handler to ensure logging works
if not logger.handlers and not logging.root.handlers:
    # Basic configuration as fallback
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )


def check_experiment_status(controller_url: str, experiment_id: str, timeout: int = 10) -> Optional[str]:
    """
    Check the current status of an experiment.
    
    Args:
        controller_url: Base URL of the controller API
        experiment_id: Experiment ID to check
        timeout: Request timeout in seconds
        
    Returns:
        Status string ('PENDING', 'RUNNING', 'STOPPED', etc.) or None if error occurred
    """
    try:
        response = requests.get(
            f"{controller_url}/api/experiments/{experiment_id}/status",
            timeout=timeout
        )
        
        if response.status_code == 404:
            return None
        
        response.raise_for_status()
        data = response.json()
        return data.get('status')
        
    except requests.exceptions.Timeout:
        print(f"Timeout checking experiment status for {experiment_id}")
        return None
    except requests.exceptions.ConnectionError as e:
        print(f"Connection error checking experiment status: {e}")
        return None
    except requests.exceptions.HTTPError as e:
        print(f"HTTP error checking experiment status: {e}")
        return None
    except requests.exceptions.RequestException as e:
        print(f"Error checking experiment status: {e}")
        return None
    except Exception as e:
        print(f"Unexpected error checking experiment status: {e}")
        return None


def request_job(controller_url: str, timeout: int = 30) -> Optional[dict]:
    """
    Request a job from the controller.
    
    Args:
        controller_url: Base URL of the controller API
        timeout: Request timeout in seconds
        
    Returns:
        Job configuration dictionary, or None if no jobs available or error occurred
    """
    try:
        # First test connection (optional, don't fail if it doesn't work)
        try:
            test_response = requests.get(
                f"{controller_url}/api/worker/test",
                timeout=5
            )
            if test_response.status_code == 200:
                test_data = test_response.json()
                print(f"✓ Connection test successful: {test_data.get('message', 'OK')}")
            else:
                print(f"⚠ Connection test returned status {test_response.status_code} (continuing anyway)")
        except Exception as test_error:
            print(f"⚠ Connection test failed: {test_error} (continuing anyway)")
        
        # Now request job
        response = requests.post(
            f"{controller_url}/api/queue",
            json={},
            timeout=timeout
        )
        
        if response.status_code == 404:
            # No jobs available - this is normal
            print(f"ℹ No pending experiments available (404)")
            return None
        
        response.raise_for_status()
        job_data = response.json()
        print(f"✓ Received job: {job_data.get('experiment_id', 'unknown')}")
        return job_data
        
    except requests.exceptions.Timeout:
        print(f"✗ Timeout requesting job from {controller_url}")
        return None
    except requests.exceptions.ConnectionError as e:
        print(f"✗ Connection error requesting job: {e}")
        print(f"  Check that {controller_url} is reachable and correct")
        return None
    except requests.exceptions.HTTPError as e:
        print(f"✗ HTTP error requesting job: {e}")
        if hasattr(e.response, 'text'):
            print(f"  Response: {e.response.text}")
        return None
    except requests.exceptions.RequestException as e:
        print(f"✗ Error requesting job: {e}")
        return None
    except Exception as e:
        print(f"✗ Unexpected error requesting job: {e}")
        return None


def upload_generation_stats(
    controller_url: str,
    job_id: str,
    experiment_id: str,
    generation_stats: Dict,
    max_retries: int = 3,
    retry_delay: float = 5.0
) -> bool:
    """
    Upload single generation statistics to the controller with retry logic.
    
    Args:
        controller_url: Base URL of the controller API
        job_id: Job ID
        experiment_id: Experiment ID
        generation_stats: Generation statistics dictionary
        max_retries: Maximum number of retry attempts
        retry_delay: Initial delay between retries (exponential backoff)
        
    Returns:
        True if upload successful, False otherwise
    """
    gen_num = generation_stats.get('generation', 'unknown')
    payload = {
        "job_id": job_id,
        "experiment_id": experiment_id,
        "generation_stats": generation_stats,
        "matches": []  # Empty for now, would contain match results
    }
    
    logger.info(f"[UPLOAD] Uploading generation {gen_num} stats for experiment {experiment_id}...")
    
    for attempt in range(max_retries):
        try:
            response = requests.post(
                f"{controller_url}/api/results",
                json=payload,
                timeout=30
            )
            response.raise_for_status()
            result = response.json()
            logger.info(f"[UPLOAD] ✓ Successfully uploaded generation {gen_num} (generation_id: {result.get('generation_id', 'unknown')})")
            return True
        except requests.exceptions.RequestException as e:
            if attempt < max_retries - 1:
                delay = retry_delay * (2 ** attempt)  # Exponential backoff
                logger.warning(f"[UPLOAD] ✗ Upload failed (attempt {attempt + 1}/{max_retries}), retrying in {delay:.1f}s: {e}")
                if hasattr(e, 'response') and e.response is not None:
                    try:
                        error_detail = e.response.json()
                        logger.warning(f"[UPLOAD]   Error details: {error_detail}")
                    except:
                        logger.warning(f"[UPLOAD]   Response text: {e.response.text[:200]}")
                time.sleep(delay)
            else:
                logger.error(f"[UPLOAD] ✗ Upload failed after {max_retries} attempts: {e}")
                if hasattr(e, 'response') and e.response is not None:
                    try:
                        error_detail = e.response.json()
                        logger.error(f"[UPLOAD]   Final error details: {error_detail}")
                    except:
                        logger.error(f"[UPLOAD]   Final response text: {e.response.text[:200]}")
                return False
    
    return False


def upload_results(controller_url: str, job_id: str, experiment_id: str, results: dict):
    """
    Upload experiment results to the controller (batch upload).
    
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
            success = upload_generation_stats(
                controller_url,
                job_id,
                experiment_id,
                gen_stats
            )
            if not success:
                print(f"Warning: Failed to upload generation {gen_stats.get('generation', 'unknown')}")
        
        print("Results uploaded successfully")
    except Exception as e:
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


def run_remote_experiment(controller_url: str, device: str = 'cuda', incremental_upload: bool = True):
    """
    Run an experiment by requesting a job from the controller.
    
    Args:
        controller_url: Base URL of the controller API
        device: Device to run on ('cuda' or 'cpu')
        incremental_upload: If True, upload results after each generation (default: True)
    """
    print(f"Requesting job from controller: {controller_url}")
    job = request_job(controller_url)
    
    if not job:
        print("No jobs available")
        return
    
    job_id = job.get('job_id')
    print(f"Received job: {job_id}")
    experiment_config = job.get('experiment_config', {})
    
    if not experiment_config:
        print("Invalid job: missing experiment_config")
        return
    
    # Create ExperimentConfig from job
    config = ExperimentManager.load_from_dict(experiment_config)
    
    print(f"Running experiment: {config.experiment_name}")
    
    # Create upload callback if incremental upload is enabled
    upload_callback = None
    if incremental_upload:
        def callback(generation_stats: Dict):
            upload_generation_stats(
                controller_url,
                job_id,
                config.experiment_id,
                generation_stats
            )
        upload_callback = callback
    
    runner = ExperimentRunner(
        config,
        device=device,
        upload_callback=upload_callback
    )
    results = runner.run_experiment()
    
    # If incremental upload was disabled, upload all results at the end
    if not incremental_upload:
        upload_results(
            controller_url,
            job_id,
            config.experiment_id,
            results
        )
    else:
        print("Results uploaded incrementally during experiment")


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
