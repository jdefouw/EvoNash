import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/postgres'

// Force dynamic rendering since we query the database
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    const { worker_id, status, active_jobs_count } = body
    
    const timestamp = new Date().toISOString()
    console.log(`[HEARTBEAT] ${timestamp} - Received from worker ${worker_id?.slice(0, 8)}... status=${status}, jobs=${active_jobs_count}`)
    
    // Validate required fields
    if (!worker_id) {
      console.error('[HEARTBEAT] Missing worker_id')
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
    
    // Build dynamic update query
    const updateFields: string[] = ['last_heartbeat = $1']
    const params: any[] = [new Date().toISOString()]
    let paramIndex = 2
    
    if (status) {
      updateFields.push(`status = $${paramIndex}`)
      params.push(status)
      paramIndex++
    }
    
    if (jobsCount !== undefined) {
      updateFields.push(`active_jobs_count = $${paramIndex}`)
      params.push(jobsCount)
      paramIndex++
    }
    
    params.push(worker_id)
    
    const result = await query(
      `UPDATE workers SET ${updateFields.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      params
    )
    
    if (result.rows.length === 0) {
      console.warn(`[HEARTBEAT] Worker ${worker_id?.slice(0, 8)}... not found in database (404)`)
      return NextResponse.json(
        { error: 'Worker not found' },
        { status: 404 }
      )
    }
    
    const worker = result.rows[0]
    
    // Log both what we sent and what was returned to verify the update
    const now = new Date().toISOString()
    console.log(`[HEARTBEAT] ✓ Updated worker ${worker_id?.slice(0, 8)}...`)
    console.log(`[HEARTBEAT]   Current time: ${now}`)
    console.log(`[HEARTBEAT]   DB returned last_heartbeat: ${worker.last_heartbeat}`)
    console.log(`[HEARTBEAT]   DB returned status: ${worker.status}`)
    
    // Check if the timestamp is recent (within 5 seconds)
    const dbTime = new Date(worker.last_heartbeat).getTime()
    const nowTime = new Date().getTime()
    const diffSec = Math.floor((nowTime - dbTime) / 1000)
    if (diffSec > 5) {
      console.warn(`[HEARTBEAT] ⚠ WARNING: last_heartbeat is ${diffSec}s old! Database update may have failed.`)
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
