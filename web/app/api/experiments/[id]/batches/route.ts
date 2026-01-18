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
    // Handle case where tables might not exist yet (graceful degradation)
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
    
    // If table doesn't exist or other error, return empty array instead of error
    if (error) {
      // Check if it's a "relation does not exist" error (table not created yet)
      if (error.message && error.message.includes('does not exist')) {
        console.log('Job assignments table does not exist yet, returning empty batches')
        return NextResponse.json({
          batches: []
        })
      }
      console.error('Error fetching job assignments:', error)
      // For other errors, still return empty array to not break the UI
      return NextResponse.json({
        batches: []
      })
    }
    
    return NextResponse.json({
      batches: jobAssignments || []
    })
  } catch (error: any) {
    console.error('Error in GET /api/experiments/[id]/batches:', error)
    // Always return empty array on error to not break the UI
    return NextResponse.json({
      batches: []
    })
  }
}
