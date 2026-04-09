import { NextResponse } from 'next/server'
import { queryAll } from '@/lib/postgres'

export const dynamic = 'force-dynamic'

/**
 * Diagnostic endpoint to investigate why experimental convergence count is low.
 * Checks each stage of the convergence detection pipeline.
 */
export async function GET() {
  try {
    // 1. Total completed experiments per group
    const totalCompleted = await queryAll<{ experiment_group: string; cnt: string }>(`
      SELECT experiment_group, COUNT(*) as cnt
      FROM experiments
      WHERE status = 'COMPLETED'
      GROUP BY experiment_group
    `)

    // 2. Experiments with entropy_variance data (after gen 5)
    const hasVarianceData = await queryAll<{ experiment_group: string; cnt: string }>(`
      SELECT e.experiment_group, COUNT(DISTINCT g.experiment_id) as cnt
      FROM generations g
      JOIN experiments e ON g.experiment_id = e.id
      WHERE e.status = 'COMPLETED'
        AND g.entropy_variance IS NOT NULL
        AND g.generation_number > 5
      GROUP BY e.experiment_group
    `)

    // 3. Experiments with peak variance > 0.0001 (divergence requirement)
    const hasPeakDivergence = await queryAll<{ experiment_group: string; cnt: string }>(`
      SELECT e.experiment_group, COUNT(DISTINCT g.experiment_id) as cnt
      FROM generations g
      JOIN experiments e ON g.experiment_id = e.id
      WHERE e.status = 'COMPLETED'
        AND g.entropy_variance IS NOT NULL
        AND g.generation_number > 5
      GROUP BY e.experiment_group
      HAVING MAX(g.entropy_variance) > 0.0001
    `)

    // Better query for peak divergence - per experiment
    const hasPeakDivergencePerExp = await queryAll<{ experiment_group: string; cnt: string }>(`
      WITH exp_peaks AS (
        SELECT g.experiment_id, e.experiment_group, MAX(g.entropy_variance) as max_var
        FROM generations g
        JOIN experiments e ON g.experiment_id = e.id
        WHERE e.status = 'COMPLETED'
          AND g.entropy_variance IS NOT NULL
          AND g.generation_number > 5
        GROUP BY g.experiment_id, e.experiment_group
      )
      SELECT experiment_group, COUNT(*) as cnt
      FROM exp_peaks
      WHERE max_var > 0.0001
      GROUP BY experiment_group
    `)

    // 4. After peak, how many generations are below threshold per experiment?
    const postPeakStats = await queryAll<{
      experiment_group: string
      experiment_id: string
      total_after_peak: string
      below_threshold: string
      max_consecutive_below: string
    }>(`
      WITH gen_data AS (
        SELECT g.experiment_id, e.experiment_group, g.generation_number,
               g.entropy_variance::float as entropy_variance
        FROM generations g
        JOIN experiments e ON g.experiment_id = e.id
        WHERE e.status = 'COMPLETED'
          AND g.entropy_variance IS NOT NULL
          AND g.generation_number > 5
      ),
      peak_info AS (
        SELECT DISTINCT ON (experiment_id)
          experiment_id, generation_number as peak_gen
        FROM gen_data
        WHERE experiment_id IN (
          SELECT experiment_id FROM gen_data
          GROUP BY experiment_id
          HAVING MAX(entropy_variance) > 0.0001
        )
        ORDER BY experiment_id, entropy_variance DESC, generation_number ASC
      ),
      after_peak AS (
        SELECT gd.experiment_id, gd.experiment_group, gd.generation_number,
               CASE WHEN gd.entropy_variance >= 0.001 THEN 1 ELSE 0 END as above_threshold
        FROM gen_data gd
        JOIN peak_info pi ON gd.experiment_id = pi.experiment_id
        WHERE gd.generation_number >= pi.peak_gen
      ),
      islands AS (
        SELECT experiment_id, experiment_group, generation_number, above_threshold,
               SUM(above_threshold) OVER (PARTITION BY experiment_id ORDER BY generation_number) as island_id
        FROM after_peak
      ),
      run_lengths AS (
        SELECT experiment_id, experiment_group, island_id,
               COUNT(*) as run_length
        FROM islands
        WHERE above_threshold = 0
        GROUP BY experiment_id, experiment_group, island_id
      )
      SELECT experiment_group, experiment_id,
             (SELECT COUNT(*) FROM after_peak ap WHERE ap.experiment_id = rl.experiment_id) as total_after_peak,
             (SELECT COUNT(*) FROM after_peak ap WHERE ap.experiment_id = rl.experiment_id AND ap.above_threshold = 0) as below_threshold,
             MAX(run_length) as max_consecutive_below
      FROM run_lengths rl
      GROUP BY experiment_group, experiment_id
      ORDER BY experiment_group, max_consecutive_below ASC
      LIMIT 50
    `)

    // 5. Distribution of max consecutive below-threshold runs per group
    const consecutiveDistribution = await queryAll<{
      experiment_group: string
      bucket: string
      cnt: string
    }>(`
      WITH gen_data AS (
        SELECT g.experiment_id, e.experiment_group, g.generation_number,
               g.entropy_variance::float as entropy_variance
        FROM generations g
        JOIN experiments e ON g.experiment_id = e.id
        WHERE e.status = 'COMPLETED'
          AND g.entropy_variance IS NOT NULL
          AND g.generation_number > 5
      ),
      peak_info AS (
        SELECT DISTINCT ON (experiment_id)
          experiment_id, generation_number as peak_gen
        FROM gen_data
        WHERE experiment_id IN (
          SELECT experiment_id FROM gen_data
          GROUP BY experiment_id
          HAVING MAX(entropy_variance) > 0.0001
        )
        ORDER BY experiment_id, entropy_variance DESC, generation_number ASC
      ),
      after_peak AS (
        SELECT gd.experiment_id, gd.experiment_group, gd.generation_number,
               CASE WHEN gd.entropy_variance >= 0.001 THEN 1 ELSE 0 END as above_threshold
        FROM gen_data gd
        JOIN peak_info pi ON gd.experiment_id = pi.experiment_id
        WHERE gd.generation_number >= pi.peak_gen
      ),
      islands AS (
        SELECT experiment_id, experiment_group, generation_number, above_threshold,
               SUM(above_threshold) OVER (PARTITION BY experiment_id ORDER BY generation_number) as island_id
        FROM after_peak
      ),
      max_runs AS (
        SELECT experiment_id, experiment_group,
               MAX(run_length) as max_run
        FROM (
          SELECT experiment_id, experiment_group, island_id, COUNT(*) as run_length
          FROM islands
          WHERE above_threshold = 0
          GROUP BY experiment_id, experiment_group, island_id
        ) sub
        GROUP BY experiment_id, experiment_group
      )
      SELECT experiment_group,
             CASE
               WHEN max_run >= 20 THEN '20+ (converged)'
               WHEN max_run >= 15 THEN '15-19'
               WHEN max_run >= 10 THEN '10-14'
               WHEN max_run >= 5 THEN '5-9'
               ELSE '0-4'
             END as bucket,
             COUNT(*) as cnt
      FROM max_runs
      GROUP BY experiment_group, bucket
      ORDER BY experiment_group, bucket
    `)

    // 6. Check for generation gaps (missing generation numbers)
    const generationGaps = await queryAll<{
      experiment_group: string
      avg_gap_count: string
      max_gap_count: string
      experiments_with_gaps: string
    }>(`
      WITH gen_sequences AS (
        SELECT g.experiment_id, e.experiment_group, g.generation_number,
               LAG(g.generation_number) OVER (PARTITION BY g.experiment_id ORDER BY g.generation_number) as prev_gen,
               g.generation_number - LAG(g.generation_number) OVER (PARTITION BY g.experiment_id ORDER BY g.generation_number) as gap
        FROM generations g
        JOIN experiments e ON g.experiment_id = e.id
        WHERE e.status = 'COMPLETED'
          AND g.entropy_variance IS NOT NULL
      ),
      gap_counts AS (
        SELECT experiment_id, experiment_group, COUNT(*) as gap_count
        FROM gen_sequences
        WHERE gap > 1
        GROUP BY experiment_id, experiment_group
      )
      SELECT experiment_group,
             ROUND(AVG(gap_count))::text as avg_gap_count,
             MAX(gap_count)::text as max_gap_count,
             COUNT(*)::text as experiments_with_gaps
      FROM gap_counts
      GROUP BY experiment_group
    `)

    // 7. Avg total generations per experiment per group
    const avgGenerations = await queryAll<{ experiment_group: string; avg_gens: string; min_gens: string; max_gens: string }>(`
      SELECT e.experiment_group,
             ROUND(AVG(gen_count))::text as avg_gens,
             MIN(gen_count)::text as min_gens,
             MAX(gen_count)::text as max_gens
      FROM (
        SELECT g.experiment_id, COUNT(*) as gen_count
        FROM generations g
        JOIN experiments e ON g.experiment_id = e.id
        WHERE e.status = 'COMPLETED'
        GROUP BY g.experiment_id, e.experiment_group
      ) sub
      JOIN experiments e ON sub.experiment_id = e.id
      GROUP BY e.experiment_group
    `)

    // 8. Experiments that have peak but fail to get 20 consecutive below threshold
    // Check specifically: do they have enough gens after peak?
    const failedConvergence = await queryAll<{
      experiment_group: string
      cnt: string
      avg_gens_after_peak: string
      min_gens_after_peak: string
    }>(`
      WITH gen_data AS (
        SELECT g.experiment_id, e.experiment_group, g.generation_number,
               g.entropy_variance::float as entropy_variance
        FROM generations g
        JOIN experiments e ON g.experiment_id = e.id
        WHERE e.status = 'COMPLETED'
          AND g.entropy_variance IS NOT NULL
          AND g.generation_number > 5
      ),
      peak_info AS (
        SELECT DISTINCT ON (experiment_id)
          experiment_id, generation_number as peak_gen
        FROM gen_data
        WHERE experiment_id IN (
          SELECT experiment_id FROM gen_data
          GROUP BY experiment_id
          HAVING MAX(entropy_variance) > 0.0001
        )
        ORDER BY experiment_id, entropy_variance DESC, generation_number ASC
      ),
      after_peak_counts AS (
        SELECT gd.experiment_id, gd.experiment_group,
               COUNT(*) as gens_after_peak
        FROM gen_data gd
        JOIN peak_info pi ON gd.experiment_id = pi.experiment_id
        WHERE gd.generation_number >= pi.peak_gen
        GROUP BY gd.experiment_id, gd.experiment_group
      ),
      converged AS (
        -- Same convergence query
        SELECT DISTINCT experiment_id
        FROM (
          SELECT experiment_id, island_id, COUNT(*) as run_length
          FROM (
            SELECT gd.experiment_id,
                   CASE WHEN gd.entropy_variance >= 0.001 THEN 1 ELSE 0 END as above_threshold,
                   SUM(CASE WHEN gd.entropy_variance >= 0.001 THEN 1 ELSE 0 END) OVER (
                     PARTITION BY gd.experiment_id ORDER BY gd.generation_number
                   ) as island_id
            FROM gen_data gd
            JOIN peak_info pi ON gd.experiment_id = pi.experiment_id
            WHERE gd.generation_number >= pi.peak_gen
          ) sub
          WHERE above_threshold = 0
          GROUP BY experiment_id, island_id
          HAVING COUNT(*) >= 20
        ) converged_runs
      )
      SELECT apc.experiment_group,
             COUNT(*) as cnt,
             ROUND(AVG(apc.gens_after_peak))::text as avg_gens_after_peak,
             MIN(apc.gens_after_peak)::text as min_gens_after_peak
      FROM after_peak_counts apc
      WHERE apc.experiment_id NOT IN (SELECT experiment_id FROM converged)
      GROUP BY apc.experiment_group
    `)

    return NextResponse.json({
      totalCompleted,
      hasVarianceData,
      hasPeakDivergencePerExp,
      consecutiveDistribution,
      generationGaps,
      avgGenerations,
      failedConvergence,
      _note: "This endpoint diagnoses why experimental convergence count is lower than expected"
    })
  } catch (error) {
    console.error('Debug convergence error:', error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
