import { NextRequest, NextResponse } from 'next/server'
import { queryOne, queryAll, query } from '@/lib/postgres'
import { ExperimentConfig } from '@/types/protocol'
import crypto from 'crypto'

// Force dynamic rendering since we query the database
export const dynamic = 'force-dynamic'

// Single-shot mode: assign full experiment in one job

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const worker_id = body.worker_id || null

    // Log worker poll attempt with detailed info
    const clientIp = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'
    const userAgent = request.headers.get('user-agent') || 'unknown'
    const timestamp = new Date().toISOString()
    console.log(`[QUEUE] ========================================`)
    console.log(`[QUEUE] Worker poll received at ${timestamp}`)
    console.log(`[QUEUE] Worker ID: ${worker_id || 'unknown'}`)
    console.log(`[QUEUE] Client IP: ${clientIp}`)
    console.log(`[QUEUE] User-Agent: ${userAgent}`)
    console.log(`[QUEUE] ========================================`)

    // CRITICAL: Worker stickiness - a worker with an active job MUST stay with that job
    // A worker should NEVER receive a new job while it has one in progress
    if (worker_id) {
      // Check if worker has ANY active job (assigned or processing) on a non-completed experiment
      const activeJob = await queryOne<{
        job_id: string;
        experiment_id: string;
        generation_start: number;
        generation_end: number;
        status: string;
      }>(
        `SELECT ja.job_id, ja.experiment_id, ja.generation_start, ja.generation_end, ja.status,
                e.experiment_name, e.mutation_mode, e.mutation_rate, e.mutation_base,
                e.max_possible_fitness, e.random_seed, e.population_size, e.selection_pressure,
                e.max_generations, e.ticks_per_generation, e.network_architecture, e.experiment_group
         FROM job_assignments ja
         JOIN experiments e ON e.id = ja.experiment_id
         WHERE ja.worker_id = $1 AND ja.status IN ('assigned', 'processing')
           AND e.status NOT IN ('COMPLETED', 'STOPPED', 'FAILED')
         ORDER BY ja.assigned_at ASC
         LIMIT 1`,
        [worker_id]
      )

      // If worker has jobs on completed experiments, mark them as completed so worker can move on
      // Also decrement the worker's active_jobs_count for each completed job
      const staleJobsResult = await query(
        `UPDATE job_assignments ja
         SET status = 'completed', completed_at = NOW()
         FROM experiments e
         WHERE ja.experiment_id = e.id
           AND ja.worker_id = $1
           AND ja.status IN ('assigned', 'processing')
           AND e.status IN ('COMPLETED', 'STOPPED', 'FAILED')
         RETURNING ja.job_id`,
        [worker_id]
      )

      const staleJobsCount = staleJobsResult.rows?.length || 0
      if (staleJobsCount > 0) {
        // Decrement the worker's active_jobs_count and update status
        await query(
          `UPDATE workers 
           SET active_jobs_count = GREATEST(0, active_jobs_count - $1),
               status = CASE WHEN GREATEST(0, active_jobs_count - $1) = 0 THEN 'idle' ELSE status END,
               last_heartbeat = NOW()
           WHERE id = $2`,
          [staleJobsCount, worker_id]
        )
        console.log(`[QUEUE] Cleaned up ${staleJobsCount} stale jobs from completed experiments for worker ${worker_id?.slice(0, 8)}`)
      }

      if (activeJob) {
        // Worker already has an active job - return that job (recovery/continuation)
        console.log(`[QUEUE] ⚠ Worker ${worker_id?.slice(0, 8)} already has active job, returning existing assignment`)
        console.log(`[QUEUE]   Job ID: ${activeJob.job_id}`)
        console.log(`[QUEUE]   Status: ${activeJob.status}`)
        console.log(`[QUEUE]   Generations: ${activeJob.generation_start}-${activeJob.generation_end}`)

        // Fetch full experiment config for the existing job
        const experiment = await queryOne(
          `SELECT * FROM experiments WHERE id = $1`,
          [activeJob.experiment_id]
        )

        if (experiment) {
          const config: ExperimentConfig = {
            experiment_id: experiment.id,
            experiment_name: experiment.experiment_name,
            mutation_mode: experiment.mutation_mode,
            mutation_rate: experiment.mutation_rate,
            mutation_base: experiment.mutation_base,
            max_possible_fitness: experiment.max_possible_fitness,
            random_seed: experiment.random_seed,
            population_size: experiment.population_size,
            selection_pressure: experiment.selection_pressure,
            max_generations: experiment.max_generations,
            ticks_per_generation: experiment.ticks_per_generation || 750,
            network_architecture: experiment.network_architecture,
            experiment_group: experiment.experiment_group
          }

          return NextResponse.json({
            job_id: activeJob.job_id,
            experiment_id: activeJob.experiment_id,
            worker_id: worker_id,
            generation_start: activeJob.generation_start,
            generation_end: activeJob.generation_end,
            experiment_config: config,
            recovery: true,
            message: 'Worker must complete existing job before receiving new assignments'
          })
        }
      }

      // Check worker capacity (should be at 0 if no active job above)
      const worker = await queryOne<{ max_parallel_jobs: number; active_jobs_count: number; status: string }>(
        'SELECT max_parallel_jobs, active_jobs_count, status FROM workers WHERE id = $1',
        [worker_id]
      )

      if (worker && worker.active_jobs_count >= worker.max_parallel_jobs) {
        console.log(`[QUEUE] Worker ${worker_id} at capacity (${worker.active_jobs_count}/${worker.max_parallel_jobs})`)
        return NextResponse.json(
          { error: 'Worker at capacity' },
          { status: 429 }
        )
      }
    }

    // =========================================================================
    // FOCUSED SEED QUEUE — ONE SEED AT A TIME
    // =========================================================================
    // Strategy: Focus ALL workers on the seed CLOSEST to reaching the current
    // phase target. Once that seed hits the target, move to the next seed.
    //
    // Phase 1 (score 3000+): Get each seed to 10 CTRL + 10 EXP completed
    //   → One seed at a time, closest to 10/10 first
    // Phase 2 (score 2000+): Deepen each seed to 20/20
    // Phase 3 (score 1000+): Deepen each seed to 30/30
    // Phase 4 (score 0): Fill remaining experiments normally
    //
    // Within a seed, the BOTTLENECK group (fewer completions) gets priority
    // so workers don't waste time on the group that's already ahead.
    // =========================================================================
    const experiments = await queryAll(
      `WITH seed_balance AS (
        SELECT
          random_seed,
          COUNT(*) FILTER (WHERE experiment_group = 'CONTROL' AND status IN ('COMPLETED', 'RUNNING')) as ctrl_done,
          COUNT(*) FILTER (WHERE experiment_group = 'EXPERIMENTAL' AND status IN ('COMPLETED', 'RUNNING')) as exp_done
        FROM experiments
        GROUP BY random_seed
      )
      SELECT
        e.*,
        COALESCE(sb.ctrl_done, 0)::int as ctrl_done,
        COALESCE(sb.exp_done, 0)::int as exp_done,
        LEAST(COALESCE(sb.ctrl_done, 0), COALESCE(sb.exp_done, 0))::int as pair_level,
        CASE
          -- ═══════════════════════════════════════════════════════════
          -- PHASE 1: Get to 10/10 — ONE seed at a time
          -- Base 300000. Within phase: closer to target = higher score.
          -- Range: 300000–300099. ALWAYS outranks Phase 2/3/4.
          -- ═══════════════════════════════════════════════════════════
          WHEN LEAST(COALESCE(sb.ctrl_done, 0), COALESCE(sb.exp_done, 0)) < 10
            THEN 300000
              + LEAST(COALESCE(sb.ctrl_done, 0), COALESCE(sb.exp_done, 0)) * 10
              + CASE
                  WHEN e.experiment_group = 'CONTROL'
                       AND COALESCE(sb.ctrl_done, 0) <= COALESCE(sb.exp_done, 0) THEN 1
                  WHEN e.experiment_group = 'EXPERIMENTAL'
                       AND COALESCE(sb.exp_done, 0) <= COALESCE(sb.ctrl_done, 0) THEN 1
                  ELSE 0
                END

          -- ═══════════════════════════════════════════════════════════
          -- PHASE 2: Get to 20/20 — ONE seed at a time
          -- Range: 200000–200299. Always outranks Phase 3/4.
          -- ═══════════════════════════════════════════════════════════
          WHEN LEAST(COALESCE(sb.ctrl_done, 0), COALESCE(sb.exp_done, 0)) < 20
            THEN 200000
              + LEAST(COALESCE(sb.ctrl_done, 0), COALESCE(sb.exp_done, 0)) * 10
              + CASE
                  WHEN e.experiment_group = 'CONTROL'
                       AND COALESCE(sb.ctrl_done, 0) <= COALESCE(sb.exp_done, 0) THEN 1
                  WHEN e.experiment_group = 'EXPERIMENTAL'
                       AND COALESCE(sb.exp_done, 0) <= COALESCE(sb.ctrl_done, 0) THEN 1
                  ELSE 0
                END

          -- ═══════════════════════════════════════════════════════════
          -- PHASE 3: Get to 30/30 — ONE seed at a time
          -- Range: 100000–100299. Always outranks Phase 4.
          -- ═══════════════════════════════════════════════════════════
          WHEN LEAST(COALESCE(sb.ctrl_done, 0), COALESCE(sb.exp_done, 0)) < 30
            THEN 100000
              + LEAST(COALESCE(sb.ctrl_done, 0), COALESCE(sb.exp_done, 0)) * 10
              + CASE
                  WHEN e.experiment_group = 'CONTROL'
                       AND COALESCE(sb.ctrl_done, 0) <= COALESCE(sb.exp_done, 0) THEN 1
                  WHEN e.experiment_group = 'EXPERIMENTAL'
                       AND COALESCE(sb.exp_done, 0) <= COALESCE(sb.ctrl_done, 0) THEN 1
                  ELSE 0
                END

          -- ═══════════════════════════════════════════════════════════
          -- PHASE 4: Normal — fill remaining experiments
          -- ═══════════════════════════════════════════════════════════
          ELSE 0
        END as gap_score
      FROM experiments e
      LEFT JOIN seed_balance sb ON e.random_seed = sb.random_seed
      WHERE e.status IN ('PENDING', 'RUNNING')
      ORDER BY
        gap_score DESC,
        created_at ASC`
    )

    if (!experiments || experiments.length === 0) {
      console.log(`[QUEUE] No PENDING or RUNNING experiments available`)
      return NextResponse.json(
        { error: 'No pending experiments available' },
        { status: 404 }
      )
    }

    // Log available experiments with gap info
    console.log(`[QUEUE] Available experiments: ${experiments.length} (seed-gap prioritized)`)
    experiments.slice(0, 10).forEach((exp: any, idx: number) => {
      console.log(`[QUEUE]   ${idx + 1}. ${exp.experiment_name} (${exp.experiment_group}) [seed=${exp.random_seed}, gap=${exp.gap_score}, ctrl=${exp.ctrl_done}, exp=${exp.exp_done}]`)
    })
    if (experiments.length > 10) {
      console.log(`[QUEUE]   ... and ${experiments.length - 10} more`)
    }

    // EXPERIMENT AFFINITY — but ONLY within the same priority phase
    // If a higher-priority seed needs work, break affinity and reassign.
    let experimentOrder: any[] = experiments

    if (worker_id) {
      // Check what experiment this worker was most recently working on
      const lastWorkerJob = await queryOne<{ experiment_id: string; experiment_group: string }>(
        `SELECT ja.experiment_id, e.experiment_group
         FROM job_assignments ja
         JOIN experiments e ON e.id = ja.experiment_id
         WHERE ja.worker_id = $1 
           AND ja.status = 'completed'
           AND e.status IN ('PENDING', 'RUNNING')
         ORDER BY ja.completed_at DESC
         LIMIT 1`,
        [worker_id]
      )

      if (lastWorkerJob) {
        const affinityExperiment = experiments.find((e: any) => e.id === lastWorkerJob.experiment_id)
        const topExperiment = experiments[0] // already sorted by gap_score DESC

        if (affinityExperiment && topExperiment) {
          const affinityScore = Number(affinityExperiment.gap_score) || 0
          const topScore = Number(topExperiment.gap_score) || 0

          // Only keep affinity if the worker's experiment is in the same priority tier
          // Phase boundaries: 300000 (Phase 1), 200000 (Phase 2), 100000 (Phase 3), 0 (Phase 4)
          const affinityPhase = affinityScore >= 300000 ? 1 : affinityScore >= 200000 ? 2 : affinityScore >= 100000 ? 3 : 4
          const topPhase = topScore >= 300000 ? 1 : topScore >= 200000 ? 2 : topScore >= 100000 ? 3 : 4

          if (affinityPhase <= topPhase) {
            // Affinity experiment is in same or higher priority phase — keep affinity
            const rest = experiments.filter((e: any) => e.id !== lastWorkerJob.experiment_id)
            experimentOrder = [affinityExperiment, ...rest]
            console.log(`[QUEUE] Worker ${worker_id.slice(0, 8)}… keeping affinity for ${affinityExperiment.experiment_name} (phase ${affinityPhase})`)
          } else {
            // Higher priority seed needs work — BREAK affinity
            console.log(`[QUEUE] Worker ${worker_id.slice(0, 8)}… BREAKING affinity: was on phase ${affinityPhase} (${affinityExperiment.experiment_name}), but phase ${topPhase} seed needs work (${topExperiment.experiment_name})`)
            // experimentOrder stays as-is (gap_score sorted)
          }
        }
      }
    }

    // Try to find an unassigned batch for each experiment (affinity order when worker_id set)
    for (const experiment of experimentOrder) {
      // Update status to RUNNING if it was PENDING
      if (experiment.status === 'PENDING') {
        await query(
          'UPDATE experiments SET status = $1 WHERE id = $2',
          ['RUNNING', experiment.id]
        )
        console.log(`[QUEUE] ✓ Updated experiment ${experiment.id} (${experiment.experiment_name}) status: PENDING -> RUNNING`)
      }

      // CRITICAL FIX: Get ALL job assignments to prevent overlapping batches
      let allJobAssignments = await queryAll(
        `SELECT generation_start, generation_end, status, worker_id, assigned_at, started_at, job_id
         FROM job_assignments WHERE experiment_id = $1`,
        [experiment.id]
      ) || []

      // Separate into active vs historical assignments
      let assignedBatches = allJobAssignments.filter((b: any) =>
        b.status === 'assigned' || b.status === 'processing'
      )

      // Recovery: Check for orphaned assignments from offline workers
      if (assignedBatches && assignedBatches.length > 0) {
        const now = new Date()
        const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000)

        // Get worker statuses for assigned batches
        const workerIds = [...new Set(assignedBatches.map((b: any) => b.worker_id))]
        const placeholders = workerIds.map((_: unknown, i: number) => `$${i + 1}`).join(', ')
        const workers = await queryAll(
          `SELECT id, status, last_heartbeat FROM workers WHERE id IN (${placeholders})`,
          workerIds
        ) || []

        const workerMap = new Map((workers || []).map((w: any) => [w.id, w]))
        const ninetySecondsAgo = new Date(now.getTime() - 90 * 1000)

        // Separate batches into: own jobs (can recover) vs other workers' jobs
        const ownBatches: any[] = []
        const otherBatches: any[] = []

        for (const batch of assignedBatches) {
          if (worker_id && batch.worker_id === worker_id) {
            ownBatches.push(batch)
          } else {
            otherBatches.push(batch)
          }
        }

        // Mark orphaned assignments from other workers as failed
        for (const batch of otherBatches) {
          const worker = workerMap.get(batch.worker_id)
          const isWorkerOffline = !worker ||
            (worker.last_heartbeat && new Date(worker.last_heartbeat) < ninetySecondsAgo) ||
            worker.status === 'offline'

          const assignedTime = batch.assigned_at ? new Date(batch.assigned_at) : null
          const startedTime = batch.started_at ? new Date(batch.started_at) : null
          const checkTime = startedTime || assignedTime

          // If worker is offline OR assignment is stuck for > 5 minutes, mark as failed
          if (isWorkerOffline || (checkTime && checkTime < fiveMinutesAgo)) {
            console.log(`[QUEUE] Recovering orphaned assignment: batch ${batch.generation_start}-${batch.generation_end}, worker offline or timeout`)
            await query(
              `UPDATE job_assignments SET status = 'failed' 
               WHERE experiment_id = $1 AND generation_start = $2 AND generation_end = $3 
               AND status IN ('assigned', 'processing')`,
              [experiment.id, batch.generation_start, batch.generation_end]
            )
          }
        }

        // Re-fetch ALL job assignments after recovery
        allJobAssignments = await queryAll(
          `SELECT generation_start, generation_end, status, worker_id, assigned_at, started_at, job_id
           FROM job_assignments WHERE experiment_id = $1`,
          [experiment.id]
        ) || []

        const updatedBatches = allJobAssignments.filter((b: any) =>
          b.status === 'assigned' || b.status === 'processing'
        )

        // If worker is recovering its own jobs, exclude them from the assigned list
        if (worker_id && ownBatches.length > 0) {
          const ownBatchRanges = new Set(ownBatches.map((b: any) =>
            `${b.generation_start}-${b.generation_end}`
          ))
          assignedBatches = updatedBatches.filter((b: any) => {
            const batchKey = `${b.generation_start}-${b.generation_end}`
            return !ownBatchRanges.has(batchKey)
          })
        } else {
          assignedBatches = updatedBatches
        }
      }

      // Get all existing generations to avoid duplicate work
      const existingGenerations = await queryAll<{ generation_number: number }>(
        'SELECT generation_number FROM generations WHERE experiment_id = $1',
        [experiment.id]
      )

      const existingGenerationNumbers = new Set((existingGenerations || []).map((g: any) => g.generation_number))

      // CRITICAL: Enforce SINGLE BATCH per experiment for sequential processing
      // Since generations depend on previous generations, only one batch can be active per experiment
      const activeBatches = assignedBatches.filter((b: any) =>
        b.status === 'assigned' || b.status === 'processing'
      )

      // If there are ANY active batches on this experiment, skip it
      // (Worker stickiness is handled at the top of the function, so if we're here,
      // any active batch belongs to another worker)
      if (activeBatches.length > 0) {
        console.log(`[QUEUE] Experiment ${experiment.id} has active batch, skipping`)
        console.log(`[QUEUE]   Active: ${activeBatches.map((b: any) => `gen ${b.generation_start}-${b.generation_end} (worker ${b.worker_id?.slice(0, 8)})`).join(', ')}`)
        continue
      }

      // Resume support: If generations already exist, check for checkpoint to resume properly
      // Scientific rigor requires continuous population state — can't resume without a checkpoint
      let generationStart = 0
      const generationEnd = experiment.max_generations - 1

      if (existingGenerationNumbers.size > 0) {
        // Find the highest completed generation number
        const maxCompletedGen = Math.max(...existingGenerationNumbers)

        // If all generations are done, mark experiment as COMPLETED and skip
        if (maxCompletedGen + 1 > generationEnd) {
          console.log(`[QUEUE] Experiment ${experiment.id} has all ${existingGenerationNumbers.size} generations completed, marking COMPLETED`)
          await query(
            'UPDATE experiments SET status = $1, completed_at = NOW() WHERE id = $2',
            ['COMPLETED', experiment.id]
          )
          continue
        }

        // Check if a checkpoint exists for the last completed generation
        // The checkpoint contains the population state needed to continue deterministically
        const checkpoint = await queryOne<{ generation_number: number }>(
          `SELECT generation_number FROM experiment_checkpoints 
           WHERE experiment_id = $1 
           ORDER BY generation_number DESC 
           LIMIT 1`,
          [experiment.id]
        )

        if (checkpoint && checkpoint.generation_number >= maxCompletedGen) {
          // Checkpoint exists — resume from after the checkpoint generation
          generationStart = checkpoint.generation_number + 1
          console.log(`[QUEUE] 🔄 Experiment ${experiment.id}: checkpoint found at gen ${checkpoint.generation_number}, resuming from gen ${generationStart}`)
        } else {
          // No valid checkpoint — must restart from generation 0 for scientific rigor
          // Delete all partial generation data so the experiment starts clean
          console.log(`[QUEUE] ⚠ Experiment ${experiment.id}: no valid checkpoint found (has ${existingGenerationNumbers.size} generations). Restarting from gen 0 for scientific rigor.`)
          
          // Delete existing generations for this experiment
          await query(
            'DELETE FROM generations WHERE experiment_id = $1',
            [experiment.id]
          )
          // Delete any partial checkpoints too
          await query(
            'DELETE FROM experiment_checkpoints WHERE experiment_id = $1',
            [experiment.id]
          )
          // Delete any failed job assignments so they don't confuse future logic
          await query(
            `DELETE FROM job_assignments WHERE experiment_id = $1 AND status IN ('failed', 'completed')`,
            [experiment.id]
          )
          console.log(`[QUEUE] 🗑 Cleaned up partial data for experiment ${experiment.id}, starting fresh from gen 0`)
          generationStart = 0
        }
      }

      const job_id = crypto.randomUUID()
      let assignedWorkerId = worker_id

      if (!assignedWorkerId) {
        // Find an available worker
        const availableWorkers = await queryAll(
          `SELECT id, max_parallel_jobs, active_jobs_count, status 
           FROM workers 
           WHERE status IN ('idle', 'processing') 
           ORDER BY active_jobs_count ASC`
        )

        if (availableWorkers && availableWorkers.length > 0) {
          const worker = availableWorkers.find((w: any) =>
            w.active_jobs_count < w.max_parallel_jobs
          )
          if (worker) {
            assignedWorkerId = worker.id
          }
        }
      }

      if (!assignedWorkerId) {
        console.log(`[QUEUE] No available workers for experiment ${experiment.id}`)
        continue
      }

      try {
        const result = await query(
          `INSERT INTO job_assignments (experiment_id, worker_id, generation_start, generation_end, status, job_id)
           VALUES ($1, $2, $3, $4, $5, $6)
           RETURNING *`,
          [experiment.id, assignedWorkerId, generationStart, generationEnd, 'assigned', job_id]
        )

        if (result.rows.length === 0) {
          console.error(`[QUEUE] Failed to create job assignment`)
          continue
        }

        const config: ExperimentConfig = {
          experiment_id: experiment.id,
          experiment_name: experiment.experiment_name,
          mutation_mode: experiment.mutation_mode,
          mutation_rate: experiment.mutation_rate,
          mutation_base: experiment.mutation_base,
          max_possible_fitness: experiment.max_possible_fitness,
          random_seed: experiment.random_seed,
          population_size: experiment.population_size,
          selection_pressure: experiment.selection_pressure,
          max_generations: experiment.max_generations,
          ticks_per_generation: experiment.ticks_per_generation || 750,
          network_architecture: experiment.network_architecture,
          experiment_group: experiment.experiment_group
        }

        console.log(`[QUEUE] ✓ Assigned full experiment to worker:`)
        console.log(`[QUEUE]   Job ID: ${job_id}`)
        console.log(`[QUEUE]   Experiment ID: ${experiment.id}`)
        console.log(`[QUEUE]   Worker ID: ${assignedWorkerId}`)
        console.log(`[QUEUE]   Generations: ${generationStart}-${generationEnd}`)
        console.log(`[QUEUE] ========================================`)

        return NextResponse.json({
          job_id,
          experiment_id: experiment.id,
          worker_id: assignedWorkerId,
          generation_start: generationStart,
          generation_end: generationEnd,
          experiment_config: config,
          resume_checkpoint: generationStart > 0  // Worker should load checkpoint before starting
        })
      } catch (insertError: any) {
        console.error(`[QUEUE] Failed to create job assignment: ${insertError.message}`)
        continue
      }
    }

    // No unassigned batches found
    console.log(`[QUEUE] No unassigned batches available`)
    return NextResponse.json(
      { error: 'No unassigned batches available' },
      { status: 404 }
    )
  } catch (error: any) {
    console.error(`[QUEUE] Error processing job request:`, error)
    return NextResponse.json(
      { error: 'Failed to process job request', details: error?.message || String(error) },
      { status: 500 }
    )
  }
}
