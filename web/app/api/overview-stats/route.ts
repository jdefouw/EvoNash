import { NextResponse } from 'next/server'
import { queryAll, queryOne } from '@/lib/postgres'
import { computePairedStats, type PairedStatsInput } from '@/lib/paired-stats'

// Force dynamic rendering since we query the database
export const dynamic = 'force-dynamic'

/**
 * Returns aggregate statistics used by the /overview page.
 * All numbers are computed live from the database so the overview
 * never shows stale / hardcoded figures.
 *
 * Convergence detection mirrors the dashboard API exactly:
 *   1. Skip first 5 generations
 *   2. Find peak entropy_variance (must > 0.0001)
 *   3. After peak, sliding window of 10 gens — at least 8/10 below 0.001
 *   4. Earliest qualifying window = convergence generation
 */
export async function GET() {
  try {
    // ── Basic counts ────────────────────────────────────────────────────
    const totalRow = await queryOne<{ count: string }>(
      `SELECT COUNT(*) as count FROM experiments`
    )
    const totalExperiments = parseInt(totalRow?.count ?? '0', 10)

    const completedRow = await queryOne<{ count: string }>(
      `SELECT COUNT(*) as count FROM experiments WHERE status = 'COMPLETED'`
    )
    const completedExperiments = parseInt(completedRow?.count ?? '0', 10)

    // ── Total generation rows ───────────────────────────────────────────
    const genCountRow = await queryOne<{ count: string }>(
      `SELECT COUNT(*) as count FROM generations`
    )
    const totalGenerationRows = parseInt(genCountRow?.count ?? '0', 10)

    // ── Average generations per completed experiment ────────────────────
    const avgGensRow = await queryOne<{ avg: string | null }>(
      `SELECT AVG(gen_count)::text as avg FROM (
         SELECT COUNT(*) as gen_count
         FROM generations g
         JOIN experiments e ON g.experiment_id = e.id
         WHERE e.status = 'COMPLETED'
         GROUP BY g.experiment_id
       ) sub`
    )
    const avgGenerationsPerExperiment = parseFloat(avgGensRow?.avg ?? '300')

    // ── Max generations setting ─────────────────────────────────────────
    const maxGensRow = await queryOne<{ max_gens: number | null }>(
      `SELECT MAX(max_generations) as max_gens FROM experiments`
    )
    const maxGenerations = maxGensRow?.max_gens ?? 1500

    // ── Convergence detection (identical to dashboard API) ──────────────
    const CONVERGENCE_THRESHOLD = 0.001
    const STABILITY_WINDOW = 10
    const MIN_BELOW_THRESHOLD = 8

    interface ExperimentConvergence {
      experiment_id: string
      experiment_group: string
      random_seed: number | null
      convergence_generation: number
    }

    const experimentConvergenceData = await queryAll<ExperimentConvergence>(`
      WITH gen_data AS (
        SELECT
          g.experiment_id,
          e.experiment_group,
          e.random_seed,
          g.generation_number,
          g.entropy_variance::float as entropy_variance
        FROM generations g
        JOIN experiments e ON g.experiment_id = e.id
        WHERE e.status = 'COMPLETED'
          AND g.entropy_variance IS NOT NULL
          AND g.generation_number > 5
      ),
      peak_info AS (
        SELECT DISTINCT ON (experiment_id)
          experiment_id,
          entropy_variance as peak_variance,
          generation_number as peak_gen
        FROM gen_data
        WHERE experiment_id IN (
          SELECT experiment_id FROM gen_data
          GROUP BY experiment_id
          HAVING MAX(entropy_variance) > 0.0001
        )
        ORDER BY experiment_id, entropy_variance DESC, generation_number ASC
      ),
      after_peak AS (
        SELECT
          gd.experiment_id,
          gd.experiment_group,
          gd.random_seed,
          gd.generation_number,
          CASE WHEN gd.entropy_variance < ${CONVERGENCE_THRESHOLD} THEN 1 ELSE 0 END as below_threshold
        FROM gen_data gd
        JOIN peak_info pi ON gd.experiment_id = pi.experiment_id
        WHERE gd.generation_number >= pi.peak_gen
      ),
      sliding_window AS (
        SELECT
          experiment_id,
          experiment_group,
          random_seed,
          generation_number,
          SUM(below_threshold) OVER (
            PARTITION BY experiment_id
            ORDER BY generation_number
            ROWS BETWEEN CURRENT ROW AND ${STABILITY_WINDOW - 1} FOLLOWING
          ) as below_count,
          COUNT(*) OVER (
            PARTITION BY experiment_id
            ORDER BY generation_number
            ROWS BETWEEN CURRENT ROW AND ${STABILITY_WINDOW - 1} FOLLOWING
          ) as window_size
        FROM after_peak
      ),
      convergent_runs AS (
        SELECT
          experiment_id,
          experiment_group,
          random_seed,
          generation_number
        FROM sliding_window
        WHERE window_size >= ${STABILITY_WINDOW}
          AND below_count >= ${MIN_BELOW_THRESHOLD}
      )
      SELECT
        experiment_id,
        experiment_group,
        random_seed,
        MIN(generation_number)::int as convergence_generation
      FROM convergent_runs
      GROUP BY experiment_id, experiment_group, random_seed
    `) || []

    // Separate convergence data by group
    const controlGens = experimentConvergenceData
      .filter(e => e.experiment_group === 'CONTROL')
      .map(e => Number(e.convergence_generation))
    const expGens = experimentConvergenceData
      .filter(e => e.experiment_group === 'EXPERIMENTAL')
      .map(e => Number(e.convergence_generation))

    const controlConvergedCount = controlGens.length
    const experimentalConvergedCount = expGens.length

    // ── Welch's t-test and Cohen's d ────────────────────────────────────
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

      const se = Math.sqrt(var1 / n1 + var2 / n2)
      if (se > 0) {
        const t = (mean1 - mean2) / se
        const absT = Math.abs(t)
        pValue = 2 * (1 - normalCDF(absT))

        const pooledStd = Math.sqrt(((n1 - 1) * var1 + (n2 - 1) * var2) / (n1 + n2 - 2))
        if (pooledStd > 0) {
          cohensD = (mean2 - mean1) / pooledStd
        }
      }
    }

    // ── Paired analysis (matched-seed comparison) ───────────────────────
    const pairedInputs: PairedStatsInput[] = experimentConvergenceData
      .filter(e => e.random_seed != null && (e.experiment_group === 'CONTROL' || e.experiment_group === 'EXPERIMENTAL'))
      .map(e => ({
        seed: Number(e.random_seed),
        group: e.experiment_group as 'CONTROL' | 'EXPERIMENTAL',
        convergenceGeneration: Number(e.convergence_generation)
      }))
    const pairedStats = computePairedStats(pairedInputs)

    // ── Scale calculations ──────────────────────────────────────────────
    const populationSize = 1000
    const ticksPerGeneration = 750
    const safeAvgGens = isNaN(avgGenerationsPerExperiment) ? 300 : avgGenerationsPerExperiment
    const decisionsPerExperiment = populationSize * safeAvgGens * ticksPerGeneration
    const totalDecisions = completedExperiments * decisionsPerExperiment

    return NextResponse.json({
      totalExperiments,
      completedExperiments,
      controlConvergedCount,
      experimentalConvergedCount,
      totalConvergedCount: controlConvergedCount + experimentalConvergedCount,
      totalGenerationRows,
      avgGenerationsPerExperiment: Math.round(safeAvgGens),
      maxGenerations,
      populationSize,
      ticksPerGeneration,
      decisionsPerExperiment: Math.round(decisionsPerExperiment),
      totalDecisions: Math.round(totalDecisions),
      pValue,
      cohensD,
      controlMean: controlMean !== null ? Math.round(controlMean) : null,
      experimentalMean: experimentalMean !== null ? Math.round(experimentalMean) : null,
      pairedStats,
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
