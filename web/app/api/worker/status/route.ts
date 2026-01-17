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
    
    return NextResponse.json({
      worker_connected: runningExperiments && runningExperiments.length > 0,
      running_experiments: runningExperiments || [],
      pending_experiments: pendingExperiments || [],
      pending_count: pendingExperiments?.length || 0,
      status_counts: counts,
      message: pendingExperiments && pendingExperiments.length > 0 
        ? `${pendingExperiments.length} experiment(s) waiting for worker`
        : runningExperiments && runningExperiments.length > 0
        ? 'Worker is active (processing experiments)'
        : 'No pending experiments - worker will poll every 30 seconds'
    })
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to check worker status' },
      { status: 500 }
    )
  }
}
