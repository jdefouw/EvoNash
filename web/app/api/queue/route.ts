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
    
    // If worker_id provided, check if worker can accept more jobs
    if (worker_id) {
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
    // Use interleaved ordering: alternate between CONTROL and EXPERIMENTAL experiments
    // This ensures workers process both groups fairly (CONTROL 1, EXPERIMENTAL 1, CONTROL 2, EXPERIMENTAL 2, ...)
    const experiments = await queryAll(
      `WITH ranked_experiments AS (
        SELECT *,
          ROW_NUMBER() OVER (PARTITION BY experiment_group ORDER BY created_at ASC) as group_rank
        FROM experiments
        WHERE status IN ('PENDING', 'RUNNING')
      )
      SELECT * FROM ranked_experiments
      ORDER BY group_rank ASC, experiment_group ASC`
    )
    
    if (!experiments || experiments.length === 0) {
      console.log(`[QUEUE] No PENDING or RUNNING experiments available`)
      return NextResponse.json(
        { error: 'No pending experiments available' },
        { status: 404 }
      )
    }
    
    // Check for both Control and Experimental experiments
    const controlExperiments = experiments.filter((e: any) => e.experiment_group === 'CONTROL')
    const experimentalExperiments = experiments.filter((e: any) => e.experiment_group === 'EXPERIMENTAL')
    const hasBothGroups = controlExperiments.length > 0 && experimentalExperiments.length > 0
    
    // Log the interleaved experiment order
    console.log(`[QUEUE] Interleaved experiment order (${experiments.length} experiments):`)
    console.log(`[QUEUE]   Control: ${controlExperiments.length}, Experimental: ${experimentalExperiments.length}`)
    experiments.slice(0, 10).forEach((exp: any, idx: number) => {
      console.log(`[QUEUE]   ${idx + 1}. ${exp.experiment_name} (${exp.experiment_group})`)
    })
    if (experiments.length > 10) {
      console.log(`[QUEUE]   ... and ${experiments.length - 10} more`)
    }

    // Experiment affinity is DISABLED when both groups have pending work
    // This ensures proper interleaving between Control and Experimental for fair comparison
    // Only use affinity when there's only one group left (to efficiently complete remaining experiments)
    let experimentOrder: any[] = experiments
    if (worker_id && !hasBothGroups) {
      const lastCompletedJob = await queryOne<{ experiment_id: string }>(
        `SELECT experiment_id FROM job_assignments 
         WHERE worker_id = $1 AND status = 'completed' 
         ORDER BY completed_at DESC 
         LIMIT 1`,
        [worker_id]
      )
      const lastExperimentId = lastCompletedJob?.experiment_id
      if (lastExperimentId && experiments.some((e: any) => e.id === lastExperimentId)) {
        const preferred = experiments.find((e: any) => e.id === lastExperimentId)
        const rest = experiments.filter((e: any) => e.id !== lastExperimentId)
        experimentOrder = preferred ? [preferred, ...rest] : experiments
        console.log(`[QUEUE] Experiment affinity (single group): preferring experiment ${lastExperimentId.slice(0, 8)}… for worker ${worker_id.slice(0, 8)}…`)
      }
    } else if (hasBothGroups) {
      console.log(`[QUEUE] Both groups have pending work - using strict interleaving (no affinity)`)
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
      const activeBatches = assignedBatches.filter((b: any) => 
        b.status === 'assigned' || b.status === 'processing'
      )
      
      // Check if the requesting worker has their own active batch (recovery case)
      const ownActiveBatches = worker_id 
        ? activeBatches.filter((b: any) => b.worker_id === worker_id)
        : []
      
      // Check if there are active batches from OTHER workers
      const otherWorkersActiveBatches = activeBatches.filter((b: any) => 
        !worker_id || b.worker_id !== worker_id
      )
      
      if (otherWorkersActiveBatches.length > 0) {
        console.log(`[QUEUE] Experiment ${experiment.id} has active batch from other worker, skipping`)
        console.log(`[QUEUE]   Active: ${otherWorkersActiveBatches.map((b: any) => `gen ${b.generation_start}-${b.generation_end} (worker ${b.worker_id?.slice(0,8)})`).join(', ')}`)
        continue
      }
      
      if (ownActiveBatches.length > 0) {
        // This worker already has an active batch - return existing job
        const existingBatch = ownActiveBatches[0]
        console.log(`[QUEUE] Worker ${worker_id?.slice(0,8)} already has active batch, returning existing job`)
        console.log(`[QUEUE]   Existing job: ${existingBatch.job_id}, gen ${existingBatch.generation_start}-${existingBatch.generation_end}`)
        
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
          job_id: existingBatch.job_id,
          experiment_id: experiment.id,
          worker_id: worker_id,
          generation_start: existingBatch.generation_start,
          generation_end: existingBatch.generation_end,
          experiment_config: config,
          recovery: true
        })
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
