"""
Statistical analysis tools for EvoNash experiments.
Performs t-tests, convergence analysis, and generates graphs.
"""

import pandas as pd
import numpy as np
from scipy import stats
from matplotlib import pyplot as plt
from pathlib import Path
from typing import Dict, Tuple, Optional
import json


class StatisticalAnalyzer:
    """Performs statistical analysis on experiment data."""
    
    def __init__(self, control_csv_path: str, experimental_csv_path: str):
        """
        Initialize analyzer with CSV data files.
        
        Args:
            control_csv_path: Path to control_data.csv
            experimental_csv_path: Path to experimental_data.csv
        """
        self.control_df = pd.read_csv(control_csv_path, encoding='utf-8')
        self.experimental_df = pd.read_csv(experimental_csv_path, encoding='utf-8')
    
    def calculate_convergence_generation(self, df: pd.DataFrame, threshold: float = 0.01) -> Optional[int]:
        """
        Calculate generation at which entropy variance drops below threshold.
        
        Args:
            df: DataFrame with generation data
            threshold: Entropy variance threshold (default 0.01)
            
        Returns:
            Generation number where convergence occurred, or None if never converged
        """
        if 'entropy_variance' not in df.columns:
            return None
        
        converged = df[df['entropy_variance'] < threshold]
        if len(converged) > 0:
            return int(converged.iloc[0]['generation'])
        return None
    
    def perform_t_test(self) -> Dict:
        """
        Perform two-sample t-test on final Elo ratings.
        
        Returns:
            Dictionary with t-statistic, p-value, and interpretation
        """
        # Get last 100 generations for statistical power
        control_elos = self.control_df['avg_elo'].tail(100).values
        experimental_elos = self.experimental_df['avg_elo'].tail(100).values
        
        t_stat, p_value = stats.ttest_ind(control_elos, experimental_elos)
        
        is_significant = p_value < 0.05
        
        return {
            't_statistic': float(t_stat),
            'p_value': float(p_value),
            'is_significant': is_significant,
            'control_mean': float(np.mean(control_elos)),
            'experimental_mean': float(np.mean(experimental_elos)),
            'control_std': float(np.std(control_elos)),
            'experimental_std': float(np.std(experimental_elos)),
            'interpretation': 'Statistically significant' if is_significant else 'Not statistically significant'
        }
    
    def analyze_convergence(self) -> Dict:
        """
        Analyze convergence speed for both groups.
        
        Returns:
            Dictionary with convergence analysis
        """
        control_convergence = self.calculate_convergence_generation(self.control_df)
        experimental_convergence = self.calculate_convergence_generation(self.experimental_df)
        
        acceleration = None
        if control_convergence and experimental_convergence:
            acceleration = ((control_convergence - experimental_convergence) / control_convergence) * 100
        
        return {
            'control_convergence_gen': control_convergence,
            'experimental_convergence_gen': experimental_convergence,
            'acceleration_percent': acceleration,
            'control_peak_elo': float(self.control_df['peak_elo'].max()),
            'experimental_peak_elo': float(self.experimental_df['peak_elo'].max())
        }
    
    def plot_convergence_velocity(self, output_path: str):
        """
        Plot Convergence Velocity graph (Generation vs Average Elo).
        
        Args:
            output_path: Path to save the graph
        """
        plt.figure(figsize=(12, 6))
        
        plt.plot(
            self.control_df['generation'],
            self.control_df['avg_elo'],
            label='Control (Static Mutation)',
            linewidth=2
        )
        plt.plot(
            self.experimental_df['generation'],
            self.experimental_df['avg_elo'],
            label='Experimental (Adaptive Mutation)',
            linewidth=2
        )
        
        plt.xlabel('Generation', fontsize=12)
        plt.ylabel('Average Elo Rating', fontsize=12)
        plt.title('Convergence Velocity: Generation vs Average Elo', fontsize=14, fontweight='bold')
        plt.legend(fontsize=10)
        plt.grid(True, alpha=0.3)
        plt.tight_layout()
        
        plt.savefig(output_path, dpi=300, bbox_inches='tight')
        plt.close()
    
    def plot_entropy_collapse(self, output_path: str):
        """
        Plot Entropy Collapse graph (Generation vs Policy Entropy).
        
        Args:
            output_path: Path to save the graph
        """
        plt.figure(figsize=(12, 6))
        
        plt.plot(
            self.control_df['generation'],
            self.control_df['policy_entropy'],
            label='Control (Static Mutation)',
            linewidth=2
        )
        plt.plot(
            self.experimental_df['generation'],
            self.experimental_df['policy_entropy'],
            label='Experimental (Adaptive Mutation)',
            linewidth=2
        )
        
        plt.xlabel('Generation', fontsize=12)
        plt.ylabel('Policy Entropy', fontsize=12)
        plt.title('Entropy Collapse: Generation vs Policy Entropy', fontsize=14, fontweight='bold')
        plt.legend(fontsize=10)
        plt.grid(True, alpha=0.3)
        plt.tight_layout()
        
        plt.savefig(output_path, dpi=300, bbox_inches='tight')
        plt.close()
    
    def plot_statistical_significance(self, output_path: str):
        """
        Plot Statistical Significance bar chart with error bars.
        
        Args:
            output_path: Path to save the graph
        """
        t_test_results = self.perform_t_test()
        
        groups = ['Control', 'Experimental']
        means = [t_test_results['control_mean'], t_test_results['experimental_mean']]
        stds = [t_test_results['control_std'], t_test_results['experimental_std']]
        
        plt.figure(figsize=(8, 6))
        
        bars = plt.bar(groups, means, yerr=stds, capsize=10, alpha=0.7, color=['#3498db', '#e74c3c'])
        
        plt.ylabel('Average Elo Rating', fontsize=12)
        plt.title('Statistical Significance: Final Mean Performance', fontsize=14, fontweight='bold')
        plt.grid(True, alpha=0.3, axis='y')
        
        # Add p-value annotation
        p_text = f"p-value: {t_test_results['p_value']:.4f}"
        if t_test_results['is_significant']:
            p_text += " *"
        plt.text(0.5, max(means) + max(stds) + 50, p_text, 
                ha='center', fontsize=10, fontweight='bold')
        
        plt.tight_layout()
        plt.savefig(output_path, dpi=300, bbox_inches='tight')
        plt.close()
    
    def generate_all_analysis(self, output_dir: str) -> Dict:
        """
        Generate all analysis graphs and statistics.
        
        Args:
            output_dir: Directory to save analysis outputs
            
        Returns:
            Dictionary with all analysis results
        """
        output_path = Path(output_dir)
        output_path.mkdir(parents=True, exist_ok=True)
        
        # Generate graphs
        self.plot_convergence_velocity(str(output_path / 'convergence_velocity.png'))
        self.plot_entropy_collapse(str(output_path / 'entropy_collapse.png'))
        self.plot_statistical_significance(str(output_path / 'statistical_significance.png'))
        
        # Perform analyses
        t_test_results = self.perform_t_test()
        convergence_results = self.analyze_convergence()
        
        # Combine results
        results = {
            't_test': t_test_results,
            'convergence': convergence_results,
            'graphs': {
                'convergence_velocity': str(output_path / 'convergence_velocity.png'),
                'entropy_collapse': str(output_path / 'entropy_collapse.png'),
                'statistical_significance': str(output_path / 'statistical_significance.png')
            }
        }
        
        # Save results to JSON
        with open(output_path / 'analysis_results.json', 'w', encoding='utf-8') as f:
            json.dump(results, f, indent=2)
        
        return results
