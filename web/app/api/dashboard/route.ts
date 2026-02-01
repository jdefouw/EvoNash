import { NextResponse } from 'next/server'
import { queryAll } from '@/lib/postgres'
import { Experiment, Generation } from '@/types/protocol'

// Force dynamic rendering since we query the database
export const dynamic = 'force-dynamic'

// =====================================================================
// STATISTICAL ANALYSIS - Designed for Scientific Rigor
// =====================================================================
// 
// IMPORTANT: We use EXPERIMENT-LEVEL statistics, not generation-level.
// Each experiment contributes ONE data point to avoid pseudoreplication.
// Analysis is restricted to experiments that reached Nash equilibrium.
// 
// Methodology:
// - Independent variable: Mutation strategy (Control vs Experimental)
// - Dependent variable: Generations to Nash equilibrium (per experiment)
// - Test: Welch's two-sample t-test (unequal variances)
// - Non-parametric alternative: Mann-Whitney U test
// - Significance level: α = 0.05
// 
// Scientific Rigor Features:
// - Assumption checking (normality tests, outlier detection)
// - Non-parametric alternatives (Mann-Whitney U)
// - Enhanced effect sizes (Hedges' g, CLES)
// - Power analysis
// - Bootstrap confidence intervals
// =====================================================================

interface TTestResult {
  pValue: number
  tStatistic: number
  degreesOfFreedom: number
  controlMean: number
  experimentalMean: number
  controlStd: number
  experimentalStd: number
  meanDifference: number
  cohensD: number | null  // Effect size
  confidenceInterval: { lower: number; upper: number } | null  // 95% CI for mean difference
  sampleSizes: { control: number; experimental: number }
}

// =============================================================================
// STATISTICAL UTILITY FUNCTIONS - Scientific Rigor
// =============================================================================

interface NormalityTestResult {
  statistic: number | null  // JB statistic for Jarque-Bera test
  pValue: number | null
  isNormal: boolean | null
  interpretation: string
  sampleSize: number
  testName: string  // Name of the test used
}

interface MannWhitneyResult {
  U: number | null
  pValue: number | null
  isSignificant: boolean | null
  rankBiserialR: number | null
  interpretation: string
  sampleSizes: { control: number; experimental: number }
}

interface HedgesGResult {
  hedgesG: number | null
  cohensD: number | null
  correctionFactor: number | null
  ciLower: number | null
  ciUpper: number | null
  interpretation: string
  sampleSizes: { control: number; experimental: number }
}

interface CLESResult {
  cles: number | null
  clesPercentage: number | null
  interpretation: string
}

interface PowerAnalysisResult {
  power: number | null
  powerPercentage: number | null
  isAdequate: boolean | null
  interpretation: string
  recommendation: string
}

interface RequiredSampleSizeResult {
  nPerGroup: number | null
  totalN: number | null
  effectSizeUsed: number | null
  targetPower: number
  interpretation: string
}

interface OutlierResult {
  outlierCount: number
  outlierIndices: number[]
  outlierValues: number[]
  lowerBound: number | null
  upperBound: number | null
  Q1: number | null
  Q3: number | null
  IQR: number | null
  outlierPercentage: number
}

interface LeveneTestResult {
  statistic: number | null
  pValue: number | null
  equalVariances: boolean | null
  interpretation: string
  sampleSizes: { control: number; experimental: number }
}

interface DistributionStats {
  n: number
  mean: number | null
  median: number | null
  std: number | null
  min: number | null
  max: number | null
  Q1: number | null
  Q3: number | null
  IQR: number | null
  skewness: number | null
  kurtosis: number | null
  values: number[]
}

interface BootstrapCIResult {
  ciLower: number | null
  ciUpper: number | null
  pointEstimate: number | null
  bootstrapSE: number | null
  nBootstrap: number
  confidenceLevel: number
  interpretation: string
}

// =============================================================================
// JARQUE-BERA NORMALITY TEST
// =============================================================================
// 
// The Jarque-Bera test is a goodness-of-fit test that determines whether sample
// data have the skewness and kurtosis matching a normal distribution.
// 
// Test Statistic: JB = n/6 * (S² + K²/4)
//   where S = sample skewness, K = sample excess kurtosis
// 
// Distribution: Under H0 (normality), JB ~ χ²(2) asymptotically
// 
// P-value: P(χ²(2) > JB) = exp(-JB/2)  [exact for chi-squared with df=2]
// 
// Interpretation:
//   - p ≥ 0.05: Fail to reject normality (data consistent with normal)
//   - p < 0.05: Reject normality (data deviates from normal)
// 
// Note: This test is asymptotically valid. For small samples (n < 30),
// results should be interpreted with caution.
// =============================================================================
function jarqueBeraTest(data: number[]): NormalityTestResult {
  const cleanData = data.filter(x => !isNaN(x) && isFinite(x))
  const n = cleanData.length
  
  if (n < 3) {
    return {
      statistic: null,
      pValue: null,
      isNormal: null,
      interpretation: 'Insufficient data (n < 3)',
      sampleSize: n,
      testName: 'Jarque-Bera'
    }
  }
  
  // Calculate skewness and kurtosis for normality assessment
  const mean = cleanData.reduce((a, b) => a + b, 0) / n
  const m2 = cleanData.reduce((sum, x) => sum + Math.pow(x - mean, 2), 0) / n
  const m3 = cleanData.reduce((sum, x) => sum + Math.pow(x - mean, 3), 0) / n
  const m4 = cleanData.reduce((sum, x) => sum + Math.pow(x - mean, 4), 0) / n
  
  const std = Math.sqrt(m2)
  if (std === 0) {
    return {
      statistic: 0,
      pValue: 1,
      isNormal: true,
      interpretation: 'No variance in data',
      sampleSize: n,
      testName: 'Jarque-Bera'
    }
  }
  
  const skewness = m3 / Math.pow(std, 3)
  const kurtosis = m4 / Math.pow(std, 4) - 3  // Excess kurtosis
  
  // Jarque-Bera test statistic
  // JB = n/6 * (S² + K²/4)
  const jb = (n / 6) * (Math.pow(skewness, 2) + Math.pow(kurtosis, 2) / 4)
  
  // P-value from chi-squared distribution with 2 df
  // For χ²(2): P(X > x) = exp(-x/2) [exact]
  const pValue = Math.exp(-jb / 2)
  const isNormal = pValue >= 0.05
  
  let interpretation: string
  if (n < 30) {
    // Add caution for small samples
    if (pValue >= 0.10) {
      interpretation = 'Consistent with normality (small sample - interpret with caution)'
    } else if (pValue >= 0.05) {
      interpretation = 'Marginally consistent with normality (small sample)'
    } else if (pValue >= 0.01) {
      interpretation = 'Evidence against normality'
    } else {
      interpretation = 'Strong evidence against normality'
    }
  } else {
    if (pValue >= 0.10) {
      interpretation = 'Strong evidence for normality'
    } else if (pValue >= 0.05) {
      interpretation = 'Marginal evidence for normality'
    } else if (pValue >= 0.01) {
      interpretation = 'Evidence against normality'
    } else {
      interpretation = 'Strong evidence against normality'
    }
  }
  
  return {
    statistic: jb,
    pValue,
    isNormal,
    interpretation,
    sampleSize: n,
    testName: 'Jarque-Bera'
  }
}

