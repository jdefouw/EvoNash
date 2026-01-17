import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/server'

// POST /api/experiments/[id]/start - Start an experiment
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabaseAdmin = getSupabaseAdmin()
    // Update experiment status to RUNNING
    const { data, error } = await supabaseAdmin
      .from('experiments')
      .update({ status: 'RUNNING' })
      .eq('id', params.id)
      .select()
      .single()

    if (error) throw error

    // TODO: Queue job for worker to process
    // This would typically add a job to a queue system

    return NextResponse.json(data)
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}
