import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

// Force dynamic rendering since we modify the database
export const dynamic = 'force-dynamic'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const supabase = await createServerClient()
    
    // Handle both sync and async params (Next.js 13+ vs 15+)
    const resolvedParams = await Promise.resolve(params)
    const experimentId = resolvedParams.id
    
    // Check current status
    const { data: experiment, error: fetchError } = await supabase
      .from('experiments')
      .select('status')
      .eq('id', experimentId)
      .single()
    
    if (fetchError || !experiment) {
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
    const { error } = await supabase
      .from('experiments')
      .update({ status: 'PENDING' })
      .eq('id', experimentId)
    
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    
    console.log(`[START] Experiment ${experimentId} queued for GPU worker`)
    
    return NextResponse.json({ 
      success: true, 
      status: 'PENDING',
      message: 'Experiment queued for GPU worker. Worker will pick it up within 30 seconds.'
    })
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to start experiment' },
      { status: 500 }
    )
  }
}
