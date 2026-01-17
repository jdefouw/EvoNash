import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

// Handle result uploads from workers
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const supabase = await createServerClient()
    
    const { job_id, experiment_id, generation_stats, matches } = body
    
    console.log(`[RESULTS] Received upload request for experiment ${experiment_id}, job ${job_id}`)
    
    if (!experiment_id || !generation_stats) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }
    
    // Get current generation number - prefer the one from stats, fallback to incrementing from DB
    let generation_number: number
    
    if (generation_stats.generation !== undefined && generation_stats.generation !== null) {
      // Use generation number directly from stats (most reliable)
      generation_number = generation_stats.generation
      console.log(`[RESULTS] Using generation number from stats: ${generation_number}`)
    } else {
      // Fallback: increment from last generation in database
      const { data: lastGenData } = await supabase
        .from('generations')
        .select('generation_number')
        .eq('experiment_id', experiment_id)
        .order('generation_number', { ascending: false })
        .limit(1)
      
      if (lastGenData && lastGenData.length > 0) {
        generation_number = lastGenData[0].generation_number + 1
        console.log(`[RESULTS] Incremented generation number from DB: ${generation_number}`)
      } else {
        generation_number = 0
        console.log(`[RESULTS] No existing generations, starting at 0`)
      }
    }
    
    console.log(`[RESULTS] Uploading generation ${generation_number} for experiment ${experiment_id}`)
    
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
      console.error(`[RESULTS] Error inserting generation ${generation_number} for experiment ${experiment_id}:`, genError)
      return NextResponse.json({ error: genError.message }, { status: 500 })
    }
    
    console.log(`[RESULTS] Successfully saved generation ${generation_number} (ID: ${generation.id}) for experiment ${experiment_id}`)
    
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
    
    if (experiment) {
      // Check if this is the last generation (generation numbers are 0-indexed)
      // If max_generations is 100, we have generations 0-99, so last is generation 99
      const is_last_generation = generation_number >= experiment.max_generations - 1
      
      if (is_last_generation) {
        console.log(`[RESULTS] Last generation (${generation_number}) reached, marking experiment as COMPLETED`)
        await supabase
          .from('experiments')
          .update({ status: 'COMPLETED', completed_at: new Date().toISOString() })
          .eq('id', experiment_id)
      } else {
        const remaining = experiment.max_generations - generation_number - 1
        console.log(`[RESULTS] Generation ${generation_number} saved, ${remaining} generations remaining`)
      }
    }
    
    return NextResponse.json({ success: true, generation_id: generation.id })
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to upload results' },
      { status: 500 }
    )
  }
}
