"""
Worker Service: Continuous polling service for processing jobs from Vercel.
Runs on local Windows machine with GPU, polls for jobs, processes experiments,
and uploads results incrementally.
"""

import time
import signal
import sys
import json
import threading
from pathlib import Path
from typing import Optional, Dict, Tuple
from datetime import datetime
import requests
import torch
import logging
import gzip
import base64

from .experiments.experiment_manager import ExperimentManager, ExperimentConfig
from .experiments.experiment_runner_optimized import OptimizedExperimentRunner
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
        
        # Generate timestamped log file name for this run
        log_file_template = self.worker_config.get('log_file', 'logs/worker.log')
        if log_file_template:
            # Create timestamped filename: logs/worker_2026-01-17_16-19-08.log
            log_path = Path(log_file_template)
            timestamp = datetime.now().strftime('%Y-%m-%d_%H-%M-%S')
            log_dir = log_path.parent
            log_stem = log_path.stem  # 'worker' from 'worker.log'
            log_suffix = log_path.suffix  # '.log'
            timestamped_log_file = log_dir / f"{log_stem}_{timestamp}{log_suffix}"
        else:
            timestamped_log_file = None
        
        # Set up logger with timestamped log file
        self.logger = setup_worker_logger(
            log_file=str(timestamped_log_file) if timestamped_log_file else None,
            log_level=self.worker_config.get('log_level', 'INFO'),
            console_output=True
        )
        
        # Log the log file location
        if timestamped_log_file:
            self.logger.info(f"📝 Logging to: {timestamped_log_file}")
        
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
        self.worker_id: Optional[str] = None
        self.gpu_type: Optional[str] = None
        self.vram_gb: int = 0
        self.max_parallel_jobs: int = 0
        self.active_jobs: list = []  # List of active job threads/tasks
        self.active_jobs_count: int = 0
        
        # Setup signal handlers for graceful shutdown
        # Windows only supports SIGINT, SIGTERM is Unix-only
        if hasattr(signal, 'SIGINT'):
            signal.signal(signal.SIGINT, self._signal_handler)
        if hasattr(signal, 'SIGTERM'):
            signal.signal(signal.SIGTERM, self._signal_handler)
        
        # Check GPU availability and get GPU info
        self._check_gpu()
        
        # Register worker with controller
        self._register_worker()
        
        # Start heartbeat thread
        self._start_heartbeat_thread()
    
    def _signal_handler(self, signum, frame):
        """Handle shutdown signals gracefully."""
        self.logger.info(f"Received signal {signum}, shutting down gracefully...")
        self.running = False
    
    def _get_gpu_info(self) -> Tuple[Optional[str], int]:
        """
        Get GPU type and VRAM information.
        
        Returns:
            Tuple of (gpu_type, vram_gb). Returns (None, 0) if no GPU available.
        """
        if self.device == 'cuda' and torch.cuda.is_available():
            gpu_name = torch.cuda.get_device_name(0)
            # Get total memory in bytes, convert to GB
            vram_bytes = torch.cuda.get_device_properties(0).total_memory
            vram_gb = int(vram_bytes / (1024 ** 3))
            return gpu_name, vram_gb
        return None, 0
    
    def _check_gpu(self):
        """Check GPU availability and log status."""
        self.gpu_type, self.vram_gb = self._get_gpu_info()
        
        if self.device == 'cuda':
            if torch.cuda.is_available():
                self.logger.info(f"GPU available: {self.gpu_type}")
                self.logger.info(f"VRAM: {self.vram_gb} GB")
                self.logger.info(f"CUDA version: {torch.version.cuda}")
                # Calculate max parallel jobs: floor(vram_gb / 2)
                self.max_parallel_jobs = self.vram_gb // 2
                self.logger.info(f"Max parallel jobs: {self.max_parallel_jobs} (based on 2GB per job)")
            else:
                self.logger.warning("CUDA requested but not available, falling back to CPU")
                self.device = 'cpu'
                self.max_parallel_jobs = 1  # CPU can handle 1 job at a time
        else:
            self.logger.info("Running on CPU")
            self.max_parallel_jobs = 1
    
    def _register_worker(self):
        """Register worker with controller and get worker_id."""
        try:
            worker_name = self.worker_config.get('worker_name', None)
            
            payload = {
                'worker_name': worker_name,
                'gpu_type': self.gpu_type or 'CPU',
                'vram_gb': self.vram_gb
            }
            
            self.logger.info("Registering worker with controller...")
            response = requests.post(
                f"{self.controller_url}/api/workers/register",
                json=payload,
                timeout=10
            )
            
            if response.status_code == 200:
                data = response.json()
                self.worker_id = data.get('worker_id')
                self.max_parallel_jobs = data.get('max_parallel_jobs', self.max_parallel_jobs)
                self.logger.info(f"✓ Worker registered: {self.worker_id}")
                self.logger.info(f"  GPU: {self.gpu_type or 'CPU'}, VRAM: {self.vram_gb}GB")
                self.logger.info(f"  Max parallel jobs: {self.max_parallel_jobs}")
            else:
                self.logger.warning(f"⚠ Worker registration failed: {response.status_code}")
                self.logger.warning(f"  Response: {response.text}")
        except Exception as e:
            self.logger.error(f"✗ Error registering worker: {e}")
            self.logger.error("  Worker will continue but may not be tracked by controller")
    
    def _send_heartbeat(self):
        """Send heartbeat to controller."""
        if not self.worker_id:
            return
        
        try:
            payload = {
                'worker_id': self.worker_id,
                'status': self.status,
                'active_jobs_count': self.active_jobs_count
            }
            
            response = requests.post(
                f"{self.controller_url}/api/workers/heartbeat",
                json=payload,
                timeout=5
            )
            
            if response.status_code != 200:
                self.logger.warning(f"Heartbeat failed: {response.status_code}")
        except Exception as e:
            # Don't log heartbeat errors as they're frequent and not critical
            pass
    
    def _start_heartbeat_thread(self):
        """Start background thread for sending heartbeats."""
        def heartbeat_loop():
            while self.running:
                self._send_heartbeat()
                time.sleep(30)  # Send heartbeat every 30 seconds
        
        heartbeat_thread = threading.Thread(target=heartbeat_loop, daemon=True)
        heartbeat_thread.start()
        self.logger.info("Heartbeat thread started")
    
    def _can_accept_job(self) -> bool:
        """Check if worker can accept another job based on VRAM capacity."""
        return self.active_jobs_count < self.max_parallel_jobs
    
    def _create_batch_upload_callback(self, job_id: str, experiment_id: str, generation_start: int, generation_end: int) -> callable:
        """
        Create batch upload callback function that collects all generations and uploads as batch.
        
        Args:
            job_id: Job ID
            experiment_id: Experiment ID
            generation_start: First generation in batch
            generation_end: Last generation in batch
            
        Returns:
            Callback function that takes generation stats dict and collects them for batch upload
        """
        batch_stats: list = []
        
        def upload_callback(generation_stats: Dict):
            """Collect generation stats for batch upload."""
            gen_num = generation_stats.get('generation', 'unknown')
            batch_stats.append(generation_stats)
            self.logger.info(f"📝 Collected generation {gen_num} for batch upload")
            
            # Check if this is the last generation in the batch
            if gen_num >= generation_end:
                # Upload entire batch
                self.logger.info(f"📤 Uploading batch of {len(batch_stats)} generations ({generation_start}-{generation_end})...")
                
                try:
                    payload = {
                        "job_id": job_id,
                        "experiment_id": experiment_id,
                        "generation_stats_batch": batch_stats,
                        "matches": []  # Empty for now
                    }
                    
                    response = requests.post(
                        f"{self.controller_url}/api/results",
                        json=payload,
                        timeout=60
                    )
                    
                    if response.status_code == 200:
                        result = response.json()
                        self.logger.info(f"✅ Successfully uploaded batch: {result.get('generations_inserted', 0)} generations")
                    else:
                        self.logger.warning(f"⚠️ Batch upload failed: {response.status_code}")
                        self.logger.warning(f"  Response: {response.text[:200]}")
                except Exception as e:
                    self.logger.error(f"✗ Error uploading batch: {e}")
        
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
    
    def _create_checkpoint_callback(self, experiment_id: str) -> callable:
        """
        Create checkpoint callback function that saves population state.
        
        Args:
            experiment_id: Experiment ID
            
        Returns:
            Callback function that saves checkpoint
        """
        def checkpoint_callback(population_state: Dict):
            """Save checkpoint to controller with compression."""
            try:
                # Compress the population_state to reduce payload size
                # Convert to JSON string, compress with gzip, then base64 encode
                json_str = json.dumps(population_state)
                compressed = gzip.compress(json_str.encode('utf-8'))
                compressed_b64 = base64.b64encode(compressed).decode('utf-8')
                
                response = requests.post(
                    f"{self.controller_url}/api/experiments/{experiment_id}/checkpoint",
                    json={
                        'generation_number': population_state['generation'],
                        'population_state_compressed': compressed_b64,
                        'compressed': True
                    },
                    timeout=60  # Increased timeout for large payloads
                )
                
                if response.status_code == 200:
                    self.logger.info(f"✓ Checkpoint saved for generation {population_state['generation']}")
                else:
                    self.logger.warning(f"⚠ Checkpoint save failed: {response.status_code}")
            except Exception as e:
                self.logger.warning(f"⚠ Checkpoint save error: {e}")
        
        return checkpoint_callback
    
    def process_job(self, job: Dict):
        """
        Process a single job (generation batch).
        
        Args:
            job: Job dictionary from controller with generation_start and generation_end
        """
        job_id = job.get('job_id')
        experiment_id = job.get('experiment_id')
        experiment_config = job.get('experiment_config', {})
        generation_start = job.get('generation_start', 0)
        generation_end = job.get('generation_end', None)
        
        if not experiment_config:
            self.logger.error("Invalid job: missing experiment_config")
            return
        
        # Increment active jobs count
        self.active_jobs_count += 1
        
        try:
            self.logger.info("=" * 80)
            self.logger.info(f"🎯 JOB RECEIVED - Starting Processing")
            self.logger.info("=" * 80)
            self.logger.info(f"Job ID:     {job_id}")
            self.logger.info(f"Experiment: {experiment_id}")
            self.logger.info(f"Generations: {generation_start}-{generation_end}")
            self.logger.info("=" * 80)
            
            # Check if experiment is already stopped before starting
            from .main import check_experiment_status
            current_status = check_experiment_status(self.controller_url, experiment_id)
            if current_status == 'STOPPED':
                self.logger.warning(f"⚠ Experiment {experiment_id} is already STOPPED, skipping")
                return
            
            # Create ExperimentConfig from job
            config = ExperimentManager.load_from_dict(experiment_config)
            
            # Load checkpoint if starting from a non-zero generation
            checkpoint_state = None
            if generation_start > 0:
                try:
                    self.logger.info(f"📥 Attempting to load checkpoint for generation {generation_start - 1}...")
                    checkpoint_response = requests.get(
                        f"{self.controller_url}/api/experiments/{experiment_id}/checkpoint",
                        params={'generation': str(generation_start - 1)},
                        timeout=30
                    )
                    
                    if checkpoint_response.status_code == 200:
                        checkpoint_data = checkpoint_response.json()
                        checkpoint_state = checkpoint_data.get('population_state')
                        self.logger.info(f"✓ Checkpoint loaded for generation {checkpoint_data.get('generation_number')}")
                    elif checkpoint_response.status_code == 404:
                        self.logger.warning(f"⚠ No checkpoint found for generation {generation_start - 1}, starting fresh")
                    else:
                        self.logger.warning(f"⚠ Failed to load checkpoint: {checkpoint_response.status_code}")
                except Exception as e:
                    self.logger.warning(f"⚠ Error loading checkpoint: {e}, starting fresh")
            
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
            self.logger.info("🚀 STARTING BATCH ON GPU")
            self.logger.info("=" * 80)
            
            # Create batch upload callback
            upload_callback = self._create_batch_upload_callback(job_id, experiment_id, generation_start, generation_end)
            
            # Create stop check callback
            stop_check_callback = self._create_stop_check_callback(experiment_id)
            
            # Create checkpoint callback
            checkpoint_callback = self._create_checkpoint_callback(experiment_id)
            
            # Initialize and run experiment batch
            runner = OptimizedExperimentRunner(
                config,
                device=self.device,
                upload_callback=upload_callback,
                stop_check_callback=stop_check_callback,
                generation_start=generation_start,
                generation_end=generation_end,
                checkpoint_callback=checkpoint_callback
            )
            
            # Load checkpoint state if available
            if checkpoint_state:
                try:
                    runner.ga.load_population_state(checkpoint_state)
                    self.logger.info(f"✓ Population state restored from checkpoint")
                except Exception as e:
                    self.logger.error(f"✗ Failed to load population state: {e}")
                    self.logger.warning("⚠ Continuing with fresh population (may cause inconsistency)")
            
            self.logger.info("=" * 80)
            self.logger.info("🔄 Starting batch execution...")
            self.logger.info("=" * 80)
            
            results = runner.run_experiment()
            
            if results.get('stopped', False):
                self.logger.info("=" * 80)
                self.logger.info("⏹ Batch stopped by user")
                self.logger.info("=" * 80)
            else:
                self.logger.info("=" * 80)
                self.logger.info("✅ Batch completed successfully")
                self.logger.info("=" * 80)
            
            # Log summary
            all_stats = results.get('all_stats', [])
            if all_stats:
                self.logger.info(f"📊 Total generations processed: {len(all_stats)}")
                self.logger.info(f"📤 Batch should have been uploaded")
            
        except KeyboardInterrupt:
            self.logger.warning("Job processing interrupted by user")
            raise  # Re-raise to stop service
        except torch.cuda.OutOfMemoryError as e:
            self.logger.error(f"GPU out of memory error: {e}")
            self.logger.error("Try reducing population_size or batch size")
        except Exception as e:
            self.logger.error(f"Error processing job {job_id}: {e}", exc_info=True)
        finally:
            # Decrement active jobs count
            self.active_jobs_count = max(0, self.active_jobs_count - 1)
    
    def run(self):
        """Main service loop - continuously poll for jobs."""
        self.logger.info("=" * 60)
        self.logger.info("EvoNash Worker Service Starting")
        self.logger.info(f"Controller URL: {self.controller_url}")
        self.logger.info(f"Poll interval: {self.poll_interval} seconds")
        self.logger.info(f"Device: {self.device}")
        self.logger.info("=" * 60)
        
        # Test connection on startup
        self.logger.info("Testing connection to controller...")
        try:
            test_response = requests.get(
                f"{self.controller_url}/api/worker/test",
                timeout=10
            )
            if test_response.status_code == 200:
                test_data = test_response.json()
                self.logger.info(f"✓ Connection test successful: {test_data.get('message', 'OK')}")
            else:
                self.logger.warning(f"⚠ Connection test returned status {test_response.status_code}")
        except Exception as e:
            self.logger.error(f"✗ Connection test failed: {e}")
            self.logger.error(f"  Check that {self.controller_url} is correct and reachable")
            self.logger.error(f"  Worker will continue but may not be able to connect")
        
        consecutive_errors = 0
        max_consecutive_errors = 5
        
        def process_job_in_thread(job: Dict):
            """Process a job in a separate thread."""
            try:
                self.process_job(job)
            except Exception as e:
                self.logger.error(f"Error in job thread: {e}", exc_info=True)
        
        while self.running:
            try:
                # Request jobs until we're at capacity
                while self._can_accept_job() and self.running:
                    # Request job from controller with worker_id
                    payload = {}
                    if self.worker_id:
                        payload['worker_id'] = self.worker_id
                    
                    try:
                        response = requests.post(
                            f"{self.controller_url}/api/queue",
                            json=payload,
                            timeout=30
                        )
                        
                        if response.status_code == 404:
                            # No jobs available
                            break
                        elif response.status_code == 429:
                            # Worker at capacity (shouldn't happen, but handle it)
                            break
                        
                        response.raise_for_status()
                        job = response.json()
                        
                        if job:
                            consecutive_errors = 0
                            # Process job in separate thread
                            job_thread = threading.Thread(
                                target=process_job_in_thread,
                                args=(job,),
                                daemon=False
                            )
                            job_thread.start()
                            self.active_jobs.append(job_thread)
                            self.logger.info(f"✅ Job {job.get('job_id')} started in thread (active: {self.active_jobs_count}/{self.max_parallel_jobs})")
                    except requests.exceptions.RequestException as e:
                        self.logger.warning(f"Error requesting job: {e}")
                        break
                
                # Clean up finished threads
                self.active_jobs = [t for t in self.active_jobs if t.is_alive()]
                
                # Update status
                if self.active_jobs_count > 0:
                    self.status = 'processing'
                else:
                    self.status = 'idle'
                
                # Sleep before next polling cycle
                if self.status == 'idle':
                    self.logger.info(f"ℹ No jobs available or at capacity, polling again in {self.poll_interval}s")
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
