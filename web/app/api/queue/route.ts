import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import type { JobRequest, JobResult } from '@/types/protocol'

// GET /api/queue - Worker polls for jobs
export async function GET(request: NextRequest) {
  try {
    // Find experiments that are RUNNING and have pending work
    // For now, return the first RUNNING experiment
    const { data: experiment, error } = await supabaseAdmin
      .from('experiments')
      .select('*')
      .eq('status', 'RUNNING')
      .limit(1)
      .single()

    if (error || !experiment) {
      return NextResponse.json({ job: null })
    }

    // Get current generation
    const { data: currentGen } = await supabaseAdmin
      .from('generations')
      .select('*')
      .eq('experiment_id', experiment.id)
      .order('generation_number', { ascending: false })
      .limit(1)
      .single()

    // Get agents for this generation
    const { data: agents } = await supabaseAdmin
      .from('agents')
      .select('id')
      .eq('experiment_id', experiment.id)
      .eq('generation_id', currentGen?.id || '')
      .limit(100)

    if (!currentGen || !agents || agents.length === 0) {
      return NextResponse.json({ job: null })
    }

    // Create job request
    const jobRequest: JobRequest = {
      job_id: crypto.randomUUID(),
      experiment_id: experiment.id,
      generation_id: currentGen.id,
      agent_ids: agents.map(a => a.id),
      match_type: 'self_play',
      num_batches: 10,
      batch_size: 10,
      experiment_config: {
        experiment_id: experiment.id,
        experiment_name: experiment.experiment_name,
        mutation_mode: experiment.mutation_mode,
        mutation_rate: experiment.mutation_rate,
        mutation_base: experiment.mutation_base,
        max_possible_elo: experiment.max_possible_elo,
        random_seed: experiment.random_seed,
        population_size: experiment.population_size,
        selection_pressure: experiment.selection_pressure,
        max_generations: experiment.max_generations,
        network_architecture: experiment.network_architecture,
        experiment_group: experiment.experiment_group
      }
    }

    return NextResponse.json({ job: jobRequest })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}

// POST /api/queue - Worker submits results
export async function POST(request: NextRequest) {
  try {
    const result: JobResult = await request.json()

    // Save matches
    if (result.matches && result.matches.length > 0) {
      const { error: matchError } = await supabaseAdmin
        .from('matches')
        .insert(result.matches.map(match => ({
          experiment_id: result.experiment_id,
          generation_id: result.generation_id || '',
          agent_a_id: match.agent_a_id,
          agent_b_id: match.agent_b_id,
          winner_id: match.winner_id,
          match_type: 'self_play',
          move_history: match.move_history,
          telemetry: match.telemetry
        })))

      if (matchError) throw matchError
    }

    // Update generation stats
    if (result.generation_stats && result.generation_id) {
      const { error: genError } = await supabaseAdmin
        .from('generations')
        .update({
          avg_fitness: result.generation_stats.avg_fitness,
          avg_elo: result.generation_stats.avg_elo,
          peak_elo: result.generation_stats.peak_elo,
          policy_entropy: result.generation_stats.policy_entropy,
          entropy_variance: result.generation_stats.entropy_variance,
          population_diversity: result.generation_stats.population_diversity,
          mutation_rate: result.generation_stats.mutation_rate
        })
        .eq('id', result.generation_id)

      if (genError) throw genError
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}
