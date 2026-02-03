
import sys
import os
import argparse
import torch
import traceback
from pathlib import Path
import time

# Add worker dir to path (so we can import src as a package)
sys.path.insert(0, os.path.dirname(__file__))

from src.experiments.experiment_manager import ExperimentConfig
from src.experiments.experiment_runner_optimized import OptimizedExperimentRunner
from src.logging.csv_logger import CSVLogger

class BatchExperimentRunner(OptimizedExperimentRunner):
    """
    Subclass of OptimizedExperimentRunner that supports custom data directories
    for batch processing.
    """
    def __init__(self, config: ExperimentConfig, data_dir: str, device: str = 'cuda'):
        # Initialize parent
        super().__init__(config, device=device)
        
        # Override logger with one that points to the specific run directory
        self.logger = CSVLogger(
            experiment_id=config.experiment_id,
            experiment_group=config.experiment_group,
            data_dir=data_dir
        )
        print(f"  [BatchRunner] Logger redirected to: {self.logger.filename}")


def run_batch_experiments(num_runs: int, output_dir: str, gpu_id: int, max_generations: int = 1500):
    """
    Run N pairs of experiments (Control + Experimental).
    """
    if torch.cuda.is_available():
        torch.cuda.set_device(gpu_id)
        print(f"Using GPU: {torch.cuda.get_device_name(gpu_id)}")
    
    base_output_path = Path(output_dir)
    base_output_path.mkdir(parents=True, exist_ok=True)
    
    start_seed = 42 # Starting seed
    
    print(f"\nStarting Batch Process: {num_runs} paired runs")
    print(f"Generations per run: {max_generations}")
    print(f"Output Directory: {base_output_path.absolute()}")
    print("="*60)
    
    for i in range(num_runs):
        run_id = i
        seed = start_seed + i
        run_dir = base_output_path / f"run_{run_id}_seed_{seed}"
        run_dir.mkdir(parents=True, exist_ok=True)
        
        print(f"\n[Run {run_id+1}/{num_runs}] Processing Seed {seed}...")
        print(f"  Directory: {run_dir}")
        
        # 1. Run Control (Static Mutation)
        print(f"  > Starting CONTROL Group...")
        try:
            control_config = ExperimentConfig(
                experiment_id=f"batch_run_{run_id}_control",
                experiment_name=f"Batch Run {run_id} Control",
                experiment_group="CONTROL",
                random_seed=seed,
                max_generations=max_generations, # Run long enough to converge
                population_size=1000
            )
            
            runner = BatchExperimentRunner(
                config=control_config,
                data_dir=str(run_dir),
                device='cuda' if torch.cuda.is_available() else 'cpu'
            )
            
            # Hook into equilibrium callback to log convergence
            def on_equilibrium(gen):
                print(f"    ! Nash Equilibrium Detected at Generation {gen}")
            
            runner.equilibrium_reached_callback = on_equilibrium
            
            runner.run_experiment()
            print(f"  < CONTROL Complete.")
            
        except Exception as e:
            print(f"  !!! ERROR in CONTROL run: {e}")
            traceback.print_exc()
        
        # 2. Run Experimental (Adaptive Mutation)
        print(f"  > Starting EXPERIMENTAL Group...")
        try:
            exp_config = ExperimentConfig(
                experiment_id=f"batch_run_{run_id}_experimental",
                experiment_name=f"Batch Run {run_id} Experimental",
                experiment_group="EXPERIMENTAL",
                random_seed=seed,
                max_generations=max_generations,
                population_size=1000
            )
            
            runner = BatchExperimentRunner(
                config=exp_config,
                data_dir=str(run_dir),
                device='cuda' if torch.cuda.is_available() else 'cpu'
            )
            
            runner.equilibrium_reached_callback = on_equilibrium
            
            runner.run_experiment()
            print(f"  < EXPERIMENTAL Complete.")
            
        except Exception as e:
            print(f"  !!! ERROR in EXPERIMENTAL run: {e}")
            traceback.print_exc()
            
        print(f"  [Run {run_id+1}] Pair completed.")
        print("-" * 60)

    print("\nBatch Processing Complete.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Run batch EvoNash experiments for CWSF data collection.")
    parser.add_argument("--n", type=int, default=1, help="Number of paired runs to execute")
    parser.add_argument("--out", type=str, default="cwsf_data_batch", help="Output directory")
    parser.add_argument("--gpu", type=int, default=0, help="GPU ID to use")
    parser.add_argument("--generations", type=int, default=1500, help="Max generations per run")
    
    args = parser.parse_args()
    
    run_batch_experiments(args.n, args.out, args.gpu, args.generations)