// =============================================================================
// LEVENE'S TEST FOR EQUALITY OF VARIANCES
// =============================================================================
// 
// Levene's test assesses whether the variances of two groups are equal.
// This implementation uses the Brown-Forsythe variant (median-based) which
// is more robust to non-normality than the mean-based version.
// 
// Test Statistic: W = (N - k) / (k - 1) * Σnᵢ(Z̄ᵢ - Z̄)² / ΣΣ(Zᵢⱼ - Z̄ᵢ)²
// 
// where Zᵢⱼ = |Xᵢⱼ - median(Xᵢ)| (Brown-Forsythe)
//       k = number of groups (2 for two-sample test)
//       N = total sample size
// 
// Distribution: Under H0, W ~ F(k-1, N-k)
// 
// Interpretation:
//   - p ≥ 0.05: Fail to reject equal variances
//   - p < 0.05: Reject equal variances (use Welch's t-test)
// 
// Note: Welch's t-test is robust to unequal variances, so even if Levene's
// test is significant, the t-test results remain valid.
// =============================================================================
function leveneTest(group1: number[], group2: number[]): LeveneTestResult {
  const g1 = group1.filter(x => !isNaN(x) && isFinite(x))
  const g2 = group2.filter(x => !isNaN(x) && isFinite(x))
  const n1 = g1.length
  const n2 = g2.length
  const N = n1 + n2
  const k = 2  // Number of groups
  
  if (n1 < 2 || n2 < 2) {
    return {
      statistic: null,
      pValue: null,
      equalVariances: null,
      interpretation: 'Insufficient data (n < 2 per group)',
      sampleSizes: { control: n1, experimental: n2 }
    }
  }
  
  // Calculate median for each group (Brown-Forsythe variant)
  const sorted1 = [...g1].sort((a, b) => a - b)
  const sorted2 = [...g2].sort((a, b) => a - b)
  const median1 = percentile(sorted1, 50)
  const median2 = percentile(sorted2, 50)
  
  // Calculate absolute deviations from median
  const z1 = g1.map(x => Math.abs(x - median1))
  const z2 = g2.map(x => Math.abs(x - median2))
  
  // Group means of absolute deviations
  const zBar1 = z1.reduce((a, b) => a + b, 0) / n1
  const zBar2 = z2.reduce((a, b) => a + b, 0) / n2
  
  // Overall mean of absolute deviations
  const zBar = (z1.reduce((a, b) => a + b, 0) + z2.reduce((a, b) => a + b, 0)) / N
  
  // Between-group sum of squares
  const ssb = n1 * Math.pow(zBar1 - zBar, 2) + n2 * Math.pow(zBar2 - zBar, 2)
  
  // Within-group sum of squares
  const ssw1 = z1.reduce((sum, z) => sum + Math.pow(z - zBar1, 2), 0)
  const ssw2 = z2.reduce((sum, z) => sum + Math.pow(z - zBar2, 2), 0)
  const ssw = ssw1 + ssw2
  
  if (ssw === 0) {
    return {
      statistic: 0,
      pValue: 1,
      equalVariances: true,
      interpretation: 'No variance in deviations',
      sampleSizes: { control: n1, experimental: n2 }
    }
  }
  
  // Levene's test statistic (F-statistic)
  const dfBetween = k - 1
  const dfWithin = N - k
  const W = ((N - k) / (k - 1)) * (ssb / ssw)
  
  // P-value from F-distribution
  const pValue = 1 - fDistributionCDF(W, dfBetween, dfWithin)
  const equalVariances = pValue >= 0.05
  
  let interpretation: string
  if (equalVariances) {
    interpretation = 'Equal variances (homoscedasticity) - standard t-test assumptions met'
  } else {
    interpretation = 'Unequal variances (heteroscedasticity) - Welch\'s t-test is appropriate'
  }
  
  return {
    statistic: W,
    pValue,
    equalVariances,
    interpretation,
    sampleSizes: { control: n1, experimental: n2 }
  }
}

// =============================================================================
// F-DISTRIBUTION CDF
// =============================================================================
// 
// The CDF of the F-distribution with df1 and df2 degrees of freedom is:
// 
// F(x; df1, df2) = I_y(df1/2, df2/2)
// 
// where y = (df1 * x) / (df1 * x + df2) and I is the regularized incomplete beta function.
// =============================================================================
function fDistributionCDF(x: number, df1: number, df2: number): number {
  if (x <= 0) return 0
  if (df1 <= 0 || df2 <= 0) return NaN
  
  const y = (df1 * x) / (df1 * x + df2)
  return incompleteBeta(y, df1 / 2, df2 / 2)
}

// Mann-Whitney U test (Wilcoxon rank-sum test)
function mannWhitneyUTest(group1: number[], group2: number[]): MannWhitneyResult {
  const g1 = group1.filter(x => !isNaN(x) && isFinite(x))
  const g2 = group2.filter(x => !isNaN(x) && isFinite(x))
  const n1 = g1.length
  const n2 = g2.length
  
  if (n1 < 2 || n2 < 2) {
    return {
      U: null,
      pValue: null,
      isSignificant: null,
      rankBiserialR: null,
      interpretation: 'Insufficient data (n < 2 per group)',
      sampleSizes: { control: n1, experimental: n2 }
    }
  }
  
  // Combine and rank all values
  const combined = [
    ...g1.map(v => ({ value: v, group: 1 })),
    ...g2.map(v => ({ value: v, group: 2 }))
  ].sort((a, b) => a.value - b.value)
  
  // Assign ranks (handling ties with average rank)
  const ranks: number[] = []
  let i = 0
  while (i < combined.length) {
    let j = i
    while (j < combined.length && combined[j].value === combined[i].value) {
      j++
    }
    const avgRank = (i + j + 1) / 2  // Average rank for ties
    for (let k = i; k < j; k++) {
      ranks.push(avgRank)
    }
    i = j
  }
  
  // Sum of ranks for group 1
  let R1 = 0
  combined.forEach((item, idx) => {
    if (item.group === 1) R1 += ranks[idx]
  })
  
  // U statistic
  const U1 = R1 - (n1 * (n1 + 1)) / 2
  const U2 = n1 * n2 - U1
  const U = Math.min(U1, U2)
  
  // Normal approximation for p-value (valid for n1, n2 > 10)
  const meanU = (n1 * n2) / 2
  const stdU = Math.sqrt((n1 * n2 * (n1 + n2 + 1)) / 12)
  const z = (U - meanU) / stdU
  const pValue = 2 * normalCDF(-Math.abs(z))
  
  const isSignificant = pValue < 0.05
  
  // Rank-biserial correlation (effect size)
  const rankBiserialR = 1 - (2 * U) / (n1 * n2)
  
  return {
    U,
    pValue,
    isSignificant,
    rankBiserialR,
    interpretation: isSignificant ? 'Distributions differ significantly' : 'No significant difference',
    sampleSizes: { control: n1, experimental: n2 }
  }
}

// Hedges' g effect size (small-sample corrected)
function hedgesG(group1: number[], group2: number[]): HedgesGResult {
  const g1 = group1.filter(x => !isNaN(x) && isFinite(x))
  const g2 = group2.filter(x => !isNaN(x) && isFinite(x))
  const n1 = g1.length
  const n2 = g2.length
  
  if (n1 < 2 || n2 < 2) {
    return {
      hedgesG: null,
      cohensD: null,
      correctionFactor: null,
      ciLower: null,
      ciUpper: null,
      interpretation: 'Insufficient data',
      sampleSizes: { control: n1, experimental: n2 }
    }
  }
  
  const mean1 = g1.reduce((a, b) => a + b, 0) / n1
  const mean2 = g2.reduce((a, b) => a + b, 0) / n2
  const var1 = g1.reduce((sum, x) => sum + Math.pow(x - mean1, 2), 0) / (n1 - 1)
  const var2 = g2.reduce((sum, x) => sum + Math.pow(x - mean2, 2), 0) / (n2 - 1)
  
  const pooledStd = Math.sqrt(((n1 - 1) * var1 + (n2 - 1) * var2) / (n1 + n2 - 2))
  
  if (pooledStd === 0) {
    return {
      hedgesG: 0,
      cohensD: 0,
      correctionFactor: 1,
      ciLower: 0,
      ciUpper: 0,
      interpretation: 'No variance in data',
      sampleSizes: { control: n1, experimental: n2 }
    }
  }
  
  // Cohen's d
  const d = (mean2 - mean1) / pooledStd
  
  // Hedges' correction factor
  const df = n1 + n2 - 2
  const correctionFactor = 1 - (3 / (4 * df - 1))
  
  // Hedges' g
  const g = d * correctionFactor
  
  // Standard error and 95% CI
  const seG = Math.sqrt((n1 + n2) / (n1 * n2) + (g * g) / (2 * (n1 + n2)))
  const ciLower = g - 1.96 * seG
  const ciUpper = g + 1.96 * seG
  
  // Interpretation
  const absG = Math.abs(g)
  let interpretation: string
  if (absG < 0.2) interpretation = 'Negligible'
  else if (absG < 0.5) interpretation = 'Small'
  else if (absG < 0.8) interpretation = 'Medium'
  else interpretation = 'Large'
  
  return {
    hedgesG: g,
    cohensD: d,
    correctionFactor,
    ciLower,
    ciUpper,
    interpretation,
    sampleSizes: { control: n1, experimental: n2 }
  }
}

// Common Language Effect Size (CLES)
function commonLanguageEffectSize(group1: number[], group2: number[]): CLESResult {
  const g1 = group1.filter(x => !isNaN(x) && isFinite(x))
  const g2 = group2.filter(x => !isNaN(x) && isFinite(x))
  const n1 = g1.length
  const n2 = g2.length
  
  if (n1 < 1 || n2 < 1) {
    return {
      cles: null,
      clesPercentage: null,
      interpretation: 'Insufficient data'
    }
  }
  
  // Count wins for group2
  let count = 0
  let ties = 0
  for (const v2 of g2) {
    for (const v1 of g1) {
      if (v2 > v1) count++
      else if (v2 === v1) ties++
    }
  }
  
  const cles = (count + 0.5 * ties) / (n1 * n2)
  
  let interpretation: string
  if (cles > 0.71) interpretation = 'Large advantage for experimental'
  else if (cles > 0.64) interpretation = 'Medium advantage for experimental'
  else if (cles > 0.56) interpretation = 'Small advantage for experimental'
  else if (cles >= 0.44) interpretation = 'Negligible difference'
  else if (cles >= 0.36) interpretation = 'Small advantage for control'
  else if (cles >= 0.29) interpretation = 'Medium advantage for control'
  else interpretation = 'Large advantage for control'
  
  return {
    cles,
    clesPercentage: cles * 100,
    interpretation
  }
}

