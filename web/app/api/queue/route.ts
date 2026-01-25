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
    
    // Try to find an unassigned batch for each experiment
    for (const experiment of experiments) {
      // Update status to RUNNING if it was PENDING
      if (experiment.status === 'PENDING') {
        await supabase
          .from('experiments')
          .update({ status: 'RUNNING' })
          .eq('id', experiment.id)
      }
      
      // Get all assigned batches for this experiment with worker info
      const { data: initialAssignedBatches } = await supabase
        .from('job_assignments')
        .select('generation_start, generation_end, status, worker_id, assigned_at, started_at')
        .eq('experiment_id', experiment.id)
        .in('status', ['assigned', 'processing'])
      
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
        const twoMinutesAgo = new Date(now.getTime() - 2 * 60 * 1000)
        
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
            (worker.last_heartbeat && new Date(worker.last_heartbeat) < twoMinutesAgo) ||
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
        
        // Re-fetch assigned batches after recovery
        const { data: updatedBatches } = await supabase
          .from('job_assignments')
          .select('generation_start, generation_end, status, worker_id, assigned_at, started_at')
          .eq('experiment_id', experiment.id)
          .in('status', ['assigned', 'processing'])
        
        // If worker is recovering its own jobs, exclude them from the assigned list
        if (worker_id && ownBatches.length > 0) {
          const ownBatchRanges = new Set(ownBatches.map((b: any) => 
            `${b.generation_start}-${b.generation_end}`
          ))
          assignedBatches = (updatedBatches || []).filter((b: any) => {
            // Exclude batches that match the worker's own jobs (allow recovery)
            const batchKey = `${b.generation_start}-${b.generation_end}`
            return !ownBatchRanges.has(batchKey)
          })
        } else {
          assignedBatches = updatedBatches || []
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
      
      // CRITICAL: Check if there's already an active batch for this experiment
      // Since generations are sequential and depend on previous ones, only ONE batch can be active at a time
      // BUT: Allow workers to recover their own jobs
      const activeBatches = (assignedBatches || []).filter((b: any) => 
        b.status === 'assigned' || b.status === 'processing'
      )
      
      // Check if there are active batches from OTHER workers (not the requesting worker)
      const otherWorkersActiveBatches = activeBatches.filter((b: any) => 
        !worker_id || b.worker_id !== worker_id
      )
      
      if (otherWorkersActiveBatches.length > 0) {
        // There's already an active batch from another worker - don't assign another one
        // This prevents race conditions where multiple workers try to process the same experiment
        console.log(`[QUEUE] Experiment ${experiment.id} already has ${otherWorkersActiveBatches.length} active batch(es) from other workers, skipping assignment`)
        console.log(`[QUEUE] Active batches: ${otherWorkersActiveBatches.map((b: any) => `${b.generation_start}-${b.generation_end}`).join(', ')}`)
        continue // Try next experiment
      }
      
      // If worker has their own active batch, they're recovering - that's allowed
      const ownActiveBatches = activeBatches.filter((b: any) => 
        worker_id && b.worker_id === worker_id
      )
      if (ownActiveBatches.length > 0) {
        console.log(`[QUEUE] Worker ${worker_id} is recovering their own batch(es): ${ownActiveBatches.map((b: any) => `${b.generation_start}-${b.generation_end}`).join(', ')}`)
        // Continue to allow the worker to get their own job back
      }
      
      // Calculate which generations are already assigned (excluding worker's own recoverable jobs)
      const assignedRanges: Array<{start: number, end: number}> = (assignedBatches || []).map((b: any) => ({
        start: b.generation_start,
        end: b.generation_end
      }))
      
      // Find first unassigned batch
      // Start from last completed generation + 1, or 0 if no checkpoint
      const batchSize = DEFAULT_BATCH_SIZE
      let generationStart = latestCheckpoint ? (latestCheckpoint.generation_number + 1) : 0
      let foundBatch = false
      
      while (generationStart < experiment.max_generations) {
        const generationEnd = Math.min(generationStart + batchSize - 1, experiment.max_generations - 1)
        
        // Check if this range overlaps with any assigned range
        const isAssigned = assignedRanges.some(range => 
          !(generationEnd < range.start || generationStart > range.end)
        )
        
        // Check if all generations in this range already exist
        const allGenerationsExist = Array.from({ length: generationEnd - generationStart + 1 }, (_, i) => generationStart + i)
          .every(genNum => existingGenerationNumbers.has(genNum))
        
        if (!isAssigned && !allGenerationsExist) {
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

