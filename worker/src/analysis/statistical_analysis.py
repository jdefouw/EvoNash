"""
Statistical analysis tools for EvoNash experiments.
Performs t-tests, convergence analysis, and generates graphs.

Scientific Rigor Features:
- Assumption checking (normality tests, outlier detection)
- Non-parametric alternatives (Mann-Whitney U)
- Enhanced effect sizes (Hedges' g, CLES)
- Power analysis
- Bootstrap confidence intervals
"""

import pandas as pd
import numpy as np
from scipy import stats
from scipy.special import ndtri  # For normal quantiles
from matplotlib import pyplot as plt
from pathlib import Path
from typing import Dict, Tuple, Optional, List
import json


# =============================================================================
# STATISTICAL UTILITY FUNCTIONS
# =============================================================================

def shapiro_wilk_test(data: np.ndarray) -> Dict:
    """
    Perform Shapiro-Wilk test for normality.
    
    The Shapiro-Wilk test is considered one of the most powerful tests for 
    normality, especially for small sample sizes (n < 50).
    
    Args:
        data: Array of numeric values
        
    Returns:
        Dictionary with W statistic, p-value, and interpretation
    """
    data = np.array(data).flatten()
    data = data[~np.isnan(data)]
    
    if len(data) < 3:
        return {
            'W_statistic': None,
            'p_value': None,
            'is_normal': None,
            'interpretation': 'Insufficient data (n < 3)',
            'sample_size': len(data)
        }
    
    # Shapiro-Wilk has an upper limit of 5000 samples
    if len(data) > 5000:
        data = np.random.choice(data, 5000, replace=False)
    
    try:
        W, p_value = stats.shapiro(data)
        is_normal = p_value >= 0.05
        
        if p_value >= 0.10:
            interpretation = 'Strong evidence for normality'
        elif p_value >= 0.05:
            interpretation = 'Marginal evidence for normality'
        elif p_value >= 0.01:
            interpretation = 'Evidence against normality'
        else:
            interpretation = 'Strong evidence against normality'
        
        return {
            'W_statistic': float(W),
            'p_value': float(p_value),
            'is_normal': is_normal,
            'interpretation': interpretation,
            'sample_size': len(data)
        }
    except Exception as e:
        return {
            'W_statistic': None,
            'p_value': None,
            'is_normal': None,
            'interpretation': f'Test failed: {str(e)}',
            'sample_size': len(data)
        }


def levene_test(group1: np.ndarray, group2: np.ndarray) -> Dict:
    """
    Perform Levene's test for equality of variances.
    
    More robust than Bartlett's test for non-normal distributions.
    
    Args:
        group1, group2: Arrays of numeric values
        
    Returns:
        Dictionary with test statistic, p-value, and interpretation
    """
    g1 = np.array(group1).flatten()
    g2 = np.array(group2).flatten()
    g1 = g1[~np.isnan(g1)]
    g2 = g2[~np.isnan(g2)]
    
    if len(g1) < 2 or len(g2) < 2:
        return {
            'W_statistic': None,
            'p_value': None,
            'equal_variances': None,
            'interpretation': 'Insufficient data'
        }
    
    try:
        W, p_value = stats.levene(g1, g2, center='median')
        equal_variances = p_value >= 0.05
        
        return {
            'W_statistic': float(W),
            'p_value': float(p_value),
            'equal_variances': equal_variances,
            'interpretation': 'Equal variances' if equal_variances else 'Unequal variances'
        }
    except Exception as e:
        return {
            'W_statistic': None,
            'p_value': None,
            'equal_variances': None,
            'interpretation': f'Test failed: {str(e)}'
        }


