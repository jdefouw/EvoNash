import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { Generation, Match } from '@/types/protocol'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createServerClient()
    const { searchParams } = new URL(request.url)
    
    // Get optional timestamp for incremental updates
    const sinceTimestamp = searchParams.get('since')
    const lastGenerationNumber = searchParams.get('last_gen')
    
    // Fetch experiment status
    const { data: experiment, error: expError } = await supabase
      .from('experiments')
      .select('status, max_generations')
      .eq('id', params.id)
      .single()
    
    if (expError || !experiment) {
      return NextResponse.json({ error: 'Experiment not found' }, { status: 404 })
    }
    
    // Fetch latest generation
    let genQuery = supabase
      .from('generations')
      .select('*')
      .eq('experiment_id', params.id)
      .order('generation_number', { ascending: false })
      .limit(1)
    
    // If we have a last generation number, only fetch if there's a newer one
    if (lastGenerationNumber) {
      genQuery = genQuery.gt('generation_number', parseInt(lastGenerationNumber))
    }
    
    const { data: generations, error: genError } = await genQuery
    
    if (genError) {
      return NextResponse.json({ error: genError.message }, { status: 500 })
    }
    
    const latestGeneration = generations && generations.length > 0 ? generations[0] : null
    
    // Fetch new matches since timestamp (if provided)
    let matchesQuery = supabase
      .from('matches')
      .select('*')
      .eq('experiment_id', params.id)
      .order('created_at', { ascending: false })
      .limit(50) // Limit to most recent 50 matches
    
    if (sinceTimestamp) {
      matchesQuery = matchesQuery.gt('created_at', sinceTimestamp)
    } else if (latestGeneration) {
      // If no timestamp but we have a generation, get matches from latest generation
      matchesQuery = matchesQuery.eq('generation_id', latestGeneration.id)
    }
    
    const { data: matches, error: matchesError } = await matchesQuery
    
    if (matchesError) {
      return NextResponse.json({ error: matchesError.message }, { status: 500 })
    }
    
    const hasUpdates = latestGeneration !== null && (
      !lastGenerationNumber || 
      latestGeneration.generation_number > parseInt(lastGenerationNumber)
    )
    
    // Always return the latest generation even if no updates, so UI can show current progress
    return NextResponse.json({
      generation: latestGeneration,
      matches: matches || [],
      experiment_status: experiment.status,
      has_updates: hasUpdates,
      max_generations: experiment.max_generations,
      current_generation: latestGeneration?.generation_number || 0,
      total_generations: experiment.max_generations
    })
  } catch (error) {
    console.error('Error in live endpoint:', error)
    return NextResponse.json(
      { error: 'Failed to fetch live data' },
      { status: 500 }
    )
  }
}
