// Shared convergence-detection SQL building blocks used by /api/queue and
// /api/experiments/topup-seeds. Centralizing this means the queue's priority
// and the topup's shortfall calculation are guaranteed to use the same
// definition of "converged" as the dashboard (web/app/api/dashboard/route.ts).
//
// Convergence definition (matches dashboard):
//   1. Skip first 5 generations.
//   2. Find peak entropy_variance per experiment. Require peak > 0.0001
//      (experiment must have diverged at some point).
//   3. From the peak forward, slide a 10-generation window. The first window
//      where >= 8 of 10 entropy_variance values are below 0.001 marks the
//      convergence generation.
//   4. The CTE produces one row per converged experiment.

export const CONVERGENCE_THRESHOLD = 0.001
export const STABILITY_WINDOW = 10
export const MIN_BELOW_THRESHOLD = 8

/**
 * SQL fragment: a chain of CTEs ending in `converged_runs` which produces
 * `(experiment_id, experiment_group, random_seed)` for every converged
 * experiment. Caller is expected to write `WITH ${CONVERGED_RUNS_CTES}`
 * followed by their own SELECT.
 */
export const CONVERGED_RUNS_CTES = `
gen_data AS (
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
converged_runs AS (
  SELECT DISTINCT
    experiment_id,
    experiment_group,
    random_seed
  FROM sliding_window
  WHERE window_size >= ${STABILITY_WINDOW}
    AND below_count >= ${MIN_BELOW_THRESHOLD}
)
`.trim()