def detect_outliers_iqr(data: np.ndarray, k: float = 1.5) -> Dict:
    """
    Detect outliers using the IQR (Interquartile Range) method.
    
    Outliers are defined as values below Q1 - k*IQR or above Q3 + k*IQR.
    Default k=1.5 identifies mild outliers; k=3.0 identifies extreme outliers.
    
    Args:
        data: Array of numeric values
        k: IQR multiplier (default 1.5)
        
    Returns:
        Dictionary with outlier information
    """
    data = np.array(data).flatten()
    data = data[~np.isnan(data)]
    
    if len(data) < 4:
        return {
            'outlier_count': 0,
            'outlier_indices': [],
            'outlier_values': [],
            'lower_bound': None,
            'upper_bound': None,
            'Q1': None,
            'Q3': None,
            'IQR': None,
            'outlier_percentage': 0.0
        }
    
    Q1 = np.percentile(data, 25)
    Q3 = np.percentile(data, 75)
    IQR = Q3 - Q1
    
    lower_bound = Q1 - k * IQR
    upper_bound = Q3 + k * IQR
    
    outlier_mask = (data < lower_bound) | (data > upper_bound)
    outlier_indices = np.where(outlier_mask)[0].tolist()
    outlier_values = data[outlier_mask].tolist()
    
    return {
        'outlier_count': len(outlier_values),
        'outlier_indices': outlier_indices,
        'outlier_values': outlier_values,
        'lower_bound': float(lower_bound),
        'upper_bound': float(upper_bound),
        'Q1': float(Q1),
        'Q3': float(Q3),
        'IQR': float(IQR),
        'outlier_percentage': (len(outlier_values) / len(data)) * 100
    }


def mann_whitney_u_test(group1: np.ndarray, group2: np.ndarray) -> Dict:
    """
    Perform Mann-Whitney U test (Wilcoxon rank-sum test).
    
    Non-parametric alternative to the independent samples t-test.
    Does not assume normal distribution. Tests whether the distributions
    of two groups are equal.
    
    Args:
        group1, group2: Arrays of numeric values
        
    Returns:
        Dictionary with U statistic, p-value, and interpretation
    """
    g1 = np.array(group1).flatten()
    g2 = np.array(group2).flatten()
    g1 = g1[~np.isnan(g1)]
    g2 = g2[~np.isnan(g2)]
    
    if len(g1) < 2 or len(g2) < 2:
        return {
            'U_statistic': None,
            'p_value': None,
            'is_significant': None,
            'interpretation': 'Insufficient data (n < 2 per group)',
            'sample_sizes': {'group1': len(g1), 'group2': len(g2)}
        }
    
    try:
        U, p_value = stats.mannwhitneyu(g1, g2, alternative='two-sided')
        is_significant = p_value < 0.05
        
        # Calculate rank-biserial correlation (effect size for Mann-Whitney)
        n1, n2 = len(g1), len(g2)
        rank_biserial = 1 - (2 * U) / (n1 * n2)
        
        return {
            'U_statistic': float(U),
            'p_value': float(p_value),
            'is_significant': is_significant,
            'rank_biserial_r': float(rank_biserial),
            'interpretation': 'Distributions differ significantly' if is_significant else 'No significant difference',
            'sample_sizes': {'group1': n1, 'group2': n2}
        }
    except Exception as e:
        return {
            'U_statistic': None,
            'p_value': None,
            'is_significant': None,
            'interpretation': f'Test failed: {str(e)}',
            'sample_sizes': {'group1': len(g1), 'group2': len(g2)}
        }


def hedges_g(group1: np.ndarray, group2: np.ndarray) -> Dict:
    """
    Calculate Hedges' g effect size.
    
    Similar to Cohen's d but with a correction factor for small sample sizes.
    More accurate than Cohen's d when n < 20.
    
    Args:
        group1, group2: Arrays of numeric values (group2 is typically experimental)
        
    Returns:
        Dictionary with Hedges' g, confidence interval, and interpretation
    """
    g1 = np.array(group1).flatten()
    g2 = np.array(group2).flatten()
    g1 = g1[~np.isnan(g1)]
    g2 = g2[~np.isnan(g2)]
    
    n1, n2 = len(g1), len(g2)
    
    if n1 < 2 or n2 < 2:
        return {
            'hedges_g': None,
            'cohens_d': None,
            'correction_factor': None,
            'ci_lower': None,
            'ci_upper': None,
            'interpretation': 'Insufficient data',
            'sample_sizes': {'group1': n1, 'group2': n2}
        }
    
    mean1, mean2 = np.mean(g1), np.mean(g2)
    var1, var2 = np.var(g1, ddof=1), np.var(g2, ddof=1)
    
    # Pooled standard deviation
    pooled_std = np.sqrt(((n1 - 1) * var1 + (n2 - 1) * var2) / (n1 + n2 - 2))
    
    if pooled_std == 0:
        return {
            'hedges_g': 0.0,
            'cohens_d': 0.0,
            'correction_factor': 1.0,
            'ci_lower': 0.0,
            'ci_upper': 0.0,
            'interpretation': 'No variance in data',
            'sample_sizes': {'group1': n1, 'group2': n2}
        }
    
    # Cohen's d
    cohens_d = (mean2 - mean1) / pooled_std
    
    # Hedges' correction factor (for small samples)
    # J = 1 - 3 / (4 * df - 1) where df = n1 + n2 - 2
    df = n1 + n2 - 2
    correction_factor = 1 - (3 / (4 * df - 1))
    
    # Hedges' g
    g = cohens_d * correction_factor
    
    # Standard error of Hedges' g
    se_g = np.sqrt((n1 + n2) / (n1 * n2) + (g ** 2) / (2 * (n1 + n2)))
    
    # 95% confidence interval
    ci_lower = g - 1.96 * se_g
    ci_upper = g + 1.96 * se_g
    
    # Interpretation
    abs_g = abs(g)
    if abs_g < 0.2:
        interpretation = 'Negligible'
    elif abs_g < 0.5:
        interpretation = 'Small'
    elif abs_g < 0.8:
        interpretation = 'Medium'
    else:
        interpretation = 'Large'
    
    return {
        'hedges_g': float(g),
        'cohens_d': float(cohens_d),
        'correction_factor': float(correction_factor),
        'ci_lower': float(ci_lower),
        'ci_upper': float(ci_upper),
        'interpretation': interpretation,
        'sample_sizes': {'group1': n1, 'group2': n2}
    }


