import { NextRequest, NextResponse } from 'next/server'
import { queryOne, query, count } from '@/lib/postgres'

// Force dynamic rendering since we query the database
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    const { worker_id, worker_name, gpu_type, vram_gb } = body
    
    // Validate required fields
    if (!gpu_type || vram_gb === undefined || vram_gb === null) {
      return NextResponse.json(
        { error: 'Missing required fields: gpu_type and vram_gb are required' },
        { status: 400 }
      )
    }
    
    // Validate vram_gb is a non-negative integer (0 is allowed for CPU workers)
    const vram = parseInt(vram_gb)
    if (isNaN(vram) || vram < 0) {
      return NextResponse.json(
        { error: 'vram_gb must be a non-negative integer' },
        { status: 400 }
      )
    }
    
    // Calculate max_parallel_jobs: floor(vram_gb / 2), minimum 1 for CPU workers
    const max_parallel_jobs = Math.max(1, Math.floor(vram / 2))
    
    // If worker_id provided, try to find existing worker
    let worker
    if (worker_id) {
      console.log(`[WORKER REGISTER] Looking for existing worker with ID: ${worker_id}`)
      
      const existingWorker = await queryOne(
        'SELECT * FROM workers WHERE id = $1',
        [worker_id]
      )
      
      if (existingWorker) {
        console.log(`[WORKER REGISTER] Found existing worker: name=${existingWorker.worker_name}, last_heartbeat=${existingWorker.last_heartbeat}`)
        // Check for active job assignments before resetting status
        // This preserves job state on re-registration (e.g., after network hiccup)
        const activeJobCount = await count(
          'job_assignments',
          "worker_id = $1 AND status IN ('assigned', 'processing')",
          [worker_id]
        )
        
        // Determine status based on active jobs - don't blindly reset to idle
        const hasActiveJobs = (activeJobCount || 0) > 0
        const newStatus = hasActiveJobs ? 'processing' : 'idle'
        const newActiveJobsCount = activeJobCount || 0
        
        // Update existing worker
        const result = await query(
          `UPDATE workers SET 
            worker_name = $1,
            gpu_type = $2,
            vram_gb = $3,
            max_parallel_jobs = $4,
            status = $5,
            active_jobs_count = $6,
            last_heartbeat = $7
           WHERE id = $8
           RETURNING *`,
          [
            worker_name || existingWorker.worker_name,
            gpu_type,
            vram,
            max_parallel_jobs,
            newStatus,
            newActiveJobsCount,
            new Date().toISOString(),
            worker_id
          ]
        )
        
        if (result.rows.length === 0) {
          return NextResponse.json(
            { error: 'Failed to update worker' },
            { status: 500 }
          )
        }
        
        worker = result.rows[0]
        console.log(`[WORKER REGISTER] Updated existing worker: ${worker.id} (${gpu_type}, ${vram}GB VRAM, ${newActiveJobsCount} active jobs)`)
      } else {
        // Worker ID provided but doesn't exist - create new with that ID
        const result = await query(
          `INSERT INTO workers (id, worker_name, gpu_type, vram_gb, max_parallel_jobs, status, active_jobs_count, last_heartbeat)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           RETURNING *`,
          [
            worker_id,
            worker_name || null,
            gpu_type,
            vram,
            max_parallel_jobs,
            'idle',
            0,
            new Date().toISOString()
          ]
        )
        
        if (result.rows.length === 0) {
          return NextResponse.json(
            { error: 'Failed to create worker' },
            { status: 500 }
          )
        }
        
        worker = result.rows[0]
        console.log(`[WORKER REGISTER] Created new worker with provided ID: ${worker.id}`)
      }
    } else {
      // No worker_id provided - create new worker
      const result = await query(
        `INSERT INTO workers (worker_name, gpu_type, vram_gb, max_parallel_jobs, status, active_jobs_count, last_heartbeat)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [
          worker_name || null,
          gpu_type,
          vram,
          max_parallel_jobs,
          'idle',
          0,
          new Date().toISOString()
        ]
      )
      
      if (result.rows.length === 0) {
        return NextResponse.json(
          { error: 'Failed to create worker' },
          { status: 500 }
        )
      }
      
      worker = result.rows[0]
      console.log(`[WORKER REGISTER] Created new worker: ${worker.id}`)
    }
    
    // Worker successfully registered/updated
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
