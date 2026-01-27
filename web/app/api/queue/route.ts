import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { ExperimentConfig } from '@/types/protocol'

// Force dynamic rendering since we query the database
export const dynamic = 'force-dynamic'

// Default batch size: 10 generations per batch
const DEFAULT_BATCH_SIZE = 10

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient()
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
      const { data: worker } = await supabase
        .from('workers')
        .select('max_parallel_jobs, active_jobs_count, status')
        .eq('id', worker_id)
        .single()
      
      if (worker && worker.active_jobs_count >= worker.max_parallel_jobs) {
        console.log(`[QUEUE] Worker ${worker_id} at capacity (${worker.active_jobs_count}/${worker.max_parallel_jobs})`)
        return NextResponse.json(
          { error: 'Worker at capacity' },
          { status: 429 }
        )
      }
    }
    
    // Find experiments with status PENDING or RUNNING
    const { data: experiments, error: fetchError } = await supabase
      .from('experiments')
      .select('*')
      .in('status', ['PENDING', 'RUNNING'])
      .order('created_at', { ascending: true })
    
    if (fetchError || !experiments || experiments.length === 0) {
      console.log(`[QUEUE] No PENDING or RUNNING experiments available`)
      return NextResponse.json(
        { error: 'No pending experiments available' },
        { status: 404 }
      )
    }

    // Experiment affinity: when worker has no active batch, prefer the experiment they last completed a job for
    // So workers finish one experiment before switching to another
    let experimentOrder: typeof experiments = experiments
    if (worker_id) {
      const { data: lastCompletedJob } = await supabase
        .from('job_assignments')
        .select('experiment_id')
        .eq('worker_id', worker_id)
        .eq('status', 'completed')
        .order('completed_at', { ascending: false })
        .limit(1)
        .single()
      const lastExperimentId = lastCompletedJob?.experiment_id
      if (lastExperimentId && experiments.some((e: any) => e.id === lastExperimentId)) {
        const preferred = experiments.find((e: any) => e.id === lastExperimentId)
        const rest = experiments.filter((e: any) => e.id !== lastExperimentId)
        experimentOrder = preferred ? [preferred, ...rest] : experiments
        console.log(`[QUEUE] Experiment affinity: preferring experiment ${lastExperimentId.slice(0, 8)}… for worker ${worker_id.slice(0, 8)}…`)
      }
    }

    // Try to find an unassigned batch for each experiment (affinity order when worker_id set)
    for (const experiment of experimentOrder) {
      // Update status to RUNNING if it was PENDING
      if (experiment.status === 'PENDING') {
        const { error: statusError } = await supabase
          .from('experiments')
          .update({ status: 'RUNNING' })
          .eq('id', experiment.id)
        
        if (statusError) {
          console.error(`[QUEUE] Failed to update experiment ${experiment.id} status to RUNNING:`, statusError)
        } else {
          console.log(`[QUEUE] ✓ Updated experiment ${experiment.id} (${experiment.experiment_name}) status: PENDING -> RUNNING`)
        }
      }
      
      // CRITICAL FIX: Get ALL job assignments to prevent overlapping batches
      // This includes 'assigned', 'processing', 'completed', and 'failed' statuses
      // We need to know what ranges have EVER been claimed, not just currently active
      const { data: fetchedJobAssignments } = await supabase
        .from('job_assignments')
        .select('generation_start, generation_end, status, worker_id, assigned_at, started_at, job_id')
        .eq('experiment_id', experiment.id)
      
      // Ensure we have a non-null array to work with
      let allJobAssignments: any[] = fetchedJobAssignments || []
      
      // Separate into active vs historical assignments
      const initialAssignedBatches = allJobAssignments.filter((b: any) => 
        b.status === 'assigned' || b.status === 'processing'
      )
      
      let assignedBatches = initialAssignedBatches || []
      
      // Recovery: Check for orphaned assignments from offline workers
      // Also allow workers to recover their own jobs
      if (assignedBatches && assignedBatches.length > 0) {
        const now = new Date()
        const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000) // 5 minutes timeout
        
        // Get worker statuses for assigned batches
        const workerIds = [...new Set(assignedBatches.map((b: any) => b.worker_id))]
        const { data: workers } = await supabase
          .from('workers')
          .select('id, status, last_heartbeat')
          .in('id', workerIds)
        
        const workerMap = new Map((workers || []).map((w: any) => [w.id, w]))
        // 90 seconds timeout for worker offline detection (as per scientific rigor requirements)
        const ninetySecondsAgo = new Date(now.getTime() - 90 * 1000)
        
        // Separate batches into: own jobs (can recover) vs other workers' jobs (check for orphaned)
        const ownBatches: any[] = []
        const otherBatches: any[] = []
        
        for (const batch of assignedBatches) {
          if (worker_id && batch.worker_id === worker_id) {
            // This is the requesting worker's own job - allow recovery
            ownBatches.push(batch)
          } else {
            // This is another worker's job - check if orphaned
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
            await supabase
              .from('job_assignments')
              .update({ status: 'failed' })
              .eq('experiment_id', experiment.id)
              .eq('generation_start', batch.generation_start)
              .eq('generation_end', batch.generation_end)
              .in('status', ['assigned', 'processing'])
          }
        }
        
        // Re-fetch ALL job assignments after recovery to get accurate state
        const { data: updatedAllAssignments } = await supabase
          .from('job_assignments')
          .select('generation_start, generation_end, status, worker_id, assigned_at, started_at, job_id')
          .eq('experiment_id', experiment.id)
        
        // Update allJobAssignments with fresh data
        // (we'll use this below to prevent overlapping batch assignments)
        allJobAssignments = updatedAllAssignments || []
        
        const updatedBatches = (updatedAllAssignments || []).filter((b: any) => 
          b.status === 'assigned' || b.status === 'processing'
        )
        
        // If worker is recovering its own jobs, exclude them from the assigned list
        if (worker_id && ownBatches.length > 0) {
          const ownBatchRanges = new Set(ownBatches.map((b: any) => 
            `${b.generation_start}-${b.generation_end}`
          ))
          assignedBatches = updatedBatches.filter((b: any) => {
            // Exclude batches that match the worker's own jobs (allow recovery)
            const batchKey = `${b.generation_start}-${b.generation_end}`
            return !ownBatchRanges.has(batchKey)
          })
        } else {
          assignedBatches = updatedBatches
        }
      }
      
      // Get last completed generation from checkpoints
      const { data: latestCheckpoint } = await supabase
        .from('experiment_checkpoints')
        .select('generation_number')
        .eq('experiment_id', experiment.id)
        .order('generation_number', { ascending: false })
        .limit(1)
        .single()
      
      // Get all existing generations to avoid duplicate work
      const { data: existingGenerations } = await supabase
        .from('generations')
        .select('generation_number')
        .eq('experiment_id', experiment.id)
      
      const existingGenerationNumbers = new Set((existingGenerations || []).map((g: any) => g.generation_number))
      
      // CRITICAL: Enforce SINGLE BATCH per experiment for sequential processing
      // Genetic algorithms REQUIRE sequential processing - generation N depends on generation N-1
      // Therefore, only ONE batch can be active at a time, regardless of worker
      const activeBatches = (assignedBatches || []).filter((b: any) => 
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
        // Another worker has an active batch - DO NOT assign a new one
        // This strictly enforces sequential processing
        console.log(`[QUEUE] Experiment ${experiment.id} has active batch from other worker, skipping`)
        console.log(`[QUEUE]   Active: ${otherWorkersActiveBatches.map((b: any) => `gen ${b.generation_start}-${b.generation_end} (worker ${b.worker_id?.slice(0,8)})`).join(', ')}`)
        continue // Try next experiment
      }
      
      if (ownActiveBatches.length > 0) {
        // This worker already has an active batch - they should complete it first
        // Return their existing batch info instead of creating a new one
        const existingBatch = ownActiveBatches[0]
        console.log(`[QUEUE] Worker ${worker_id?.slice(0,8)} already has active batch, returning existing job`)
        console.log(`[QUEUE]   Existing job: ${existingBatch.job_id}, gen ${existingBatch.generation_start}-${existingBatch.generation_end}`)
        
        // Return the existing job assignment
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
          recovery: true  // Flag to indicate this is a recovery, not a new assignment
        })
      }
      
      // CRITICAL: Calculate which generations have EVER been claimed by ANY assignment
      // This prevents overlapping batches even when jobs are released/failed
      // Include ALL statuses: assigned, processing, completed, failed
      const allClaimedRanges: Array<{start: number, end: number, status: string, job_id: string}> = 
        (allJobAssignments || []).map((b: any) => ({
          start: b.generation_start,
          end: b.generation_end,
          status: b.status,
          job_id: b.job_id
        }))
      
      // For overlap prevention, only exclude completed ranges where all generations exist
      // Failed ranges need to be retried, but we should find the NEXT unclaimed range
      const activeOrPendingRanges = allClaimedRanges.filter(r => 
        r.status === 'assigned' || r.status === 'processing'
      )
      
      // EFFICIENT BATCH ASSIGNMENT: Start from last completed generation, not from 0
      // This prevents assigning batches for already-completed ranges
      const batchSize = DEFAULT_BATCH_SIZE
      
      // Query the highest completed generation number
      const { data: lastGeneration } = await supabase
        .from('generations')
        .select('generation_number')
        .eq('experiment_id', experiment.id)
        .order('generation_number', { ascending: false })
        .limit(1)
        .single()
      
      const lastCompletedGen = lastGeneration?.generation_number ?? -1
      
      // Start from the next generation after last completed, aligned to batch boundary
      let generationStart = lastCompletedGen + 1
      // Align to batch boundary (e.g., if last completed is 1005, start at 1010 not 1006)
      generationStart = Math.floor(generationStart / batchSize) * batchSize
      
      console.log(`[QUEUE] Experiment ${experiment.id}: last completed gen=${lastCompletedGen}, starting search at gen=${generationStart}`)
      
      let foundBatch = false
      
      while (generationStart < experiment.max_generations) {
        const generationEnd = Math.min(generationStart + batchSize - 1, experiment.max_generations - 1)
        
        // Check if this range overlaps with any ACTIVE assignment (assigned or processing)
        const isActivelyAssigned = activeOrPendingRanges.some(range => 
          !(generationEnd < range.start || generationStart > range.end)
        )
        
        // Check if all generations in this range already exist in the database
        const allGenerationsExist = Array.from({ length: generationEnd - generationStart + 1 }, (_, i) => generationStart + i)
          .every(genNum => existingGenerationNumbers.has(genNum))
        
        if (!isActivelyAssigned && !allGenerationsExist) {
          // Found an unassigned batch!
          foundBatch = true
          
          // Generate job ID
          const job_id = crypto.randomUUID()
          
          // Get or create worker_id (if not provided, we'll need to assign to a worker)
          let assignedWorkerId = worker_id
          
          if (!assignedWorkerId) {
            // Find an available worker
            const { data: availableWorkers } = await supabase
              .from('workers')
              .select('id, max_parallel_jobs, active_jobs_count, status')
              .in('status', ['idle', 'processing'])
              .order('active_jobs_count', { ascending: true })
            
            if (availableWorkers && availableWorkers.length > 0) {
              // Find worker with capacity
              const worker = availableWorkers.find((w: any) => 
                w.active_jobs_count < w.max_parallel_jobs
              )
              
              if (worker) {
                assignedWorkerId = worker.id
              }
            }
          }
          
          if (!assignedWorkerId) {
            // No available workers, skip this experiment
            console.log(`[QUEUE] No available workers for experiment ${experiment.id}`)
            continue
          }
          
          // Create job assignment
          // The database trigger will prevent overlapping batches, but we check first to avoid unnecessary errors
          const { data: jobAssignment, error: assignmentError } = await supabase
            .from('job_assignments')
            .insert({
              experiment_id: experiment.id,
              worker_id: assignedWorkerId,
              generation_start: generationStart,
              generation_end: generationEnd,
              status: 'assigned',
              job_id: job_id
            })
            .select()
            .single()
          
          if (assignmentError) {
            // Check if error is due to overlapping batch constraint
            if (assignmentError.message?.includes('overlapping') || assignmentError.message?.includes('already active')) {
              console.log(`[QUEUE] Batch ${generationStart}-${generationEnd} overlaps with existing batch (race condition prevented)`)
              // Try next experiment - this one already has an active batch
              break
            }
            console.error(`[QUEUE] Failed to create job assignment: ${assignmentError.message}`)
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

