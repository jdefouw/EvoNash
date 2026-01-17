import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'

// GET /api/experiments/[id]/status - Get experiment status
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { data, error } = await supabaseAdmin
      .from('experiments')
      .select('id, status, created_at, completed_at')
      .eq('id', params.id)
      .single()

    if (error) throw error

    // Get latest generation to show progress
    const { data: latestGen } = await supabaseAdmin
      .from('generations')
      .select('generation_number')
      .eq('experiment_id', params.id)
      .order('generation_number', { ascending: false })
      .limit(1)
      .single()

    return NextResponse.json({
      ...data,
      current_generation: latestGen?.generation_number || 0
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}
