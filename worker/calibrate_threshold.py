
import sys
import os
import argparse
import torch
import numpy as np
import pandas as pd
from pathlib import Path

# Add worker dir to path
sys.path.insert(0, os.path.dirname(__file__))

from src.experiments.experiment_manager import ExperimentConfig
from src.experiments.experiment_runner_optimized import OptimizedExperimentRunner
from src.logging.csv_logger import CSVLogger
import src.experiments.experiment_runner_optimized as ero

class CalibrationRunner(OptimizedExperimentRunner):
    """
    Runner that saves to a calibration folder.
    """
    def __init__(self, config: ExperimentConfig, data_dir: str, device: str = 'cuda'):
        super().__init__(config, device=device)
        self.logger = CSVLogger(
            experiment_id=config.experiment_id,
            experiment_group=config.experiment_group,
            data_dir=data_dir
        )

def calibrate(generations: int, gpu_id: int):
    """
    Run a long Control experiment to determine the noise floor of entropy variance.
    """
    if torch.cuda.is_available():
        torch.cuda.set_device(gpu_id)
        print(f"Using GPU: {torch.cuda.get_device_name(gpu_id)}")
    
    # Disable early stopping globally for this run to ensure we get full data
    ero.ENABLE_EARLY_STOPPING = False
    print("Early stopping DISABLED for calibration.")
    
    out_dir = Path("calibration_data")
    out_dir.mkdir(exist_ok=True)
    
    print(f"Running Control Experiment for {generations} generations...")
    
    config = ExperimentConfig(
        experiment_id="calibration_run",
        experiment_name="Calibration Run",
        experiment_group="CONTROL", # Use Control (Static) as baseline
        random_seed=42,
        max_generations=generations,
        population_size=1000
    )
    
    runner = CalibrationRunner(
        config=config,
        data_dir=str(out_dir),
        device='cuda' if torch.cuda.is_available() else 'cpu'
    )
    
    runner.run_experiment()
    
    print("\nProcessing results...")
    
    # Load the data
    try:
        csv_path = out_dir / "control_data.csv"
        df = pd.read_csv(csv_path)
        
        # Analyze Entropy Variance
        variance = df['entropy_variance']
        # Ignore first 50 generations (warmup)
        stable_var = variance[50:] if len(variance) > 50 else variance
        
        min_var = stable_var.min()
        avg_var = stable_var.mean()
        p95_var = np.percentile(stable_var, 5) # 5th percentile (low end)
        
        print("\n" + "="*50)
        print("CALIBRATION RESULTS")
        print("="*50)
        print(f"Entropy Variance (Post-warmup):")
        print(f"  Min: {min_var:.6f}")
        print(f"  Mean: {avg_var:.6f}")
        print(f"  P5 ({generations} gens): {p95_var:.6f}")
        print("-" * 50)
        
        current_threshold = 0.001
        print(f"Current Threshold: {current_threshold}")
        
        if min_var < current_threshold:
            print("VALIDATION: The 0.001 threshold IS reachable.")
        else:
            print("WARNING: The 0.001 threshold might be too strict (Min observed > 0.001).")
            print(f"Consider relaxing to: {min_var * 1.5:.4f}")

        # Upload results
        try:
            from src.utils.uploader import ExperimentUploader
            uploader = ExperimentUploader()
            if uploader.worker_id:
                print("\nUploading calibration results...")
                uploader.upload_calibration(
                    metric_name="entropy_variance",
                    min_val=float(min_var),
                    mean_val=float(avg_var),
                    threshold=float(current_threshold),
                    generations=generations
                )
            else:
                print("Skipping upload: No worker_id found")
        except Exception as ue:
            print(f"Failed to upload results: {ue}")
            
    except Exception as e:
        print(f"Error analyzing data: {e}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Run calibration for EvoNash thresholds.")
    parser.add_argument("--generations", type=int, default=500, help="Number of generations")
    parser.add_argument("--gpu", type=int, default=0, help="GPU ID")
    
    args = parser.parse_args()
    
    calibrate(args.generations, args.gpu)
