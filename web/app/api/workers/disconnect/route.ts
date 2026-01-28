import { NextRequest, NextResponse } from 'next/server'
import { query, queryAll } from '@/lib/postgres'

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
    const activeJobs = await queryAll(
      `SELECT job_id, experiment_id, generation_start, generation_end
       FROM job_assignments
       WHERE worker_id = $1 AND status IN ('assigned', 'processing')`,
      [worker_id]
    )

    const activeJobCount = activeJobs?.length || 0

    // Mark worker as offline
    await query(
      `UPDATE workers SET status = $1, active_jobs_count = $2, last_heartbeat = $3 WHERE id = $4`,
      ['offline', 0, timestamp, worker_id]
    )

    // Release all active jobs from this worker
    const releasedResult = await query(
      `UPDATE job_assignments 
       SET status = $1, completed_at = $2
       WHERE worker_id = $3 AND status IN ('assigned', 'processing')
       RETURNING job_id, experiment_id, generation_start, generation_end`,
      ['failed', timestamp, worker_id]
    )

    const releasedJobs = releasedResult.rows || []
    const releasedCount = releasedJobs.length

    if (releasedJobs.length > 0) {
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
      released_jobs: releasedJobs
    })
  } catch (error: any) {
    console.error(`[WORKERS/DISCONNECT] Unexpected error:`, error)
    return NextResponse.json(
      { error: 'Failed to process disconnect', details: error?.message || String(error) },
      { status: 500 }
    )
  }
}
