import { NextResponse } from 'next/server'
import { queryAll } from '@/lib/postgres'
import { Experiment, Generation } from '@/types/protocol'

// Force dynamic rendering since we query the database
export const dynamic = 'force-dynamic'

// Simple t-test implementation for two independent samples
function tTest(sample1: number[], sample2: number[]): { pValue: number; tStatistic: number } {
  if (sample1.length < 2 || sample2.length < 2) {
    return { pValue: 1, tStatistic: 0 }
  }

  const mean1 = sample1.reduce((a, b) => a + b, 0) / sample1.length
  const mean2 = sample2.reduce((a, b) => a + b, 0) / sample2.length

  const variance1 = sample1.reduce((sum, val) => sum + Math.pow(val - mean1, 2), 0) / (sample1.length - 1)
  const variance2 = sample2.reduce((sum, val) => sum + Math.pow(val - mean2, 2), 0) / (sample2.length - 1)

  const pooledSE = Math.sqrt(variance1 / sample1.length + variance2 / sample2.length)
  
  if (pooledSE === 0) {
    return { pValue: 1, tStatistic: 0 }
  }

  const tStatistic = (mean1 - mean2) / pooledSE

  // Degrees of freedom (Welch-Satterthwaite approximation)
  const df = Math.pow(variance1 / sample1.length + variance2 / sample2.length, 2) /
    (Math.pow(variance1 / sample1.length, 2) / (sample1.length - 1) +
     Math.pow(variance2 / sample2.length, 2) / (sample2.length - 1))

  // Approximate p-value using normal distribution for large samples
  // For a more accurate p-value, you'd need a t-distribution table or library
  const pValue = 2 * (1 - normalCDF(Math.abs(tStatistic)))

  return { pValue, tStatistic }
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
    // New fields for statistical power analysis
    controlExperimentCount: number
    experimentalExperimentCount: number
    controlAvgGenerations: number
    experimentalAvgGenerations: number
    statisticalPowerLevel: StatisticalPowerLevel
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

    // Find convergence points (entropy variance < 0.01)
    // IMPORTANT: We need to find convergence AFTER the population has diverged first.
    // At generation 0, all agents are identical (same seed), so variance is artificially low.
    // True convergence = population evolved, diverged, then stabilized to Nash Equilibrium.
    const findConvergenceGeneration = (generations: Generation[]): number | null => {
      const threshold = 0.01
      
      // First, find the index where entropy variance exceeds threshold (population diverged)
      const divergenceIndex = generations.findIndex(
        (g: Generation) => g.entropy_variance != null && g.entropy_variance >= threshold
      )
      
      // If population never diverged, there's no meaningful convergence
      if (divergenceIndex === -1) {
        return null
      }
      
      // Now find the first generation AFTER divergence where variance drops below threshold
      const convergenceGen = generations.slice(divergenceIndex).find(
        (g: Generation) => g.entropy_variance != null && g.entropy_variance < threshold
      )
      
      return convergenceGen?.generation_number ?? null
    }
    
    const controlConvergenceGen = findConvergenceGeneration(controlGenerations)
    const experimentalConvergenceGen = findConvergenceGeneration(experimentalGenerations)

    // Calculate convergence improvement
    let convergenceImprovement: number | null = null
    if (controlConvergenceGen !== null && experimentalConvergenceGen !== null && controlConvergenceGen > 0) {
      convergenceImprovement = ((controlConvergenceGen - experimentalConvergenceGen) / controlConvergenceGen) * 100
    }

    // Final and peak Elo values
    const controlFinalElo = controlElos.length > 0 ? controlElos[controlElos.length - 1] : null
    const experimentalFinalElo = experimentalElos.length > 0 ? experimentalElos[experimentalElos.length - 1] : null
    
    const controlPeakElo = controlElos.length > 0 ? Math.max(...controlElos) : null
    const experimentalPeakElo = experimentalElos.length > 0 ? Math.max(...experimentalElos) : null

    // Perform t-test on final Elo ratings
    let pValue: number | null = null
    let tStatistic: number | null = null
    let isSignificant = false

    if (controlElos.length >= 2 && experimentalElos.length >= 2) {
      const testResult = tTest(controlElos, experimentalElos)
      pValue = testResult.pValue
      tStatistic = testResult.tStatistic
      isSignificant = pValue < 0.05
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
        statisticalPowerLevel
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
