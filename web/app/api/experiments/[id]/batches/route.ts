import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

// Force dynamic rendering since we query the database
export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createServerClient()
    const experimentId = params.id
    
    // Get all job assignments for this experiment
    const { data: jobAssignments, error } = await supabase
      .from('job_assignments')
      .select(`
        *,
        workers (
          id,
          worker_name,
          gpu_type,
          vram_gb
        )
      `)
      .eq('experiment_id', experimentId)
      .order('generation_start', { ascending: true })
    
    if (error) {
      console.error('Error fetching job assignments:', error)
      return NextResponse.json(
        { error: error.message || 'Failed to fetch job assignments' },
        { status: 500 }
      )
    }
    
    return NextResponse.json({
      batches: jobAssignments || []
    })
  } catch (error: any) {
    console.error('Error in GET /api/experiments/[id]/batches:', error)
    return NextResponse.json(
      { error: 'Failed to fetch batches', details: error?.message || String(error) },
      { status: 500 }
    )
  }
}
