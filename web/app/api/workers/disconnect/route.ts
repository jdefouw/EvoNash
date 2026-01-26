import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

// Force dynamic rendering since we modify the database
export const dynamic = 'force-dynamic'

/**
 * POST /api/workers/disconnect
 * 
 * Handle graceful worker disconnection.
 * Marks the worker as offline and releases all active jobs.
 * 
 * Request body:
 * - worker_id: string (required) - The worker ID that is disconnecting
 * - reason: string (optional) - Reason for disconnection (e.g., "User initiated shutdown", "Error")
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient()
    const body = await request.json()
    const { worker_id, reason } = body

    if (!worker_id) {
      return NextResponse.json(
        { error: 'Missing required field: worker_id' },
        { status: 400 }
      )
    }

    const timestamp = new Date().toISOString()
    console.log(`[WORKERS/DISCONNECT] ========================================`)
    console.log(`[WORKERS/DISCONNECT] Worker ${worker_id} disconnecting`)
    console.log(`[WORKERS/DISCONNECT] Reason: ${reason || 'Not specified'}`)
    console.log(`[WORKERS/DISCONNECT] Time: ${timestamp}`)
    console.log(`[WORKERS/DISCONNECT] ========================================`)

    // Get the worker's current active jobs before marking offline
    const { data: activeJobs } = await supabase
      .from('job_assignments')
      .select('job_id, experiment_id, generation_start, generation_end')
      .eq('worker_id', worker_id)
      .in('status', ['assigned', 'processing'])

    const activeJobCount = activeJobs?.length || 0

    // Mark worker as offline
    const { error: workerError } = await supabase
      .from('workers')
      .update({
        status: 'offline',
        active_jobs_count: 0,
        last_heartbeat: timestamp
      })
      .eq('id', worker_id)

    if (workerError) {
      console.error(`[WORKERS/DISCONNECT] Error updating worker status:`, workerError)
    }

    // Release all active jobs from this worker
    const { data: releasedJobs, error: jobsError } = await supabase
      .from('job_assignments')
      .update({
        status: 'failed',
        completed_at: timestamp
      })
      .eq('worker_id', worker_id)
      .in('status', ['assigned', 'processing'])
      .select('job_id, experiment_id, generation_start, generation_end')

    if (jobsError) {
      console.error(`[WORKERS/DISCONNECT] Error releasing jobs:`, jobsError)
    }

    const releasedCount = releasedJobs?.length || 0

    if (releasedJobs && releasedJobs.length > 0) {
      console.log(`[WORKERS/DISCONNECT] Released ${releasedCount} job(s):`)
      for (const job of releasedJobs) {
        console.log(`[WORKERS/DISCONNECT]   - Job ${job.job_id}: experiment ${job.experiment_id}, gens ${job.generation_start}-${job.generation_end}`)
      }
    }

    console.log(`[WORKERS/DISCONNECT] ✓ Worker ${worker_id} marked offline, ${releasedCount} jobs released`)

    return NextResponse.json({
      success: true,
      worker_id,
      reason,
      jobs_released: releasedCount,
      released_jobs: releasedJobs || []
    })
  } catch (error: any) {
    console.error(`[WORKERS/DISCONNECT] Unexpected error:`, error)
    return NextResponse.json(
      { error: 'Failed to process disconnect', details: error?.message || String(error) },
      { status: 500 }
    )
  }
}
