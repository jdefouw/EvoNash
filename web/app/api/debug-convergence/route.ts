import { NextRequest, NextResponse } from 'next/server'
import { queryAll, queryOne } from '@/lib/postgres'

export const dynamic = 'force-dynamic'

/**
 * Diagnostic endpoint for convergence detection.
 * 
 * Usage:
 *   GET /api/debug-convergence                         → Global stats
 *   GET /api/debug-convergence?experiment_id=UUID       → Per-experiment deep dive
 *   GET /api/debug-convergence?seed=63456               → All experiments for a seed
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const experimentId = searchParams.get('experiment_id')
  const seed = searchParams.get('seed')

  try {
    // =====================================================================
    // PER-EXPERIMENT DEEP DIVE
    // =====================================================================
    if (experimentId) {
      // Get experiment info
      const experiment = await queryOne<any>(
        `SELECT id, experiment_name, experiment_group, random_seed, status, 
                max_generations, completed_at
         FROM experiments WHERE id = $1`, [experimentId]
      )
      if (!experiment) {
        return NextResponse.json({ error: 'Experiment not found' }, { status: 404 })
      }

      // Count generations
      const genCount = await queryOne<{ cnt: string }>(
        `SELECT COUNT(*)::text as cnt FROM generations WHERE experiment_id = $1`,
        [experimentId]
      )

      // Get entropy_variance stats
      const varianceStats = await queryOne<any>(
        `SELECT 
           COUNT(*)::int as total_gens,
           COUNT(entropy_variance)::int as gens_with_variance,
           COUNT(*) FILTER (WHERE entropy_variance IS NULL)::int as gens_null_variance,
           MAX(entropy_variance)::float as max_variance,
           MIN(entropy_variance)::float as min_variance,
           AVG(entropy_variance)::float as avg_variance
         FROM generations WHERE experiment_id = $1`,
        [experimentId]
      )

      // Get entropy_variance values (sampled)
      const varianceSamples = await queryAll<{ gen: number; ev: number | null }>(
        `SELECT generation_number as gen, entropy_variance::float as ev
         FROM generations WHERE experiment_id = $1
         ORDER BY generation_number`,
        [experimentId]
      ) || []

      // Run the exact convergence detection pipeline step by step
      const CONVERGENCE_THRESHOLD = 0.001
      const STABILITY_WINDOW = 20
      const MIN_BELOW_THRESHOLD = 18

      // Step 1: gen_data (skip first 5, non-null variance)
      const genData = varianceSamples.filter(
        g => g.gen > 5 && g.ev !== null
      )

      // Step 2: peak
      let peakGen: number | null = null
      let peakVariance: number | null = null
      if (genData.length > 0) {
        const maxVar = Math.max(...genData.map(g => g.ev!))
        if (maxVar > 0.0001) {
          const peakEntry = genData.find(g => g.ev === maxVar)
          peakGen = peakEntry?.gen ?? null
          peakVariance = maxVar
        }
      }

      // Step 3: after peak, sliding window
      let convergenceGen: number | null = null
      let windowResults: { gen: number; belowCount: number; windowSize: number }[] = []
      if (peakGen !== null) {
        const afterPeak = genData.filter(g => g.gen >= peakGen!)
        for (let i = 0; i < afterPeak.length; i++) {
          const window = afterPeak.slice(i, i + STABILITY_WINDOW)
          if (window.length >= STABILITY_WINDOW) {
            const belowCount = window.filter(g => g.ev! < CONVERGENCE_THRESHOLD).length
            windowResults.push({
              gen: afterPeak[i].gen,
              belowCount,
              windowSize: window.length
            })
            if (belowCount >= MIN_BELOW_THRESHOLD && convergenceGen === null) {
              convergenceGen = afterPeak[i].gen
            }
          }
        }
      }

      // Why it failed
      let failureReason = null
      if (experiment.status !== 'COMPLETED') {
        failureReason = `Experiment status is '${experiment.status}', not 'COMPLETED'`
      } else if (varianceStats.gens_with_variance === 0) {
        failureReason = 'No entropy_variance data in generations table'
      } else if (genData.length === 0) {
        failureReason = 'No generation data after gen 5 with non-null entropy_variance'
      } else if (peakGen === null) {
        failureReason = `Peak entropy_variance (${varianceStats.max_variance}) is <= 0.0001 — experiment never diverged`
      } else if (windowResults.length === 0) {
        failureReason = `Not enough generations after peak (gen ${peakGen}) for a ${STABILITY_WINDOW}-gen window`
      } else if (convergenceGen === null) {
        const bestWindow = windowResults.reduce((a, b) => a.belowCount > b.belowCount ? a : b)
        failureReason = `No ${STABILITY_WINDOW}-gen window with ${MIN_BELOW_THRESHOLD}/${STABILITY_WINDOW} below ${CONVERGENCE_THRESHOLD}. Best window: gen ${bestWindow.gen} with ${bestWindow.belowCount}/${bestWindow.windowSize} below threshold`
      }

      return NextResponse.json({
        experiment: {
          id: experiment.id,
          name: experiment.experiment_name,
          group: experiment.experiment_group,
          seed: experiment.random_seed,
          status: experiment.status,
          maxGenerations: experiment.max_generations,
          completedAt: experiment.completed_at
        },
        generationCount: parseInt(genCount?.cnt || '0', 10),
        varianceStats,
        convergenceResult: {
          detected: convergenceGen !== null,
          convergenceGeneration: convergenceGen,
          peakGeneration: peakGen,
          peakVariance,
          gensAfterPeak: peakGen !== null ? genData.filter(g => g.gen >= peakGen!).length : 0,
          failureReason,
          threshold: CONVERGENCE_THRESHOLD,
          windowSize: STABILITY_WINDOW,
          minBelowRequired: MIN_BELOW_THRESHOLD
        },
        // Show first few and last few variance values
        varianceSummary: {
          first10: varianceSamples.slice(0, 10),
          last10: varianceSamples.slice(-10),
          aroundPeak: peakGen ? varianceSamples.filter(g => Math.abs(g.gen - peakGen!) <= 5) : [],
          aroundConvergence: convergenceGen ? varianceSamples.filter(g => Math.abs(g.gen - convergenceGen!) <= 10) : []
        }
      })
    }

    // =====================================================================
    // PER-SEED SUMMARY
    // =====================================================================
    if (seed) {
      const seedNum = parseInt(seed, 10)
      const experiments = await queryAll<any>(
        `SELECT id, experiment_name, experiment_group, status, completed_at
         FROM experiments WHERE random_seed = $1
         ORDER BY experiment_group, experiment_name`, [seedNum]
      )

      // Count converged per group using the dashboard SQL
      const converged = await queryAll<{ experiment_id: string; experiment_group: string; convergence_generation: number }>(
        `WITH gen_data AS (
          SELECT g.experiment_id, e.experiment_group, g.generation_number,
                 g.entropy_variance::float as entropy_variance,
                 ROW_NUMBER() OVER (PARTITION BY g.experiment_id ORDER BY g.generation_number) as rn
          FROM generations g
          JOIN experiments e ON g.experiment_id = e.id
          WHERE e.status = 'COMPLETED' AND e.random_seed = $1
            AND g.entropy_variance IS NOT NULL AND g.generation_number > 5
        ),
        peak_info AS (
          SELECT DISTINCT ON (experiment_id) experiment_id,
                 entropy_variance as peak_variance, generation_number as peak_gen
          FROM gen_data
          WHERE experiment_id IN (
            SELECT experiment_id FROM gen_data GROUP BY experiment_id HAVING MAX(entropy_variance) > 0.0001
          )
          ORDER BY experiment_id, entropy_variance DESC, generation_number ASC
        ),
        after_peak AS (
          SELECT gd.experiment_id, gd.experiment_group, gd.generation_number,
                 CASE WHEN gd.entropy_variance < 0.001 THEN 1 ELSE 0 END as below_threshold
          FROM gen_data gd
          JOIN peak_info pi ON gd.experiment_id = pi.experiment_id
          WHERE gd.generation_number >= pi.peak_gen
        ),
        sliding_window AS (
          SELECT experiment_id, experiment_group, generation_number,
                 SUM(below_threshold) OVER (
                   PARTITION BY experiment_id ORDER BY generation_number
                   ROWS BETWEEN CURRENT ROW AND 19 FOLLOWING
                 ) as below_count,
                 COUNT(*) OVER (
                   PARTITION BY experiment_id ORDER BY generation_number
                   ROWS BETWEEN CURRENT ROW AND 19 FOLLOWING
                 ) as window_size
          FROM after_peak
        )
        SELECT experiment_id, experiment_group, MIN(generation_number)::int as convergence_generation
        FROM sliding_window
        WHERE window_size >= 20 AND below_count >= 18
        GROUP BY experiment_id, experiment_group`,
        [seedNum]
      ) || []

      const convergedIds = new Set(converged.map(c => c.experiment_id))

      return NextResponse.json({
        seed: seedNum,
        totalExperiments: experiments.length,
        completed: experiments.filter((e: any) => e.status === 'COMPLETED').length,
        running: experiments.filter((e: any) => e.status === 'RUNNING').length,
        pending: experiments.filter((e: any) => e.status === 'PENDING').length,
        convergedCount: {
          control: converged.filter(c => c.experiment_group === 'CONTROL').length,
          experimental: converged.filter(c => c.experiment_group === 'EXPERIMENTAL').length
        },
        experiments: experiments.map((e: any) => ({
          id: e.id,
          name: e.experiment_name,
          group: e.experiment_group,
          status: e.status,
          converged: convergedIds.has(e.id),
          convergenceGen: converged.find(c => c.experiment_id === e.id)?.convergence_generation ?? null
        }))
      })
    }

    // =====================================================================
    // GLOBAL SUMMARY (original behavior, simplified)
    // =====================================================================
    const totalCompleted = await queryAll<{ experiment_group: string; cnt: string }>(`
      SELECT experiment_group, COUNT(*) as cnt FROM experiments WHERE status = 'COMPLETED' GROUP BY experiment_group
    `)

    const convergedCounts = await queryAll<{ experiment_group: string; cnt: string }>(`
      WITH gen_data AS (
        SELECT g.experiment_id, e.experiment_group, g.generation_number,
               g.entropy_variance::float as entropy_variance
        FROM generations g
        JOIN experiments e ON g.experiment_id = e.id
        WHERE e.status = 'COMPLETED' AND g.entropy_variance IS NOT NULL AND g.generation_number > 5
      ),
      peak_info AS (
        SELECT DISTINCT ON (experiment_id) experiment_id, generation_number as peak_gen
        FROM gen_data
        WHERE experiment_id IN (SELECT experiment_id FROM gen_data GROUP BY experiment_id HAVING MAX(entropy_variance) > 0.0001)
        ORDER BY experiment_id, entropy_variance DESC, generation_number ASC
      ),
      after_peak AS (
        SELECT gd.experiment_id, gd.experiment_group, gd.generation_number,
               CASE WHEN gd.entropy_variance < 0.001 THEN 1 ELSE 0 END as below_threshold
        FROM gen_data gd JOIN peak_info pi ON gd.experiment_id = pi.experiment_id
        WHERE gd.generation_number >= pi.peak_gen
      ),
      sliding_window AS (
        SELECT experiment_id, experiment_group, generation_number,
               SUM(below_threshold) OVER (PARTITION BY experiment_id ORDER BY generation_number ROWS BETWEEN CURRENT ROW AND 19 FOLLOWING) as below_count,
               COUNT(*) OVER (PARTITION BY experiment_id ORDER BY generation_number ROWS BETWEEN CURRENT ROW AND 19 FOLLOWING) as window_size
        FROM after_peak
      )
      SELECT experiment_group, COUNT(DISTINCT experiment_id)::text as cnt
      FROM sliding_window WHERE window_size >= 20 AND below_count >= 18
      GROUP BY experiment_group
    `)

    return NextResponse.json({
      totalCompleted,
      convergedCounts,
      _usage: {
        perExperiment: '/api/debug-convergence?experiment_id=UUID',
        perSeed: '/api/debug-convergence?seed=63456',
        global: '/api/debug-convergence'
      }
    })
  } catch (error) {
    console.error('Debug convergence error:', error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
