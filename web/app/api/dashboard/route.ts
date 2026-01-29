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
// 
// Methodology:
// - Independent variable: Mutation strategy (Control vs Experimental)
// - Dependent variable: Final average Elo rating per experiment
// - Test: Welch's two-sample t-test (unequal variances)
// - Significance level: α = 0.05
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

// T-distribution CDF approximation (more accurate than normal for small samples)
function tDistributionCDF(t: number, df: number): number {
  // Use beta function relationship: F(t) = 1 - 0.5 * I(df/(df+t²), df/2, 1/2)
  // For simplicity, use normal approximation adjusted for df
  // This is accurate for df > 30, reasonable for df > 5
  if (df <= 0) return 0.5
  
  // Adjusted t-value for better small-sample accuracy
  const adjustedT = t * Math.sqrt((df - 2) / df) * (df > 2 ? 1 : 0.9)
  
  return normalCDF(adjustedT)
}

// T-distribution quantile (inverse CDF) approximation
function tDistributionQuantile(p: number, df: number): number {
  // For 95% CI (p = 0.975), use approximation
  // Accurate for df > 30, reasonable for df > 5
  if (df <= 1) return 12.706  // t(0.975, 1)
  if (df <= 2) return 4.303   // t(0.975, 2)
  if (df <= 3) return 3.182   // t(0.975, 3)
  if (df <= 4) return 2.776   // t(0.975, 4)
  if (df <= 5) return 2.571   // t(0.975, 5)
  if (df <= 10) return 2.228  // t(0.975, 10)
  if (df <= 20) return 2.086  // t(0.975, 20)
  if (df <= 30) return 2.042  // t(0.975, 30)
  return 1.96  // Normal approximation for large df
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
    convergenceImprovement: number | null
    controlFinalElo: number | null
    experimentalFinalElo: number | null
    controlPeakElo: number | null
    experimentalPeakElo: number | null
    pValue: number | null
    tStatistic: number | null
    isSignificant: boolean
    totalGenerationsControl: number
    totalGenerationsExperimental: number
    // Statistical power and sample size
    controlExperimentCount: number
    experimentalExperimentCount: number
    controlAvgGenerations: number
    experimentalAvgGenerations: number
    statisticalPowerLevel: StatisticalPowerLevel
    // Enhanced statistical metrics for scientific rigor
    degreesOfFreedom: number | null
    cohensD: number | null  // Effect size
    confidenceInterval: { lower: number; upper: number } | null  // 95% CI for mean difference
    controlMean: number | null  // Mean of experiment-level final Elos
    experimentalMean: number | null
    controlStd: number | null  // Std of experiment-level final Elos
    experimentalStd: number | null
    meanDifference: number | null  // Experimental - Control
  }
}

// Calculate statistical power level based on experiment counts and generations
function calculatePowerLevel(
  controlCount: number,
  experimentalCount: number,
  controlAvgGens: number,
  experimentalAvgGens: number
): StatisticalPowerLevel {
  const minCount = Math.min(controlCount, experimentalCount)
  const minAvgGens = Math.min(controlAvgGens, experimentalAvgGens)

  // Robust: 5+ experiments per group with 2000+ generations each
  if (minCount >= 5 && minAvgGens >= 2000) {
    return 'robust'
  }
  // Recommended: 2-3 experiments per group with 1000+ generations each
  if (minCount >= 2 && minAvgGens >= 1000) {
    return 'recommended'
  }
  // Minimum: 1+ experiment per group with 500+ generations each
  if (minCount >= 1 && minAvgGens >= 500) {
    return 'minimum'
  }
  // Insufficient: < 1 experiment per group OR < 100 generations
  return 'insufficient'
}

