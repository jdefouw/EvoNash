#!/usr/bin/env python
"""
Worker setup script — ensures UUID and worker name exist before anything else runs.

Run before verification or worker service. This script:
1. Checks/generates a persistent machine UUID (data/machine_id.txt)
2. Prompts the user for a worker name (or keeps existing)
3. Saves everything to config/worker_config.json

Exit code 0 = setup complete, 1 = error.
"""

import json
import uuid
import socket
import sys
from pathlib import Path


def main():
    worker_dir = Path(__file__).parent.resolve()
    config_path = worker_dir / "config" / "worker_config.json"
    machine_id_path = worker_dir / "data" / "machine_id.txt"

    # ── Load or create config ─────────────────────────────────────────
    if config_path.exists():
        with open(config_path, "r", encoding="utf-8") as f:
            config = json.load(f)
    else:
        config_path.parent.mkdir(parents=True, exist_ok=True)
        config = {
            "controller_url": "https://sf.defouw.ca",
            "poll_interval_seconds": 30,
            "max_retries": 3,
            "retry_delay_seconds": 5,
            "device": "cuda",
            "log_level": "INFO",
            "log_file": "logs/worker.log",
        }

    # ── Step 1: Ensure persistent worker UUID ─────────────────────────
    hostname = socket.gethostname()
    worker_id = None

    if machine_id_path.exists():
        try:
            content = machine_id_path.read_text().strip()
            if ":" in content:
                stored_hostname, stored_uuid = content.split(":", 1)
                if stored_hostname == hostname:
                    worker_id = stored_uuid
                    print(f"  Worker ID loaded: {worker_id[:8]}... (host: {hostname})")
                else:
                    print(f"  WARNING: machine_id.txt was created on '{stored_hostname}', "
                          f"but this machine is '{hostname}'")
                    print(f"  Generating a new ID for this machine...")
            else:
                # Old format — migrate
                print(f"  Migrating old machine_id format...")
        except Exception as e:
            print(f"  Error reading machine_id.txt: {e}")

    if worker_id is None:
        worker_id = str(uuid.uuid4())
        machine_id_path.parent.mkdir(parents=True, exist_ok=True)
        machine_id_path.write_text(f"{hostname}:{worker_id}")
        print(f"  Generated new Worker ID: {worker_id[:8]}... (host: {hostname})")
        print(f"  Saved to: {machine_id_path}")

    # ── Step 2: Worker name prompt ────────────────────────────────────
    current_name = config.get("worker_name", "")

    print()
    print("=" * 60)
    print("  EVONASH WORKER - Setup")
    print("=" * 60)
    print()
    print(f"  Worker ID:   {worker_id[:8]}...")
    print(f"  Hostname:    {hostname}")
    print(f"  Server:      {config.get('controller_url', 'not set')}")
    print()

    if current_name:
        print(f"  Current worker name: {current_name}")
        print()
        try:
            choice = input("  Keep this name? (Y/n): ").strip().lower()
        except EOFError:
            choice = "y"

        if choice in ("", "y", "yes"):
            print(f"  Keeping name: {current_name}")
        else:
            try:
                new_name = input("  Enter new worker name: ").strip()
            except EOFError:
                new_name = ""
            if new_name:
                config["worker_name"] = new_name
                print(f"  Worker name changed to: {new_name}")
            else:
                print(f"  No name entered, keeping: {current_name}")
    else:
        print("  No worker name configured yet.")
        print("  This name identifies your worker in the dashboard.")
        print("  Examples: 'Gaming-PC', 'Lab-Server-1', 'Joel-3090'")
        print()
        try:
            new_name = input("  Enter worker name: ").strip()
        except EOFError:
            new_name = ""

        if new_name:
            config["worker_name"] = new_name
            print(f"  Worker name set to: {new_name}")
        else:
            default_name = f"Worker-{worker_id[:8]}"
            config["worker_name"] = default_name
            print(f"  Using default name: {default_name}")

    print()
    print("=" * 60)

    # ── Save config ───────────────────────────────────────────────────
    with open(config_path, "w", encoding="utf-8") as f:
        json.dump(config, f, indent=2)
    print(f"  Config saved to: {config_path}")
    print()

    return 0


if __name__ == "__main__":
    sys.exit(main())
