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
    
    // First, check if experiment exists and is RUNNING
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
    
    if (experiment.status !== 'RUNNING') {
      return NextResponse.json(
        { error: `Cannot stop experiment with status: ${experiment.status}. Only RUNNING experiments can be stopped.` },
        { status: 400 }
      )
    }
    
    // Update status to STOPPED
    await query(
      'UPDATE experiments SET status = $1 WHERE id = $2',
      ['STOPPED', experimentId]
    )
    
    return NextResponse.json({ success: true, status: 'STOPPED' })
  } catch (error: any) {
    console.error('Error stopping experiment:', error)
    return NextResponse.json(
      { error: 'Failed to stop experiment' },
      { status: 500 }
    )
  }
}
