"""
Verification tests for CUDA optimization changes.

These tests ensure that the optimized implementations produce scientifically
equivalent results to the original implementations, preserving experiment integrity.

Tests compare:
1. BatchedNetworkEnsemble vs individual forward passes
2. Analytical raycast vs step-based raycast
3. Vectorized food consumption vs loop-based

Run with: python -m pytest tests/test_cuda_optimizations.py -v
Or standalone: python tests/test_cuda_optimizations.py
"""

import logging
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'src'))

import torch
import numpy as np
from typing import List
import time


def test_batched_network_ensemble():
    """
    Test that BatchedNetworkEnsemble produces identical outputs to individual forward passes.
    
    Scientific integrity: Neural network outputs must be mathematically identical.
    """
    print("\n" + "="*60)
    print("TEST: BatchedNetworkEnsemble vs Individual Forward Passes")
    print("="*60)
    
    from simulation.agent import Agent, NeuralNetwork
    from simulation.agent_batched import BatchedNetworkEnsemble
    
    device = 'cuda' if torch.cuda.is_available() else 'cpu'
    print(f"Device: {device}")
    
    # Create test agents
    num_agents = 100
    agents = []
    for i in range(num_agents):
        network = NeuralNetwork(input_size=24, hidden_size=64, output_size=4).to(device)
        # Initialize with random but reproducible weights
        torch.manual_seed(i)
        for param in network.parameters():
            torch.nn.init.normal_(param, mean=0.0, std=0.1)
        agent = Agent(agent_id=i, network=network, device=device)
        agents.append(agent)
    
    # Create batched ensemble
    ensemble = BatchedNetworkEnsemble(agents, device=device)
    
    # Create test inputs
    torch.manual_seed(42)
    test_inputs = torch.randn(num_agents, 24, device=device)
    
    # Get outputs from individual forward passes (legacy approach)
    individual_outputs = torch.zeros(num_agents, 4, device=device)
    with torch.no_grad():
        for i, agent in enumerate(agents):
            output = agent.network(test_inputs[i:i+1])
            individual_outputs[i] = output.squeeze(0)
    
    # Get outputs from batched ensemble
    with torch.no_grad():
        batched_outputs = ensemble.forward(test_inputs)
    
    # Compare outputs
    max_diff = torch.max(torch.abs(individual_outputs - batched_outputs)).item()
    mean_diff = torch.mean(torch.abs(individual_outputs - batched_outputs)).item()
    
    print(f"\nResults:")
    print(f"  Max absolute difference: {max_diff:.2e}")
    print(f"  Mean absolute difference: {mean_diff:.2e}")
    
    # Allow small floating point differences (< 1e-5)
    tolerance = 1e-5
    passed = max_diff < tolerance
    
    if passed:
        print(f"  STATUS: PASSED (tolerance: {tolerance})")
    else:
        print(f"  STATUS: FAILED (max_diff {max_diff} > tolerance {tolerance})")
    
    # Performance comparison
    print("\nPerformance comparison:")
    
    # Time individual forward passes
    torch.cuda.synchronize() if device == 'cuda' else None
    start = time.perf_counter()
    for _ in range(10):
        with torch.no_grad():
            for i, agent in enumerate(agents):
                _ = agent.network(test_inputs[i:i+1])
    torch.cuda.synchronize() if device == 'cuda' else None
    individual_time = (time.perf_counter() - start) / 10
    
    # Time batched forward passes
    torch.cuda.synchronize() if device == 'cuda' else None
    start = time.perf_counter()
    for _ in range(10):
        with torch.no_grad():
            _ = ensemble.forward(test_inputs)
    torch.cuda.synchronize() if device == 'cuda' else None
    batched_time = (time.perf_counter() - start) / 10
    
    speedup = individual_time / batched_time if batched_time > 0 else float('inf')
    print(f"  Individual forward passes: {individual_time*1000:.2f}ms")
    print(f"  Batched forward pass: {batched_time*1000:.2f}ms")
    print(f"  Speedup: {speedup:.1f}x")
    
    return passed


