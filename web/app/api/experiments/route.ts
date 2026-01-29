import { NextRequest, NextResponse } from 'next/server'
import { queryAll, insertOne, query } from '@/lib/postgres'
import { Experiment, ExperimentConfig } from '@/types/protocol'

// Force dynamic rendering since we query the database
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const data = await queryAll<Experiment>(
      'SELECT * FROM experiments ORDER BY created_at DESC'
    )
    
    return NextResponse.json(data || [])
  } catch (error) {
    console.error('Error fetching experiments:', error)
    // Return empty array on error to prevent client-side issues
    return NextResponse.json([])
  }
}

export async function POST(request: NextRequest) {
  try {
    console.log('POST /api/experiments - Starting request')
    const body = await request.json()
    console.log('Request body received:', { 
      experiment_name: body.experiment_name,
      experiment_group: body.experiment_group,
      bulk_count: body.bulk_count
    })
    
    const {
      experiment_name,
      experiment_group,
      random_seed,
      population_size,
      max_generations,
      ticks_per_generation,
      mutation_rate,
      mutation_base,
      max_possible_elo,
      selection_pressure,
      network_architecture,
      bulk_count
    } = body
    
    // Validate required fields
    if (!experiment_name || !experiment_group) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }
    
    // Derive mutation_mode from experiment_group
    // CONTROL = STATIC mutation (fixed rate ε = 0.05)
    // EXPERIMENTAL = ADAPTIVE mutation (fitness-scaled ε = f(Elo))
    const mutation_mode = experiment_group === 'CONTROL' ? 'STATIC' : 'ADAPTIVE'
    
    // Validate bulk_count if provided
    const validatedBulkCount = bulk_count ? Math.max(1, Math.min(100, parseInt(bulk_count) || 1)) : 1
    
    // Handle bulk creation
    if (validatedBulkCount > 1) {
      console.log(`Bulk creating ${validatedBulkCount} experiments with base name: ${experiment_name}`)
      
      const experiments: Experiment[] = []
      const configs: ExperimentConfig[] = []
      
      // Use a transaction for atomicity
      await query('BEGIN')
      
      try {
        for (let i = 1; i <= validatedBulkCount; i++) {
          const numberedName = `${experiment_name} ${i}`
          
          const insertData = {
            experiment_name: numberedName,
            experiment_group,
            mutation_mode,
            random_seed: random_seed || 42,
            population_size: population_size || 1000,
            max_generations: max_generations || 1500,
            ticks_per_generation: ticks_per_generation || 750,
            mutation_rate: mutation_rate || null,
            mutation_base: mutation_base || null,
            max_possible_elo: max_possible_elo || 2000.0,
            selection_pressure: selection_pressure || 0.2,
            network_architecture: JSON.stringify(network_architecture || {
              input_size: 24,
              hidden_layers: [64],
              output_size: 4
            }),
            status: 'PENDING'
          }
          
          const data = await insertOne<Experiment>('experiments', insertData)
          experiments.push(data)
          
          configs.push({
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
            ticks_per_generation: data.ticks_per_generation || 750,
            network_architecture: data.network_architecture,
            experiment_group: data.experiment_group
          })
        }
        
        await query('COMMIT')
        console.log(`Successfully created ${experiments.length} experiments`)
        
        return NextResponse.json({ 
          experiments, 
          configs,
          count: experiments.length 
        })
      } catch (bulkError) {
        await query('ROLLBACK')
        throw bulkError
      }
    }
    
    // Single experiment creation (original logic)
    const insertData = {
      experiment_name,
      experiment_group,
      mutation_mode,
      random_seed: random_seed || 42,
      population_size: population_size || 1000,
      max_generations: max_generations || 1500,
      ticks_per_generation: ticks_per_generation || 750,
      mutation_rate: mutation_rate || null,
      mutation_base: mutation_base || null,
      max_possible_elo: max_possible_elo || 2000.0,
      selection_pressure: selection_pressure || 0.2,
      network_architecture: JSON.stringify(network_architecture || {
        input_size: 24,
        hidden_layers: [64],
        output_size: 4
      }),
      status: 'PENDING'
    }
    
    console.log('Inserting experiment data:', insertData)
    
    const data = await insertOne<Experiment>('experiments', insertData)
    
    console.log('Experiment created successfully:', data.id)
    
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
      ticks_per_generation: data.ticks_per_generation || 750,
      network_architecture: data.network_architecture,
      experiment_group: data.experiment_group
    }
    
    return NextResponse.json({ experiment: data, config })
  } catch (error) {
    console.error('Error creating experiment:', error)
    const errorMessage = error instanceof Error ? error.message : 'Failed to create experiment'
    const errorStack = error instanceof Error ? error.stack : undefined
    console.error('Error stack:', errorStack)
    return NextResponse.json(
      { 
        error: errorMessage,
        type: error instanceof Error ? error.constructor.name : 'Unknown',
        message: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    )
  }
}
