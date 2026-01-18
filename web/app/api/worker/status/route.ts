import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

// Force dynamic rendering since we query the database
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const supabase = await createServerClient()
    
    // Get workers information
    const { data: workers, error: workersError } = await supabase
      .from('workers')
      .select('*')
      .order('last_heartbeat', { ascending: false })
    
    // Mark workers as offline if they haven't sent a heartbeat in the last 2 minutes
    const now = new Date()
    const twoMinutesAgo = new Date(now.getTime() - 2 * 60 * 1000)
    
    const workersWithStatus = (workers || []).map((worker: any) => {
      const lastHeartbeat = new Date(worker.last_heartbeat)
      const isOffline = lastHeartbeat < twoMinutesAgo
      return {
        ...worker,
        status: isOffline ? 'offline' : worker.status
      }
    })
    
    const activeWorkers = workersWithStatus.filter((w: any) => w.status !== 'offline')
    const totalCapacity = workersWithStatus.reduce((sum: number, w: any) => sum + (w.max_parallel_jobs || 0), 0)
    const utilizedCapacity = workersWithStatus.reduce((sum: number, w: any) => sum + (w.active_jobs_count || 0), 0)
    
    // Check if there are any RUNNING experiments
    const { data: runningExperiments, error: runningError } = await supabase
      .from('experiments')
      .select('id, experiment_name, status, created_at')
      .eq('status', 'RUNNING')
      .order('created_at', { ascending: false })
      .limit(5)
    
    if (runningError) {
      return NextResponse.json({ error: runningError.message }, { status: 500 })
    }
    
    // Check if there are PENDING experiments waiting for worker
    const { data: pendingExperiments, error: pendingError } = await supabase
      .from('experiments')
      .select('id, experiment_name, status, created_at')
      .eq('status', 'PENDING')
      .order('created_at', { ascending: false })
      .limit(5)
    
    if (pendingError) {
      return NextResponse.json({ error: pendingError.message }, { status: 500 })
    }
    
    // Get all status counts for diagnostics
    const { data: statusCounts, error: countError } = await supabase
      .from('experiments')
      .select('status')
    
    const counts = statusCounts?.reduce((acc: Record<string, number>, exp: any) => {
      acc[exp.status] = (acc[exp.status] || 0) + 1
      return acc
    }, {}) || {}
    
    // Check for recent activity
    const worker_connected = activeWorkers.length > 0
    
    // Also check if there are recent generations (within last 5 minutes) as a sign of worker activity
    const { data: recentGenerations } = await supabase
      .from('generations')
      .select('created_at, experiment_id')
      .order('created_at', { ascending: false })
      .limit(1)
    
    const has_recent_activity = recentGenerations && recentGenerations.length > 0 && 
      (new Date().getTime() - new Date(recentGenerations[0].created_at).getTime()) < 5 * 60 * 1000
    
    // Get the most recent generation timestamp for display
    const last_generation_time = recentGenerations && recentGenerations.length > 0
      ? recentGenerations[0].created_at
      : null
    
    return NextResponse.json({
      worker_connected: worker_connected || has_recent_activity,
      active_workers_count: activeWorkers.length,
      total_workers_count: workersWithStatus.length,
      workers: workersWithStatus,
      total_capacity: totalCapacity,
      utilized_capacity: utilizedCapacity,
      available_capacity: totalCapacity - utilizedCapacity,
      running_experiments: runningExperiments || [],
      pending_experiments: pendingExperiments || [],
      pending_count: pendingExperiments?.length || 0,
      status_counts: counts,
      has_recent_activity: has_recent_activity,
      last_generation_time: last_generation_time,
      message: activeWorkers.length > 0
        ? `${activeWorkers.length} active worker(s) (${utilizedCapacity}/${totalCapacity} jobs)`
        : pendingExperiments && pendingExperiments.length > 0
        ? `${pendingExperiments.length} experiment(s) waiting for workers`
        : runningExperiments && runningExperiments.length > 0
        ? 'Experiments running'
        : has_recent_activity
        ? `Workers recently active (last generation: ${last_generation_time ? new Date(last_generation_time).toLocaleString() : 'unknown'})`
        : 'No active workers - workers will poll every 30 seconds'
    })
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to check worker status' },
      { status: 500 }
    )
  }
}