def test_analytical_raycast():
    """
    Test that analytical raycast produces similar results to step-based raycast.
    
    Scientific integrity: Raycast distances should be geometrically equivalent.
    Note: Analytical method may be more accurate than step-based.
    """
    print("\n" + "="*60)
    print("TEST: Analytical Raycast vs Step-Based Raycast (Deterministic)")
    print("="*60)
    
    from simulation.petri_dish_vectorized import VectorizedPetriDish
    
    device = 'cuda' if torch.cuda.is_available() else 'cpu'
    print(f"Device: {device}")
    
    # Create petri dish
    petri_dish = VectorizedPetriDish(ticks_per_generation=100, device=device)
    
    # Create deterministic setup
    # Place 1 agent at (100, 100) looking East (0 radians)
    # Place 1 food at (150, 100) -> Distance 50 - radius
    num_agents = 1
    agent_positions = torch.tensor([[100.0, 100.0]], device=device, dtype=torch.float32)
    agent_angles = torch.tensor([0.0], device=device, dtype=torch.float32)
    active_mask = torch.ones(num_agents, dtype=torch.bool, device=device)
    
    # Force food position
    if len(petri_dish.food) == 0:
        from simulation.petri_dish import Food
        petri_dish.food = [Food(150.0, 100.0, 0)]
    else:
        petri_dish.food[0].x = 150.0
        petri_dish.food[0].y = 100.0
        # Remove other food
        petri_dish.food = petri_dish.food[:1]
        
    petri_dish._update_food_tensors()
    
    raycast_config = {
        'count': 1,
        'max_distance': 200.0,
        'angles': np.array([0.0]) # Look straight ahead
    }
    
    # Get results from analytical method
    analytical_results = petri_dish.batch_raycast(
        agent_positions, agent_angles, raycast_config, active_mask
    )
    
    # Get results from legacy step-based method
    legacy_results = petri_dish.batch_raycast_legacy(
        agent_positions, agent_angles, raycast_config, active_mask
    )
    
    # Compare food detection (column 1)
    # Analytical: Exact distance to circle surface = 50 - radius (wait, core logic might return center dist or surface dist?)
    # Usually raycasts return distance to surface.
    # Legacy: Step based 10.0.
    
    an_dist = analytical_results[0, 0, 1].item()
    leg_dist = legacy_results[0, 0, 1].item()
    
    print(f"\nResults (Food Detection):")
    print(f"  Analytical Dist: {an_dist:.2f}")
    print(f"  Legacy Dist: {leg_dist:.2f}")
    
    diff = abs(an_dist - leg_dist)
    print(f"  Difference: {diff:.2f}")
    
    # Allow difference up to step_size + error
    tolerance = 15.0 
    passed = diff < tolerance
    
    if passed:
        print(f"  STATUS: PASSED (tolerance: {tolerance})")
    else:
        print(f"  STATUS: FAILED (diff {diff} > tolerance {tolerance})")
    
    return passed


