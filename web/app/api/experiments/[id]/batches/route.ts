import { NextRequest, NextResponse } from 'next/server'
import { queryAll } from '@/lib/postgres'

// Force dynamic rendering since we query the database
export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const experimentId = params.id
    
    // Get all job assignments for this experiment with worker info
    const jobAssignments = await queryAll(
      `SELECT 
        ja.*,
        json_build_object(
          'id', w.id,
          'worker_name', w.worker_name,
          'gpu_type', w.gpu_type,
          'vram_gb', w.vram_gb
        ) as workers
       FROM job_assignments ja
       LEFT JOIN workers w ON ja.worker_id = w.id
       WHERE ja.experiment_id = $1
       ORDER BY ja.generation_start ASC`,
      [experimentId]
    )
    
    return NextResponse.json({
      batches: jobAssignments || []
    })
  } catch (error: any) {
    console.error('Error in GET /api/experiments/[id]/batches:', error)
    // Check if it's a "relation does not exist" error (table not created yet)
    if (error.message && error.message.includes('does not exist')) {
      console.log('Job assignments table does not exist yet, returning empty batches')
      return NextResponse.json({
        batches: []
      })
    }
    // Always return empty array on error to not break the UI
    return NextResponse.json({
      batches: []
    })
  }
}
