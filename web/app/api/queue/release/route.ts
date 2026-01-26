import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

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
    const supabase = await createServerClient()
    const body = await request.json()
    const { job_id, worker_id, reason, last_completed_generation } = body

    if (!job_id || !worker_id) {
      return NextResponse.json(
        { error: 'Missing required fields: job_id and worker_id' },
        { status: 400 }
      )
    }

    console.log(`[QUEUE/RELEASE] Worker ${worker_id} releasing job ${job_id}: ${reason || 'No reason provided'}`)

    // First, verify the worker owns this job
    const { data: jobAssignment } = await supabase
      .from('job_assignments')
      .select('*')
      .eq('job_id', job_id)
      .single()

    if (!jobAssignment) {
      return NextResponse.json(
        { error: 'Job assignment not found' },
        { status: 404 }
      )
    }

    if (jobAssignment.worker_id !== worker_id) {
      console.error(`[QUEUE/RELEASE] Worker ${worker_id} attempted to release job ${job_id} owned by ${jobAssignment.worker_id}`)
      return NextResponse.json(
        { error: 'Unauthorized: Worker does not own this job' },
        { status: 403 }
      )
    }

    // Mark job as failed so it can be reassigned
    // The queue route will detect this and allow a new worker to pick it up
    const { data, error } = await supabase
      .from('job_assignments')
      .update({
        status: 'failed',
        completed_at: new Date().toISOString()
      })
      .eq('job_id', job_id)
      .eq('worker_id', worker_id)
      .in('status', ['assigned', 'processing'])
      .select()

    if (error) {
      console.error(`[QUEUE/RELEASE] Database error:`, error)
      return NextResponse.json(
        { error: 'Failed to release job', details: error.message },
        { status: 500 }
      )
    }

    // Update worker's active jobs count
    const { data: worker } = await supabase
      .from('workers')
      .select('active_jobs_count')
      .eq('id', worker_id)
      .single()

    if (worker) {
      await supabase
        .from('workers')
        .update({
          active_jobs_count: Math.max(0, (worker.active_jobs_count || 1) - 1),
          status: worker.active_jobs_count <= 1 ? 'idle' : 'processing'
        })
        .eq('id', worker_id)
    }

    const releasedCount = data?.length || 0
    console.log(`[QUEUE/RELEASE] ✓ Job ${job_id} released by worker ${worker_id} (${releasedCount} assignments updated)`)

    // If last_completed_generation was provided, log it for tracking
    if (last_completed_generation !== undefined) {
      console.log(`[QUEUE/RELEASE] Last completed generation: ${last_completed_generation}`)
    }

    return NextResponse.json({
      success: true,
      released: releasedCount,
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