def common_language_effect_size(group1: np.ndarray, group2: np.ndarray) -> Dict:
    """
    Calculate Common Language Effect Size (CLES).
    
    Also known as the probability of superiority. Represents the probability
    that a randomly selected value from group2 will be greater than a 
    randomly selected value from group1.
    
    More intuitive than Cohen's d or Hedges' g for non-statisticians.
    
    Args:
        group1: Control group values
        group2: Experimental group values
        
    Returns:
        Dictionary with CLES and interpretation
    """
    g1 = np.array(group1).flatten()
    g2 = np.array(group2).flatten()
    g1 = g1[~np.isnan(g1)]
    g2 = g2[~np.isnan(g2)]
    
    n1, n2 = len(g1), len(g2)
    
    if n1 < 1 or n2 < 1:
        return {
            'cles': None,
            'cles_percentage': None,
            'interpretation': 'Insufficient data'
        }
    
    # Count how many times group2 > group1
    count = 0
    ties = 0
    for v2 in g2:
        for v1 in g1:
            if v2 > v1:
                count += 1
            elif v2 == v1:
                ties += 1
    
    # CLES = (wins + 0.5 * ties) / (n1 * n2)
    cles = (count + 0.5 * ties) / (n1 * n2)
    
    # Interpretation
    if cles > 0.71:
        interpretation = 'Large advantage for experimental group'
    elif cles > 0.64:
        interpretation = 'Medium advantage for experimental group'
    elif cles > 0.56:
        interpretation = 'Small advantage for experimental group'
    elif cles >= 0.44:
        interpretation = 'Negligible difference'
    elif cles >= 0.36:
        interpretation = 'Small advantage for control group'
    elif cles >= 0.29:
        interpretation = 'Medium advantage for control group'
    else:
        interpretation = 'Large advantage for control group'
    
    return {
        'cles': float(cles),
        'cles_percentage': float(cles * 100),
        'interpretation': interpretation
    }


def calculate_statistical_power(n1: int, n2: int, effect_size: float, alpha: float = 0.05) -> Dict:
    """
    Calculate achieved statistical power for a two-sample t-test.
    
    Power = probability of detecting an effect when one exists.
    Typically, power >= 0.80 is considered adequate.
    
    Args:
        n1, n2: Sample sizes for each group
        effect_size: Cohen's d or Hedges' g
        alpha: Significance level (default 0.05)
        
    Returns:
        Dictionary with power, interpretation, and recommendations
    """
    if n1 < 2 or n2 < 2 or effect_size is None:
        return {
            'power': None,
            'interpretation': 'Insufficient data for power calculation',
            'is_adequate': None,
            'recommendation': 'Need at least n=2 per group'
        }
    
    # Non-centrality parameter
    # ncp = d * sqrt(n1*n2 / (n1+n2))
    ncp = abs(effect_size) * np.sqrt((n1 * n2) / (n1 + n2))
    
    # Degrees of freedom (using Welch's approximation simplified)
    df = n1 + n2 - 2
    
    # Critical t-value for two-tailed test
    t_crit = stats.t.ppf(1 - alpha / 2, df)
    
    # Power = P(|T| > t_crit | H1 is true)
    # Using non-central t-distribution
    try:
        power = 1 - stats.nct.cdf(t_crit, df, ncp) + stats.nct.cdf(-t_crit, df, ncp)
        power = float(power)
    except:
        # Fallback to normal approximation for large samples
        z_crit = stats.norm.ppf(1 - alpha / 2)
        power = 1 - stats.norm.cdf(z_crit - ncp) + stats.norm.cdf(-z_crit - ncp)
        power = float(power)
    
    is_adequate = power >= 0.80
    
    if power >= 0.95:
        interpretation = 'Excellent power - very likely to detect effect'
    elif power >= 0.80:
        interpretation = 'Adequate power - likely to detect effect'
    elif power >= 0.60:
        interpretation = 'Moderate power - may miss real effects'
    elif power >= 0.40:
        interpretation = 'Low power - likely to miss real effects'
    else:
        interpretation = 'Very low power - study is underpowered'
    
    return {
        'power': power,
        'power_percentage': power * 100,
        'is_adequate': is_adequate,
        'interpretation': interpretation,
        'recommendation': 'Sample size adequate' if is_adequate else 'Consider increasing sample size'
    }


