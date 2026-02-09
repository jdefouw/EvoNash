
import os
import sys
import json
import requests
from src.utils.uploader import ExperimentUploader

def check_verification():
    # Initialize uploader to get configuration and worker ID
    uploader = ExperimentUploader()
    
    if not uploader.worker_id:
        print("[Check] Worker ID not found. Cannot check verification status.")
        sys.exit(1) # Not verified (or unknown)
        
    print(f"[Check] Checking verification status for worker: {uploader.worker_id}")
    
    try:
        # Query the verification endpoint
        # We need to query GET /api/verification?worker_id=... but current GET is all logs
        # Let's check if the specific worker has a PASS record in the last X days?
        # Or just checking the last 50 logs returned by default GET might be enough if volume is low.
        # BETTER: The user said "if there is no verification on file in the DB for the worker".
        # let's try to find a "PASS" for this worker_id in the logs.
        
        response = requests.get(f"{uploader.controller_url}/api/verification")
        
        if response.status_code != 200:
            print(f"[Check] Failed to fetch verification logs: {response.status_code}")
            sys.exit(1) # Assume not verified on error
            
        logs = response.json()
        
        # Look for a passing record for this worker
        is_verified = False
        for log in logs:
            if log.get('worker_id') == uploader.worker_id and log.get('status') == 'PASS':
                print(f"[Check] Found existing verification record from {log.get('executed_at')}")
                is_verified = True
                break
        
        if is_verified:
            print("[Check] Worker is already verified.")
            sys.exit(0) # Verified
        else:
            print("[Check] No verification record found for this worker.")
            sys.exit(1) # Not verified
            
    except Exception as e:
        print(f"[Check] Error checking verification: {e}")
        sys.exit(1) # Assume not verified on error

if __name__ == "__main__":
    check_verification()
