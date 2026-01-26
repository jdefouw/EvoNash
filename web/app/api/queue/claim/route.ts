import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

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
    const supabase = await createServerClient()
    const body = await request.json()
    const { job_id, worker_id } = body

    if (!job_id || !worker_id) {
      return NextResponse.json(
        { error: 'Missing required fields: job_id and worker_id' },
        { status: 400 }
      )
    }

    console.log(`[QUEUE/CLAIM] Worker ${worker_id} claiming job ${job_id}`)

    // Atomic update: only claim if still assigned to this worker
    // This prevents race conditions where another worker might have claimed it
    const { data, error } = await supabase
      .from('job_assignments')
      .update({
        status: 'processing',
        started_at: new Date().toISOString()
      })
      .eq('job_id', job_id)
      .eq('worker_id', worker_id)
      .eq('status', 'assigned')
      .select()
      .single()

    if (error) {
      // Check if it's a "no rows returned" error (job already claimed or doesn't exist)
      if (error.code === 'PGRST116') {
        console.log(`[QUEUE/CLAIM] Job ${job_id} no longer available for worker ${worker_id}`)
        return NextResponse.json(
          { error: 'Job no longer available - may have been claimed by another worker or already processing' },
          { status: 409 }
        )
      }
      console.error(`[QUEUE/CLAIM] Database error:`, error)
      return NextResponse.json(
        { error: 'Failed to claim job', details: error.message },
        { status: 500 }
      )
    }

    if (!data) {
      console.log(`[QUEUE/CLAIM] Job ${job_id} not found or not assigned to worker ${worker_id}`)
      return NextResponse.json(
        { error: 'Job not found or not assigned to this worker' },
        { status: 409 }
      )
    }

    // Update worker status to processing
    await supabase
      .from('workers')
      .update({ 
        status: 'processing',
        last_heartbeat: new Date().toISOString()
      })
      .eq('id', worker_id)

    console.log(`[QUEUE/CLAIM] ✓ Job ${job_id} successfully claimed by worker ${worker_id}`)

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