def required_sample_size(effect_size: float, power: float = 0.80, alpha: float = 0.05) -> Dict:
    """
    Calculate required sample size per group to achieve desired power.
    
    Args:
        effect_size: Expected Cohen's d or Hedges' g
        power: Desired power (default 0.80)
        alpha: Significance level (default 0.05)
        
    Returns:
        Dictionary with required n per group and total n
    """
    if effect_size is None or effect_size == 0:
        return {
            'n_per_group': None,
            'total_n': None,
            'interpretation': 'Cannot calculate: effect size is zero or unknown'
        }
    
    # Using normal approximation for sample size calculation
    z_alpha = stats.norm.ppf(1 - alpha / 2)
    z_beta = stats.norm.ppf(power)
    
    # n per group = 2 * ((z_alpha + z_beta) / d)^2
    n_per_group = 2 * ((z_alpha + z_beta) / abs(effect_size)) ** 2
    n_per_group = int(np.ceil(n_per_group))
    
    return {
        'n_per_group': n_per_group,
        'total_n': n_per_group * 2,
        'effect_size_used': abs(effect_size),
        'target_power': power,
        'alpha': alpha,
        'interpretation': f'Need n={n_per_group} per group (total N={n_per_group * 2}) for {power*100:.0f}% power'
    }


def bootstrap_confidence_interval(
    group1: np.ndarray, 
    group2: np.ndarray, 
    n_bootstrap: int = 10000,
    confidence_level: float = 0.95,
    statistic: str = 'mean_difference'
) -> Dict:
    """
    Calculate bootstrap confidence interval for mean difference.
    
    Bootstrap methods are distribution-free and robust to non-normality.
    Uses the percentile method for CI calculation.
    
    Args:
        group1, group2: Arrays of numeric values
        n_bootstrap: Number of bootstrap resamples (default 10000)
        confidence_level: Confidence level (default 0.95)
        statistic: Which statistic to bootstrap ('mean_difference' or 'cohens_d')
        
    Returns:
        Dictionary with bootstrap CI and distribution info
    """
    g1 = np.array(group1).flatten()
    g2 = np.array(group2).flatten()
    g1 = g1[~np.isnan(g1)]
    g2 = g2[~np.isnan(g2)]
    
    n1, n2 = len(g1), len(g2)
    
    if n1 < 2 or n2 < 2:
        return {
            'ci_lower': None,
            'ci_upper': None,
            'point_estimate': None,
            'bootstrap_se': None,
            'interpretation': 'Insufficient data'
        }
    
    # Original statistic
    if statistic == 'mean_difference':
        original_stat = np.mean(g2) - np.mean(g1)
    else:  # cohens_d
        pooled_std = np.sqrt(((n1 - 1) * np.var(g1, ddof=1) + (n2 - 1) * np.var(g2, ddof=1)) / (n1 + n2 - 2))
        original_stat = (np.mean(g2) - np.mean(g1)) / pooled_std if pooled_std > 0 else 0
    
    # Bootstrap resampling
    bootstrap_stats = []
    np.random.seed(42)  # For reproducibility
    
    for _ in range(n_bootstrap):
        # Resample with replacement
        boot_g1 = np.random.choice(g1, size=n1, replace=True)
        boot_g2 = np.random.choice(g2, size=n2, replace=True)
        
        if statistic == 'mean_difference':
            boot_stat = np.mean(boot_g2) - np.mean(boot_g1)
        else:
            boot_pooled_std = np.sqrt(
                ((n1 - 1) * np.var(boot_g1, ddof=1) + (n2 - 1) * np.var(boot_g2, ddof=1)) / (n1 + n2 - 2)
            )
            boot_stat = (np.mean(boot_g2) - np.mean(boot_g1)) / boot_pooled_std if boot_pooled_std > 0 else 0
        
        bootstrap_stats.append(boot_stat)
    
    bootstrap_stats = np.array(bootstrap_stats)
    
    # Percentile method for CI
    alpha = 1 - confidence_level
    ci_lower = np.percentile(bootstrap_stats, alpha / 2 * 100)
    ci_upper = np.percentile(bootstrap_stats, (1 - alpha / 2) * 100)
    
    # Bootstrap standard error
    bootstrap_se = np.std(bootstrap_stats, ddof=1)
    
    return {
        'ci_lower': float(ci_lower),
        'ci_upper': float(ci_upper),
        'point_estimate': float(original_stat),
        'bootstrap_se': float(bootstrap_se),
        'n_bootstrap': n_bootstrap,
        'confidence_level': confidence_level,
        'method': 'percentile',
        'interpretation': f'{confidence_level*100:.0f}% CI: [{ci_lower:.4f}, {ci_upper:.4f}]'
    }


