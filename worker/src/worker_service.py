"""
Worker Service: Continuous polling service for processing jobs from Vercel.
Runs on local Windows machine with GPU, polls for jobs, processes experiments,
and uploads results incrementally.
"""

import time
import signal
import sys
import json
from pathlib import Path
from typing import Optional, Dict
import requests
import torch
import logging

from .experiments.experiment_manager import ExperimentManager, ExperimentConfig
from .experiments.experiment_runner import ExperimentRunner
from .main import request_job, upload_generation_stats, check_experiment_status
from .logging.worker_logger import setup_worker_logger


class WorkerService:
    """
    Continuous worker service that polls Vercel for jobs and processes them on local GPU.
    """
    
    def __init__(self, config_path: str):
        """
        Initialize worker service.
        
        Args:
            config_path: Path to worker_config.json
        """
        # Load worker configuration (Windows-compatible path handling)
        config_path_obj = Path(config_path).resolve()
        if not config_path_obj.exists():
            raise FileNotFoundError(f"Worker config file not found: {config_path_obj}")
        
        with open(config_path_obj, 'r', encoding='utf-8') as f:
            self.worker_config = json.load(f)
        
        # Set up logger
        self.logger = setup_worker_logger(
            log_file=self.worker_config.get('log_file'),
            log_level=self.worker_config.get('log_level', 'INFO'),
            console_output=True
        )
        
        # Configuration
        self.controller_url = self.worker_config['controller_url']
        self.poll_interval = self.worker_config.get('poll_interval_seconds', 30)
        self.max_retries = self.worker_config.get('max_retries', 3)
        self.retry_delay = self.worker_config.get('retry_delay_seconds', 5)
        self.device = self.worker_config.get('device', 'cuda')
        
        # State
        self.running = True
        self.current_job: Optional[Dict] = None
        self.status = 'idle'  # idle, processing, error
        
        # Setup signal handlers for graceful shutdown
        # Windows only supports SIGINT, SIGTERM is Unix-only
        if hasattr(signal, 'SIGINT'):
            signal.signal(signal.SIGINT, self._signal_handler)
        if hasattr(signal, 'SIGTERM'):
            signal.signal(signal.SIGTERM, self._signal_handler)
        
        # Check GPU availability
        self._check_gpu()
    
    def _signal_handler(self, signum, frame):
        """Handle shutdown signals gracefully."""
        self.logger.info(f"Received signal {signum}, shutting down gracefully...")
        self.running = False
    
    def _check_gpu(self):
        """Check GPU availability and log status."""
        if self.device == 'cuda':
            if torch.cuda.is_available():
                gpu_name = torch.cuda.get_device_name(0)
                self.logger.info(f"GPU available: {gpu_name}")
                self.logger.info(f"CUDA version: {torch.version.cuda}")
            else:
                self.logger.warning("CUDA requested but not available, falling back to CPU")
                self.device = 'cpu'
        else:
            self.logger.info("Running on CPU")
    
    def _create_upload_callback(self, job_id: str, experiment_id: str) -> callable:
        """
        Create upload callback function for incremental generation uploads.
        
        Args:
            job_id: Job ID
            experiment_id: Experiment ID
            
        Returns:
            Callback function that takes generation stats dict
        """
        def upload_callback(generation_stats: Dict):
            """Upload single generation stats to controller."""
            success = upload_generation_stats(
                self.controller_url,
                job_id,
                experiment_id,
                generation_stats,
                max_retries=self.max_retries,
                retry_delay=self.retry_delay
            )
            if success:
                gen_num = generation_stats.get('generation', 'unknown')
                self.logger.debug(f"Uploaded generation {gen_num} stats")
            else:
                gen_num = generation_stats.get('generation', 'unknown')
                self.logger.warning(f"Failed to upload generation {gen_num} stats")
        
        return upload_callback
    
    def _create_stop_check_callback(self, experiment_id: str) -> callable:
        """
        Create stop check callback function that queries experiment status.
        
        Args:
            experiment_id: Experiment ID to check
            
        Returns:
            Callback function that returns True if experiment should stop
        """
        def stop_check_callback() -> bool:
            """Check if experiment status is STOPPED."""
            status = check_experiment_status(self.controller_url, experiment_id)
            if status == 'STOPPED':
                return True
            # If status check fails (returns None), continue execution
            # This prevents transient network errors from stopping experiments
            return False
        
        return stop_check_callback
    
    def process_job(self, job: Dict):
        """
        Process a single job (experiment).
        
        Args:
            job: Job dictionary from controller
        """
        job_id = job.get('job_id')
        experiment_id = job.get('experiment_id')
        experiment_config = job.get('experiment_config', {})
        
        if not experiment_config:
            self.logger.error("Invalid job: missing experiment_config")
            return
        
        self.logger.info("=" * 80)
        self.logger.info(f"🎯 JOB RECEIVED - Starting Processing")
        self.logger.info("=" * 80)
        self.logger.info(f"Job ID:     {job_id}")
        self.logger.info(f"Experiment: {experiment_id}")
        self.logger.info("=" * 80)
        
        self.status = 'processing'
        self.current_job = job
        
        try:
            # Check if experiment is already stopped before starting
            from .main import check_experiment_status
            current_status = check_experiment_status(self.controller_url, experiment_id)
            if current_status == 'STOPPED':
                self.logger.warning(f"⚠ Experiment {experiment_id} is already STOPPED, skipping")
                self.status = 'idle'
                self.current_job = None
                return
            
            # Create ExperimentConfig from job
            config = ExperimentManager.load_from_dict(experiment_config)
            
            self.logger.info("=" * 80)
            self.logger.info("📋 EXPERIMENT CONFIGURATION")
            self.logger.info("=" * 80)
            self.logger.info(f"  Name:            {config.experiment_name}")
            self.logger.info(f"  Group:           {config.experiment_group}")
            self.logger.info(f"  Mutation Mode:   {config.mutation_mode}")
            if config.mutation_mode == 'STATIC':
                self.logger.info(f"  Mutation Rate:   {config.mutation_rate}")
            else:
                self.logger.info(f"  Mutation Base:   {config.mutation_base}")
            self.logger.info(f"  Population Size: {config.population_size:,}")
            self.logger.info(f"  Max Generations: {config.max_generations:,}")
            self.logger.info(f"  Random Seed:     {config.random_seed}")
            self.logger.info(f"  Selection Press: {config.selection_pressure}")
            self.logger.info(f"  Max Possible Elo: {config.max_possible_elo}")
            self.logger.info("=" * 80)
            self.logger.info("🚀 STARTING EXPERIMENT ON GPU")
            self.logger.info("=" * 80)
            
            # Create upload callback for incremental uploads
            upload_callback = self._create_upload_callback(job_id, experiment_id)
            
            # Create stop check callback
            stop_check_callback = self._create_stop_check_callback(experiment_id)
            
            # Initialize and run experiment
            runner = ExperimentRunner(
                config,
                device=self.device,
                upload_callback=upload_callback,
                stop_check_callback=stop_check_callback
            )
            
            results = runner.run_experiment()
            
            if results.get('stopped', False):
                self.logger.info(f"Experiment stopped by user")
            else:
                self.logger.info(f"Experiment completed successfully")
            self.logger.info(f"CSV data saved to: {results['csv_path']}")
            
            # Final stats summary
            final_stats = results.get('final_stats', {})
            if final_stats:
                self.logger.info("=" * 80)
                self.logger.info("FINAL EXPERIMENT STATISTICS")
                self.logger.info("=" * 80)
                self.logger.info(f"  Elo Ratings:")
                self.logger.info(f"    Average: {final_stats.get('avg_elo', 0):.2f}")
                self.logger.info(f"    Peak:    {final_stats.get('peak_elo', 0):.2f}")
                self.logger.info(f"    Min:     {final_stats.get('min_elo', 0):.2f}")
                self.logger.info(f"    Std Dev: {final_stats.get('std_elo', 0):.2f}")
                self.logger.info(f"  Fitness:")
                self.logger.info(f"    Average: {final_stats.get('avg_fitness', 0):.2f}")
                self.logger.info(f"    Min:     {final_stats.get('min_fitness', 0):.2f}")
                self.logger.info(f"    Max:     {final_stats.get('max_fitness', 0):.2f}")
                self.logger.info(f"  Policy Metrics:")
                self.logger.info(f"    Entropy:        {final_stats.get('policy_entropy', 0):.4f}")
                self.logger.info(f"    Entropy Var:    {final_stats.get('entropy_variance', 0):.4f}")
                self.logger.info(f"    Diversity:      {final_stats.get('population_diversity', 0):.4f}")
                self.logger.info(f"  Evolution:")
                self.logger.info(f"    Mutation Rate:  {final_stats.get('mutation_rate', 0):.4f}")
                self.logger.info("=" * 80)
            
            self.status = 'idle'
            self.current_job = None
            
        except KeyboardInterrupt:
            self.logger.warning("Job processing interrupted by user")
            self.status = 'idle'
            self.current_job = None
            raise  # Re-raise to stop service
        except torch.cuda.OutOfMemoryError as e:
            self.logger.error(f"GPU out of memory error: {e}")
            self.logger.error("Try reducing population_size or max_generations")
            self.status = 'error'
            self.current_job = None
        except Exception as e:
            self.logger.error(f"Error processing job {job_id}: {e}", exc_info=True)
            self.status = 'error'
            self.current_job = None
            # Note: Experiment status will remain RUNNING in database
            # Could add API call to mark as FAILED here if needed
    
    def run(self):
        """Main service loop - continuously poll for jobs."""
        self.logger.info("=" * 60)
        self.logger.info("EvoNash Worker Service Starting")
        self.logger.info(f"Controller URL: {self.controller_url}")
        self.logger.info(f"Poll interval: {self.poll_interval} seconds")
        self.logger.info(f"Device: {self.device}")
        self.logger.info("=" * 60)
        
        consecutive_errors = 0
        max_consecutive_errors = 5
        
        while self.running:
            try:
                # Request job from controller
                self.logger.info(f"Polling {self.controller_url}/api/queue for jobs...")
                job = request_job(self.controller_url, timeout=30)
                
                if job:
                    consecutive_errors = 0
                    self.logger.info(f"✓ Job received, processing...")
                    self.process_job(job)
                else:
                    # No job available - this is normal, not an error
                    consecutive_errors = 0
                    if self.status == 'idle':
                        self.logger.info(f"ℹ No pending experiments, polling again in {self.poll_interval}s")
                    time.sleep(self.poll_interval)
                
            except KeyboardInterrupt:
                self.logger.info("Interrupted by user")
                break
            except requests.exceptions.RequestException as e:
                consecutive_errors += 1
                self.logger.warning(f"Network error in worker loop (attempt {consecutive_errors}/{max_consecutive_errors}): {e}")
                
                if consecutive_errors >= max_consecutive_errors:
                    self.logger.critical(f"Too many consecutive network errors ({consecutive_errors}), shutting down")
                    break
                
                # Wait before retrying with exponential backoff
                delay = min(self.poll_interval * (2 ** (consecutive_errors - 1)), 300)  # Max 5 minutes
                self.logger.info(f"Retrying in {delay}s...")
                time.sleep(delay)
            except Exception as e:
                consecutive_errors += 1
                self.logger.error(f"Unexpected error in worker loop: {e}", exc_info=True)
                
                if consecutive_errors >= max_consecutive_errors:
                    self.logger.critical(f"Too many consecutive errors ({consecutive_errors}), shutting down")
                    break
                
                # Wait before retrying
                delay = min(self.poll_interval * (2 ** (consecutive_errors - 1)), 300)
                self.logger.info(f"Retrying in {delay}s...")
                time.sleep(delay)
        
        self.logger.info("Worker service stopped")
        self.status = 'idle'