// =============================================================================
// NON-CENTRAL T-DISTRIBUTION CDF
// =============================================================================
// 
// The non-central t-distribution with df degrees of freedom and non-centrality
// parameter δ (ncp) is used for power calculations.
// 
// This implementation uses a series expansion that converges well for most
// practical values of δ and df.
// 
// Reference: Algorithm AS 243 - Lenth, R.V. (1989)
// =============================================================================
function nonCentralTCDF(t: number, df: number, ncp: number): number {
  if (df <= 0) return NaN
  if (ncp === 0) return tDistributionCDF(t, df)
  
  // Handle negative t by symmetry
  if (t < 0) {
    return 1 - nonCentralTCDF(-t, df, -ncp)
  }
  
  // Use series expansion
  const x = t * t / (df + t * t)
  const maxIterations = 1000
  const tolerance = 1e-12
  
  // Calculate using the weighted sum of incomplete beta functions
  let sum = 0
  let term: number
  const lambda = ncp * ncp / 2
  
  // Poisson weight: exp(-λ) * λ^j / j!
  let poissonWeight = Math.exp(-lambda)
  
  for (let j = 0; j < maxIterations; j++) {
    // Calculate the incomplete beta term
    // I_x((df + 1)/2 + j, 1/2) for odd terms
    // I_x(df/2 + j, 1/2) for even terms
    
    const beta1 = incompleteBeta(x, (df + 1) / 2 + j, 0.5)
    const beta2 = incompleteBeta(x, df / 2 + j, 0.5)
    
    // Contribution from this term
    const contrib1 = poissonWeight * (1 - beta1) / 2
    const contrib2 = (j > 0 ? lambda / j : 0) * poissonWeight * (1 - beta2) / 2
    
    term = contrib1
    sum += term
    
    if (j > 0 && Math.abs(term) < tolerance * Math.abs(sum)) {
      break
    }
    
    // Update Poisson weight for next iteration
    poissonWeight *= lambda / (j + 1)
  }
  
  // Add the central part
  const centralCDF = normalCDF(-ncp)
  
  // The non-central t CDF
  return centralCDF + sum
}

// =============================================================================
// STATISTICAL POWER CALCULATION
// =============================================================================
// 
// Power = P(reject H0 | H1 is true)
//       = P(|T| > t_crit | T ~ non-central t(df, ncp))
// 
// For a two-sample t-test:
//   df = n1 + n2 - 2
//   ncp = δ * sqrt(n1 * n2 / (n1 + n2))  where δ is the effect size
// 
// Power = 1 - F_nct(t_crit, df, ncp) + F_nct(-t_crit, df, ncp)
// 
// where F_nct is the non-central t CDF.
// =============================================================================
function calculatePower(n1: number, n2: number, effectSize: number | null, alpha: number = 0.05): PowerAnalysisResult {
  if (n1 < 2 || n2 < 2 || effectSize === null) {
    return {
      power: null,
      powerPercentage: null,
      isAdequate: null,
      interpretation: 'Insufficient data for power calculation',
      recommendation: 'Need at least n=2 per group'
    }
  }
  
  const df = n1 + n2 - 2
  
  // Non-centrality parameter
  const ncp = Math.abs(effectSize) * Math.sqrt((n1 * n2) / (n1 + n2))
  
  // Critical t-value for two-tailed test
  const tCrit = tDistributionQuantile(1 - alpha / 2, df)
  
  // Power using non-central t-distribution
  // Power = P(|T| > tCrit) = P(T > tCrit) + P(T < -tCrit)
  //       = 1 - F_nct(tCrit, df, ncp) + F_nct(-tCrit, df, ncp)
  let power: number
  
  // For small ncp or large df, the non-central t calculation can be unstable
  // Use a simpler approximation in those cases
  if (df > 100 || ncp < 0.01) {
    // Normal approximation (accurate for large df)
    const zCrit = normalQuantile(1 - alpha / 2)
    power = 1 - normalCDF(zCrit - ncp) + normalCDF(-zCrit - ncp)
  } else {
    // Use non-central t-distribution
    power = 1 - nonCentralTCDF(tCrit, df, ncp) + nonCentralTCDF(-tCrit, df, ncp)
  }
  
  // Clamp power to [0, 1]
  power = Math.max(0, Math.min(1, power))
  
  const isAdequate = power >= 0.80
  
  let interpretation: string
  if (power >= 0.95) interpretation = 'Excellent power - very likely to detect effect'
  else if (power >= 0.80) interpretation = 'Adequate power - likely to detect effect'
  else if (power >= 0.60) interpretation = 'Moderate power - may miss real effects'
  else if (power >= 0.40) interpretation = 'Low power - likely to miss real effects'
  else interpretation = 'Very low power - study is underpowered'
  
  return {
    power,
    powerPercentage: power * 100,
    isAdequate,
    interpretation,
    recommendation: isAdequate ? 'Sample size adequate' : 'Consider increasing sample size'
  }
}

// Required sample size calculation
function requiredSampleSize(effectSize: number | null, targetPower: number = 0.80, alpha: number = 0.05): RequiredSampleSizeResult {
  if (effectSize === null || effectSize === 0) {
    return {
      nPerGroup: null,
      totalN: null,
      effectSizeUsed: null,
      targetPower,
      interpretation: 'Cannot calculate: effect size is zero or unknown'
    }
  }
  
  // Using normal approximation
  const zAlpha = 1.96  // Two-tailed α = 0.05
  const zBeta = normalQuantile(targetPower)
  
  const nPerGroup = Math.ceil(2 * Math.pow((zAlpha + zBeta) / Math.abs(effectSize), 2))
  
  return {
    nPerGroup,
    totalN: nPerGroup * 2,
    effectSizeUsed: Math.abs(effectSize),
    targetPower,
    interpretation: `Need n=${nPerGroup} per group (total N=${nPerGroup * 2}) for ${targetPower * 100}% power`
  }
}

// Outlier detection using IQR method
function detectOutliers(data: number[], k: number = 1.5): OutlierResult {
  const cleanData = data.filter(x => !isNaN(x) && isFinite(x))
  
  if (cleanData.length < 4) {
    return {
      outlierCount: 0,
      outlierIndices: [],
      outlierValues: [],
      lowerBound: null,
      upperBound: null,
      Q1: null,
      Q3: null,
      IQR: null,
      outlierPercentage: 0
    }
  }
  
  const sorted = [...cleanData].sort((a, b) => a - b)
  const Q1 = percentile(sorted, 25)
  const Q3 = percentile(sorted, 75)
  const IQR = Q3 - Q1
  
  const lowerBound = Q1 - k * IQR
  const upperBound = Q3 + k * IQR
  
  const outlierIndices: number[] = []
  const outlierValues: number[] = []
  
  cleanData.forEach((value, index) => {
    if (value < lowerBound || value > upperBound) {
      outlierIndices.push(index)
      outlierValues.push(value)
    }
  })
  
  return {
    outlierCount: outlierValues.length,
    outlierIndices,
    outlierValues,
    lowerBound,
    upperBound,
    Q1,
    Q3,
    IQR,
    outlierPercentage: (outlierValues.length / cleanData.length) * 100
  }
}

// Distribution statistics for visualization
function getDistributionStats(data: number[]): DistributionStats {
  const cleanData = data.filter(x => !isNaN(x) && isFinite(x))
  const n = cleanData.length
  
  if (n < 1) {
    return {
      n: 0,
      mean: null,
      median: null,
      std: null,
      min: null,
      max: null,
      Q1: null,
      Q3: null,
      IQR: null,
      skewness: null,
      kurtosis: null,
      values: []
    }
  }
  
  const sorted = [...cleanData].sort((a, b) => a - b)
  const mean = cleanData.reduce((a, b) => a + b, 0) / n
  const variance = n > 1 ? cleanData.reduce((sum, x) => sum + Math.pow(x - mean, 2), 0) / (n - 1) : 0
  const std = Math.sqrt(variance)
  
  // Skewness and kurtosis
  let skewness: number | null = null
  let kurtosis: number | null = null
  if (n > 2 && std > 0) {
    const m3 = cleanData.reduce((sum, x) => sum + Math.pow(x - mean, 3), 0) / n
    skewness = m3 / Math.pow(std, 3)
  }
  if (n > 3 && std > 0) {
    const m4 = cleanData.reduce((sum, x) => sum + Math.pow(x - mean, 4), 0) / n
    kurtosis = m4 / Math.pow(std, 4) - 3  // Excess kurtosis
  }
  
  const Q1 = percentile(sorted, 25)
  const Q3 = percentile(sorted, 75)
  
  return {
    n,
    mean,
    median: percentile(sorted, 50),
    std,
    min: sorted[0],
    max: sorted[n - 1],
    Q1,
    Q3,
    IQR: Q3 - Q1,
    skewness,
    kurtosis,
    values: cleanData
  }
}

