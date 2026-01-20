import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

// Increase max duration for large payload processing
export const maxDuration = 60

// Handle result uploads from workers (supports both single and batch uploads)
export async function POST(request: NextRequest) {
  try {
    // Handle payload size errors gracefully
    let body
    try {
      body = await request.json()
    } catch (parseError: any) {
      const errorMessage = (parseError?.message || String(parseError)).toLowerCase()
      // Check for various payload size error messages
      if (errorMessage.includes('too large') || 
          errorMessage.includes('413') || 
          errorMessage.includes('payload') ||
          errorMessage.includes('request entity too large') ||
          errorMessage.includes('body size limit') ||
          errorMessage.includes('max body size')) {
        console.error(`[RESULTS] Payload too large error:`, parseError?.message || String(parseError))
        return NextResponse.json(
          { 
            error: 'Payload too large', 
            details: 'The results data exceeds the maximum allowed size (typically 4.5MB for serverless functions). Consider reducing batch size or splitting the upload.',
            hint: 'Try reducing the number of generations per batch, matches per upload, or limit the amount of telemetry data included'
          },
          { status: 413 }
        )
      }
      // Re-throw if it's a different error
      throw parseError
    }
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
    
    // Prepare generation inserts
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
    
    // Check which generations already exist to avoid duplicate key errors
    const generationNumbers = generationInserts.map((g: any) => g.generation_number)
    const { data: existingGenerations, error: checkError } = await supabase
      .from('generations')
      .select('generation_number')
      .eq('experiment_id', experiment_id)
      .in('generation_number', generationNumbers)
    
    if (checkError) {
      console.error(`[RESULTS] Error checking existing generations:`, checkError)
      return NextResponse.json({ error: checkError.message }, { status: 500 })
    }
    
    // Filter out generations that already exist
    const existingNumbers = new Set((existingGenerations || []).map((g: any) => g.generation_number))
    const newGenerationInserts = generationInserts.filter((g: any) => !existingNumbers.has(g.generation_number))
    
    let insertedGenerations: any[] = []
    
    // Only insert if there are new generations
    if (newGenerationInserts.length > 0) {
      const { data: inserted, error: genError } = await supabase
        .from('generations')
        .insert(newGenerationInserts)
        .select()
      
      if (genError) {
        console.error(`[RESULTS] Error inserting generations for experiment ${experiment_id}:`, genError)
        return NextResponse.json({ error: genError.message }, { status: 500 })
      }
      
      insertedGenerations = inserted || []
      console.log(`[RESULTS] Successfully saved ${insertedGenerations.length} new generations for experiment ${experiment_id} (${existingNumbers.size} already existed)`)
    } else {
      console.log(`[RESULTS] All ${generationNumbers.length} generations already exist for experiment ${experiment_id}, skipping insert`)
      
      // Fetch existing generations for return value
      const { data: existing } = await supabase
        .from('generations')
        .select('*')
        .eq('experiment_id', experiment_id)
        .in('generation_number', generationNumbers)
      
      insertedGenerations = existing || []
    }
    
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
        const { error: updateError } = await supabase
          .from('job_assignments')
          .update({ 
            status: 'completed',
            completed_at: new Date().toISOString()
          })
          .eq('id', jobAssignment.id)
        
        if (updateError) {
          console.error(`[RESULTS] Error updating job assignment status:`, updateError)
        }
      }
    }
    
    // Check if all batches for experiment are complete
    const { data: experiment } = await supabase
      .from('experiments')
      .select('max_generations, status')
      .eq('id', experiment_id)
      .single()
    
    if (experiment) {
      // Check if we have all generations (this is the primary indicator of completion)
      // Generation numbers are 0-indexed, so for max_generations=500, we need generations 0-499
      const { data: allGenerations } = await supabase
        .from('generations')
        .select('generation_number')
        .eq('experiment_id', experiment_id)
      
      const generationNumbers = new Set((allGenerations || []).map((g: any) => g.generation_number))
      const expectedGenerations = new Set(Array.from({ length: experiment.max_generations }, (_, i) => i))
      
      // Check if we have all required generations (0 to max_generations-1)
      const hasAllGenerations = generationNumbers.size >= experiment.max_generations && 
        Array.from(expectedGenerations).every(gen => generationNumbers.has(gen))
      
      // Re-fetch job assignments AFTER the update to ensure we see the latest status
      // This avoids race conditions where the update hasn't been committed yet
      const { data: allAssignments } = await supabase
        .from('job_assignments')
        .select('status, started_at, assigned_at')
        .eq('experiment_id', experiment_id)
      
      // Only check for completion if experiment is still RUNNING or PENDING
      if (hasAllGenerations && (experiment.status === 'RUNNING' || experiment.status === 'PENDING')) {
        // Check if there are any truly active assignments (assigned or recently started processing)
        // Allow some grace period for assignments that might be stuck
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
        
        // Mark as COMPLETED if we have all generations and no active assignments
        // This ensures completion even if some assignments are stuck or failed
        if (!hasActiveAssignments) {
          console.log(`[RESULTS] All generations complete for experiment ${experiment_id} (${generationNumbers.size}/${experiment.max_generations} generations), marking as COMPLETED`)
          const { error: updateError } = await supabase
            .from('experiments')
            .update({ status: 'COMPLETED', completed_at: new Date().toISOString() })
            .eq('id', experiment_id)
          
          if (updateError) {
            console.error(`[RESULTS] Error updating experiment status:`, updateError)
          } else {
            console.log(`[RESULTS] ✓ Successfully marked experiment ${experiment_id} as COMPLETED`)
          }
        } else {
          const completedBatches = allAssignments?.filter((a: any) => a.status === 'completed').length || 0
          const totalBatches = allAssignments?.length || 0
          const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString()
          const activeBatches = allAssignments?.filter((a: any) => 
            a.status === 'assigned' || (a.status === 'processing' && (a.started_at || a.assigned_at) > tenMinutesAgo)
          ).length || 0
          const missingGenerations = Array.from(expectedGenerations).filter(gen => !generationNumbers.has(gen))
          console.log(`[RESULTS] Batch saved. Progress: ${completedBatches}/${totalBatches} batches (${activeBatches} active), ${generationNumbers.size}/${experiment.max_generations} generations. Missing: ${missingGenerations.length > 0 ? missingGenerations.slice(0, 10).join(',') + (missingGenerations.length > 10 ? '...' : '') : 'none'}`)
        }
      } else {
        // Log progress even if not checking for completion
        const completedBatches = allAssignments?.filter((a: any) => a.status === 'completed').length || 0
        const totalBatches = allAssignments?.length || 0
        const activeBatches = allAssignments?.filter((a: any) => a.status === 'assigned' || a.status === 'processing').length || 0
        const missingGenerations = Array.from(expectedGenerations).filter(gen => !generationNumbers.has(gen))
        console.log(`[RESULTS] Batch saved. Status: ${experiment.status}, Progress: ${completedBatches}/${totalBatches} batches (${activeBatches} active), ${generationNumbers.size}/${experiment.max_generations} generations. Missing: ${missingGenerations.length > 0 ? missingGenerations.slice(0, 10).join(',') + (missingGenerations.length > 10 ? '...' : '') : 'none'}`)
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
