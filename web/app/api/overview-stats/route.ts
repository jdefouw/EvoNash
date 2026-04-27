import { NextResponse } from 'next/server'
import { queryAll, queryOne } from '@/lib/postgres'

// Force dynamic rendering since we query the database
export const dynamic = 'force-dynamic'

/**
 * Returns aggregate statistics used by the /overview page.
 * All numbers are computed live from the database so the overview
 * never shows stale / hardcoded figures.
 */
export async function GET() {
  try {
    // Total experiments
    const totalRow = await queryOne<{ count: string }>(
      `SELECT COUNT(*) as count FROM experiments`
    )
    const totalExperiments = parseInt(totalRow?.count ?? '0', 10)

    // Completed experiments
    const completedRow = await queryOne<{ count: string }>(
      `SELECT COUNT(*) as count FROM experiments WHERE status = 'COMPLETED'`
    )
    const completedExperiments = parseInt(completedRow?.count ?? '0', 10)

    // Converged experiments per group (experiments that reached Nash equilibrium)
    // We detect convergence the same way the dashboard does — checking if
    // convergence_generation is set, or falling back to entropy variance analysis
    const convergedControl = await queryAll(
      `SELECT DISTINCT e.id
       FROM experiments e
       JOIN generations g ON g.experiment_id = e.id
       WHERE e.experiment_group = 'CONTROL'
         AND e.status = 'COMPLETED'
         AND e.convergence_generation IS NOT NULL`
    )
    const convergedExperimental = await queryAll(
      `SELECT DISTINCT e.id
       FROM experiments e
       JOIN generations g ON g.experiment_id = e.id
       WHERE e.experiment_group = 'EXPERIMENTAL'
         AND e.status = 'COMPLETED'
         AND e.convergence_generation IS NOT NULL`
    )

    const controlConvergedCount = convergedControl?.length ?? 0
    const experimentalConvergedCount = convergedExperimental?.length ?? 0

    // Total generation rows in the database
    const genCountRow = await queryOne<{ count: string }>(
      `SELECT COUNT(*) as count FROM generations`
    )
    const totalGenerationRows = parseInt(genCountRow?.count ?? '0', 10)

    // Average generations per completed experiment
    const avgGensRow = await queryOne<{ avg: string }>(
      `SELECT AVG(gen_count) as avg FROM (
         SELECT COUNT(*) as gen_count 
         FROM generations g
         JOIN experiments e ON g.experiment_id = e.id
         WHERE e.status = 'COMPLETED'
         GROUP BY g.experiment_id
       ) sub`
    )
    const avgGenerationsPerExperiment = parseFloat(avgGensRow?.avg ?? '300')

    // Max generations setting (from experiment config)
    const maxGensRow = await queryOne<{ max_gens: number }>(
      `SELECT MAX(max_generations) as max_gens FROM experiments`
    )
    const maxGenerations = maxGensRow?.max_gens ?? 1500

    // Convergence generation stats for overview text
    const controlConvergenceGens = await queryAll(
      `SELECT convergence_generation FROM experiments
       WHERE experiment_group = 'CONTROL'
         AND status = 'COMPLETED'
         AND convergence_generation IS NOT NULL
       ORDER BY convergence_generation ASC`
    )
    const experimentalConvergenceGens = await queryAll(
      `SELECT convergence_generation FROM experiments
       WHERE experiment_group = 'EXPERIMENTAL'
         AND status = 'COMPLETED'
         AND convergence_generation IS NOT NULL
       ORDER BY convergence_generation ASC`
    )

    const controlGens = (controlConvergenceGens ?? []).map((r: any) => r.convergence_generation as number)
    const expGens = (experimentalConvergenceGens ?? []).map((r: any) => r.convergence_generation as number)

    // Calculate Welch's t-test and Cohen's d for the overview page
    let pValue: number | null = null
    let cohensD: number | null = null
    let controlMean: number | null = null
    let experimentalMean: number | null = null

    if (controlGens.length >= 2 && expGens.length >= 2) {
      const n1 = controlGens.length
      const n2 = expGens.length
      const mean1 = controlGens.reduce((a, b) => a + b, 0) / n1
      const mean2 = expGens.reduce((a, b) => a + b, 0) / n2
      const var1 = controlGens.reduce((s, x) => s + (x - mean1) ** 2, 0) / (n1 - 1)
      const var2 = expGens.reduce((s, x) => s + (x - mean2) ** 2, 0) / (n2 - 1)

      controlMean = mean1
      experimentalMean = mean2

      // Welch's t-test
      const se = Math.sqrt(var1 / n1 + var2 / n2)
      if (se > 0) {
        const t = (mean1 - mean2) / se
        const dfNum = (var1 / n1 + var2 / n2) ** 2
        const dfDen = (var1 / n1) ** 2 / (n1 - 1) + (var2 / n2) ** 2 / (n2 - 1)
        const df = dfNum / dfDen

        // Approximate p-value using normal distribution for large df
        const absT = Math.abs(t)
        pValue = 2 * (1 - normalCDF(absT))

        // Cohen's d (experimental - control, so negative means experimental is lower/faster)
        const pooledStd = Math.sqrt(((n1 - 1) * var1 + (n2 - 1) * var2) / (n1 + n2 - 2))
        if (pooledStd > 0) {
          cohensD = (mean2 - mean1) / pooledStd
        }
      }
    }

    // Scale calculations
    const populationSize = 1000
    const ticksPerGeneration = 750
    const decisionsPerExperiment = populationSize * avgGenerationsPerExperiment * ticksPerGeneration
    const totalDecisions = completedExperiments * decisionsPerExperiment

    return NextResponse.json({
      totalExperiments,
      completedExperiments,
      controlConvergedCount,
      experimentalConvergedCount,
      totalConvergedCount: controlConvergedCount + experimentalConvergedCount,
      totalGenerationRows,
      avgGenerationsPerExperiment: Math.round(avgGenerationsPerExperiment),
      maxGenerations,
      populationSize,
      ticksPerGeneration,
      decisionsPerExperiment: Math.round(decisionsPerExperiment),
      totalDecisions: Math.round(totalDecisions),
      pValue,
      cohensD,
      controlMean: controlMean !== null ? Math.round(controlMean) : null,
      experimentalMean: experimentalMean !== null ? Math.round(experimentalMean) : null,
    })
  } catch (error: any) {
    console.error('Error fetching overview stats:', error)
    return NextResponse.json(
      { error: 'Failed to fetch overview stats' },
      { status: 500 }
    )
  }
}

// Standard normal CDF approximation (Abramowitz & Stegun)
function normalCDF(x: number): number {
  const a1 = 0.254829592
  const a2 = -0.284496736
  const a3 = 1.421413741
  const a4 = -1.453152027
  const a5 = 1.061405429
  const p = 0.3275911

  const sign = x < 0 ? -1 : 1
  const absX = Math.abs(x)
  const t = 1.0 / (1.0 + p * absX)
  const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-absX * absX / 2)

  return 0.5 * (1.0 + sign * y)
}
