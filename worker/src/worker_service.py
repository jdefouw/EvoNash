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
        
        # Get or generate machine-specific worker ID
        # IMPORTANT: This is stored in a SEPARATE file (machine_id.txt) that should NEVER be copied
        # between machines. This ensures each machine has a unique identity even if worker_config.json
        # is shared/copied during deployment.
        import uuid
        machine_id_path = Path(__file__).parent.parent / 'data' / 'machine_id.txt'
        
        if machine_id_path.exists():
            # Load existing machine ID
            self.persistent_worker_id = machine_id_path.read_text().strip()
            self.logger.info(f"Loaded machine ID from {machine_id_path}: {self.persistent_worker_id}")
        else:
            # Generate new machine-specific UUID
            self.persistent_worker_id = str(uuid.uuid4())
            machine_id_path.parent.mkdir(parents=True, exist_ok=True)
            machine_id_path.write_text(self.persistent_worker_id)
            self.logger.info(f"Generated new machine ID: {self.persistent_worker_id}")
            self.logger.info(f"  Saved to: {machine_id_path}")
            self.logger.info(f"  NOTE: This file should NOT be copied between machines!")
        
        # State
        self.running = True
        self.current_job: Optional[Dict] = None
        self.status = 'idle'  # idle, processing, error
        self.worker_id: Optional[str] = None  # Will be set after registration
        self.gpu_type: Optional[str] = None
        self.vram_gb: int = 0
        self.max_parallel_jobs: int = 0
        self.active_jobs: list = []  # List of active job threads/tasks (legacy, unused in single-job mode)
        self.active_jobs_count: int = 0
        
        # Thread safety lock for job processing (defense in depth)
        # Ensures only one job can be processed at a time even if threading is re-enabled
        self._job_lock = threading.Lock()
        
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
        
        # Notify server of graceful shutdown
        self._notify_disconnect("User initiated shutdown (signal {})".format(signum))
    
    def _notify_disconnect(self, reason: str):
        """Notify server that worker is disconnecting and release all jobs."""
        if not self.worker_id:
            return
            
        try:
            self.logger.info(f"Notifying server of disconnect: {reason}")
            response = requests.post(
                f"{self.controller_url}/api/workers/disconnect",
                json={
                    'worker_id': self.worker_id,
                    'reason': reason
                },
                timeout=5
            )
            if response.status_code == 200:
                data = response.json()
                jobs_released = data.get('jobs_released', 0)
                self.logger.info(f"✓ Server notified of shutdown ({jobs_released} jobs released)")
            else:
                self.logger.warning(f"⚠ Failed to notify server: {response.status_code}")
        except Exception as e:
            self.logger.warning(f"⚠ Failed to notify server of disconnect: {e}")
    
    def _claim_job(self, job_id: str) -> bool:
        """
        Claim a job before processing to prevent conflicts.
        
        Args:
            job_id: The job ID to claim
            
        Returns:
            True if job was successfully claimed, False otherwise
        """
        if not self.worker_id:
            self.logger.error("Cannot claim job: worker_id not set")
            return False
            
        try:
            self.logger.info(f"📋 Claiming job {job_id}...")
            response = requests.post(
                f"{self.controller_url}/api/queue/claim",
                json={
                    'job_id': job_id,
                    'worker_id': self.worker_id
                },
                timeout=10
            )
            
            if response.status_code == 200:
                self.logger.info(f"✓ Job {job_id} claimed successfully")
                return True
            elif response.status_code == 409:
                self.logger.warning(f"⚠ Job {job_id} no longer available (may have been claimed by another worker)")
                return False
            else:
                self.logger.error(f"✗ Failed to claim job: {response.status_code} - {response.text}")
                return False
        except Exception as e:
            self.logger.error(f"✗ Error claiming job {job_id}: {e}")
            return False
    
    def _release_job(self, job_id: str, reason: str, last_completed_generation: Optional[int] = None):
        """
        Release a job back to the queue.
        
        Args:
            job_id: The job ID to release
            reason: Reason for releasing the job
            last_completed_generation: Last generation that was successfully completed
        """
        if not self.worker_id:
            return
            
        try:
            payload = {
                'job_id': job_id,
                'worker_id': self.worker_id,
                'reason': reason
            }
            if last_completed_generation is not None:
                payload['last_completed_generation'] = last_completed_generation
                
            self.logger.info(f"📤 Releasing job {job_id}: {reason}")
            response = requests.post(
                f"{self.controller_url}/api/queue/release",
                json=payload,
                timeout=10
            )
            
            if response.status_code == 200:
                self.logger.info(f"✓ Job {job_id} released successfully")
            else:
                self.logger.warning(f"⚠ Failed to release job: {response.status_code}")
        except Exception as e:
            self.logger.warning(f"⚠ Error releasing job {job_id}: {e}")
    
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
        """Check GPU availability and log status with detailed diagnostics."""
        import os
        
        # Log PyTorch and CUDA build info for diagnostics
        self.logger.info(f"PyTorch version: {torch.__version__}")
        self.logger.info(f"PyTorch CUDA built with: {torch.version.cuda if torch.version.cuda else 'None (CPU-only build)'}")
        
        if self.device == 'cuda':
            # Detailed CUDA availability check
            cuda_available = torch.cuda.is_available()
            self.logger.info(f"torch.cuda.is_available(): {cuda_available}")
            
            if not cuda_available:
                # Additional diagnostics when CUDA appears unavailable
                self.logger.warning("=" * 60)
                self.logger.warning("CUDA DIAGNOSTICS - Investigating why CUDA is unavailable")
                self.logger.warning("=" * 60)
                
                # Check if CUDA was built into PyTorch
                if not torch.version.cuda:
                    self.logger.error("❌ PyTorch was built WITHOUT CUDA support!")
                    self.logger.error("   Install PyTorch with CUDA: pip install torch --index-url https://download.pytorch.org/whl/cu121")
                else:
                    self.logger.info(f"✓ PyTorch was built with CUDA {torch.version.cuda}")
                    
                    # Try to get more info about why CUDA isn't working
                    try:
                        device_count = torch.cuda.device_count()
                        self.logger.info(f"  Device count: {device_count}")
                    except Exception as e:
                        self.logger.error(f"  Error getting device count: {e}")
                    
                    # Check CUDA_VISIBLE_DEVICES
                    cuda_visible = os.environ.get('CUDA_VISIBLE_DEVICES', 'not set')
                    self.logger.info(f"  CUDA_VISIBLE_DEVICES: {cuda_visible}")
                    
                    # Try to initialize CUDA explicitly
                    try:
                        self.logger.info("  Attempting explicit CUDA initialization...")
                        torch.cuda.init()
                        # Check again after explicit init
                        if torch.cuda.is_available():
                            self.logger.info("  ✓ CUDA now available after explicit init!")
                            cuda_available = True
                        else:
                            self.logger.warning("  ✗ CUDA still unavailable after explicit init")
                    except Exception as e:
                        self.logger.error(f"  CUDA init error: {e}")
                
                self.logger.warning("=" * 60)
            
            if cuda_available:
                self.gpu_type, self.vram_gb = self._get_gpu_info()
                self.logger.info(f"✓ GPU available: {self.gpu_type}")
                self.logger.info(f"  VRAM: {self.vram_gb} GB")
                self.logger.info(f"  CUDA version: {torch.version.cuda}")
                # ALWAYS use single-job mode for scientific rigor and CUDA stability
                # This ensures deterministic execution and prevents GPU memory conflicts
                self.max_parallel_jobs = 1
                self.logger.info(f"  Max parallel jobs: {self.max_parallel_jobs} (single-job mode for scientific rigor)")
            else:
                self.logger.warning("⚠ CUDA requested but not available, falling back to CPU")
                self.device = 'cpu'
                self.gpu_type = 'CPU'
                self.vram_gb = 0
                self.max_parallel_jobs = 1  # CPU can handle 1 job at a time
        else:
            self.logger.info("Running on CPU (configured)")
            self.gpu_type = 'CPU'
            self.vram_gb = 0
            self.max_parallel_jobs = 1
    
    def _register_worker(self):
        """Register worker with controller using persistent worker_id."""
        max_retries = 3
        retry_delay = 5
        
        for attempt in range(max_retries):
            try:
                worker_name = self.worker_config.get('worker_name', None)
                
                payload = {
                    'worker_id': self.persistent_worker_id,  # Send persistent ID
                    'worker_name': worker_name,
                    'gpu_type': self.gpu_type or 'CPU',
                    'vram_gb': self.vram_gb
                }
                
                self.logger.info(f"Registering worker with controller (persistent ID: {self.persistent_worker_id})...")
                self.logger.info(f"  Payload: gpu_type={payload['gpu_type']}, vram_gb={payload['vram_gb']}")
                
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
                    return  # Success
                else:
                    self.logger.warning(f"⚠ Worker registration failed: {response.status_code}")
                    self.logger.warning(f"  Response: {response.text}")
                    
                    if attempt < max_retries - 1:
                        self.logger.info(f"  Retrying in {retry_delay}s... (attempt {attempt + 1}/{max_retries})")
                        time.sleep(retry_delay)
                        retry_delay *= 2  # Exponential backoff
                    
            except Exception as e:
                self.logger.error(f"✗ Error registering worker (attempt {attempt + 1}/{max_retries}): {e}")
                
                if attempt < max_retries - 1:
                    self.logger.info(f"  Retrying in {retry_delay}s...")
                    time.sleep(retry_delay)
                    retry_delay *= 2
        
        # All retries failed - use persistent ID as fallback
        self.logger.warning("⚠ All registration attempts failed. Using persistent ID as worker_id.")
        self.worker_id = self.persistent_worker_id
        self.logger.warning(f"  Worker will continue with ID: {self.worker_id}")
    
    def _send_heartbeat(self):
        """Send heartbeat to controller."""
        if not self.worker_id:
            return
        
        try:
            # Determine status based on active jobs count for accurate reporting
            # This ensures the server knows we're processing even if self.status is stale
            current_status = 'processing' if self.active_jobs_count > 0 else self.status
            
            payload = {
                'worker_id': self.worker_id,
                'status': current_status,
                'active_jobs_count': self.active_jobs_count
            }
            
            response = requests.post(
                f"{self.controller_url}/api/workers/heartbeat",
                json=payload,
                timeout=5
            )
            
            if response.status_code == 404:
                # Worker was deleted from server (stale heartbeat cleanup)
                # Re-register to restore worker entry
                self.logger.warning("⚠ Worker not found in server, re-registering...")
                self._register_worker()
            elif response.status_code != 200:
                self.logger.warning(f"Heartbeat failed: {response.status_code}")
        except requests.exceptions.Timeout:
            self.logger.debug("Heartbeat timeout (will retry next cycle)")
        except requests.exceptions.ConnectionError:
            self.logger.debug("Heartbeat connection error (will retry next cycle)")
        except Exception as e:
            self.logger.warning(f"Heartbeat error: {e}")
    
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
        Create batch upload callback function that uploads generations frequently for live UI updates.
        
        Args:
            job_id: Job ID
            experiment_id: Experiment ID
            generation_start: First generation in batch
            generation_end: Last generation in batch
            
        Returns:
            Callback function that takes generation stats dict and uploads them periodically
        """
        batch_stats: list = []
        UPLOAD_INTERVAL = 3  # Upload every 3 generations for live updates
        
        def upload_batch(stats_to_upload: list, reason: str):
            """Helper function to upload a batch of stats."""
            if not stats_to_upload:
                return
            
            try:
                payload = {
                    "job_id": job_id,
                    "experiment_id": experiment_id,
                    "worker_id": self.worker_id,  # Include worker_id for ownership verification
                    "generation_stats_batch": stats_to_upload,
                    "matches": []  # Empty for now
                }
                
                response = requests.post(
                    f"{self.controller_url}/api/results",
                    json=payload,
                    timeout=60
                )
                
                if response.status_code == 200:
                    result = response.json()
                    self.logger.info(f"✅ Successfully uploaded {len(stats_to_upload)} generations ({reason}): {result.get('generations_inserted', 0)} inserted")
                else:
                    self.logger.warning(f"⚠️ Batch upload failed: {response.status_code}")
                    self.logger.warning(f"  Response: {response.text[:200]}")
            except Exception as e:
                self.logger.error(f"✗ Error uploading batch: {e}")
        
        def upload_callback(generation_stats: Dict):
            """Collect generation stats and upload periodically for live UI updates."""
            gen_num = generation_stats.get('generation', 'unknown')
            batch_stats.append(generation_stats)
            self.logger.info(f"📝 Collected generation {gen_num} for batch upload")
            
            # Upload every N generations for live UI updates
            if len(batch_stats) >= UPLOAD_INTERVAL:
                stats_to_upload = batch_stats[:UPLOAD_INTERVAL]
                # Remove uploaded stats from the list
                del batch_stats[:UPLOAD_INTERVAL]
                upload_batch(stats_to_upload, f"periodic upload (every {UPLOAD_INTERVAL} gens)")
            
            # Always upload remaining stats at the end of the batch
            if gen_num >= generation_end and batch_stats:
                self.logger.info(f"📤 Uploading final batch of {len(batch_stats)} generations...")
                stats_to_upload = list(batch_stats)  # Copy the list
                batch_stats.clear()
                upload_batch(stats_to_upload, "final batch")
        
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
    
    def _create_generation_check_callback(self, experiment_id: str) -> callable:
        """
        Create generation check callback function that queries if a generation already exists.
        
        Args:
            experiment_id: Experiment ID to check
            
        Returns:
            Callback function that returns True if generation already exists
        """
        import requests
        
        def generation_check_callback(generation_number: int) -> bool:
            """Check if generation already exists in database."""
            try:
                # Query the generations endpoint to check if this generation exists
                response = requests.get(
                    f"{self.controller_url}/api/generations",
                    params={'experiment_id': experiment_id, 'generation_number': generation_number},
                    timeout=10
                )
                
                if response.status_code == 200:
                    data = response.json()
                    # If we get data back, the generation exists
                    return len(data) > 0
                elif response.status_code == 404:
                    # Generation doesn't exist
                    return False
                else:
                    # On error, assume it doesn't exist (safer to process than skip)
                    self.logger.warning(f"⚠️ Error checking generation {generation_number}: {response.status_code}, assuming not exists")
                    return False
            except Exception as e:
                # On exception, assume it doesn't exist (safer to process than skip)
                self.logger.warning(f"⚠️ Exception checking generation {generation_number}: {e}, assuming not exists")
                return False
        
        return generation_check_callback
    
    def _get_last_completed_generation(self, experiment_id: str) -> int:
        """
        Query the database for the last completed generation number (single API call).
        
        This is much more efficient than checking generations one-by-one for recovery.
        
        Args:
            experiment_id: Experiment ID to check
            
        Returns:
            The highest completed generation number, or -1 if none exist
        """
        import requests
        
        try:
            response = requests.get(
                f"{self.controller_url}/api/generations",
                params={'experiment_id': experiment_id, 'latest': 'true'},
                timeout=10
            )
            
            if response.status_code == 200:
                data = response.json()
                last_gen = data.get('last_completed_generation', -1)
                return last_gen
            else:
                self.logger.warning(f"⚠️ Error getting last completed generation: {response.status_code}")
                return -1
        except Exception as e:
            self.logger.warning(f"⚠️ Exception getting last completed generation: {e}")
            return -1
    
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
                # Validate generation number exists
                generation_number = population_state.get('generation')
                if generation_number is None:
                    self.logger.error(f"⚠ Checkpoint save failed: generation number missing from population_state")
                    return
                
                # Try to compress the population_state to reduce payload size
                # Convert to JSON string, compress with gzip, then base64 encode
                use_compression = True
                compressed_b64 = None
                payload_size_bytes = 0
                try:
                    json_str = json.dumps(population_state)
                    uncompressed_size = len(json_str.encode('utf-8'))
                    compressed = gzip.compress(json_str.encode('utf-8'))
                    compressed_b64 = base64.b64encode(compressed).decode('utf-8')
                    compressed_size = len(compressed_b64.encode('utf-8'))
                    
                    # Estimate final payload size (JSON overhead + base64 data)
                    # Base64 encoding increases size by ~33%, JSON wrapper adds ~100 bytes
                    payload_size_bytes = compressed_size + 200  # Add buffer for JSON wrapper
                    
                    # Log size information for debugging
                    compression_ratio = (1 - compressed_size / uncompressed_size) * 100 if uncompressed_size > 0 else 0
                    self.logger.debug(f"Checkpoint size: {uncompressed_size:,} bytes uncompressed, {compressed_size:,} bytes compressed ({compression_ratio:.1f}% reduction)")
                    
                    # Warn if payload is approaching the limit (4.5MB = 4,500,000 bytes)
                    if payload_size_bytes > 4_000_000:  # 4MB threshold
                        self.logger.warning(f"⚠ Checkpoint payload is large ({payload_size_bytes:,} bytes), may exceed Vercel 4.5MB limit")
                    
                except Exception as compress_error:
                    self.logger.warning(f"⚠ Compression failed, sending uncompressed: {compress_error}")
                    use_compression = False
                    # Estimate uncompressed size
                    try:
                        json_str = json.dumps(population_state)
                        payload_size_bytes = len(json_str.encode('utf-8')) + 200
                    except:
                        pass
                
                # Check if payload is too large before sending
                MAX_PAYLOAD_SIZE = 4_500_000  # Vercel limit is 4.5MB
                if payload_size_bytes > MAX_PAYLOAD_SIZE:
                    self.logger.error(f"⚠ Checkpoint payload too large ({payload_size_bytes:,} bytes > {MAX_PAYLOAD_SIZE:,} bytes). Skipping checkpoint save.")
                    self.logger.error(f"   Consider reducing max_agents in save_population_state() or using a different storage mechanism.")
                    return
                
                # Prepare request payload - always include generation_number at top level
                if use_compression and compressed_b64:
                    payload = {
                        'generation_number': int(generation_number),  # Ensure it's an integer
                        'population_state_compressed': compressed_b64,
                        'compressed': True
                    }
                else:
                    # Fallback to uncompressed (for small populations or if compression fails)
                    payload = {
                        'generation_number': int(generation_number),  # Ensure it's an integer
                        'population_state': population_state,
                        'compressed': False
                    }
                
                response = requests.post(
                    f"{self.controller_url}/api/experiments/{experiment_id}/checkpoint",
                    json=payload,
                    timeout=60  # Increased timeout for large payloads
                )
                
                if response.status_code == 200:
                    self.logger.info(f"✓ Checkpoint saved for generation {population_state['generation']}")
                else:
                    # Log the error response for debugging
                    try:
                        error_data = response.json()
                        error_msg = error_data.get('error', 'Unknown error')
                        error_details = error_data.get('details', '')
                        self.logger.warning(f"⚠ Checkpoint save failed: {response.status_code} - {error_msg}")
                        if error_details:
                            self.logger.warning(f"  Details: {error_details}")
                    except:
                        self.logger.warning(f"⚠ Checkpoint save failed: {response.status_code} - {response.text[:200]}")
            except Exception as e:
                self.logger.warning(f"⚠ Checkpoint save error: {e}")
        
        return checkpoint_callback
    
    def process_job(self, job: Dict):
        """
        Process a single job (generation batch).
        
        Uses mutex lock for defense-in-depth to ensure only one job processes at a time.
        Counter is incremented before claiming to prevent race conditions.
        
        Args:
            job: Job dictionary from controller with generation_start and generation_end
        """
        # Acquire lock to ensure single-job processing (defense in depth)
        with self._job_lock:
            self._process_job_internal(job)
    
    def _process_job_internal(self, job: Dict):
        """
        Internal job processing logic (called under lock).
        
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
        
        # Increment active jobs count BEFORE claiming (atomic reserve)
        # This prevents race conditions where multiple jobs could be claimed simultaneously
        self.active_jobs_count += 1
        
        # Claim the job before processing to prevent conflicts
        if job_id and not self._claim_job(job_id):
            self.logger.error(f"✗ Failed to claim job {job_id}, skipping")
            # Rollback counter on claim failure
            self.active_jobs_count = max(0, self.active_jobs_count - 1)
            return
        
        # Track current job for heartbeat and shutdown
        self.current_job = job
        
        try:
            self.logger.info("=" * 80)
            self.logger.info(f"🎯 JOB CLAIMED - Starting Processing")
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
            
            # EFFICIENT RECOVERY: Single API call to get last completed generation
            # Instead of checking generations one-by-one (O(n) calls), we query the max in O(1)
            self.logger.info(f"🔍 Checking for existing progress (efficient single-query recovery)...")
            last_completed = self._get_last_completed_generation(experiment_id)
            
            # VALIDATION: Check if batch is completely obsolete (all generations already done)
            # This can happen if the queue assigned an old batch that was completed by another worker
            if generation_end <= last_completed:
                self.logger.warning(f"⚠️ OBSOLETE BATCH DETECTED: Batch {generation_start}-{generation_end} is entirely before last completed ({last_completed})")
                self.logger.warning(f"   This batch has already been completed. Releasing job without processing.")
                # Release the job so it doesn't block the queue
                self._release_job(job_id, "batch_obsolete")
                return
            
            # Calculate actual_start efficiently based on last completed generation
            if last_completed >= generation_start:
                # Resume from one after last completed (capped at generation_end + 1)
                actual_start = min(last_completed + 1, generation_end + 1)
                skipped_count = actual_start - generation_start
                self.logger.info(f"✓ Recovery: Found {skipped_count} completed generations (last: {last_completed})")
                self.logger.info(f"  → Resuming from generation {actual_start}")
            else:
                # No completed generations in this range, start from beginning
                actual_start = generation_start
                if last_completed == -1:
                    self.logger.info(f"✓ No prior progress found, starting from generation {generation_start}")
                else:
                    self.logger.info(f"✓ Last completed ({last_completed}) is before batch range, starting from {generation_start}")
            
            # Load checkpoint if starting from a non-zero generation
            checkpoint_state = None
            if actual_start > 0:
                # Try to load checkpoint from the generation before actual_start
                checkpoint_gen = actual_start - 1
                try:
                    self.logger.info(f"📥 Attempting to load checkpoint for generation {checkpoint_gen}...")
                    checkpoint_response = requests.get(
                        f"{self.controller_url}/api/experiments/{experiment_id}/checkpoint",
                        params={'generation': str(checkpoint_gen)},
                        timeout=30
                    )
                    
                    if checkpoint_response.status_code == 200:
                        checkpoint_data = checkpoint_response.json()
                        checkpoint_state = checkpoint_data.get('population_state')
                        self.logger.info(f"✓ Checkpoint loaded for generation {checkpoint_data.get('generation_number')}")
                    elif checkpoint_response.status_code == 404:
                        # If specific checkpoint not found, try loading the latest available checkpoint
                        self.logger.info(f"📥 Checkpoint for gen {checkpoint_gen} not found, trying latest checkpoint...")
                        try:
                            checkpoint_response = requests.get(
                                f"{self.controller_url}/api/experiments/{experiment_id}/checkpoint",
                                timeout=30  # No generation param = get latest
                            )
                            if checkpoint_response.status_code == 200:
                                checkpoint_data = checkpoint_response.json()
                                checkpoint_state = checkpoint_data.get('population_state')
                                loaded_gen = checkpoint_data.get('generation_number')
                                self.logger.info(f"✓ Latest checkpoint loaded (from generation {loaded_gen})")
                            else:
                                self.logger.warning(f"⚠ No checkpoint found, starting fresh")
                        except Exception as e2:
                            self.logger.warning(f"⚠ Error loading latest checkpoint: {e2}, starting fresh")
                    else:
                        self.logger.warning(f"⚠ Failed to load checkpoint: {checkpoint_response.status_code}")
                except Exception as e:
                    self.logger.warning(f"⚠ Error loading checkpoint: {e}, starting fresh")
            
            # Update generation_start to skip existing generations
            if actual_start > generation_start:
                self.logger.info(f"📝 Adjusting generation_start from {generation_start} to {actual_start} to skip existing generations")
                generation_start = actual_start
            
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
            
            # Create generation check callback to avoid duplicate work
            generation_check_callback = self._create_generation_check_callback(experiment_id)
            
            # Create checkpoint loader callback for loading checkpoints when skipping generations
            def checkpoint_loader_callback(generation_number: int) -> Optional[Dict]:
                """Load checkpoint for a specific generation number."""
                try:
                    checkpoint_response = requests.get(
                        f"{self.controller_url}/api/experiments/{experiment_id}/checkpoint",
                        params={'generation': str(generation_number)},
                        timeout=30
                    )
                    if checkpoint_response.status_code == 200:
                        checkpoint_data = checkpoint_response.json()
                        return checkpoint_data.get('population_state')
                    return None
                except Exception as e:
                    self.logger.warning(f"⚠️  Error loading checkpoint for generation {generation_number}: {e}")
                    return None
            
            # Initialize and run experiment batch
            runner = OptimizedExperimentRunner(
                config,
                device=self.device,
                upload_callback=upload_callback,
                stop_check_callback=stop_check_callback,
                generation_start=generation_start,
                generation_end=generation_end,
                checkpoint_callback=checkpoint_callback,
                generation_check_callback=generation_check_callback,
                checkpoint_loader_callback=checkpoint_loader_callback
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
            # Release the job so another worker can pick it up
            if job_id:
                self._release_job(job_id, "User interrupted (KeyboardInterrupt)")
            raise  # Re-raise to stop service
        except torch.cuda.OutOfMemoryError as e:
            self.logger.error(f"GPU out of memory error: {e}")
            self.logger.error("Try reducing population_size or batch size")
            # Release the job so another worker can try
            if job_id:
                self._release_job(job_id, f"GPU out of memory: {e}")
        except Exception as e:
            self.logger.error(f"Error processing job {job_id}: {e}", exc_info=True)
            # Release the job on unexpected errors
            if job_id:
                self._release_job(job_id, f"Unexpected error: {e}")
        finally:
            # Clear current job tracking
            self.current_job = None
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
        
        while self.running:
            try:
                # Single-job synchronous processing for scientific rigor
                # Only request a job if we can accept one (should always be true in single-job mode)
                if self._can_accept_job() and self.running:
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
                            self.status = 'idle'
                            self.logger.info(f"ℹ No jobs available, polling again in {self.poll_interval}s")
                        elif response.status_code == 429:
                            # Worker at capacity (shouldn't happen in single-job mode, but handle it)
                            self.status = 'idle'
                            self.logger.info(f"ℹ At capacity, polling again in {self.poll_interval}s")
                        else:
                            response.raise_for_status()
                            job = response.json()
                            
                            if job:
                                consecutive_errors = 0
                                # Process job synchronously (blocks until complete)
                                # This ensures deterministic execution and data integrity
                                self.logger.info(f"✅ Job {job.get('job_id')} received, processing synchronously")
                                self.status = 'processing'
                                self.process_job(job)
                                self.status = 'idle'
                                # Continue immediately to check for next job
                                continue
                            else:
                                self.status = 'idle'
                    except requests.exceptions.RequestException as e:
                        self.logger.warning(f"Error requesting job: {e}")
                        self.status = 'idle'
                else:
                    self.status = 'idle'
                
                # Sleep before next polling cycle
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
