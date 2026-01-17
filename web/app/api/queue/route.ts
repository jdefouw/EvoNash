import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { ExperimentConfig } from '@/types/protocol'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient()
    
    // Log worker poll attempt
    const clientIp = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'
    console.log(`[QUEUE] Worker poll from ${clientIp} at ${new Date().toISOString()}`)
    
    // Find a PENDING experiment
    const { data: experiment, error: fetchError } = await supabase
      .from('experiments')
      .select('*')
      .eq('status', 'PENDING')
      .limit(1)
      .single()
    
    if (fetchError || !experiment) {
      console.log(`[QUEUE] No PENDING experiments available`)
      return NextResponse.json(
        { error: 'No pending experiments available' },
        { status: 404 }
      )
    }
    
    console.log(`[QUEUE] Found PENDING experiment: ${experiment.id} - ${experiment.experiment_name}`)
    
    // Update status to RUNNING
    const { error: updateError } = await supabase
      .from('experiments')
      .update({ status: 'RUNNING' })
      .eq('id', experiment.id)
    
    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }
    
    // Create experiment config for worker
    const config: ExperimentConfig = {
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
    
    // Generate job ID (UUID)
    const job_id = crypto.randomUUID()
    
    return NextResponse.json({
      job_id,
      experiment_id: experiment.id,
      experiment_config: config
    })
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to process job request' },
      { status: 500 }
    )
  }
}

