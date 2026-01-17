import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { Experiment, ExperimentConfig } from '@/types/protocol'

export async function GET() {
  try {
    const supabase = await createServerClient()
    
    const { data, error } = await supabase
      .from('experiments')
      .select('*')
      .order('created_at', { ascending: false })
    
    if (error) {
      console.error('Supabase error:', error)
      // Return empty array instead of error to prevent client-side issues
      return NextResponse.json([])
    }
    
    return NextResponse.json(data || [])
  } catch (error) {
    console.error('Error fetching experiments:', error)
    // Return empty array on error to prevent client-side issues
    return NextResponse.json([])
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const supabase = await createServerClient()
    
    const {
      experiment_name,
      experiment_group,
      mutation_mode,
      random_seed,
      population_size,
      max_generations,
      mutation_rate,
      mutation_base,
      max_possible_elo,
      selection_pressure,
      network_architecture
    } = body
    
    // Validate required fields
    if (!experiment_name || !experiment_group || !mutation_mode) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }
    
    const { data, error } = await supabase
      .from('experiments')
      .insert({
        experiment_name,
        experiment_group,
        mutation_mode,
        random_seed: random_seed || 42,
        population_size: population_size || 1000,
        max_generations: max_generations || 5000,
        mutation_rate,
        mutation_base,
        max_possible_elo: max_possible_elo || 2000.0,
        selection_pressure: selection_pressure || 0.2,
        network_architecture: network_architecture || {
          input_size: 24,
          hidden_layers: [64],
          output_size: 4
        },
        status: 'PENDING'
      })
      .select()
      .single()
    
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    
    // Return experiment config for worker
    const config: ExperimentConfig = {
      experiment_id: data.id,
      experiment_name: data.experiment_name,
      mutation_mode: data.mutation_mode,
      mutation_rate: data.mutation_rate,
      mutation_base: data.mutation_base,
      max_possible_elo: data.max_possible_elo,
      random_seed: data.random_seed,
      population_size: data.population_size,
      selection_pressure: data.selection_pressure,
      max_generations: data.max_generations,
      network_architecture: data.network_architecture,
      experiment_group: data.experiment_group
    }
    
    return NextResponse.json({ experiment: data, config })
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to create experiment' },
      { status: 500 }
    )
  }
}
