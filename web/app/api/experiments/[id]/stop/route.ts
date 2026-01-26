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
    
    // First, check if experiment exists and is RUNNING
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
    
    if (experiment.status !== 'RUNNING') {
      return NextResponse.json(
        { error: `Cannot stop experiment with status: ${experiment.status}. Only RUNNING experiments can be stopped.` },
        { status: 400 }
      )
    }
    
    // Update status to STOPPED
    const { error: updateError } = await supabase
      .from('experiments')
      .update({ status: 'STOPPED' })
      .eq('id', experimentId)
    
    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }
    
    return NextResponse.json({ success: true, status: 'STOPPED' })
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to stop experiment' },
      { status: 500 }
    )
  }
}