// Bootstrap confidence interval
function bootstrapCI(
  group1: number[],
  group2: number[],
  nBootstrap: number = 5000,
  confidenceLevel: number = 0.95
): BootstrapCIResult {
  const g1 = group1.filter(x => !isNaN(x) && isFinite(x))
  const g2 = group2.filter(x => !isNaN(x) && isFinite(x))
  const n1 = g1.length
  const n2 = g2.length
  
  if (n1 < 2 || n2 < 2) {
    return {
      ciLower: null,
      ciUpper: null,
      pointEstimate: null,
      bootstrapSE: null,
      nBootstrap,
      confidenceLevel,
      interpretation: 'Insufficient data'
    }
  }
  
  const originalDiff = g2.reduce((a, b) => a + b, 0) / n2 - g1.reduce((a, b) => a + b, 0) / n1
  
  // Bootstrap resampling (using seeded random for reproducibility)
  const bootstrapDiffs: number[] = []
  let seed = 42
  const random = () => {
    seed = (seed * 1103515245 + 12345) % 2147483648
    return seed / 2147483648
  }
  
  for (let i = 0; i < nBootstrap; i++) {
    // Resample with replacement
    const bootG1 = Array.from({ length: n1 }, () => g1[Math.floor(random() * n1)])
    const bootG2 = Array.from({ length: n2 }, () => g2[Math.floor(random() * n2)])
    
    const bootDiff = bootG2.reduce((a, b) => a + b, 0) / n2 - bootG1.reduce((a, b) => a + b, 0) / n1
    bootstrapDiffs.push(bootDiff)
  }
  
  bootstrapDiffs.sort((a, b) => a - b)
  
  const alpha = 1 - confidenceLevel
  const ciLower = percentile(bootstrapDiffs, alpha / 2 * 100)
  const ciUpper = percentile(bootstrapDiffs, (1 - alpha / 2) * 100)
  
  const bootstrapMean = bootstrapDiffs.reduce((a, b) => a + b, 0) / nBootstrap
  const bootstrapSE = Math.sqrt(
    bootstrapDiffs.reduce((sum, x) => sum + Math.pow(x - bootstrapMean, 2), 0) / (nBootstrap - 1)
  )
  
  return {
    ciLower,
    ciUpper,
    pointEstimate: originalDiff,
    bootstrapSE,
    nBootstrap,
    confidenceLevel,
    interpretation: `${confidenceLevel * 100}% CI: [${ciLower.toFixed(4)}, ${ciUpper.toFixed(4)}]`
  }
}

// Helper: percentile calculation
function percentile(sortedArr: number[], p: number): number {
  if (sortedArr.length === 0) return 0
  const index = (p / 100) * (sortedArr.length - 1)
  const lower = Math.floor(index)
  const upper = Math.ceil(index)
  if (lower === upper) return sortedArr[lower]
  return sortedArr[lower] + (sortedArr[upper] - sortedArr[lower]) * (index - lower)
}

// Helper: normal quantile (inverse CDF)
function normalQuantile(p: number): number {
  // Approximation using Abramowitz and Stegun formula
  if (p <= 0) return -Infinity
  if (p >= 1) return Infinity
  if (p === 0.5) return 0
  
  const a = [
    -3.969683028665376e+01,
    2.209460984245205e+02,
    -2.759285104469687e+02,
    1.383577518672690e+02,
    -3.066479806614716e+01,
    2.506628277459239e+00
  ]
  const b = [
    -5.447609879822406e+01,
    1.615858368580409e+02,
    -1.556989798598866e+02,
    6.680131188771972e+01,
    -1.328068155288572e+01
  ]
  const c = [
    -7.784894002430293e-03,
    -3.223964580411365e-01,
    -2.400758277161838e+00,
    -2.549732539343734e+00,
    4.374664141464968e+00,
    2.938163982698783e+00
  ]
  const d = [
    7.784695709041462e-03,
    3.224671290700398e-01,
    2.445134137142996e+00,
    3.754408661907416e+00
  ]
  
  const pLow = 0.02425
  const pHigh = 1 - pLow
  
  let q: number
  if (p < pLow) {
    q = Math.sqrt(-2 * Math.log(p))
    return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
           ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
  } else if (p <= pHigh) {
    q = p - 0.5
    const r = q * q
    return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q /
           (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1)
  } else {
    q = Math.sqrt(-2 * Math.log(1 - p))
    return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
            ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
  }
}

// Welch's t-test for two independent samples with unequal variances
// Uses experiment-level summary statistics (one data point per experiment)
function welchTTest(sample1: number[], sample2: number[]): TTestResult {
  const n1 = sample1.length
  const n2 = sample2.length
  
  // Require minimum sample size for meaningful analysis
  if (n1 < 2 || n2 < 2) {
    return {
      pValue: 1,
      tStatistic: 0,
      degreesOfFreedom: 0,
      controlMean: n1 > 0 ? sample1.reduce((a, b) => a + b, 0) / n1 : 0,
      experimentalMean: n2 > 0 ? sample2.reduce((a, b) => a + b, 0) / n2 : 0,
      controlStd: 0,
      experimentalStd: 0,
      meanDifference: 0,
      cohensD: null,
      confidenceInterval: null,
      sampleSizes: { control: n1, experimental: n2 }
    }
  }

  // Calculate means
  const mean1 = sample1.reduce((a, b) => a + b, 0) / n1
  const mean2 = sample2.reduce((a, b) => a + b, 0) / n2
  const meanDiff = mean2 - mean1  // Experimental - Control

  // Calculate sample variances (unbiased, using n-1)
  const variance1 = sample1.reduce((sum, val) => sum + Math.pow(val - mean1, 2), 0) / (n1 - 1)
  const variance2 = sample2.reduce((sum, val) => sum + Math.pow(val - mean2, 2), 0) / (n2 - 1)
  
  const std1 = Math.sqrt(variance1)
  const std2 = Math.sqrt(variance2)

  // Pooled standard error (Welch's formula)
  const se1 = variance1 / n1
  const se2 = variance2 / n2
  const pooledSE = Math.sqrt(se1 + se2)
  
  if (pooledSE === 0) {
    return {
      pValue: 1,
      tStatistic: 0,
      degreesOfFreedom: n1 + n2 - 2,
      controlMean: mean1,
      experimentalMean: mean2,
      controlStd: std1,
      experimentalStd: std2,
      meanDifference: meanDiff,
      cohensD: null,
      confidenceInterval: null,
      sampleSizes: { control: n1, experimental: n2 }
    }
  }

  // Welch's t-statistic
  const tStatistic = (mean1 - mean2) / pooledSE

  // Welch-Satterthwaite degrees of freedom
  const df = Math.pow(se1 + se2, 2) / (Math.pow(se1, 2) / (n1 - 1) + Math.pow(se2, 2) / (n2 - 1))

  // P-value from t-distribution (two-tailed)
  const pValue = 2 * tDistributionCDF(-Math.abs(tStatistic), df)

  // Cohen's d effect size (pooled standard deviation)
  const pooledStd = Math.sqrt(((n1 - 1) * variance1 + (n2 - 1) * variance2) / (n1 + n2 - 2))
  const cohensD = pooledStd > 0 ? Math.abs(meanDiff) / pooledStd : null

  // 95% Confidence Interval for mean difference
  const tCritical = tDistributionQuantile(0.975, df)  // Two-tailed 95% CI
  const marginOfError = tCritical * pooledSE
  const confidenceInterval = {
    lower: meanDiff - marginOfError,
    upper: meanDiff + marginOfError
  }

  return {
    pValue,
    tStatistic,
    degreesOfFreedom: df,
    controlMean: mean1,
    experimentalMean: mean2,
    controlStd: std1,
    experimentalStd: std2,
    meanDifference: meanDiff,
    cohensD,
    confidenceInterval,
    sampleSizes: { control: n1, experimental: n2 }
  }
}

// =============================================================================
// INCOMPLETE BETA FUNCTION
// =============================================================================
// 
// The regularized incomplete beta function I_x(a, b) is used for computing
// the CDF of the t-distribution, F-distribution, and beta distribution.
// 
// Uses the continued fraction representation for numerical stability.
// =============================================================================
function incompleteBeta(x: number, a: number, b: number): number {
  if (x <= 0) return 0
  if (x >= 1) return 1
  
  // For numerical stability, use the symmetry relation when appropriate
  // I_x(a,b) = 1 - I_{1-x}(b,a)
  if (x > (a + 1) / (a + b + 2)) {
    return 1 - incompleteBeta(1 - x, b, a)
  }
  
  // Calculate using continued fraction (Lentz's algorithm)
  const lnBeta = logBeta(a, b)
  const front = Math.exp(Math.log(x) * a + Math.log(1 - x) * b - lnBeta) / a
  
  // Continued fraction for I_x(a,b)
  const maxIterations = 200
  const epsilon = 1e-14
  
  let f = 1
  let c = 1
  let d = 0
  
  for (let m = 0; m <= maxIterations; m++) {
    let numerator: number
    
    if (m === 0) {
      numerator = 1
    } else if (m % 2 === 0) {
      const k = m / 2
      numerator = (k * (b - k) * x) / ((a + 2 * k - 1) * (a + 2 * k))
    } else {
      const k = (m - 1) / 2
      numerator = -((a + k) * (a + b + k) * x) / ((a + 2 * k) * (a + 2 * k + 1))
    }
    
    d = 1 + numerator * d
    if (Math.abs(d) < 1e-30) d = 1e-30
    d = 1 / d
    
    c = 1 + numerator / c
    if (Math.abs(c) < 1e-30) c = 1e-30
    
    const delta = c * d
    f *= delta
    
    if (Math.abs(delta - 1) < epsilon) {
      break
    }
  }
  
  return front * (f - 1)
}

