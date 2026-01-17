import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

// Handle result uploads from workers
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const supabase = await createServerClient()
    
    const { job_id, experiment_id, generation_stats, matches } = body
    
    if (!experiment_id || !generation_stats) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }
    
    // Get current generation number (increment from last)
    const { data: lastGen } = await supabase
      .from('generations')
      .select('generation_number')
      .eq('experiment_id', experiment_id)
      .order('generation_number', { ascending: false })
      .limit(1)
      .single()
    
    const generation_number = lastGen ? lastGen.generation_number + 1 : 0
    
    // Insert generation stats
    const { data: generation, error: genError } = await supabase
      .from('generations')
      .insert({
        experiment_id,
        generation_number,
        population_size: generation_stats.population_size || 1000,
        avg_fitness: generation_stats.avg_fitness,
        avg_elo: generation_stats.avg_elo,
        peak_elo: generation_stats.peak_elo,
        min_elo: generation_stats.min_elo,
        std_elo: generation_stats.std_elo,
        policy_entropy: generation_stats.policy_entropy,
        entropy_variance: generation_stats.entropy_variance,
        population_diversity: generation_stats.population_diversity,
        mutation_rate: generation_stats.mutation_rate,
        min_fitness: generation_stats.min_fitness,
        max_fitness: generation_stats.max_fitness,
        std_fitness: generation_stats.std_fitness
      })
      .select()
      .single()
    
    if (genError) {
      return NextResponse.json({ error: genError.message }, { status: 500 })
    }
    
    // Insert matches if provided
    if (matches && matches.length > 0) {
      const matchInserts = matches.map((match: any) => ({
        experiment_id,
        generation_id: generation.id,
        agent_a_id: match.agent_a_id,
        agent_b_id: match.agent_b_id,
        winner_id: match.winner_id,
        match_type: match.match_type || 'self_play',
        move_history: match.move_history || [],
        telemetry: match.telemetry || {}
      }))
      
      await supabase.from('matches').insert(matchInserts)
    }
    
    // Update experiment status if this is the last generation
    const { data: experiment } = await supabase
      .from('experiments')
      .select('max_generations')
      .eq('id', experiment_id)
      .single()
    
    if (experiment && generation_number >= experiment.max_generations - 1) {
      await supabase
        .from('experiments')
        .update({ status: 'COMPLETED', completed_at: new Date().toISOString() })
        .eq('id', experiment_id)
    }
    
    return NextResponse.json({ success: true, generation_id: generation.id })
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to upload results' },
      { status: 500 }
    )
  }
}
