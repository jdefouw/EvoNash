import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

// Force dynamic rendering since we query the database
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient()
    const body = await request.json()
    
    const { worker_name, gpu_type, vram_gb } = body
    
    // Validate required fields
    if (!gpu_type || vram_gb === undefined || vram_gb === null) {
      return NextResponse.json(
        { error: 'Missing required fields: gpu_type and vram_gb are required' },
        { status: 400 }
      )
    }
    
    // Validate vram_gb is a positive integer
    const vram = parseInt(vram_gb)
    if (isNaN(vram) || vram <= 0) {
      return NextResponse.json(
        { error: 'vram_gb must be a positive integer' },
        { status: 400 }
      )
    }
    
    // Calculate max_parallel_jobs: floor(vram_gb / 2)
    const max_parallel_jobs = Math.floor(vram / 2)
    
    // Check if worker already exists (by GPU type and VRAM - could be improved with unique identifier)
    // For now, we'll create a new worker each time (workers can be identified by ID)
    // In production, you might want to use a unique worker identifier
    
    // Insert or update worker
    // Since we don't have a unique identifier yet, we'll always create new
    // TODO: Consider adding worker_id from worker config or MAC address for persistence
    const { data: worker, error } = await supabase
      .from('workers')
      .insert({
        worker_name: worker_name || null,
        gpu_type,
        vram_gb: vram,
        max_parallel_jobs,
        status: 'idle',
        active_jobs_count: 0,
        last_heartbeat: new Date().toISOString()
      })
      .select()
      .single()
    
    if (error) {
      console.error('Error registering worker:', error)
      return NextResponse.json(
        { error: error.message || 'Failed to register worker' },
        { status: 500 }
      )
    }
    
    console.log(`[WORKER REGISTER] Registered worker: ${worker.id} (${gpu_type}, ${vram}GB VRAM, ${max_parallel_jobs} max parallel jobs)`)
    
    return NextResponse.json({
      worker_id: worker.id,
      max_parallel_jobs: worker.max_parallel_jobs,
      worker: {
        id: worker.id,
        worker_name: worker.worker_name,
        gpu_type: worker.gpu_type,
        vram_gb: worker.vram_gb,
        max_parallel_jobs: worker.max_parallel_jobs,
        status: worker.status
      }
    })
  } catch (error: any) {
    console.error('Error in worker registration:', error)
    return NextResponse.json(
      { error: 'Failed to register worker', details: error?.message || String(error) },
      { status: 500 }
    )
  }
}
