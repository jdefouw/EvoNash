import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createServerClient()
    
    // First, check if experiment exists and is RUNNING
    const { data: experiment, error: fetchError } = await supabase
      .from('experiments')
      .select('status')
      .eq('id', params.id)
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
      .eq('id', params.id)
    
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