// Log of beta function using log-gamma
function logBeta(a: number, b: number): number {
  return logGamma(a) + logGamma(b) - logGamma(a + b)
}

// Log-gamma function using Lanczos approximation
function logGamma(z: number): number {
  if (z < 0.5) {
    // Reflection formula: Γ(z)Γ(1-z) = π/sin(πz)
    return Math.log(Math.PI / Math.sin(Math.PI * z)) - logGamma(1 - z)
  }
  
  z -= 1
  
  // Lanczos coefficients for g=7
  const g = 7
  const c = [
    0.99999999999980993,
    676.5203681218851,
    -1259.1392167224028,
    771.32342877765313,
    -176.61502916214059,
    12.507343278686905,
    -0.13857109526572012,
    9.9843695780195716e-6,
    1.5056327351493116e-7
  ]
  
  let x = c[0]
  for (let i = 1; i < g + 2; i++) {
    x += c[i] / (z + i)
  }
  
  const t = z + g + 0.5
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x)
}

// =============================================================================
// T-DISTRIBUTION CDF
// =============================================================================
// 
// The CDF of Student's t-distribution with df degrees of freedom is:
// 
// For t ≥ 0: F(t; df) = 1 - 0.5 * I_x(df/2, 1/2)
// For t < 0: F(t; df) = 0.5 * I_x(df/2, 1/2)
// 
// where x = df / (df + t²) and I_x is the regularized incomplete beta function.
// 
// This implementation is accurate for all degrees of freedom.
// =============================================================================
function tDistributionCDF(t: number, df: number): number {
  if (df <= 0) return 0.5
  if (!isFinite(t)) return t > 0 ? 1 : 0
  
  const x = df / (df + t * t)
  const betaValue = incompleteBeta(x, df / 2, 0.5)
  
  if (t >= 0) {
    return 1 - 0.5 * betaValue
  } else {
    return 0.5 * betaValue
  }
}

// =============================================================================
// T-DISTRIBUTION QUANTILE (INVERSE CDF)
// =============================================================================
// 
// Computes the inverse of the t-distribution CDF using Newton-Raphson iteration.
// 
// Given probability p and degrees of freedom df, finds t such that:
//   P(T ≤ t) = p  where T ~ t(df)
// 
// Uses the normal quantile as an initial guess, then refines with Newton-Raphson.
// =============================================================================
function tDistributionQuantile(p: number, df: number): number {
  if (p <= 0) return -Infinity
  if (p >= 1) return Infinity
  if (p === 0.5) return 0
  if (df <= 0) return NaN
  
  // Handle symmetry: if p < 0.5, compute for 1-p and negate
  if (p < 0.5) {
    return -tDistributionQuantile(1 - p, df)
  }
  
  // Initial guess using normal quantile with correction for df
  // Cornish-Fisher expansion for better starting point
  const z = normalQuantile(p)
  const g1 = (z * z * z + z) / 4
  const g2 = (5 * Math.pow(z, 5) + 16 * Math.pow(z, 3) + 3 * z) / 96
  const g3 = (3 * Math.pow(z, 7) + 19 * Math.pow(z, 5) + 17 * Math.pow(z, 3) - 15 * z) / 384
  
  let t = z + g1 / df + g2 / (df * df) + g3 / (df * df * df)
  
  // Newton-Raphson iteration
  const maxIterations = 50
  const tolerance = 1e-12
  
  for (let i = 0; i < maxIterations; i++) {
    const cdf = tDistributionCDF(t, df)
    const error = cdf - p
    
    if (Math.abs(error) < tolerance) {
      break
    }
    
    // PDF of t-distribution for Newton-Raphson
    const pdf = tDistributionPDF(t, df)
    if (pdf === 0) break
    
    const delta = error / pdf
    t -= delta
    
    if (Math.abs(delta) < tolerance * Math.abs(t)) {
      break
    }
  }
  
  return t
}

// T-distribution PDF for Newton-Raphson iteration
function tDistributionPDF(t: number, df: number): number {
  const lnCoeff = logGamma((df + 1) / 2) - logGamma(df / 2) - 0.5 * Math.log(df * Math.PI)
  const lnPdf = lnCoeff - ((df + 1) / 2) * Math.log(1 + (t * t) / df)
  return Math.exp(lnPdf)
}

// Standard normal cumulative distribution function approximation
function normalCDF(x: number): number {
  const a1 = 0.254829592
  const a2 = -0.284496736
  const a3 = 1.421413741
  const a4 = -1.453152027
  const a5 = 1.061405429
  const p = 0.3275911

  const sign = x < 0 ? -1 : 1
  x = Math.abs(x) / Math.sqrt(2)

  const t = 1.0 / (1.0 + p * x)
  const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x)

  return 0.5 * (1.0 + sign * y)
}

export type StatisticalPowerLevel = 'insufficient' | 'minimum' | 'recommended' | 'robust'

export interface DashboardData {
  controlExperiments: Experiment[]
  experimentalExperiments: Experiment[]
  controlGenerations: Generation[]
  experimentalGenerations: Generation[]
  statistics: {
    controlConvergenceGen: number | null
    experimentalConvergenceGen: number | null
    convergenceImprovement: number | null  // Percentage improvement in convergence speed
    // Descriptive only (not used for hypothesis testing)
    controlFinalElo: number | null
    experimentalFinalElo: number | null
    controlPeakElo: number | null
    experimentalPeakElo: number | null
    // Primary: Convergence generation t-test (hypothesis test)
    convergencePValue: number | null
    convergenceTStatistic: number | null
    convergenceIsSignificant: boolean
    convergenceControlMean: number | null
    convergenceExperimentalMean: number | null
    convergenceCohensD: number | null
    convergenceConfidenceInterval: { lower: number; upper: number } | null
    convergenceDegreesOfFreedom: number | null
    convergenceControlStd: number | null
    convergenceExperimentalStd: number | null
    convergenceMeanDifference: number | null  // Control − Experimental (positive = experimental faster)
    // Secondary: Elo t-test (descriptive only)
    pValue: number | null
    tStatistic: number | null
    isSignificant: boolean
    degreesOfFreedom: number | null
    cohensD: number | null
    confidenceInterval: { lower: number; upper: number } | null
    controlMean: number | null
    experimentalMean: number | null
    controlStd: number | null
    experimentalStd: number | null
    meanDifference: number | null
    // Experiment counts and generations
    totalGenerationsControl: number
    totalGenerationsExperimental: number
    controlExperimentCount: number
    experimentalExperimentCount: number
    controlAvgGenerations: number
    experimentalAvgGenerations: number
    statisticalPowerLevel: StatisticalPowerLevel
    // Convergence sample sizes (experiments that reached Nash, used for primary analysis)
    controlConvergedCount: number
    experimentalConvergedCount: number
  }
  // Scientific Rigor - Assumption Checks
  assumptionChecks?: {
    normalityControl: NormalityTestResult
    normalityExperimental: NormalityTestResult
    bothNormal: boolean
    varianceEquality: LeveneTestResult  // Levene's test for equal variances
    outlierControl: OutlierResult
    outlierExperimental: OutlierResult
    anyOutliers: boolean
    recommendation: 'parametric' | 'parametric_with_caution' | 'non_parametric'
    recommendationText: string
  }
  // Scientific Rigor - Non-parametric Test
  nonParametricTest?: MannWhitneyResult
  // Scientific Rigor - Enhanced Effect Sizes
  effectSizes?: {
    hedgesG: HedgesGResult
    cles: CLESResult
  }
  // Scientific Rigor - Power Analysis
  powerAnalysis?: {
    achievedPower: PowerAnalysisResult
    requiredFor80: RequiredSampleSizeResult
    requiredFor90: RequiredSampleSizeResult
    requiredFor95: RequiredSampleSizeResult
  }
  // Scientific Rigor - Bootstrap CI
  bootstrapCI?: BootstrapCIResult
  // Scientific Rigor - Distribution Data (for visualizations)
  distributionData?: {
    control: DistributionStats
    experimental: DistributionStats
  }
}

