import { NextRequest, NextResponse } from 'next/server'
import { queryOne, queryAll, query } from '@/lib/postgres'
import { ExperimentConfig } from '@/types/protocol'

// Force dynamic rendering since we query the database
export const dynamic = 'force-dynamic'

// Default batch size: 10 generations per batch
const DEFAULT_BATCH_SIZE = 10

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
                e.max_possible_elo, e.random_seed, e.population_size, e.selection_pressure,
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
        console.log(`[QUEUE] Cleaned up ${staleJobsCount} stale jobs from completed experiments for worker ${worker_id?.slice(0,8)}`)
      }
      
      if (activeJob) {
        // Worker already has an active job - return that job (recovery/continuation)
        console.log(`[QUEUE] ⚠ Worker ${worker_id?.slice(0,8)} already has active job, returning existing assignment`)
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
            max_possible_elo: experiment.max_possible_elo,
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
    
    // Find experiments with status PENDING or RUNNING
    // IMPORTANT: Never assign jobs from COMPLETED, FAILED, or STOPPED experiments
    const experiments = await queryAll(
      `SELECT * FROM experiments
       WHERE status IN ('PENDING', 'RUNNING')
       ORDER BY created_at ASC`
    )
    
    if (!experiments || experiments.length === 0) {
      console.log(`[QUEUE] No PENDING or RUNNING experiments available`)
      return NextResponse.json(
        { error: 'No pending experiments available' },
        { status: 404 }
      )
    }
    
    // Log available experiments
    console.log(`[QUEUE] Available experiments: ${experiments.length}`)
    experiments.slice(0, 10).forEach((exp: any, idx: number) => {
      console.log(`[QUEUE]   ${idx + 1}. ${exp.experiment_name} (${exp.experiment_group})`)
    })
    if (experiments.length > 10) {
      console.log(`[QUEUE]   ... and ${experiments.length - 10} more`)
    }

    // EXPERIMENT AFFINITY: Workers should complete their current experiment before moving to another
    // This is the KEY fix - workers stay on the same experiment until it's done
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
        // Worker was recently working on an experiment that still needs work
        // Put that experiment FIRST so they continue with it
        const affinityExperiment = experiments.find((e: any) => e.id === lastWorkerJob.experiment_id)
        if (affinityExperiment) {
          const rest = experiments.filter((e: any) => e.id !== lastWorkerJob.experiment_id)
          experimentOrder = [affinityExperiment, ...rest]
          console.log(`[QUEUE] Worker ${worker_id.slice(0, 8)}… has affinity for ${affinityExperiment.experiment_name}, prioritizing it`)
        }
      } else {
        // Worker doesn't have recent affinity - use group balancing for initial assignment
        // Count workers per group to balance initial assignments
        const activeWorkersByGroup = await queryAll<{ experiment_group: string; worker_count: number }>(
          `SELECT e.experiment_group, COUNT(DISTINCT ja.worker_id) as worker_count
           FROM job_assignments ja
           JOIN experiments e ON e.id = ja.experiment_id
           WHERE ja.status IN ('assigned', 'processing')
           AND e.status IN ('PENDING', 'RUNNING')
           GROUP BY e.experiment_group`
        ) || []
        
        const controlExperiments = experiments.filter((e: any) => e.experiment_group === 'CONTROL')
        const experimentalExperiments = experiments.filter((e: any) => e.experiment_group === 'EXPERIMENTAL')
        const hasBothGroups = controlExperiments.length > 0 && experimentalExperiments.length > 0
        
        if (hasBothGroups) {
          const controlWorkers = activeWorkersByGroup.find((g: any) => g.experiment_group === 'CONTROL')?.worker_count || 0
          const experimentalWorkers = activeWorkersByGroup.find((g: any) => g.experiment_group === 'EXPERIMENTAL')?.worker_count || 0
          
          console.log(`[QUEUE] No affinity, balancing: CONTROL=${controlWorkers} workers, EXPERIMENTAL=${experimentalWorkers} workers`)
          
          // Assign to group with fewer workers
          const preferredGroup = controlWorkers <= experimentalWorkers ? 'CONTROL' : 'EXPERIMENTAL'
          const preferredExperiments = experiments.filter((e: any) => e.experiment_group === preferredGroup)
          const otherExperiments = experiments.filter((e: any) => e.experiment_group !== preferredGroup)
          experimentOrder = [...preferredExperiments, ...otherExperiments]
          console.log(`[QUEUE] Preferring ${preferredGroup} group for new worker`)
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
        console.log(`[QUEUE]   Active: ${activeBatches.map((b: any) => `gen ${b.generation_start}-${b.generation_end} (worker ${b.worker_id?.slice(0,8)})`).join(', ')}`)
        continue
      }
      
      // Calculate which generations have EVER been claimed
      const activeOrPendingRanges = allJobAssignments
        .filter((r: any) => r.status === 'assigned' || r.status === 'processing')
        .map((b: any) => ({
          start: b.generation_start,
          end: b.generation_end,
          status: b.status,
          job_id: b.job_id
        }))
      
      // EFFICIENT BATCH ASSIGNMENT: Start from last completed generation
      const batchSize = DEFAULT_BATCH_SIZE
      
      // Query the highest completed generation number
      const lastGeneration = await queryOne<{ generation_number: number }>(
        `SELECT generation_number FROM generations 
         WHERE experiment_id = $1 
         ORDER BY generation_number DESC 
         LIMIT 1`,
        [experiment.id]
      )
      
      const lastCompletedGen = lastGeneration?.generation_number ?? -1
      
      // Start from the next generation after last completed, aligned to batch boundary
      let generationStart = lastCompletedGen + 1
      generationStart = Math.floor(generationStart / batchSize) * batchSize
      
      console.log(`[QUEUE] Experiment ${experiment.id}: last completed gen=${lastCompletedGen}, starting search at gen=${generationStart}`)
      
      let foundBatch = false
      
      while (generationStart < experiment.max_generations) {
        const generationEnd = Math.min(generationStart + batchSize - 1, experiment.max_generations - 1)
        
        // Check if this range overlaps with any ACTIVE assignment
        const isActivelyAssigned = activeOrPendingRanges.some((range: any) => 
          !(generationEnd < range.start || generationStart > range.end)
        )
        
        // Check if all generations in this range already exist
        const allGenerationsExist = Array.from({ length: generationEnd - generationStart + 1 }, (_, i) => generationStart + i)
          .every(genNum => existingGenerationNumbers.has(genNum))
        
        if (!isActivelyAssigned && !allGenerationsExist) {
          foundBatch = true
          
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
          
          // Create job assignment
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
            
            // Create experiment config for worker
            const config: ExperimentConfig = {
              experiment_id: experiment.id,
              experiment_name: experiment.experiment_name,
              mutation_mode: experiment.mutation_mode,
              mutation_rate: experiment.mutation_rate,
              mutation_base: experiment.mutation_base,
              max_possible_elo: experiment.max_possible_elo,
              random_seed: experiment.random_seed,
              population_size: experiment.population_size,
              selection_pressure: experiment.selection_pressure,
              max_generations: experiment.max_generations,
              ticks_per_generation: experiment.ticks_per_generation || 750,
              network_architecture: experiment.network_architecture,
              experiment_group: experiment.experiment_group
            }
            
            console.log(`[QUEUE] ✓ Assigned batch to worker:`)
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
              experiment_config: config
            })
          } catch (insertError: any) {
            // Check if error is due to overlapping batch constraint
            if (insertError.message?.includes('overlapping') || insertError.message?.includes('already active')) {
              console.log(`[QUEUE] Batch ${generationStart}-${generationEnd} overlaps with existing batch (race condition prevented)`)
              break
            }
            console.error(`[QUEUE] Failed to create job assignment: ${insertError.message}`)
            continue
          }
        }
        
        generationStart += batchSize
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
