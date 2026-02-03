
import requests
import json
import logging
import os
from datetime import datetime

logger = logging.getLogger(__name__)

class ExperimentUploader:
    def __init__(self, controller_url=None):
        self.worker_id = None
        
        # 1. Try to load config from standard location
        config_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "config", "worker_config.json")
        loaded_url = None
        
        if os.path.exists(config_path):
            try:
                with open(config_path, 'r') as f:
                    config = json.load(f)
                    loaded_url = config.get('controller_url')
                    if loaded_url:
                        print(f"[Uploader] Loaded controller URL from config: {loaded_url}")
            except Exception as e:
                print(f"[Uploader] Failed to load config: {e}")

        # 2. Use argument or default
        if controller_url:
            self.controller_url = controller_url.rstrip("/")
        elif loaded_url:
            self.controller_url = loaded_url.rstrip("/")
        else:
            print("[Uploader] Warning: using default localhost URL")
            self.controller_url = "http://localhost:3000"

        self._load_worker_id()

    def _load_worker_id(self):
        try:
            # Look for machine_id.txt relative to this file
            # this file is in worker/src/utils/uploader.py
            # machine_id is in worker/data/machine_id.txt
            current_dir = os.path.dirname(os.path.abspath(__file__))
            worker_root = os.path.dirname(os.path.dirname(os.path.dirname(current_dir))) 
            # Wait, path logic is tricky. 
            # File: worker/src/utils/uploader.py
            # Root: worker/
            # Data: worker/data/machine_id.txt
            
            # Let's try standard relative path from execution context usually 'worker/'
            data_path = os.path.join("data", "machine_id.txt")
            
            if os.path.exists(data_path):
                with open(data_path, 'r') as f:
                    content = f.read().strip()
                    if ":" in content:
                        _, self.worker_id = content.split(":", 1)
                    else:
                        self.worker_id = content
        except Exception as e:
            logger.warning(f"Could not load worker_id: {e}")

    def upload_verification(self, test_suite: str, status: str, details: dict):
        """Upload verification test results."""
        endpoint = f"{self.controller_url}/api/verification"
        payload = {
            "worker_id": self.worker_id,
            "test_suite": test_suite,
            "status": status,
            "details": details
        }
        
        try:
            response = requests.post(endpoint, json=payload, timeout=10)
            if response.status_code == 200:
                print(f"[Uploader] Successfully uploaded verification results for {test_suite}")
                return True
            else:
                print(f"[Uploader] Failed to upload verification: {response.status_code} {response.text}")
                return False
        except Exception as e:
            print(f"[Uploader] Error uploading verification: {e}")
            return False

    def upload_calibration(self, metric_name: str, min_val: float, mean_val: float, threshold: float, generations: int):
        """Upload calibration log."""
        endpoint = f"{self.controller_url}/api/calibration"
        payload = {
            "worker_id": self.worker_id,
            "metric_name": metric_name,
            "min_value": min_val,
            "mean_value": mean_val,
            "recommended_threshold": threshold,
            "generations_run": generations
        }
        
        try:
            response = requests.post(endpoint, json=payload, timeout=10)
            if response.status_code == 200:
                print(f"[Uploader] Successfully uploaded calibration for {metric_name}")
                return True
            else:
                print(f"[Uploader] Failed to upload calibration: {response.status_code} {response.text}")
                return False
        except Exception as e:
            print(f"[Uploader] Error uploading calibration: {e}")
            return False
