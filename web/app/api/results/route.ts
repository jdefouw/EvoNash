import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

// Handle result uploads from workers (supports both single and batch uploads)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const supabase = await createServerClient()
    
    const { job_id, experiment_id, generation_stats, generation_stats_batch, matches } = body
    
    console.log(`[RESULTS] Received upload request for experiment ${experiment_id}, job ${job_id}`)
    
    if (!experiment_id) {
      return NextResponse.json(
        { error: 'Missing required field: experiment_id' },
        { status: 400 }
      )
    }
    
    // Support both single generation_stats and batch generation_stats_batch
    const statsArray = generation_stats_batch || (generation_stats ? [generation_stats] : [])
    
    if (statsArray.length === 0) {
      return NextResponse.json(
        { error: 'Missing required field: generation_stats or generation_stats_batch' },
        { status: 400 }
      )
    }
    
    // Validate job assignment exists
    if (job_id) {
      const { data: jobAssignment } = await supabase
        .from('job_assignments')
        .select('*')
        .eq('job_id', job_id)
        .single()
      
      if (!jobAssignment) {
        return NextResponse.json(
          { error: 'Job assignment not found' },
          { status: 404 }
        )
      }
      
      // Update job assignment status to processing (if not already)
      if (jobAssignment.status === 'assigned') {
        await supabase
          .from('job_assignments')
          .update({ 
            status: 'processing',
            started_at: new Date().toISOString()
          })
          .eq('id', jobAssignment.id)
      }
    }
    
    // Insert all generations in batch
    const generationInserts = statsArray.map((stats: any) => {
      const generation_number = stats.generation !== undefined ? stats.generation : null
      
      if (generation_number === null) {
        throw new Error('Generation number is required in generation_stats')
      }
      
      return {
        experiment_id,
        generation_number,
        population_size: stats.population_size || 1000,
        avg_fitness: stats.avg_fitness,
        avg_elo: stats.avg_elo,
        peak_elo: stats.peak_elo,
        min_elo: stats.min_elo,
        std_elo: stats.std_elo,
        policy_entropy: stats.policy_entropy,
        entropy_variance: stats.entropy_variance,
        population_diversity: stats.population_diversity,
        mutation_rate: stats.mutation_rate,
        min_fitness: stats.min_fitness,
        max_fitness: stats.max_fitness,
        std_fitness: stats.std_fitness
      }
    })
    
    const { data: insertedGenerations, error: genError } = await supabase
      .from('generations')
      .insert(generationInserts)
      .select()
    
    if (genError) {
      console.error(`[RESULTS] Error inserting generations for experiment ${experiment_id}:`, genError)
      return NextResponse.json({ error: genError.message }, { status: 500 })
    }
    
    console.log(`[RESULTS] Successfully saved ${insertedGenerations.length} generations for experiment ${experiment_id}`)
    
    // Insert matches if provided (flatten matches array if it's an array of arrays)
    if (matches && matches.length > 0) {
      const allMatches = Array.isArray(matches[0]) ? matches.flat() : matches
      const matchInserts = allMatches.map((match: any, idx: number) => {
        // Find corresponding generation_id
        const generation = insertedGenerations?.find((g: any) => 
          g.generation_number === match.generation_number
        )
        if (!generation) {
          // Fallback: use first generation if match doesn't specify generation_number
          return null
        }
        
        return {
          experiment_id,
          generation_id: generation.id,
          agent_a_id: match.agent_a_id,
          agent_b_id: match.agent_b_id,
          winner_id: match.winner_id,
          match_type: match.match_type || 'self_play',
          move_history: match.move_history || [],
          telemetry: match.telemetry || {}
        }
      }).filter((m: any) => m !== null)
      
      if (matchInserts.length > 0) {
        await supabase.from('matches').insert(matchInserts)
      }
    }
    
    // Update job assignment status to completed
    if (job_id) {
      const { data: jobAssignment } = await supabase
        .from('job_assignments')
        .select('*')
        .eq('job_id', job_id)
        .single()
      
      if (jobAssignment) {
        await supabase
          .from('job_assignments')
          .update({ 
            status: 'completed',
            completed_at: new Date().toISOString()
          })
          .eq('id', jobAssignment.id)
      }
    }
    
    // Check if all batches for experiment are complete
    const { data: experiment } = await supabase
      .from('experiments')
      .select('max_generations')
      .eq('id', experiment_id)
      .single()
    
    if (experiment) {
      // Check if all job assignments are completed
      const { data: allAssignments } = await supabase
        .from('job_assignments')
        .select('status')
        .eq('experiment_id', experiment_id)
      
      const allCompleted = allAssignments && allAssignments.every((a: any) => a.status === 'completed')
      
      // Also check if we have all generations
      const { data: allGenerations } = await supabase
        .from('generations')
        .select('generation_number')
        .eq('experiment_id', experiment_id)
      
      const hasAllGenerations = allGenerations && allGenerations.length >= experiment.max_generations
      
      if (allCompleted && hasAllGenerations) {
        console.log(`[RESULTS] All batches completed for experiment ${experiment_id}, marking as COMPLETED`)
        await supabase
          .from('experiments')
          .update({ status: 'COMPLETED', completed_at: new Date().toISOString() })
          .eq('id', experiment_id)
      } else {
        const completedBatches = allAssignments?.filter((a: any) => a.status === 'completed').length || 0
        const totalBatches = allAssignments?.length || 0
        console.log(`[RESULTS] Batch saved. Progress: ${completedBatches}/${totalBatches} batches, ${allGenerations?.length || 0}/${experiment.max_generations} generations`)
      }
    }
    
    return NextResponse.json({ 
      success: true, 
      generations_inserted: insertedGenerations?.length || 0,
      generation_ids: insertedGenerations?.map((g: any) => g.id) || []
    })
  } catch (error: any) {
    console.error(`[RESULTS] Unexpected error processing upload:`, error)
    return NextResponse.json(
      { error: 'Failed to upload results', details: error?.message || String(error) },
      { status: 500 }
    )
  }
}
