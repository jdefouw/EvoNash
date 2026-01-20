import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

// Force dynamic rendering since we query the database
export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    // Handle both sync and async params (Next.js 13+ compatibility)
    const resolvedParams = await Promise.resolve(params)
    const experimentId = resolvedParams.id
    
    if (!experimentId) {
      return NextResponse.json({ error: 'Experiment ID is required' }, { status: 400 })
    }
    
    const supabase = await createServerClient()
    
    const { data, error } = await supabase
      .from('experiments')
      .select('*')
      .eq('id', experimentId)
      .single()
    
    if (error) {
      console.error('Error fetching experiment:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    
    if (!data) {
      return NextResponse.json({ error: 'Experiment not found' }, { status: 404 })
    }
    
    // Check if experiment should be marked as COMPLETED
    // This catches cases where all generations exist but status wasn't updated
    if (data.status === 'RUNNING' || data.status === 'PENDING') {
      const { data: allGenerations } = await supabase
        .from('generations')
        .select('generation_number')
        .eq('experiment_id', experimentId)
      
      const hasAllGenerations = allGenerations && allGenerations.length >= data.max_generations
      
      if (hasAllGenerations) {
        // Check if there are any active job assignments
        // Use the same logic as results route: ignore stuck assignments older than 10 minutes
        const { data: allAssignments } = await supabase
          .from('job_assignments')
          .select('status, started_at, assigned_at')
          .eq('experiment_id', experimentId)
        
        const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString()
        const hasActiveAssignments = allAssignments && allAssignments.some((a: any) => {
          if (a.status === 'assigned') return true
          if (a.status === 'processing') {
            // Only consider it active if it started recently (within 10 minutes)
            // Stuck assignments older than 10 minutes won't block completion
            const checkTime = a.started_at || a.assigned_at
            return checkTime && checkTime > tenMinutesAgo
          }
          return false
        })
        
        // If we have all generations and no active assignments, mark as COMPLETED
        if (!hasActiveAssignments) {
          console.log(`[EXPERIMENTS] Auto-marking experiment ${experimentId} as COMPLETED (all generations exist)`)
          const { data: updatedExperiment } = await supabase
            .from('experiments')
            .update({ status: 'COMPLETED', completed_at: new Date().toISOString() })
            .eq('id', experimentId)
            .select()
            .single()
          
          if (updatedExperiment) {
            return NextResponse.json(updatedExperiment)
          }
        }
      }
    }
    
    return NextResponse.json(data)
  } catch (error: any) {
    console.error('Unexpected error in GET /api/experiments/[id]:', error)
    return NextResponse.json(
      { error: 'Failed to fetch experiment', details: error?.message || String(error) },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createServerClient()
    
    const { error } = await supabase
      .from('experiments')
      .delete()
      .eq('id', params.id)
    
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to delete experiment' },
      { status: 500 }
    )
  }
}
