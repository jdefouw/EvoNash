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
      
      // Get all assigned batches for this experiment
      const { data: assignedBatches } = await supabase
        .from('job_assignments')
        .select('generation_start, generation_end, status')
        .eq('experiment_id', experiment.id)
        .in('status', ['assigned', 'processing'])
      
      // Get last completed generation from checkpoints
      const { data: latestCheckpoint } = await supabase
        .from('experiment_checkpoints')
        .select('generation_number')
        .eq('experiment_id', experiment.id)
        .order('generation_number', { ascending: false })
        .limit(1)
        .single()
      
      // Calculate which generations are already assigned
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
        
        if (!isAssigned) {
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
            ticks_per_generation: experiment.ticks_per_generation || 500,
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

