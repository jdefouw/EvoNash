import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

// Force dynamic rendering since we query the database
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClient()
    
    // Get all workers, ordered by last heartbeat (most recent first)
    const { data: workers, error } = await supabase
      .from('workers')
      .select('*')
      .order('last_heartbeat', { ascending: false })
    
    if (error) {
      console.error('Error fetching workers:', error)
      return NextResponse.json(
        { error: error.message || 'Failed to fetch workers' },
        { status: 500 }
      )
    }
    
    // Fetch active job assignments with experiment names
    const { data: activeJobs } = await supabase
      .from('job_assignments')
      .select(`
        worker_id,
        experiment_id,
        generation_start,
        generation_end,
        status,
        experiments!inner (
          id,
          experiment_name
        )
      `)
      .in('status', ['assigned', 'processing'])
    
    // Create a map of worker_id to their current experiment
    const workerExperimentMap = new Map<string, {
      experiment_id: string
      experiment_name: string
      generation_start: number
      generation_end: number
      status: string
    }>()
    
    if (activeJobs) {
      for (const job of activeJobs) {
        // Only store the first (most recent) job per worker
        if (!workerExperimentMap.has(job.worker_id)) {
          const experiment = job.experiments as any
          workerExperimentMap.set(job.worker_id, {
            experiment_id: job.experiment_id,
            experiment_name: experiment?.experiment_name || 'Unknown',
            generation_start: job.generation_start,
            generation_end: job.generation_end,
            status: job.status
          })
        }
      }
    }
    
    // Mark workers as offline if they haven't sent a heartbeat in the last 90 seconds
    // (as per scientific rigor requirements for timely job recovery)
    const now = new Date()
    const ninetySecondsAgo = new Date(now.getTime() - 90 * 1000)
    
    // Auto-cleanup: Delete workers that have been offline for more than 5 minutes
    // BUT only if they don't have active job assignments (to prevent cascade deletion of running jobs)
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000)
    const potentiallyStaleWorkerIds = (workers || [])
      .filter(w => new Date(w.last_heartbeat) < fiveMinutesAgo)
      .map(w => w.id)
    
    // Check which stale workers have active job assignments
    let staleWorkerIds: string[] = []
    if (potentiallyStaleWorkerIds.length > 0) {
      // Get workers with active jobs (assigned or processing)
      const { data: activeJobWorkers } = await supabase
        .from('job_assignments')
        .select('worker_id')
        .in('worker_id', potentiallyStaleWorkerIds)
        .in('status', ['assigned', 'processing'])
      
      const workersWithActiveJobs = new Set((activeJobWorkers || []).map(j => j.worker_id))
      
      // Only delete workers that are stale AND have no active jobs
      staleWorkerIds = potentiallyStaleWorkerIds.filter(id => !workersWithActiveJobs.has(id))
      
      if (staleWorkerIds.length > 0) {
        console.log(`[WORKERS] Auto-cleaning ${staleWorkerIds.length} stale worker(s) (${potentiallyStaleWorkerIds.length - staleWorkerIds.length} preserved due to active jobs)`)
        await supabase
          .from('workers')
          .delete()
          .in('id', staleWorkerIds)
      }
    }
    
    // Filter out the stale workers from the response
    const activeWorkersList = (workers || []).filter(w => !staleWorkerIds.includes(w.id))
    
    const workersWithStatus = activeWorkersList.map(worker => {
      const lastHeartbeat = new Date(worker.last_heartbeat)
      const isOffline = lastHeartbeat < ninetySecondsAgo
      const currentExperiment = workerExperimentMap.get(worker.id)
      
      return {
        ...worker,
        // Override status if worker is actually offline
        status: isOffline ? 'offline' : worker.status,
        // Include current experiment info if worker is processing one
        current_experiment: currentExperiment || null
      }
    })
    
    // Count active workers (not offline)
    const activeWorkers = workersWithStatus.filter(w => w.status !== 'offline')
    
    // Count processing workers (have an active job)
    const processingWorkers = workersWithStatus.filter(w => w.current_experiment !== null && w.status !== 'offline')
    
    // Calculate total capacity
    const totalCapacity = workersWithStatus.reduce((sum, w) => sum + (w.max_parallel_jobs || 0), 0)
    const utilizedCapacity = workersWithStatus.reduce((sum, w) => sum + (w.active_jobs_count || 0), 0)
    
    // Count pending jobs in the queue (assigned but not yet processing)
    const { count: pendingJobsCount } = await supabase
      .from('job_assignments')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'assigned')
    
    // Count actively processing jobs
    const { count: processingJobsCount } = await supabase
      .from('job_assignments')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'processing')
    
    return NextResponse.json({
      workers: workersWithStatus,
      active_workers_count: activeWorkers.length,
      processing_workers_count: processingWorkers.length,
      total_workers_count: workersWithStatus.length,
      total_capacity: totalCapacity,
      utilized_capacity: utilizedCapacity,
      available_capacity: totalCapacity - utilizedCapacity,
      pending_jobs_count: pendingJobsCount || 0,
      processing_jobs_count: processingJobsCount || 0
    })
  } catch (error: any) {
    console.error('Error in GET /api/workers:', error)
    return NextResponse.json(
      { error: 'Failed to fetch workers', details: error?.message || String(error) },
      { status: 500 }
    )
  }
}
