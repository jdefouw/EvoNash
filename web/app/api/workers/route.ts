import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

// Force dynamic rendering since we query the database
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClient()
    
    // Get all workers, ordered by last heartbeat (most recent first)
    const { data: workers, error } = await supabase
      .from('workers')
      .select('*')
      .order('last_heartbeat', { ascending: false })
    
    if (error) {
      console.error('Error fetching workers:', error)
      return NextResponse.json(
        { error: error.message || 'Failed to fetch workers' },
        { status: 500 }
      )
    }
    
    // Mark workers as offline if they haven't sent a heartbeat in the last 2 minutes
    const now = new Date()
    const twoMinutesAgo = new Date(now.getTime() - 2 * 60 * 1000)
    
    const workersWithStatus = (workers || []).map(worker => {
      const lastHeartbeat = new Date(worker.last_heartbeat)
      const isOffline = lastHeartbeat < twoMinutesAgo
      
      return {
        ...worker,
        // Override status if worker is actually offline
        status: isOffline ? 'offline' : worker.status
      }
    })
    
    // Count active workers (not offline)
    const activeWorkers = workersWithStatus.filter(w => w.status !== 'offline')
    
    // Calculate total capacity
    const totalCapacity = workersWithStatus.reduce((sum, w) => sum + (w.max_parallel_jobs || 0), 0)
    const utilizedCapacity = workersWithStatus.reduce((sum, w) => sum + (w.active_jobs_count || 0), 0)
    
    return NextResponse.json({
      workers: workersWithStatus,
      active_workers_count: activeWorkers.length,
      total_workers_count: workersWithStatus.length,
      total_capacity: totalCapacity,
      utilized_capacity: utilizedCapacity,
      available_capacity: totalCapacity - utilizedCapacity
    })
  } catch (error: any) {
    console.error('Error in GET /api/workers:', error)
    return NextResponse.json(
      { error: 'Failed to fetch workers', details: error?.message || String(error) },
      { status: 500 }
    )
  }
}
