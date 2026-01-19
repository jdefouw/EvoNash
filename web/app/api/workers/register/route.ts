import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

// Force dynamic rendering since we query the database
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient()
    const body = await request.json()
    
    const { worker_id, worker_name, gpu_type, vram_gb } = body
    
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
    
    // If worker_id provided, try to find existing worker
    let worker
    if (worker_id) {
      const { data: existingWorker } = await supabase
        .from('workers')
        .select('*')
        .eq('id', worker_id)
        .single()
      
      if (existingWorker) {
        // Update existing worker
        const { data: updatedWorker, error: updateError } = await supabase
          .from('workers')
          .update({
            worker_name: worker_name || existingWorker.worker_name,
            gpu_type,
            vram_gb: vram,
            max_parallel_jobs,
            status: 'idle',  // Reset to idle on re-registration
            active_jobs_count: 0,  // Reset job count
            last_heartbeat: new Date().toISOString()
          })
          .eq('id', worker_id)
          .select()
          .single()
        
        if (updateError) {
          console.error('Error updating worker:', updateError)
          return NextResponse.json(
            { error: updateError.message || 'Failed to update worker' },
            { status: 500 }
          )
        }
        
        worker = updatedWorker
        console.log(`[WORKER REGISTER] Updated existing worker: ${worker.id} (${gpu_type}, ${vram}GB VRAM)`)
      } else {
        // Worker ID provided but doesn't exist - create new with that ID
        const { data: newWorker, error: insertError } = await supabase
          .from('workers')
          .insert({
            id: worker_id,
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
        
        if (insertError) {
          console.error('Error creating worker with ID:', insertError)
          return NextResponse.json(
            { error: insertError.message || 'Failed to create worker' },
            { status: 500 }
          )
        }
        
        worker = newWorker
        console.log(`[WORKER REGISTER] Created new worker with provided ID: ${worker.id}`)
      }
    } else {
      // No worker_id provided - create new worker
      const { data: newWorker, error: insertError } = await supabase
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
      
      if (insertError) {
        console.error('Error creating worker:', insertError)
        return NextResponse.json(
          { error: insertError.message || 'Failed to create worker' },
          { status: 500 }
        )
      }
      
      worker = newWorker
      console.log(`[WORKER REGISTER] Created new worker: ${worker.id}`)
    }
    
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