// =============================================================================
// STATISTICAL POWER LEVEL DETERMINATION
// =============================================================================
// 
// Statistical power is the probability of correctly rejecting the null hypothesis
// when a true effect exists. It depends on:
//   1. Sample size (n per group)
//   2. Effect size (Cohen's d or Hedges' g)
//   3. Significance level (α, typically 0.05)
//   4. Variance in the data
// 
// Standard thresholds (Cohen, 1988; widely accepted in scientific research):
//   - Power ≥ 80%: "Adequate" - standard threshold for publication-quality research
//   - Power ≥ 90%: "High" - recommended for confirmatory studies
//   - Power < 50%: "Inadequate" - high risk of Type II error (false negative)
// 
// This function uses the ACTUAL CALCULATED POWER when available (based on observed
// effect size), falling back to sample-size estimates only when effect size is unknown.
// =============================================================================

interface PowerLevelInput {
  controlCount: number
  experimentalCount: number
  achievedPower: number | null  // From actual power calculation using observed effect size
}

function calculatePowerLevel(input: PowerLevelInput): StatisticalPowerLevel {
  const { controlCount, experimentalCount, achievedPower } = input
  const minCount = Math.min(controlCount, experimentalCount)

  // If we have actual calculated power (requires n≥2 and observed effect size),
  // use it directly - this is the most scientifically rigorous approach
  if (achievedPower !== null) {
    // Thresholds based on established statistical conventions:
    // - 80% power is the standard "adequate" threshold (Cohen, 1988)
    // - 90%+ is considered high power, suitable for publication
    // - Below 50% means more likely to miss a real effect than detect it
    if (achievedPower >= 0.80) {
      return 'robust'      // ≥80% power: Standard threshold for adequate power
    }
    if (achievedPower >= 0.60) {
      return 'recommended' // 60-79% power: Moderate, may detect large effects
    }
    if (achievedPower >= 0.40) {
      return 'minimum'     // 40-59% power: Low, likely to miss real effects
    }
    return 'insufficient'  // <40% power: Very low, study is underpowered
  }

  // Fallback when we can't calculate actual power yet (no effect size estimate)
  // Use sample size thresholds based on a priori power analysis for medium effect (d=0.5):
  //   - n=64 per group needed for 80% power with d=0.5
  //   - n=26 per group needed for 80% power with d=0.8 (large effect)
  //   - n=3 is mathematical minimum for t-test (df > 1)
  //
  // These are conservative estimates assuming medium effect size.
  // Once we have data to calculate actual effect size, we use the real power instead.
  
  if (minCount < 2) {
    return 'insufficient'  // Cannot compute t-test statistics
  }
  if (minCount < 3) {
    return 'insufficient'  // df ≤ 1, t-test not meaningful
  }
  // With n≥3 but no effect size yet, we're in minimum territory
  // (actual power will be calculated once we have enough data for effect size)
  if (minCount < 10) {
    return 'minimum'       // Small sample, waiting for effect size calculation
  }
  if (minCount < 26) {
    return 'recommended'   // Moderate sample, ~80% power for large effects (d=0.8)
  }
  return 'robust'          // Large sample, likely adequate power even for medium effects
}


