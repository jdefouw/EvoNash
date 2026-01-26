import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { Generation, Match } from '@/types/protocol'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const experimentId = params.id
    
    if (!experimentId) {
      console.error('[LIVE] Missing experiment ID in params')
      return NextResponse.json({ error: 'Missing experiment ID' }, { status: 400 })
    }
    
    console.log(`[LIVE] Fetching live data for experiment: ${experimentId}`)
    
    const supabase = await createServerClient()
    const { searchParams } = new URL(request.url)
    
    // Get optional timestamp for incremental updates
    const sinceTimestamp = searchParams.get('since')
    const lastGenerationNumber = searchParams.get('last_gen')
    
    // Fetch experiment status
    const { data: experiment, error: expError } = await supabase
      .from('experiments')
      .select('status, max_generations')
      .eq('id', experimentId)
      .single()
    
    if (expError) {
      console.error(`[LIVE] Database error for experiment ${experimentId}:`, expError)
      // Return 500 for database errors, not 404
      return NextResponse.json({ 
        error: 'Database error', 
        details: expError.message 
      }, { status: 500 })
    }
    
    if (!experiment) {
      console.error(`[LIVE] Experiment not found: ${experimentId}`)
      return NextResponse.json({ error: 'Experiment not found' }, { status: 404 })
    }
    
    // Check if experiment should be marked as COMPLETED
    // This catches cases where all generations exist but status wasn't updated
    let currentStatus = experiment.status
    if (currentStatus === 'RUNNING' || currentStatus === 'PENDING') {
      const { data: allGenerations } = await supabase
        .from('generations')
        .select('generation_number')
        .eq('experiment_id', experimentId)
      
      const generationNumbers = new Set((allGenerations || []).map((g: any) => g.generation_number))
      const expectedGenerations = new Set(Array.from({ length: experiment.max_generations }, (_, i) => i))
      
      // Check if we have all required generations (0 to max_generations-1)
      const hasAllGenerations = generationNumbers.size >= experiment.max_generations && 
        Array.from(expectedGenerations).every(gen => generationNumbers.has(gen))
      
      if (hasAllGenerations) {
        // Check if there are any active job assignments
        // Use the same logic as results route: ignore stuck assignments older than 10 minutes
        const { data: allAssignments } = await supabase
          .from('job_assignments')
          .select('status, started_at, assigned_at')
          .eq('experiment_id', experimentId)
        
        const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString()
        const hasActiveAssignments = allAssignments && allAssignments.some((a: any) => {
          if (a.status === 'assigned') return true
          if (a.status === 'processing') {
            // Only consider it active if it started recently (within 10 minutes)
            // Stuck assignments older than 10 minutes won't block completion
            const checkTime = a.started_at || a.assigned_at
            return checkTime && checkTime > tenMinutesAgo
          }
          return false
        })
        
        // If we have all generations and no active assignments, mark as COMPLETED
        if (!hasActiveAssignments) {
          console.log(`[LIVE] Auto-marking experiment ${experimentId} as COMPLETED (${generationNumbers.size}/${experiment.max_generations} generations exist)`)
          const { error: updateError } = await supabase
            .from('experiments')
            .update({ status: 'COMPLETED', completed_at: new Date().toISOString() })
            .eq('id', experimentId)
          
          if (!updateError) {
            currentStatus = 'COMPLETED'
            console.log(`[LIVE] ✓ Successfully marked experiment ${experimentId} as COMPLETED`)
          } else {
            console.error(`[LIVE] Failed to update experiment status:`, updateError)
          }
        }
      }
    }
    
    // Fetch latest generation
    let genQuery = supabase
      .from('generations')
      .select('*')
      .eq('experiment_id', experimentId)
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
      .eq('experiment_id', experimentId)
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
    const response = {
      generation: latestGeneration,
      latestGeneration: latestGeneration, // Alias for consistency
      matches: matches || [],
      experiment_status: currentStatus, // Use potentially updated status
      has_updates: hasUpdates,
      max_generations: experiment.max_generations,
      current_generation: latestGeneration?.generation_number || 0,
      total_generations: experiment.max_generations
    }
    
    console.log(`[LIVE] Returning data for experiment ${experimentId}: gen=${latestGeneration?.generation_number || 0}, matches=${matches?.length || 0}, has_updates=${hasUpdates}`)
    
    return NextResponse.json(response)
  } catch (error) {
    console.error('[LIVE] Unexpected error in live endpoint:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { 
        error: 'Failed to fetch live data',
        details: errorMessage 
      },
      { status: 500 }
    )
  }
}
