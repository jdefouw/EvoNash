import { NextRequest, NextResponse } from 'next/server'
import { queryOne, rpc } from '@/lib/postgres'

// Force dynamic rendering since we modify the database
export const dynamic = 'force-dynamic'

/**
 * POST /api/queue/claim
 * 
 * Explicitly claim a job before starting work.
 * This prevents race conditions where multiple workers might try to process the same job.
 * 
 * Request body:
 * - job_id: string (required) - The job ID to claim
 * - worker_id: string (required) - The worker ID claiming the job
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { job_id, worker_id } = body

    if (!job_id || !worker_id) {
      return NextResponse.json(
        { error: 'Missing required fields: job_id and worker_id' },
        { status: 400 }
      )
    }

    console.log(`[QUEUE/CLAIM] Worker ${worker_id?.slice(0,8)} attempting to claim job ${job_id}`)

    // SECURITY: Verify job is actually assigned to this worker before claiming
    // This prevents workers from stealing jobs assigned to other workers
    const jobAssignment = await queryOne<{ worker_id: string; status: string }>(
      'SELECT worker_id, status FROM job_assignments WHERE job_id = $1',
      [job_id]
    )

    if (!jobAssignment) {
      console.error(`[QUEUE/CLAIM] Job ${job_id} not found`)
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      )
    }

    // Verify ownership - job must be assigned to this specific worker
    if (jobAssignment.worker_id !== worker_id) {
      console.warn(`[QUEUE/CLAIM] SECURITY: Worker ${worker_id?.slice(0,8)} tried to claim job assigned to ${jobAssignment.worker_id?.slice(0,8)}`)
      return NextResponse.json(
        { error: 'Job is assigned to a different worker', assigned_to: jobAssignment.worker_id },
        { status: 403 }
      )
    }

    // Verify status - must be 'assigned' (not already processing or completed)
    if (jobAssignment.status !== 'assigned') {
      console.log(`[QUEUE/CLAIM] Job ${job_id} has status '${jobAssignment.status}', cannot claim`)
      return NextResponse.json(
        { error: `Job cannot be claimed - current status: ${jobAssignment.status}` },
        { status: 409 }
      )
    }

    console.log(`[QUEUE/CLAIM] ✓ Ownership verified, proceeding with atomic claim`)

    // Use atomic claim function for data integrity
    // This atomically updates job status AND increments worker's active_jobs_count
    // Prevents race conditions and counter drift in distributed CUDA compute jobs
    const claimed = await rpc<boolean>('claim_job_atomic', {
      p_job_id: job_id,
      p_worker_id: worker_id
    })

    if (!claimed) {
      console.log(`[QUEUE/CLAIM] Job ${job_id} no longer available for worker ${worker_id}`)
      return NextResponse.json(
        { error: 'Job no longer available - may have been claimed by another worker or already processing' },
        { status: 409 }
      )
    }

    // Fetch job details after successful claim
    const data = await queryOne(
      `SELECT id, job_id, experiment_id, generation_start, generation_end, status, started_at
       FROM job_assignments WHERE job_id = $1`,
      [job_id]
    )

    if (!data) {
      console.error(`[QUEUE/CLAIM] Failed to fetch job details after claim`)
      return NextResponse.json(
        { error: 'Job claimed but failed to fetch details' },
        { status: 500 }
      )
    }

    console.log(`[QUEUE/CLAIM] ✓ Job ${job_id} successfully claimed by worker ${worker_id} (atomic)`)

    return NextResponse.json({
      success: true,
      job: {
        id: data.id,
        job_id: data.job_id,
        experiment_id: data.experiment_id,
        generation_start: data.generation_start,
        generation_end: data.generation_end,
        status: data.status,
        started_at: data.started_at
      }
    })
  } catch (error: any) {
    console.error(`[QUEUE/CLAIM] Unexpected error:`, error)
    return NextResponse.json(
      { error: 'Failed to claim job', details: error?.message || String(error) },
      { status: 500 }
    )
  }
}
