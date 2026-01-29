import { NextRequest, NextResponse } from 'next/server'
import { queryAll, count } from '@/lib/postgres'

// Force dynamic rendering since we query the database
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    // Get all workers, ordered by worker name (alphabetically)
    // NULLS LAST ensures workers without names appear at the end
    const workers = await queryAll(
      'SELECT * FROM workers ORDER BY worker_name ASC NULLS LAST, last_heartbeat DESC'
    )
    
    // Debug logging - log raw worker data
    console.log(`[GET /api/workers] Found ${workers?.length || 0} workers in database`)
    if (workers && workers.length > 0) {
      workers.forEach((w: any, i: number) => {
        console.log(`[GET /api/workers] Worker ${i+1}: id=${w.id?.slice(0,8)}..., name=${w.worker_name}, status=${w.status}, last_heartbeat=${w.last_heartbeat}`)
      })
    }
    
    // Fetch active job assignments with experiment names
    const activeJobs = await queryAll(
      `SELECT 
        ja.worker_id,
        ja.experiment_id,
        ja.generation_start,
        ja.generation_end,
        ja.status,
        e.id as exp_id,
        e.experiment_name
       FROM job_assignments ja
       INNER JOIN experiments e ON ja.experiment_id = e.id
       WHERE ja.status IN ('assigned', 'processing')`
    )
    
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
          workerExperimentMap.set(job.worker_id, {
            experiment_id: job.experiment_id,
            experiment_name: job.experiment_name || 'Unknown',
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
    
    const workersWithStatus = (workers || []).map((worker: any) => {
      const lastHeartbeat = new Date(worker.last_heartbeat)
      const isOffline = lastHeartbeat < ninetySecondsAgo
      const currentExperiment = workerExperimentMap.get(worker.id)
      
      // Debug: Log heartbeat comparison
      const heartbeatAgeMs = now.getTime() - lastHeartbeat.getTime()
      const heartbeatAgeSec = Math.floor(heartbeatAgeMs / 1000)
      console.log(`[GET /api/workers] Worker ${worker.id?.slice(0,8)}... heartbeat age: ${heartbeatAgeSec}s, offline threshold: 90s, isOffline: ${isOffline}`)
      console.log(`[GET /api/workers]   now=${now.toISOString()}, lastHeartbeat=${worker.last_heartbeat}, ninetySecondsAgo=${ninetySecondsAgo.toISOString()}`)
      
      return {
        ...worker,
        // Override status if worker is actually offline
        status: isOffline ? 'offline' : worker.status,
        // Include current experiment info if worker is processing one
        current_experiment: currentExperiment || null
      }
    })
    
    // Count active workers (not offline)
    const activeWorkers = workersWithStatus.filter((w: any) => w.status !== 'offline')
    
    // Count processing workers (have an active job)
    const processingWorkers = workersWithStatus.filter((w: any) => w.current_experiment !== null && w.status !== 'offline')
    
    // Calculate total capacity
    const totalCapacity = workersWithStatus.reduce((sum: number, w: any) => sum + (w.max_parallel_jobs || 0), 0)
    const utilizedCapacity = workersWithStatus.reduce((sum: number, w: any) => sum + (w.active_jobs_count || 0), 0)
    
    // Count pending jobs in the queue (assigned but not yet processing)
    const pendingJobsCount = await count('job_assignments', "status = $1", ['assigned'])
    
    // Count actively processing jobs
    const processingJobsCount = await count('job_assignments', "status = $1", ['processing'])
    
    console.log(`[GET /api/workers] Returning ${workersWithStatus.length} workers (${activeWorkers.length} active, ${processingWorkers.length} processing)`)
    
    return NextResponse.json({
      workers: workersWithStatus,
      active_workers_count: activeWorkers.length,
      processing_workers_count: processingWorkers.length,
      total_workers_count: workersWithStatus.length,
      total_capacity: totalCapacity,
      utilized_capacity: utilizedCapacity,
      available_capacity: totalCapacity - utilizedCapacity,
      pending_jobs_count: pendingJobsCount || 0,
      processing_jobs_count: processingJobsCount || 0,
      _server_timestamp: now.toISOString()  // Debug: helps identify stale responses
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    })
  } catch (error: any) {
    console.error('Error in GET /api/workers:', error)
    return NextResponse.json(
      { error: 'Failed to fetch workers', details: error?.message || String(error) },
      { status: 500 }
    )
  }
}
