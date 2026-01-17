import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/server'

// GET /api/generations?experiment_id=xxx - Get generations for experiment
export async function GET(request: NextRequest) {
  try {
    const supabaseAdmin = getSupabaseAdmin()
    const { searchParams } = new URL(request.url)
    const experimentId = searchParams.get('experiment_id')

    if (!experimentId) {
      return NextResponse.json(
        { error: 'experiment_id is required' },
        { status: 400 }
      )
    }

    const { data, error } = await supabaseAdmin
      .from('generations')
      .select('*')
      .eq('experiment_id', experimentId)
      .order('generation_number', { ascending: true })

    if (error) throw error

    return NextResponse.json(data)
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}