def get_distribution_statistics(data: np.ndarray) -> Dict:
    """
    Calculate comprehensive distribution statistics for visualization.
    
    Args:
        data: Array of numeric values
        
    Returns:
        Dictionary with statistics for box plots, histograms, Q-Q plots
    """
    data = np.array(data).flatten()
    data = data[~np.isnan(data)]
    
    if len(data) < 1:
        return {
            'n': 0,
            'mean': None,
            'median': None,
            'std': None,
            'min': None,
            'max': None,
            'Q1': None,
            'Q3': None,
            'IQR': None,
            'skewness': None,
            'kurtosis': None
        }
    
    return {
        'n': len(data),
        'mean': float(np.mean(data)),
        'median': float(np.median(data)),
        'std': float(np.std(data, ddof=1)) if len(data) > 1 else 0.0,
        'min': float(np.min(data)),
        'max': float(np.max(data)),
        'Q1': float(np.percentile(data, 25)),
        'Q3': float(np.percentile(data, 75)),
        'IQR': float(np.percentile(data, 75) - np.percentile(data, 25)),
        'skewness': float(stats.skew(data)) if len(data) > 2 else None,
        'kurtosis': float(stats.kurtosis(data)) if len(data) > 3 else None,
        'values': data.tolist()  # For visualization
    }


