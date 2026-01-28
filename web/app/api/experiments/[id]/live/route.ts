import { NextRequest, NextResponse } from 'next/server'
import { queryOne, queryAll, query } from '@/lib/postgres'
import { Generation, Match } from '@/types/protocol'

// Force dynamic rendering since we query the database
export const dynamic = 'force-dynamic'

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
    
    const { searchParams } = new URL(request.url)
    
    // Get optional timestamp for incremental updates
    const sinceTimestamp = searchParams.get('since')
    const lastGenerationNumber = searchParams.get('last_gen')
    
    // Fetch experiment status
    const experiment = await queryOne<{ status: string; max_generations: number }>(
      'SELECT status, max_generations FROM experiments WHERE id = $1',
      [experimentId]
    )
    
    if (!experiment) {
      console.error(`[LIVE] Experiment not found: ${experimentId}`)
      return NextResponse.json({ error: 'Experiment not found' }, { status: 404 })
    }
    
    // Check if experiment should be marked as COMPLETED
    // This catches cases where all generations exist but status wasn't updated
    let currentStatus = experiment.status
    if (currentStatus === 'RUNNING' || currentStatus === 'PENDING') {
      const allGenerations = await queryAll<{ generation_number: number }>(
        'SELECT generation_number FROM generations WHERE experiment_id = $1',
        [experimentId]
      )
      
      const generationNumbers = new Set((allGenerations || []).map((g: any) => g.generation_number))
      const expectedGenerations = new Set(Array.from({ length: experiment.max_generations }, (_, i) => i))
      
      // Check if we have all required generations (0 to max_generations-1)
      const hasAllGenerations = generationNumbers.size >= experiment.max_generations && 
        Array.from(expectedGenerations).every(gen => generationNumbers.has(gen))
      
      // FALLBACK: Also check if the final generation exists and count is sufficient
      const finalGenerationExists = generationNumbers.has(experiment.max_generations - 1)
      const hasEnoughGenerations = generationNumbers.size >= experiment.max_generations
      const shouldComplete = hasAllGenerations || (finalGenerationExists && hasEnoughGenerations)
      
      if (shouldComplete) {
        const reason = hasAllGenerations 
          ? `all ${generationNumbers.size} generations present`
          : `final generation ${experiment.max_generations - 1} exists with ${generationNumbers.size} total`
        console.log(`[LIVE] Experiment ${experimentId} completing: ${reason}`)
        
        // Mark as COMPLETED
        await query(
          'UPDATE experiments SET status = $1, completed_at = $2 WHERE id = $3',
          ['COMPLETED', new Date().toISOString(), experimentId]
        )
        
        currentStatus = 'COMPLETED'
        console.log(`[LIVE] ✓ Successfully marked experiment ${experimentId} as COMPLETED`)
      } else {
        // Log why we're not completing
        const missingGens = Array.from(expectedGenerations).filter(gen => !generationNumbers.has(gen))
        const maxGenInDb = generationNumbers.size > 0 ? Math.max(...Array.from(generationNumbers)) : -1
        console.log(`[LIVE] Experiment ${experimentId} not complete: have ${generationNumbers.size}/${experiment.max_generations} generations (max in DB: ${maxGenInDb}). Missing: ${missingGens.slice(0, 10).join(',')}${missingGens.length > 10 ? '...' : ''}`)
      }
    }
    
    // Always fetch the absolute latest generation so the UI can show current progress.
    const latestGenRows = await queryAll<Generation>(
      `SELECT * FROM generations 
       WHERE experiment_id = $1 
       ORDER BY generation_number DESC 
       LIMIT 1`,
      [experimentId]
    )
    
    const latestGeneration = latestGenRows && latestGenRows.length > 0 ? latestGenRows[0] : null
    
    // Fetch new matches since timestamp (if provided)
    let matches: Match[] = []
    
    if (sinceTimestamp) {
      matches = await queryAll<Match>(
        `SELECT * FROM matches 
         WHERE experiment_id = $1 AND created_at > $2
         ORDER BY created_at DESC 
         LIMIT 50`,
        [experimentId, sinceTimestamp]
      ) || []
    } else if (latestGeneration) {
      // If no timestamp but we have a generation, get matches from latest generation
      matches = await queryAll<Match>(
        `SELECT * FROM matches 
         WHERE experiment_id = $1 AND generation_id = $2
         ORDER BY created_at DESC 
         LIMIT 50`,
        [experimentId, latestGeneration.id]
      ) || []
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
