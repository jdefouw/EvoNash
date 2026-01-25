import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { Experiment, Generation } from '@/types/protocol'

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
  }
}

export async function GET() {
  try {
    const supabase = await createServerClient()

    // Fetch all experiments
    const { data: experiments, error: expError } = await supabase
      .from('experiments')
      .select('*')
      .in('status', ['COMPLETED', 'RUNNING'])
      .order('created_at', { ascending: false })

    if (expError) {
      console.error('Error fetching experiments:', expError)
      return NextResponse.json({ error: expError.message }, { status: 500 })
    }

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
      const { data: controlGens, error: controlGenError } = await supabase
        .from('generations')
        .select('*')
        .in('experiment_id', controlIds)
        .order('generation_number', { ascending: true })

      if (controlGenError) {
        console.error('Error fetching control generations:', controlGenError)
      } else {
        controlGenerations = controlGens || []
      }
    }

    // Fetch generations for experimental experiments
    const experimentalIds = experimentalExperiments.map((exp: Experiment) => exp.id)
    let experimentalGenerations: Generation[] = []
    
    if (experimentalIds.length > 0) {
      const { data: expGens, error: expGenError } = await supabase
        .from('generations')
        .select('*')
        .in('experiment_id', experimentalIds)
        .order('generation_number', { ascending: true })

      if (expGenError) {
        console.error('Error fetching experimental generations:', expGenError)
      } else {
        experimentalGenerations = expGens || []
      }
    }

    // Calculate statistics
    const controlElos = controlGenerations
      .map((g: Generation) => g.avg_elo)
      .filter((e): e is number => e !== null && e !== undefined)
    
    const experimentalElos = experimentalGenerations
      .map((g: Generation) => g.avg_elo)
      .filter((e): e is number => e !== null && e !== undefined)

    // Find convergence points (entropy variance < 0.01)
    const controlConvergenceGen = controlGenerations.find(
      (g: Generation) => g.entropy_variance !== null && g.entropy_variance < 0.01
    )?.generation_number ?? null

    const experimentalConvergenceGen = experimentalGenerations.find(
      (g: Generation) => g.entropy_variance !== null && g.entropy_variance < 0.01
    )?.generation_number ?? null

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
        totalGenerationsExperimental: experimentalGenerations.length
      }
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Dashboard API error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch dashboard data' },
      { status: 500 }
    )
  }
}
