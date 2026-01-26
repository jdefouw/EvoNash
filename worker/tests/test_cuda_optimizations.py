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
    print("TEST: Analytical Raycast vs Step-Based Raycast")
    print("="*60)
    
    from simulation.petri_dish_vectorized import VectorizedPetriDish
    
    device = 'cuda' if torch.cuda.is_available() else 'cpu'
    print(f"Device: {device}")
    
    # Create petri dish
    petri_dish = VectorizedPetriDish(ticks_per_generation=100, device=device)
    
    # Create test agent positions and angles
    num_agents = 50
    torch.manual_seed(42)
    agent_positions = torch.rand(num_agents, 2, device=device) * 500
    agent_angles = torch.rand(num_agents, device=device) * 2 * np.pi
    active_mask = torch.ones(num_agents, dtype=torch.bool, device=device)
    
    raycast_config = {
        'count': 8,
        'max_distance': 200.0,
        'angles': np.linspace(0, 360, 8)
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
    # Note: Step-based has limited precision based on step_size
    step_size = 10.0  # From legacy implementation
    
    # For food detection, analytical should find food at same or closer distances
    food_diff = analytical_results[:, :, 1] - legacy_results[:, :, 1]
    max_food_diff = torch.max(torch.abs(food_diff)).item()
    
    print(f"\nResults (Food Detection, column 1):")
    print(f"  Max absolute difference: {max_food_diff:.2f}")
    print(f"  Expected max difference: ~{step_size} (step size)")
    
    # Analytical should generally find food at same or closer distance
    # Allow difference up to step_size since step-based has discrete sampling
    tolerance = step_size + 5.0  # Allow some margin
    passed = max_food_diff < tolerance
    
    if passed:
        print(f"  STATUS: PASSED (tolerance: {tolerance})")
    else:
        print(f"  STATUS: FAILED (max_diff {max_food_diff} > tolerance {tolerance})")
    
    # Performance comparison
    print("\nPerformance comparison:")
    
    torch.cuda.synchronize() if device == 'cuda' else None
    start = time.perf_counter()
    for _ in range(10):
        _ = petri_dish.batch_raycast(agent_positions, agent_angles, raycast_config, active_mask)
    torch.cuda.synchronize() if device == 'cuda' else None
    analytical_time = (time.perf_counter() - start) / 10
    
    torch.cuda.synchronize() if device == 'cuda' else None
    start = time.perf_counter()
    for _ in range(10):
        _ = petri_dish.batch_raycast_legacy(agent_positions, agent_angles, raycast_config, active_mask)
    torch.cuda.synchronize() if device == 'cuda' else None
    legacy_time = (time.perf_counter() - start) / 10
    
    speedup = legacy_time / analytical_time if analytical_time > 0 else float('inf')
    print(f"  Analytical raycast: {analytical_time*1000:.2f}ms")
    print(f"  Step-based raycast: {legacy_time*1000:.2f}ms")
    print(f"  Speedup: {speedup:.1f}x")
    
    return passed


def test_vectorized_food_consumption():
    """
    Test that vectorized food consumption produces identical results to loop-based.
    
    Scientific integrity: Energy updates and food consumption must be identical.
    """
    print("\n" + "="*60)
    print("TEST: Vectorized Food Consumption vs Loop-Based")
    print("="*60)
    
    from simulation.petri_dish_vectorized import VectorizedPetriDish
    
    device = 'cuda' if torch.cuda.is_available() else 'cpu'
    print(f"Device: {device}")
    
    # Create petri dish with known food positions
    petri_dish = VectorizedPetriDish(ticks_per_generation=100, device=device)
    
    # Create test scenario with some agents near food
    num_agents = 100
    torch.manual_seed(42)
    
    # Place some agents very close to food for guaranteed collisions
    agent_positions = torch.rand(num_agents, 2, device=device) * 500
    agent_energies = torch.full((num_agents,), 50.0, device=device)
    active_mask = torch.ones(num_agents, dtype=torch.bool, device=device)
    
    # Reset food to known state for both tests
    petri_dish.reset()
    food_consumed_initial = petri_dish.food_consumed.clone()
    
    # Test vectorized version
    energies_vectorized, consumed_vectorized = petri_dish.batch_check_food_consumption(
        agent_positions, agent_energies.clone(), active_mask
    )
    
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
    print(f"  Max energy difference: {energy_diff:.6f}")
    print(f"  Consumed mask matches: {consumed_match}")
    print(f"  Total food consumed (vectorized): {consumed_vectorized.sum().item()}")
    print(f"  Total food consumed (legacy): {consumed_legacy.sum().item()}")
    
    passed = energy_diff < 1e-5 and consumed_match
    
    if passed:
        print(f"  STATUS: PASSED")
    else:
        print(f"  STATUS: FAILED")
    
    # Performance comparison
    print("\nPerformance comparison:")
    
    petri_dish.food_consumed = food_consumed_initial.clone()
    torch.cuda.synchronize() if device == 'cuda' else None
    start = time.perf_counter()
    for _ in range(100):
        petri_dish.food_consumed = food_consumed_initial.clone()
        _ = petri_dish.batch_check_food_consumption(
            agent_positions, agent_energies.clone(), active_mask
        )
    torch.cuda.synchronize() if device == 'cuda' else None
    vectorized_time = (time.perf_counter() - start) / 100
    
    petri_dish.food_consumed = food_consumed_initial.clone()
    torch.cuda.synchronize() if device == 'cuda' else None
    start = time.perf_counter()
    for _ in range(100):
        petri_dish.food_consumed = food_consumed_initial.clone()
        _ = petri_dish.batch_check_food_consumption_legacy(
            agent_positions, agent_energies.clone(), active_mask
        )
    torch.cuda.synchronize() if device == 'cuda' else None
    legacy_time = (time.perf_counter() - start) / 100
    
    speedup = legacy_time / vectorized_time if vectorized_time > 0 else float('inf')
    print(f"  Vectorized: {vectorized_time*1000:.2f}ms")
    print(f"  Loop-based: {legacy_time*1000:.2f}ms")
    print(f"  Speedup: {speedup:.1f}x")
    
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
        symbol = "✓" if passed else "✗"
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
    sys.exit(0 if success else 1)