export async function GET() {
  try {
    // =========================================================================
    // DATA FETCHING STRATEGY:
    // 1. Statistics: Use ALL completed experiments for statistical accuracy
    // 2. Charts: Use subset (20 per group) for UI performance
    // =========================================================================

    // Fetch ALL completed experiments for statistics (no limit)
    const allCompletedExperiments = await queryAll<Experiment>(
      `SELECT * FROM experiments 
       WHERE status = 'COMPLETED' 
       ORDER BY created_at DESC`
    )

    // Also fetch running experiments for display purposes
    const runningExperiments = await queryAll<Experiment>(
      `SELECT * FROM experiments 
       WHERE status = 'RUNNING' 
       ORDER BY created_at DESC`
    )

    // Separate completed experiments by group (for statistics)
    const allControlExperiments = (allCompletedExperiments || []).filter(
      (exp: Experiment) => exp.experiment_group === 'CONTROL'
    )
    const allExperimentalExperiments = (allCompletedExperiments || []).filter(
      (exp: Experiment) => exp.experiment_group === 'EXPERIMENTAL'
    )

    // Combine for display (completed + running)
    const allExperiments = [...(allCompletedExperiments || []), ...(runningExperiments || [])]
    const controlExperiments = allExperiments.filter(
      (exp: Experiment) => exp.experiment_group === 'CONTROL'
    )
    const experimentalExperiments = allExperiments.filter(
      (exp: Experiment) => exp.experiment_group === 'EXPERIMENTAL'
    )

    // =========================================================================
    // STATISTICS DATA: Aggregate final Elo for ALL completed experiments
    // Uses SQL aggregation to efficiently calculate avg of last 10 generations
    // =========================================================================
    
    interface ExperimentFinalElo {
      experiment_id: string
      experiment_group: string
      final_elo: number
    }
    
    const experimentFinalElos = await queryAll<ExperimentFinalElo>(
      `WITH ranked_generations AS (
        SELECT 
          g.experiment_id,
          e.experiment_group,
          g.avg_elo,
          g.generation_number,
          ROW_NUMBER() OVER (
            PARTITION BY g.experiment_id 
            ORDER BY g.generation_number DESC
          ) as rn,
          COUNT(*) OVER (PARTITION BY g.experiment_id) as total_gens
        FROM generations g
        JOIN experiments e ON g.experiment_id = e.id
        WHERE e.status = 'COMPLETED'
          AND g.avg_elo IS NOT NULL
      )
      SELECT 
        experiment_id,
        experiment_group,
        AVG(avg_elo) as final_elo
      FROM ranked_generations
      WHERE rn <= LEAST(10, total_gens)
      GROUP BY experiment_id, experiment_group
      HAVING AVG(avg_elo) > 0`
    ) || []

    // Separate final Elos by group for statistical calculations
    const allControlFinalElos = experimentFinalElos
      .filter(e => e.experiment_group === 'CONTROL')
      .map(e => e.final_elo)
    const allExperimentalFinalElos = experimentFinalElos
      .filter(e => e.experiment_group === 'EXPERIMENTAL')
      .map(e => e.final_elo)

    // =========================================================================
    // CHART DATA: Fetch generations for subset of experiments (for visualization)
    // Chart ELO/entropy values are from generations.avg_elo, generations.peak_elo,
    // etc. at each generation_number — one row per (experiment_id, generation_number).
    // Control and experimental series use disjoint experiment_id sets (CONTROL vs EXPERIMENTAL).
    // =========================================================================
    
    const MAX_EXPERIMENTS_FOR_CHARTS = 20
    const controlIdsForCharts = controlExperiments.slice(0, MAX_EXPERIMENTS_FOR_CHARTS).map((exp: Experiment) => exp.id)
    const experimentalIdsForCharts = experimentalExperiments.slice(0, MAX_EXPERIMENTS_FOR_CHARTS).map((exp: Experiment) => exp.id)

    // Fetch generations only for the subset used in charts (values at each generation from DB)
    let controlGenerations: Generation[] = []
    
    if (controlIdsForCharts.length > 0) {
      const placeholders = controlIdsForCharts.map((_: string, i: number) => `$${i + 1}`).join(', ')
      controlGenerations = await queryAll<Generation>(
        `SELECT * FROM generations 
         WHERE experiment_id IN (${placeholders}) 
         ORDER BY generation_number ASC`,
        controlIdsForCharts
      ) || []
    }

    // Fetch generations for experimental experiments (disjoint from control)
    let experimentalGenerations: Generation[] = []
    
    if (experimentalIdsForCharts.length > 0) {
      const overlap = controlIdsForCharts.filter((id: string) => experimentalIdsForCharts.includes(id))
      if (overlap.length > 0) {
        console.warn('[dashboard] Chart data: control and experimental ID lists overlapped (bug?)', overlap)
      }
      const placeholders = experimentalIdsForCharts.map((_: string, i: number) => `$${i + 1}`).join(', ')
      experimentalGenerations = await queryAll<Generation>(
        `SELECT * FROM generations 
         WHERE experiment_id IN (${placeholders}) 
         ORDER BY generation_number ASC`,
        experimentalIdsForCharts
      ) || []
    }

    // =========================================================================
    // CONVERGENCE DATA: Fetch ALL generations for ALL completed experiments
    // This is needed to calculate convergence generation for each experiment
    // =========================================================================
    
    const allControlIds = allControlExperiments.map((exp: Experiment) => exp.id)
    const allExperimentalIds = allExperimentalExperiments.map((exp: Experiment) => exp.id)
    
    let allControlGenerations: Generation[] = []
    let allExperimentalGenerations: Generation[] = []
    
    // Fetch all generations for control experiments (for convergence stats)
    if (allControlIds.length > 0) {
      const placeholders = allControlIds.map((_: string, i: number) => `$${i + 1}`).join(', ')
      allControlGenerations = await queryAll<Generation>(
        `SELECT * FROM generations 
         WHERE experiment_id IN (${placeholders}) 
         ORDER BY experiment_id, generation_number ASC`,
        allControlIds
      ) || []
    }
    
    // Fetch all generations for experimental experiments (for convergence stats)
    if (allExperimentalIds.length > 0) {
      const placeholders = allExperimentalIds.map((_: string, i: number) => `$${i + 1}`).join(', ')
      allExperimentalGenerations = await queryAll<Generation>(
        `SELECT * FROM generations 
         WHERE experiment_id IN (${placeholders}) 
         ORDER BY experiment_id, generation_number ASC`,
        allExperimentalIds
      ) || []
    }

    // Calculate statistics
    const controlElos = controlGenerations
      .map((g: Generation) => g.avg_elo)
      .filter((e): e is number => e !== null && e !== undefined)
    
    const experimentalElos = experimentalGenerations
      .map((g: Generation) => g.avg_elo)
      .filter((e): e is number => e !== null && e !== undefined)

    // Find convergence points using improved detection with stability window
    // 
    // Logic:
    // 1. Find peak entropy variance (must be above minimum to show divergence)
    // 2. Use min(absolute threshold, 5% of peak) for convergence detection
    // 3. Require STABILITY_WINDOW consecutive generations below threshold
    // 
    // IMPORTANT: Both groups use the same threshold for fair comparison
    const CONVERGENCE_THRESHOLD = 0.01
    const STABILITY_WINDOW = 20  // Require 20 consecutive generations below threshold
    
    const findConvergenceGeneration = (generations: Generation[], absoluteThreshold: number): number | null => {
      if (generations.length < 10) return null
      
      // Get variance data (skip first few gens where data might be unstable)
      const varianceData = generations.slice(5)
        .filter((g: Generation) => g.entropy_variance != null)
        .map((g: Generation) => ({
          gen: g.generation_number,
          variance: g.entropy_variance as number
        }))
      
      if (varianceData.length === 0) return null

      // Find peak variance
      const peakVariance = Math.max(...varianceData.map(d => d.variance))
      const peakIndex = varianceData.findIndex(d => d.variance === peakVariance)
      
      // Must have diverged (peak > minimum threshold)
      if (peakVariance <= 0.0001) return null

      // Use the fixed threshold for convergence detection
      // This matches the documented methodology: σ < 0.01 after initial divergence
      const effectiveThreshold = absoluteThreshold
      
      // Get data after peak
      const afterPeak = varianceData.slice(peakIndex)
      
      // Find first generation that starts a stable run of STABILITY_WINDOW generations below threshold
      for (let i = 0; i <= afterPeak.length - STABILITY_WINDOW; i++) {
        const window = afterPeak.slice(i, i + STABILITY_WINDOW)
        if (window.every(d => d.variance < effectiveThreshold)) {
          return window[0].gen
        }
      }
      
      return null
    }
    
    const controlConvergenceGen = findConvergenceGeneration(controlGenerations, CONVERGENCE_THRESHOLD)
    const experimentalConvergenceGen = findConvergenceGeneration(experimentalGenerations, CONVERGENCE_THRESHOLD)

    // Calculate convergence improvement
    let convergenceImprovement: number | null = null
    if (controlConvergenceGen !== null && experimentalConvergenceGen !== null && controlConvergenceGen > 0) {
      convergenceImprovement = ((controlConvergenceGen - experimentalConvergenceGen) / controlConvergenceGen) * 100
    }

    // Final and peak Elo values (from all generations combined)
    const controlFinalElo = controlElos.length > 0 ? controlElos[controlElos.length - 1] : null
    const experimentalFinalElo = experimentalElos.length > 0 ? experimentalElos[experimentalElos.length - 1] : null
    
    const controlPeakElo = controlElos.length > 0 ? Math.max(...controlElos) : null
    const experimentalPeakElo = experimentalElos.length > 0 ? Math.max(...experimentalElos) : null

    // =========================================================================
    // EXPERIMENT-LEVEL T-TEST (Scientifically Rigorous)
    // =========================================================================
    // CRITICAL: We use ONE data point per experiment to avoid pseudoreplication.
    // Each experiment provides its final average Elo as the summary statistic.
    // This ensures statistical independence between samples.
    // 
    // IMPORTANT: We use ALL completed experiments for statistical analysis,
    // not just the subset used for chart visualization.
    // =========================================================================
    
    // Use pre-calculated final Elos from SQL aggregation (ALL completed experiments)
    const controlExperimentElos = allControlFinalElos
    const experimentalExperimentElos = allExperimentalFinalElos
    
    // Perform Welch's t-test on experiment-level data
    let tTestResult: TTestResult | null = null
    let pValue: number | null = null
    let tStatistic: number | null = null
    let isSignificant = false
    let degreesOfFreedom: number | null = null
    let cohensD: number | null = null
    let confidenceInterval: { lower: number; upper: number } | null = null
    let controlMean: number | null = null
    let experimentalMean: number | null = null
    let controlStd: number | null = null
    let experimentalStd: number | null = null
    let meanDifference: number | null = null

    // Require at least 2 experiments per group for valid t-test
    if (controlExperimentElos.length >= 2 && experimentalExperimentElos.length >= 2) {
      tTestResult = welchTTest(controlExperimentElos, experimentalExperimentElos)
      pValue = tTestResult.pValue
      tStatistic = tTestResult.tStatistic
      degreesOfFreedom = tTestResult.degreesOfFreedom
      cohensD = tTestResult.cohensD
      confidenceInterval = tTestResult.confidenceInterval
      controlMean = tTestResult.controlMean
      experimentalMean = tTestResult.experimentalMean
      controlStd = tTestResult.controlStd
      experimentalStd = tTestResult.experimentalStd
      meanDifference = tTestResult.meanDifference
      isSignificant = pValue < 0.05
    } else if (controlExperimentElos.length >= 1 && experimentalExperimentElos.length >= 1) {
      // With only 1 experiment per group, report means but no significance test
      controlMean = controlExperimentElos.reduce((a, b) => a + b, 0) / controlExperimentElos.length
      experimentalMean = experimentalExperimentElos.reduce((a, b) => a + b, 0) / experimentalExperimentElos.length
      meanDifference = experimentalMean - controlMean
    }

    // =========================================================================
    // CONVERGENCE GENERATION T-TEST (Primary Hypothesis Test)
    // =========================================================================
    // This directly tests the hypothesis: "Does adaptive mutation reach Nash
    // equilibrium in fewer generations than static mutation?"
    // Each experiment provides ONE data point: its convergence generation.
    // 
    // IMPORTANT: We use ALL completed experiments for statistical analysis,
    // not just the subset used for chart visualization.
    // =========================================================================
    
    // Get convergence generation for each experiment
    const getExperimentConvergenceGens = (experiments: Experiment[], generations: Generation[]): number[] => {
      return experiments.map(exp => {
        // Get all generations for this experiment, sorted
        const expGens = generations
          .filter(g => g.experiment_id === exp.id)
          .sort((a, b) => a.generation_number - b.generation_number)
        
        if (expGens.length < 10) return null
        
        // Apply the same convergence detection logic as findConvergenceGeneration
        const varianceData = expGens.slice(5)
          .filter(g => g.entropy_variance != null)
          .map(g => ({
            gen: g.generation_number,
            variance: g.entropy_variance as number
          }))
        
        if (varianceData.length === 0) return null
        
        const peakVariance = Math.max(...varianceData.map(d => d.variance))
        const peakIndex = varianceData.findIndex(d => d.variance === peakVariance)
        
        if (peakVariance <= 0.0001) return null
        
        // Use the fixed threshold for convergence detection
        // This matches the documented methodology: σ < 0.01 after initial divergence
        const effectiveThreshold = CONVERGENCE_THRESHOLD
        
        const afterPeak = varianceData.slice(peakIndex)
        
        // Find stable convergence window
        for (let i = 0; i <= afterPeak.length - STABILITY_WINDOW; i++) {
          const window = afterPeak.slice(i, i + STABILITY_WINDOW)
          if (window.every(d => d.variance < effectiveThreshold)) {
            return window[0].gen
          }
        }
        
        return null
      }).filter((gen): gen is number => gen !== null)
    }
    
    // Use ALL completed experiments for convergence statistics (not just chart subset)
    const controlConvergenceGens = getExperimentConvergenceGens(allControlExperiments, allControlGenerations)
    const experimentalConvergenceGens = getExperimentConvergenceGens(allExperimentalExperiments, allExperimentalGenerations)
    
    // T-test on convergence generations (PRIMARY hypothesis test)
    let convergenceTTestResult: TTestResult | null = null
    let convergencePValue: number | null = null
    let convergenceTStatistic: number | null = null
    let convergenceIsSignificant = false
    let convergenceControlMean: number | null = null
    let convergenceExperimentalMean: number | null = null
    let convergenceCohensD: number | null = null
    let convergenceConfidenceInterval: { lower: number; upper: number } | null = null
    let convergenceDegreesOfFreedom: number | null = null
    let convergenceControlStd: number | null = null
    let convergenceExperimentalStd: number | null = null
    // Control − Experimental (positive = experimental reached Nash in fewer generations)
    let convergenceMeanDifference: number | null = null

    if (controlConvergenceGens.length >= 2 && experimentalConvergenceGens.length >= 2) {
      convergenceTTestResult = welchTTest(controlConvergenceGens, experimentalConvergenceGens)
      convergencePValue = convergenceTTestResult.pValue
      convergenceTStatistic = convergenceTTestResult.tStatistic
      convergenceControlMean = convergenceTTestResult.controlMean
      convergenceExperimentalMean = convergenceTTestResult.experimentalMean
      convergenceCohensD = convergenceTTestResult.cohensD
      convergenceConfidenceInterval = convergenceTTestResult.confidenceInterval
      convergenceDegreesOfFreedom = convergenceTTestResult.degreesOfFreedom
      convergenceControlStd = convergenceTTestResult.controlStd
      convergenceExperimentalStd = convergenceTTestResult.experimentalStd
      // TTestResult.meanDifference is Experimental − Control; we want Control − Experimental
      convergenceMeanDifference = -convergenceTTestResult.meanDifference
      convergenceIsSignificant = convergencePValue < 0.05

      // Update improvement percentage from multi-experiment data (more accurate)
      if (convergenceControlMean && convergenceExperimentalMean && convergenceControlMean > 0) {
        convergenceImprovement = ((convergenceControlMean - convergenceExperimentalMean) / convergenceControlMean) * 100
      }
    } else if (controlConvergenceGens.length >= 1 && experimentalConvergenceGens.length >= 1) {
      // With only 1 experiment per group, report means but no significance test
      convergenceControlMean = controlConvergenceGens.reduce((a, b) => a + b, 0) / controlConvergenceGens.length
      convergenceExperimentalMean = experimentalConvergenceGens.reduce((a, b) => a + b, 0) / experimentalConvergenceGens.length
      convergenceMeanDifference = convergenceControlMean - convergenceExperimentalMean
      if (convergenceControlMean > 0) {
        convergenceImprovement = ((convergenceControlMean - convergenceExperimentalMean) / convergenceControlMean) * 100
      }
    }

    // Calculate statistics based on ALL completed experiments (not chart subset)
    // These counts reflect the actual sample sizes used in statistical tests
    const controlExperimentCount = allControlExperiments.length
    const experimentalExperimentCount = allExperimentalExperiments.length
    
    // Calculate average generations from ALL completed experiments
    const controlAvgGenerations = controlExperimentCount > 0
      ? Math.round(allControlGenerations.length / controlExperimentCount)
      : 0
    const experimentalAvgGenerations = experimentalExperimentCount > 0
      ? Math.round(allExperimentalGenerations.length / experimentalExperimentCount)
      : 0

    // =========================================================================
    // SCIENTIFIC RIGOR - On convergence generations (primary hypothesis outcome)
    // =========================================================================
    // Assumption checks, effect sizes, power, and distributions apply to
    // generations to Nash equilibrium. Only experiments that converged are included.
    // =========================================================================

    // Initialize optional scientific rigor fields
    let assumptionChecks: DashboardData['assumptionChecks'] = undefined
    let nonParametricTest: DashboardData['nonParametricTest'] = undefined
    let effectSizes: DashboardData['effectSizes'] = undefined
    let powerAnalysisResult: DashboardData['powerAnalysis'] = undefined
    let bootstrapCIResult: DashboardData['bootstrapCI'] = undefined
    let distributionData: DashboardData['distributionData'] = undefined

    // Track achieved power for power level (from convergence analysis)
    let achievedPowerValue: number | null = null

    // Only compute rigor when we have at least 2 converged experiments per group
    if (controlConvergenceGens.length >= 2 && experimentalConvergenceGens.length >= 2) {
      // Assumption Checks - on generations to Nash
      const normalityControl = jarqueBeraTest(controlConvergenceGens)
      const normalityExperimental = jarqueBeraTest(experimentalConvergenceGens)
      const varianceEquality = leveneTest(controlConvergenceGens, experimentalConvergenceGens)
      const outlierControl = detectOutliers(controlConvergenceGens)
      const outlierExperimental = detectOutliers(experimentalConvergenceGens)

      const bothNormal = (normalityControl.isNormal ?? false) && (normalityExperimental.isNormal ?? false)
      const anyOutliers = outlierControl.outlierCount > 0 || outlierExperimental.outlierCount > 0

      let recommendation: 'parametric' | 'parametric_with_caution' | 'non_parametric'
      let recommendationText: string

      if (bothNormal && !anyOutliers) {
        recommendation = 'parametric'
        if (varianceEquality.equalVariances) {
          recommendationText = 'Use parametric tests (Welch\'s t-test). All assumptions met including equal variances.'
        } else {
          recommendationText = 'Use parametric tests (Welch\'s t-test). Normal data with unequal variances - Welch\'s t-test handles this.'
        }
      } else if (bothNormal && anyOutliers) {
        recommendation = 'parametric_with_caution'
        recommendationText = 'Use parametric tests with caution. Data is normal but contains outliers.'
      } else {
        recommendation = 'non_parametric'
        recommendationText = 'Consider non-parametric tests (Mann-Whitney U). Normality assumption may be violated.'
      }

      assumptionChecks = {
        normalityControl,
        normalityExperimental,
        bothNormal,
        varianceEquality,
        outlierControl,
        outlierExperimental,
        anyOutliers,
        recommendation,
        recommendationText
      }

      nonParametricTest = mannWhitneyUTest(controlConvergenceGens, experimentalConvergenceGens)

      const hedgesGResult = hedgesG(controlConvergenceGens, experimentalConvergenceGens)
      const clesResult = commonLanguageEffectSize(controlConvergenceGens, experimentalConvergenceGens)
      effectSizes = {
        hedgesG: hedgesGResult,
        cles: clesResult
      }

      const effectSizeForPower = hedgesGResult.hedgesG ?? convergenceCohensD
      const achievedPower = calculatePower(
        controlConvergenceGens.length,
        experimentalConvergenceGens.length,
        effectSizeForPower
      )
      const requiredFor80 = requiredSampleSize(effectSizeForPower, 0.80)
      const requiredFor90 = requiredSampleSize(effectSizeForPower, 0.90)
      const requiredFor95 = requiredSampleSize(effectSizeForPower, 0.95)

      powerAnalysisResult = {
        achievedPower,
        requiredFor80,
        requiredFor90,
        requiredFor95
      }

      achievedPowerValue = achievedPower.power

      bootstrapCIResult = bootstrapCI(controlConvergenceGens, experimentalConvergenceGens, 5000)

      distributionData = {
        control: getDistributionStats(controlConvergenceGens),
        experimental: getDistributionStats(experimentalConvergenceGens)
      }
    }

    // Power level from convergence analysis (converged-experiment counts)
    const statisticalPowerLevel = calculatePowerLevel({
      controlCount: controlConvergenceGens.length,
      experimentalCount: experimentalConvergenceGens.length,
      achievedPower: achievedPowerValue
    })

    const response: DashboardData = {
      controlExperiments,
      experimentalExperiments,
      controlGenerations,
      experimentalGenerations,
      statistics: {
        controlConvergenceGen,
        experimentalConvergenceGen,
        convergenceImprovement,
        controlFinalElo,
        experimentalFinalElo,
        controlPeakElo,
        experimentalPeakElo,
        // Primary: convergence generation t-test (hypothesis test)
        convergencePValue,
        convergenceTStatistic,
        convergenceIsSignificant,
        convergenceControlMean,
        convergenceExperimentalMean,
        convergenceCohensD,
        convergenceConfidenceInterval,
        convergenceDegreesOfFreedom,
        convergenceControlStd,
        convergenceExperimentalStd,
        convergenceMeanDifference,
        // Secondary: Elo t-test (descriptive only)
        pValue,
        tStatistic,
        isSignificant,
        degreesOfFreedom,
        cohensD,
        confidenceInterval,
        controlMean,
        experimentalMean,
        controlStd,
        experimentalStd,
        meanDifference,
        totalGenerationsControl: allControlGenerations.length,
        totalGenerationsExperimental: allExperimentalGenerations.length,
        controlExperimentCount,
        experimentalExperimentCount,
        controlAvgGenerations,
        experimentalAvgGenerations,
        statisticalPowerLevel,
        controlConvergedCount: controlConvergenceGens.length,
        experimentalConvergedCount: experimentalConvergenceGens.length
      },
      // Scientific Rigor additions
      assumptionChecks,
      nonParametricTest,
      effectSizes,
      powerAnalysis: powerAnalysisResult,
      bootstrapCI: bootstrapCIResult,
      distributionData
    }

    return NextResponse.json(response, {
      headers: {
        'Cache-Control': 'private, no-store, no-cache, max-age=0, must-revalidate',
        Pragma: 'no-cache'
      }
    })
  } catch (error) {
    console.error('Dashboard API error:', error)
    
    // Return more detailed error information for debugging
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    const isDbError = errorMessage.includes('DATABASE_URL') || 
                      errorMessage.includes('ECONNREFUSED') ||
                      errorMessage.includes('connection')
    
    return NextResponse.json(
      { 
        error: 'Failed to fetch dashboard data',
        details: process.env.NODE_ENV === 'development' ? errorMessage : undefined,
        isDbError
      },
      { status: 500 }
    )
  }
}
