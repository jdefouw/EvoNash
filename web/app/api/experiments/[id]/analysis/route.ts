import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createServerClient()
    
    // Get experiment
    const { data: experiment, error: expError } = await supabase
      .from('experiments')
      .select('*')
      .eq('id', params.id)
      .single()
    
    if (expError || !experiment) {
      return NextResponse.json({ error: 'Experiment not found' }, { status: 404 })
    }
    
    // Get all generations for this experiment
    const { data: generations, error: genError } = await supabase
      .from('generations')
      .select('*')
      .eq('experiment_id', params.id)
      .order('generation_number', { ascending: true })
    
    if (genError) {
      return NextResponse.json({ error: genError.message }, { status: 500 })
    }
    
    if (!generations || generations.length === 0) {
      return NextResponse.json({
        error: 'No generation data available',
        experiment: experiment
      })
    }
    
    // Calculate basic statistics
    const avg_elos = generations.map(g => g.avg_elo).filter(Boolean) as number[]
    const peak_elos = generations.map(g => g.peak_elo).filter(Boolean) as number[]
    const entropies = generations.map(g => g.policy_entropy).filter(Boolean) as number[]
    const entropy_variances = generations.map(g => g.entropy_variance).filter(Boolean) as number[]
    
    // Find convergence point (entropy variance < 0.01)
    const convergence_gen = generations.find(g => 
      g.entropy_variance !== null && g.entropy_variance < 0.01
    )
    
    const analysis = {
      experiment_id: params.id,
      total_generations: generations.length,
      final_avg_elo: avg_elos[avg_elos.length - 1] || null,
      final_peak_elo: peak_elos[peak_elos.length - 1] || null,
      peak_elo_overall: peak_elos.length > 0 ? Math.max(...peak_elos) : null,
      final_entropy: entropies[entropies.length - 1] || null,
      convergence_generation: convergence_gen?.generation_number || null,
      avg_elo_trend: avg_elos,
      entropy_trend: entropies,
      entropy_variance_trend: entropy_variances
    }
    
    return NextResponse.json(analysis)
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to generate analysis' },
      { status: 500 }
    )
  }
}