# =============================================================================
# MAIN ANALYZER CLASS
# =============================================================================

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
    
    # Unified convergence threshold for BOTH groups (scientific best practice)
    # Using the same threshold enables fair comparison of convergence generations
    # The threshold is based on entropy variance stabilization
    CONVERGENCE_THRESHOLD = 0.01
    
    # Stability window: require N consecutive generations below threshold
    # This prevents false positives from noise
    STABILITY_WINDOW = 20
    
    def calculate_convergence_generation(self, df: pd.DataFrame, threshold: float = 0.01, stability_window: int = 20) -> Optional[int]:
        """
        Calculate generation at which entropy variance drops below threshold AND stays there.
        
        IMPORTANT: We need to find convergence AFTER the population has diverged first.
        At generation 0, all agents are identical (same seed), so variance is artificially low.
        True convergence = population evolved, diverged, then stabilized to Nash Equilibrium.
        
        For scientific rigor, we require stability_window consecutive generations below
        threshold before declaring convergence. This prevents false positives from noise.
        
        Args:
            df: DataFrame with generation data
            threshold: Entropy variance threshold (default 0.01, same for all groups)
            stability_window: Number of consecutive generations below threshold required (default 20)
            
        Returns:
            Generation number where stable convergence began, or None if never converged
        """
        if 'entropy_variance' not in df.columns:
            return None
        
        # First, find where entropy variance exceeds threshold (population diverged)
        diverged = df[df['entropy_variance'] >= threshold]
        if len(diverged) == 0:
            # Population never diverged, so no meaningful convergence
            return None
        
        # Get the generation where divergence first occurred
        first_divergence_gen = int(diverged.iloc[0]['generation'])
        
        # Filter to generations after divergence
        after_divergence = df[df['generation'] > first_divergence_gen].copy()
        if len(after_divergence) < stability_window:
            return None
        
        # Find first generation that starts a stable run of stability_window generations below threshold
        below_threshold = (after_divergence['entropy_variance'] < threshold).values
        
        for i in range(len(below_threshold) - stability_window + 1):
            # Check if we have stability_window consecutive True values
            if all(below_threshold[i:i + stability_window]):
                return int(after_divergence.iloc[i]['generation'])
        
        return None
    
    def calculate_convergence_generation_multi_metric(
        self, 
        df: pd.DataFrame, 
        entropy_threshold: float = 0.01,
        elo_std_threshold: float = 50.0,
        stability_window: int = 20
    ) -> Optional[int]:
        """
        Calculate convergence using multiple metrics for more robust Nash equilibrium detection.
        
        This method uses a combination of:
        1. Entropy variance (primary) - policy homogeneity
        2. Elo standard deviation (secondary) - fitness stability
        
        Both metrics must be stable for the stability_window to confirm true Nash equilibrium.
        
        Args:
            df: DataFrame with generation data
            entropy_threshold: Entropy variance threshold (default 0.01)
            elo_std_threshold: Elo standard deviation threshold (default 50.0, ~5% of typical range)
            stability_window: Consecutive generations required below thresholds (default 20)
            
        Returns:
            Generation number where multi-metric convergence occurred, or None if not converged
        """
        required_cols = ['entropy_variance', 'std_elo', 'generation']
        if not all(col in df.columns for col in required_cols):
            # Fall back to single-metric if std_elo not available
            return self.calculate_convergence_generation(df, entropy_threshold, stability_window)
        
        # First, find where entropy variance exceeds threshold (population diverged)
        diverged = df[df['entropy_variance'] >= entropy_threshold]
        if len(diverged) == 0:
            return None
        
        first_divergence_gen = int(diverged.iloc[0]['generation'])
        
        # Filter to generations after divergence
        after_divergence = df[df['generation'] > first_divergence_gen].copy()
        if len(after_divergence) < stability_window:
            return None
        
        # Check both metrics: entropy variance AND Elo stability
        entropy_stable = (after_divergence['entropy_variance'] < entropy_threshold).values
        elo_stable = (after_divergence['std_elo'] < elo_std_threshold).values
        
        # Both must be stable
        both_stable = entropy_stable & elo_stable
        
        for i in range(len(both_stable) - stability_window + 1):
            if all(both_stable[i:i + stability_window]):
                return int(after_divergence.iloc[i]['generation'])
        
        return None
    
    def perform_t_test(self) -> Dict:
        """
        Perform Welch's two-sample t-test on final Elo ratings.
        
        IMPORTANT: For multi-experiment analysis, each experiment should provide
        ONE data point (final Elo) to avoid pseudoreplication. This implementation
        uses the last 10 generations averaged per experiment for stability.
        
        For single control vs single experimental (as in typical CSV analysis),
        we use the average of last 10 generations as the summary statistic.
        
        Returns:
            Dictionary with t-statistic, p-value, effect size, and interpretation
        """
        # Get average of last 10 generations for each group (more stable than single point)
        last_n = min(10, len(self.control_df), len(self.experimental_df))
        control_elos = self.control_df['avg_elo'].tail(last_n).values
        experimental_elos = self.experimental_df['avg_elo'].tail(last_n).values
        
        # Welch's t-test (unequal variances)
        t_stat, p_value = stats.ttest_ind(control_elos, experimental_elos, equal_var=False)
        
        is_significant = p_value < 0.05
        
        # Calculate effect size (Cohen's d)
        control_mean = float(np.mean(control_elos))
        experimental_mean = float(np.mean(experimental_elos))
        control_std = float(np.std(control_elos, ddof=1))
        experimental_std = float(np.std(experimental_elos, ddof=1))
        
        # Pooled standard deviation for Cohen's d
        n1, n2 = len(control_elos), len(experimental_elos)
        pooled_std = np.sqrt(((n1 - 1) * control_std**2 + (n2 - 1) * experimental_std**2) / (n1 + n2 - 2))
        cohens_d = abs(experimental_mean - control_mean) / pooled_std if pooled_std > 0 else None
        
        # Effect size interpretation
        effect_size_label = 'N/A'
        if cohens_d is not None:
            if cohens_d < 0.2:
                effect_size_label = 'Negligible'
            elif cohens_d < 0.5:
                effect_size_label = 'Small'
            elif cohens_d < 0.8:
                effect_size_label = 'Medium'
            else:
                effect_size_label = 'Large'
        
        return {
            't_statistic': float(t_stat),
            'p_value': float(p_value),
            'is_significant': is_significant,
            'control_mean': control_mean,
            'experimental_mean': experimental_mean,
            'control_std': control_std,
            'experimental_std': experimental_std,
            'mean_difference': float(experimental_mean - control_mean),
            'cohens_d': float(cohens_d) if cohens_d is not None else None,
            'effect_size_label': effect_size_label,
            'sample_sizes': {'control': n1, 'experimental': n2},
            'interpretation': 'Statistically significant' if is_significant else 'Not statistically significant',
            'note': 'WARNING: This is a single experiment comparison. For publication-quality results, run 5+ experiments per group and compare experiment-level means.'
        }
    
    def analyze_convergence(self) -> Dict:
        """
        Analyze convergence speed for both groups.
        
        Uses the SAME threshold for both groups (scientific best practice for fair comparison).
        Convergence requires stability_window consecutive generations below threshold.
        
        Returns:
            Dictionary with convergence analysis
        """
        # Use unified threshold and stability window for both groups
        control_convergence = self.calculate_convergence_generation(
            self.control_df, 
            threshold=self.CONVERGENCE_THRESHOLD,
            stability_window=self.STABILITY_WINDOW
        )
        experimental_convergence = self.calculate_convergence_generation(
            self.experimental_df,
            threshold=self.CONVERGENCE_THRESHOLD,
            stability_window=self.STABILITY_WINDOW
        )
        
        acceleration = None
        if control_convergence and experimental_convergence:
            acceleration = ((control_convergence - experimental_convergence) / control_convergence) * 100
        
        return {
            'control_convergence_gen': control_convergence,
            'experimental_convergence_gen': experimental_convergence,
            'acceleration_percent': acceleration,
            'control_peak_elo': float(self.control_df['peak_elo'].max()),
            'experimental_peak_elo': float(self.experimental_df['peak_elo'].max()),
            'threshold_used': self.CONVERGENCE_THRESHOLD,
            'stability_window': self.STABILITY_WINDOW
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
    
    def perform_assumption_checks(self) -> Dict:
        """
        Perform assumption checks for parametric tests.
        
        Checks:
        1. Normality (Shapiro-Wilk test for both groups)
        2. Variance equality (Levene's test)
        3. Outliers (IQR method)
        
        Returns:
            Dictionary with all assumption check results and recommendations
        """
        # Get final Elos for each group (using last 10 generations averaged)
        last_n = min(10, len(self.control_df), len(self.experimental_df))
        control_elos = self.control_df['avg_elo'].tail(last_n).values
        experimental_elos = self.experimental_df['avg_elo'].tail(last_n).values
        
        # Normality tests
        control_normality = shapiro_wilk_test(control_elos)
        experimental_normality = shapiro_wilk_test(experimental_elos)
        
        # Variance equality
        variance_equality = levene_test(control_elos, experimental_elos)
        
        # Outlier detection
        control_outliers = detect_outliers_iqr(control_elos)
        experimental_outliers = detect_outliers_iqr(experimental_elos)
        
        # Recommendation logic
        both_normal = (control_normality.get('is_normal', False) and 
                       experimental_normality.get('is_normal', False))
        has_outliers = (control_outliers.get('outlier_count', 0) > 0 or 
                        experimental_outliers.get('outlier_count', 0) > 0)
        
        if both_normal and not has_outliers:
            recommendation = 'parametric'
            recommendation_text = 'Use parametric tests (Welch\'s t-test). Assumptions are met.'
        elif both_normal and has_outliers:
            recommendation = 'parametric_with_caution'
            recommendation_text = 'Use parametric tests with caution. Data is normal but contains outliers.'
        else:
            recommendation = 'non_parametric'
            recommendation_text = 'Consider non-parametric tests (Mann-Whitney U). Normality assumption may be violated.'
        
        return {
            'normality': {
                'control': control_normality,
                'experimental': experimental_normality,
                'both_normal': both_normal
            },
            'variance_equality': variance_equality,
            'outliers': {
                'control': control_outliers,
                'experimental': experimental_outliers,
                'any_outliers': has_outliers
            },
            'recommendation': recommendation,
            'recommendation_text': recommendation_text
        }
    
    def perform_non_parametric_test(self) -> Dict:
        """
        Perform Mann-Whitney U test as non-parametric alternative to t-test.
        
        Returns:
            Dictionary with Mann-Whitney U test results
        """
        last_n = min(10, len(self.control_df), len(self.experimental_df))
        control_elos = self.control_df['avg_elo'].tail(last_n).values
        experimental_elos = self.experimental_df['avg_elo'].tail(last_n).values
        
        return mann_whitney_u_test(control_elos, experimental_elos)
    
    def calculate_effect_sizes(self) -> Dict:
        """
        Calculate multiple effect size measures.
        
        Returns:
            Dictionary with Cohen's d, Hedges' g, and CLES
        """
        last_n = min(10, len(self.control_df), len(self.experimental_df))
        control_elos = self.control_df['avg_elo'].tail(last_n).values
        experimental_elos = self.experimental_df['avg_elo'].tail(last_n).values
        
        hedges_result = hedges_g(control_elos, experimental_elos)
        cles_result = common_language_effect_size(control_elos, experimental_elos)
        
        return {
            'hedges_g': hedges_result,
            'cles': cles_result,
            'cohens_d': hedges_result.get('cohens_d')  # Also available from hedges_g calculation
        }
    
    def calculate_power_analysis(self) -> Dict:
        """
        Calculate statistical power and required sample sizes.
        
        Returns:
            Dictionary with power analysis results
        """
        last_n = min(10, len(self.control_df), len(self.experimental_df))
        control_elos = self.control_df['avg_elo'].tail(last_n).values
        experimental_elos = self.experimental_df['avg_elo'].tail(last_n).values
        
        # Get effect size
        effect_sizes = self.calculate_effect_sizes()
        d = effect_sizes.get('cohens_d')
        
        # Calculate achieved power
        n1, n2 = len(control_elos), len(experimental_elos)
        achieved_power = calculate_statistical_power(n1, n2, d)
        
        # Calculate required sample sizes for various power levels
        required_80 = required_sample_size(d, power=0.80)
        required_90 = required_sample_size(d, power=0.90)
        required_95 = required_sample_size(d, power=0.95)
        
        return {
            'achieved_power': achieved_power,
            'required_sample_sizes': {
                'power_80': required_80,
                'power_90': required_90,
                'power_95': required_95
            },
            'current_sample_sizes': {'control': n1, 'experimental': n2},
            'effect_size_used': d
        }
    
    def calculate_bootstrap_ci(self, n_bootstrap: int = 10000) -> Dict:
        """
        Calculate bootstrap confidence intervals.
        
        Args:
            n_bootstrap: Number of bootstrap resamples
            
        Returns:
            Dictionary with bootstrap CI for mean difference
        """
        last_n = min(10, len(self.control_df), len(self.experimental_df))
        control_elos = self.control_df['avg_elo'].tail(last_n).values
        experimental_elos = self.experimental_df['avg_elo'].tail(last_n).values
        
        return bootstrap_confidence_interval(
            control_elos, 
            experimental_elos, 
            n_bootstrap=n_bootstrap
        )
    
    def get_distribution_data(self) -> Dict:
        """
        Get distribution statistics for visualization (box plots, histograms).
        
        Returns:
            Dictionary with distribution statistics for both groups
        """
        last_n = min(10, len(self.control_df), len(self.experimental_df))
        control_elos = self.control_df['avg_elo'].tail(last_n).values
        experimental_elos = self.experimental_df['avg_elo'].tail(last_n).values
        
        return {
            'control': get_distribution_statistics(control_elos),
            'experimental': get_distribution_statistics(experimental_elos)
        }
    
    def generate_all_analysis(self, output_dir: str) -> Dict:
        """
        Generate all analysis graphs and statistics with full scientific rigor.
        
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
        
        # Perform all analyses
        t_test_results = self.perform_t_test()
        convergence_results = self.analyze_convergence()
        
        # New scientific rigor analyses
        assumption_checks = self.perform_assumption_checks()
        non_parametric = self.perform_non_parametric_test()
        effect_sizes = self.calculate_effect_sizes()
        power_analysis = self.calculate_power_analysis()
        bootstrap_ci = self.calculate_bootstrap_ci()
        distribution_data = self.get_distribution_data()
        
        # Combine results
        results = {
            't_test': t_test_results,
            'convergence': convergence_results,
            # Scientific rigor additions
            'assumption_checks': assumption_checks,
            'non_parametric_test': non_parametric,
            'effect_sizes': effect_sizes,
            'power_analysis': power_analysis,
            'bootstrap_ci': bootstrap_ci,
            'distribution_data': distribution_data,
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