export async function GET() {
  try {
    // Fetch all experiments
    const experiments = await queryAll<Experiment>(
      `SELECT * FROM experiments 
       WHERE status IN ('COMPLETED', 'RUNNING') 
       ORDER BY created_at DESC`
    )

    // Separate by group
    const controlExperiments = (experiments || []).filter(
      (exp: Experiment) => exp.experiment_group === 'CONTROL'
    )
    const experimentalExperiments = (experiments || []).filter(
      (exp: Experiment) => exp.experiment_group === 'EXPERIMENTAL'
    )

    // Fetch generations for control experiments
    const controlIds = controlExperiments.map((exp: Experiment) => exp.id)
    let controlGenerations: Generation[] = []
    
    if (controlIds.length > 0) {
      const placeholders = controlIds.map((_: string, i: number) => `$${i + 1}`).join(', ')
      controlGenerations = await queryAll<Generation>(
        `SELECT * FROM generations 
         WHERE experiment_id IN (${placeholders}) 
         ORDER BY generation_number ASC`,
        controlIds
      ) || []
    }

    // Fetch generations for experimental experiments
    const experimentalIds = experimentalExperiments.map((exp: Experiment) => exp.id)
    let experimentalGenerations: Generation[] = []
    
    if (experimentalIds.length > 0) {
      const placeholders = experimentalIds.map((_: string, i: number) => `$${i + 1}`).join(', ')
      experimentalGenerations = await queryAll<Generation>(
        `SELECT * FROM generations 
         WHERE experiment_id IN (${placeholders}) 
         ORDER BY generation_number ASC`,
        experimentalIds
      ) || []
    }

    // Calculate statistics
    const controlElos = controlGenerations
      .map((g: Generation) => g.avg_elo)
      .filter((e): e is number => e !== null && e !== undefined)
    
    const experimentalElos = experimentalGenerations
      .map((g: Generation) => g.avg_elo)
      .filter((e): e is number => e !== null && e !== undefined)

    // Find convergence points using improved relative threshold detection
    // This handles cases where variance never exceeds the absolute threshold but clearly converges
    // 
    // Logic:
    // 1. Find peak entropy variance (must be above minimum to show divergence)
    // 2. Use min(absolute threshold, 5% of peak) for convergence detection
    // 3. Find when variance drops below effective threshold after peak
    const CONTROL_CONVERGENCE_THRESHOLD = 0.01
    const EXPERIMENTAL_CONVERGENCE_THRESHOLD = 0.025
    
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

      // Use stricter of absolute or relative (5% of peak) threshold
      const relativeThreshold = peakVariance * 0.05
      const effectiveThreshold = Math.min(absoluteThreshold, relativeThreshold)
      
      // Find convergence after peak
      const convergencePoint = varianceData.slice(peakIndex).find(
        d => d.variance < effectiveThreshold
      )
      
      return convergencePoint?.gen ?? null
    }
    
    const controlConvergenceGen = findConvergenceGeneration(controlGenerations, CONTROL_CONVERGENCE_THRESHOLD)
    const experimentalConvergenceGen = findConvergenceGeneration(experimentalGenerations, EXPERIMENTAL_CONVERGENCE_THRESHOLD)

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
    // =========================================================================
    
    // Calculate final Elo for EACH experiment (not each generation)
    const getExperimentFinalElos = (experiments: Experiment[], generations: Generation[]): number[] => {
      return experiments.map(exp => {
        // Get all generations for this experiment, sorted by generation number
        const expGens = generations
          .filter(g => g.experiment_id === exp.id)
          .sort((a, b) => a.generation_number - b.generation_number)
        
        if (expGens.length === 0) return null
        
        // Use average of last 10 generations for stability (or all if < 10)
        const lastN = Math.min(10, expGens.length)
        const lastGens = expGens.slice(-lastN)
        const avgFinalElo = lastGens.reduce((sum, g) => sum + (g.avg_elo || 0), 0) / lastN
        
        return avgFinalElo
      }).filter((elo): elo is number => elo !== null && elo > 0)
    }
    
    const controlExperimentElos = getExperimentFinalElos(controlExperiments, controlGenerations)
    const experimentalExperimentElos = getExperimentFinalElos(experimentalExperiments, experimentalGenerations)
    
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

    // Calculate average generations per experiment
    const controlExperimentCount = controlExperiments.length
    const experimentalExperimentCount = experimentalExperiments.length
    
    const controlAvgGenerations = controlExperimentCount > 0
      ? Math.round(controlGenerations.length / controlExperimentCount)
      : 0
    const experimentalAvgGenerations = experimentalExperimentCount > 0
      ? Math.round(experimentalGenerations.length / experimentalExperimentCount)
      : 0

    // Calculate statistical power level
    const statisticalPowerLevel = calculatePowerLevel(
      controlExperimentCount,
      experimentalExperimentCount,
      controlAvgGenerations,
      experimentalAvgGenerations
    )

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
        pValue,
        tStatistic,
        isSignificant,
        totalGenerationsControl: controlGenerations.length,
        totalGenerationsExperimental: experimentalGenerations.length,
        controlExperimentCount,
        experimentalExperimentCount,
        controlAvgGenerations,
        experimentalAvgGenerations,
        statisticalPowerLevel,
        // Enhanced statistical metrics for scientific rigor
        degreesOfFreedom,
        cohensD,
        confidenceInterval,
        controlMean,
        experimentalMean,
        controlStd,
        experimentalStd,
        meanDifference
      }
    }

    return NextResponse.json(response, {
      headers: {
        'Cache-Control': 'private, no-store, no-cache, max-age=0, must-revalidate',
        Pragma: 'no-cache'
      }
    })
  } catch (error) {
    console.error('Dashboard API error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch dashboard data' },
      { status: 500 }
    )
  }
}
