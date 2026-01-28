import { NextRequest, NextResponse } from 'next/server'
import { rpc } from '@/lib/postgres'

// Force dynamic rendering since we modify the database
export const dynamic = 'force-dynamic'

/**
 * POST /api/queue/release
 * 
 * Release a job back to the queue for reassignment.
 * Used during graceful shutdown or when a worker needs to give up a job.
 * 
 * Request body:
 * - job_id: string (required) - The job ID to release
 * - worker_id: string (required) - The worker ID releasing the job
 * - reason: string (optional) - Reason for releasing the job
 * - last_completed_generation: number (optional) - Last successfully completed generation
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { job_id, worker_id, reason, last_completed_generation } = body

    if (!job_id || !worker_id) {
      return NextResponse.json(
        { error: 'Missing required fields: job_id and worker_id' },
        { status: 400 }
      )
    }

    console.log(`[QUEUE/RELEASE] Worker ${worker_id} releasing job ${job_id}: ${reason || 'No reason provided'}`)

    // Use atomic release function for data integrity
    // This atomically updates job status AND decrements worker's active_jobs_count
    // Also verifies ownership - only the assigned worker can release the job
    const released = await rpc<boolean>('release_job_atomic', {
      p_job_id: job_id,
      p_worker_id: worker_id,
      p_reason: reason || 'Released by worker'
    })

    if (!released) {
      // Job not found or not owned by this worker
      console.log(`[QUEUE/RELEASE] Job ${job_id} not found or not owned by worker ${worker_id}`)
      return NextResponse.json(
        { error: 'Job not found or not assigned to this worker' },
        { status: 404 }
      )
    }

    console.log(`[QUEUE/RELEASE] ✓ Job ${job_id} released by worker ${worker_id} (atomic)`)

    // If last_completed_generation was provided, log it for tracking
    if (last_completed_generation !== undefined) {
      console.log(`[QUEUE/RELEASE] Last completed generation: ${last_completed_generation}`)
    }

    return NextResponse.json({
      success: true,
      released: released ? 1 : 0,
      job_id,
      reason,
      last_completed_generation
    })
  } catch (error: any) {
    console.error(`[QUEUE/RELEASE] Unexpected error:`, error)
    return NextResponse.json(
      { error: 'Failed to release job', details: error?.message || String(error) },
      { status: 500 }
    )
  }
}