def test_vectorized_food_consumption():
    """
    Test that vectorized food consumption produces identical results to loop-based.
    
    Scientific integrity: Energy updates and food consumption must be identical.
    """
    print("\n" + "="*60)
    print("TEST: Vectorized Food Consumption vs Loop-Based (Deterministic)")
    print("="*60)
    
    from simulation.petri_dish_vectorized import VectorizedPetriDish
    from simulation.petri_dish import Food
    
    device = 'cuda' if torch.cuda.is_available() else 'cpu'
    print(f"Device: {device}")
    
    # Create petri dish
    petri_dish = VectorizedPetriDish(ticks_per_generation=100, device=device)
    
    # Deterministic setup: 2 Agents, 2 Foods. No overlap.
    # Agent 0 at (10, 10). Food 0 at (10, 10). Collision!
    # Agent 1 at (500, 500). Food 1 at (500, 500). Collision!
    # This avoids 'closest vs first' ambiguity since each food has clearly 1 closest agent.
    
    num_agents = 2
    agent_positions = torch.tensor([
        [10.0, 10.0],
        [500.0, 500.0]
    ], device=device, dtype=torch.float32)
    
    agent_energies = torch.tensor([50.0, 50.0], device=device, dtype=torch.float32)
    active_mask = torch.ones(num_agents, dtype=torch.bool, device=device)
    
    # Setup food
    petri_dish.food = [
        Food(10.0, 10.0, 0),
        Food(500.0, 500.0, 1)
    ]
    petri_dish._update_food_tensors()
    
    # Test vectorized version
    food_consumed_initial = petri_dish.food_consumed.clone()
    energies_vectorized, consumed_vectorized = petri_dish.batch_check_food_consumption(
        agent_positions, agent_energies.clone(), active_mask
    )
    
    # Verify both foods consumed
    if not torch.all(consumed_vectorized).item():
        print("WARNING: Vectorized did not consume all food!")
    
    # Reset food state
    petri_dish.food_consumed = food_consumed_initial.clone()
    
    # Test legacy version
    energies_legacy, consumed_legacy = petri_dish.batch_check_food_consumption_legacy(
        agent_positions, agent_energies.clone(), active_mask
    )
    
    # Compare results
    energy_diff = torch.max(torch.abs(energies_vectorized - energies_legacy)).item()
    consumed_match = torch.all(consumed_vectorized == consumed_legacy).item()
    
    print(f"\nResults:")
    print(f"  Vectorized Energies: {energies_vectorized.cpu().numpy()}")
    print(f"  Legacy Energies: {energies_legacy.cpu().numpy()}")
    print(f"  Max energy difference: {energy_diff:.6f}")
    print(f"  Consumed mask matches: {consumed_match}")
    
    passed = energy_diff < 1e-5 and consumed_match
    
    if passed:
        print(f"  STATUS: PASSED")
    else:
        print(f"  STATUS: FAILED")
    
    return passed


def run_all_tests():
    """Run all verification tests and report results."""
    print("\n" + "="*70)
    print(" CUDA OPTIMIZATION VERIFICATION TESTS")
    print(" Ensuring scientific integrity of optimized implementations")
    print("="*70)
    
    results = {}
    
    try:
        results['BatchedNetworkEnsemble'] = test_batched_network_ensemble()
    except Exception as e:
        print(f"\nERROR in BatchedNetworkEnsemble test: {e}")
        results['BatchedNetworkEnsemble'] = False
    
    try:
        results['AnalyticalRaycast'] = test_analytical_raycast()
    except Exception as e:
        print(f"\nERROR in AnalyticalRaycast test: {e}")
        results['AnalyticalRaycast'] = False
    
    try:
        results['VectorizedFoodConsumption'] = test_vectorized_food_consumption()
    except Exception as e:
        print(f"\nERROR in VectorizedFoodConsumption test: {e}")
        results['VectorizedFoodConsumption'] = False
    
    # Summary
    print("\n" + "="*70)
    print(" TEST SUMMARY")
    print("="*70)
    
    all_passed = True
    for test_name, passed in results.items():
        status = "PASSED" if passed else "FAILED"
        symbol = "[PASS]" if passed else "[FAIL]"
        print(f"  {symbol} {test_name}: {status}")
        if not passed:
            all_passed = False
    
    print("="*70)
    if all_passed:
        print(" ALL TESTS PASSED - Scientific integrity preserved")
    else:
        print(" SOME TESTS FAILED - Review implementations")
    print("="*70 + "\n")
    
    return all_passed


if __name__ == '__main__':
    success = run_all_tests()
    
    # Upload results
    try:
        from src.utils.uploader import ExperimentUploader
        uploader = ExperimentUploader()
        if uploader.worker_id:
            status = "PASS" if success else "FAIL"
            details = {"full_suite_pass": success}
            print("\nUploading verification results...")
            uploader.upload_verification("test_cuda_optimizations.py", status, details)
        else:
            print("Skipping upload: No worker_id found (run start_worker.bat first to generate one)")
    except Exception as e:
        print(f"Failed to upload results: {e}")
        
    sys.exit(0 if success else 1)
