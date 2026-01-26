import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

// Force dynamic rendering since we query the database
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient()
    const body = await request.json()
    
    const { worker_id, status, active_jobs_count } = body
    
    // Validate required fields
    if (!worker_id) {
      return NextResponse.json(
        { error: 'Missing required field: worker_id' },
        { status: 400 }
      )
    }
    
    // Validate status if provided (don't default to 'idle' - preserve current status)
    const validStatuses = ['idle', 'processing', 'offline']
    if (status && !validStatuses.includes(status)) {
      return NextResponse.json(
        { error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` },
        { status: 400 }
      )
    }
    
    // Validate active_jobs_count if provided
    const jobsCount = active_jobs_count !== undefined ? parseInt(active_jobs_count) : undefined
    if (jobsCount !== undefined && (isNaN(jobsCount) || jobsCount < 0)) {
      return NextResponse.json(
        { error: 'active_jobs_count must be a non-negative integer' },
        { status: 400 }
      )
    }
    
    // Update worker heartbeat - only update status if explicitly provided
    // This prevents accidentally overwriting 'processing' with 'idle'
    const updateData: any = {
      last_heartbeat: new Date().toISOString()
    }
    
    // Only update status if explicitly provided by the worker
    if (status) {
      updateData.status = status
    }
    
    if (jobsCount !== undefined) {
      updateData.active_jobs_count = jobsCount
    }
    
    const { data: worker, error } = await supabase
      .from('workers')
      .update(updateData)
      .eq('id', worker_id)
      .select()
      .single()
    
    if (error) {
      // Check if this is a "no rows returned" error (worker doesn't exist)
      if (error.code === 'PGRST116' || error.message?.includes('no rows')) {
        return NextResponse.json(
          { error: 'Worker not found' },
          { status: 404 }
        )
      }
      console.error('Error updating worker heartbeat:', error)
      return NextResponse.json(
        { error: error.message || 'Failed to update heartbeat' },
        { status: 500 }
      )
    }
    
    if (!worker) {
      return NextResponse.json(
        { error: 'Worker not found' },
        { status: 404 }
      )
    }
    
    return NextResponse.json({
      success: true,
      worker: {
        id: worker.id,
        status: worker.status,
        active_jobs_count: worker.active_jobs_count,
        last_heartbeat: worker.last_heartbeat
      }
    })
  } catch (error: any) {
    console.error('Error in worker heartbeat:', error)
    return NextResponse.json(
      { error: 'Failed to update heartbeat', details: error?.message || String(error) },
      { status: 500 }
    )
  }
}
