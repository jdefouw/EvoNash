import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'

// GET /api/agents?experiment_id=xxx&generation_id=xxx - Get agents
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const experimentId = searchParams.get('experiment_id')
    const generationId = searchParams.get('generation_id')

    let query = supabaseAdmin
      .from('agents')
      .select('*')

    if (experimentId) {
      query = query.eq('experiment_id', experimentId)
    }

    if (generationId) {
      query = query.eq('generation_id', generationId)
    }

    const { data, error } = await query.order('agent_index', { ascending: true })

    if (error) throw error

    return NextResponse.json(data)
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}
