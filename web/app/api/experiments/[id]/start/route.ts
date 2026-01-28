import { NextRequest, NextResponse } from 'next/server'
import { queryOne, query } from '@/lib/postgres'

// Force dynamic rendering since we modify the database
export const dynamic = 'force-dynamic'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    // Handle both sync and async params (Next.js 13+ vs 15+)
    const resolvedParams = await Promise.resolve(params)
    const experimentId = resolvedParams.id
    
    // Check current status
    const experiment = await queryOne<{ status: string }>(
      'SELECT status FROM experiments WHERE id = $1',
      [experimentId]
    )
    
    if (!experiment) {
      return NextResponse.json(
        { error: 'Experiment not found' },
        { status: 404 }
      )
    }
    
    // Only allow starting if status is PENDING, STOPPED, or FAILED
    if (experiment.status === 'RUNNING') {
      return NextResponse.json(
        { error: 'Experiment is already running' },
        { status: 400 }
      )
    }
    
    if (experiment.status === 'COMPLETED') {
      return NextResponse.json(
        { error: 'Cannot restart a completed experiment' },
        { status: 400 }
      )
    }
    
    // Set status to PENDING so worker can pick it up
    // The worker will change it to RUNNING when it claims the job
    await query(
      'UPDATE experiments SET status = $1 WHERE id = $2',
      ['PENDING', experimentId]
    )
    
    console.log(`[START] Experiment ${experimentId} queued for GPU worker`)
    
    return NextResponse.json({ 
      success: true, 
      status: 'PENDING',
      message: 'Experiment queued for GPU worker. Worker will pick it up within 30 seconds.'
    })
  } catch (error: any) {
    console.error('Error starting experiment:', error)
    return NextResponse.json(
      { error: 'Failed to start experiment' },
      { status: 500 }
    )
  }
}
