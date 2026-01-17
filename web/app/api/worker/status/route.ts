import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = await createServerClient()
    
    // Check if there are any RUNNING experiments (indicates worker is active)
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
    
    // Check for recent activity - if there are RUNNING experiments or recent generations, worker is active
    const worker_connected = runningExperiments && runningExperiments.length > 0
    
    // Also check if there are recent generations (within last 5 minutes) as a sign of worker activity
    const { data: recentGenerations } = await supabase
      .from('generations')
      .select('created_at')
      .order('created_at', { ascending: false })
      .limit(1)
    
    const has_recent_activity = recentGenerations && recentGenerations.length > 0 && 
      (new Date().getTime() - new Date(recentGenerations[0].created_at).getTime()) < 5 * 60 * 1000
    
    return NextResponse.json({
      worker_connected: worker_connected || has_recent_activity,
      running_experiments: runningExperiments || [],
      pending_experiments: pendingExperiments || [],
      pending_count: pendingExperiments?.length || 0,
      status_counts: counts,
      has_recent_activity: has_recent_activity,
      message: pendingExperiments && pendingExperiments.length > 0 
        ? `${pendingExperiments.length} experiment(s) waiting for worker`
        : runningExperiments && runningExperiments.length > 0
        ? 'Worker is active (processing experiments)'
        : has_recent_activity
        ? 'Worker recently active (checking for new jobs)'
        : 'No pending experiments - worker will poll every 30 seconds'
    })
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to check worker status' },
      { status: 500 }
    )
  }
}
