import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/server'

// GET /api/experiments/[id]/analysis - Get statistical analysis
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabaseAdmin = getSupabaseAdmin()
    // Get experiment details
    const { data: experiment, error: expError } = await supabaseAdmin
      .from('experiments')
      .select('*')
      .eq('id', params.id)
      .single()

    if (expError) throw expError

    // Get all generations for this experiment
    const { data: generations, error: genError } = await supabaseAdmin
      .from('generations')
      .select('*')
      .eq('experiment_id', params.id)
      .order('generation_number', { ascending: true })

    if (genError) throw genError

    // Calculate basic statistics
    const stats = {
      total_generations: generations?.length || 0,
      avg_elo_over_time: generations?.map(g => g.avg_elo) || [],
      peak_elo: Math.max(...(generations?.map(g => g.peak_elo) || [0])),
      avg_entropy: generations?.length 
        ? generations.reduce((sum, g) => sum + (g.policy_entropy || 0), 0) / generations.length 
        : 0,
      convergence_gen: generations?.findIndex(g => (g.entropy_variance || 1) < 0.01) || null
    }

    return NextResponse.json({
      experiment,
      statistics: stats,
      generations: generations
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}
