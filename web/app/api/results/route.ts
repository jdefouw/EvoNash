import { NextRequest, NextResponse } from 'next/server'
import { queryOne, queryAll, query, rpc, insertMany } from '@/lib/postgres'

// Force dynamic rendering since we query the database
export const dynamic = 'force-dynamic'

// Nash equilibrium detection constants
const ABSOLUTE_THRESHOLD = 0.01     // Minimum floor for convergence threshold
const RELATIVE_THRESHOLD_PERCENT = 0.10  // 10% of peak variance
const STABILITY_WINDOW = 20         // Consecutive generations below threshold required
const POST_CONVERGENCE_BUFFER = 30  // Additional generations after convergence before completing

/**
 * Detect Nash equilibrium based on entropy variance convergence.
 * 
 * Algorithm:
 * 1. Find peak entropy variance (skip first 5 generations for stability)
 * 2. Use relative threshold (10% of peak) when peak is high, absolute (0.01) when peak is low
 * 3. Find when variance drops below threshold for STABILITY_WINDOW consecutive generations after peak
 * 4. Require POST_CONVERGENCE_BUFFER additional generations after convergence
 * 
 * @param experimentId - The experiment ID to check
 * @returns Object with equilibriumReached boolean and convergenceGeneration number
 */
async function detectEquilibrium(experimentId: string): Promise<{
  equilibriumReached: boolean
  convergenceGeneration: number | null
}> {
  // Query all generations ordered by generation_number
  const generations = await queryAll<{ generation_number: number; entropy_variance: number | null }>(
    `SELECT generation_number, entropy_variance 
     FROM generations 
     WHERE experiment_id = $1 
     ORDER BY generation_number ASC`,
    [experimentId]
  )
  
  // Need enough generations to detect equilibrium
  if (!generations || generations.length < STABILITY_WINDOW + POST_CONVERGENCE_BUFFER) {
    return { equilibriumReached: false, convergenceGeneration: null }
  }
  
  // Skip first 5 generations (unstable data)
  const varianceData = generations.slice(5).map(g => ({
    gen: g.generation_number,
    variance: g.entropy_variance ?? 0
  }))
  
  if (varianceData.length === 0) {
    return { equilibriumReached: false, convergenceGeneration: null }
  }
  
  // Find peak variance
  const peakVariance = Math.max(...varianceData.map(d => d.variance))
  const peakIndex = varianceData.findIndex(d => d.variance === peakVariance)
  
  // Must have diverged (peak > minimum threshold)
  if (peakVariance <= 0.0001) {
    return { equilibriumReached: false, convergenceGeneration: null }
  }
  
  // Use relative threshold (10% of peak) when peak is high, absolute when peak is low
  const relativeThreshold = peakVariance * RELATIVE_THRESHOLD_PERCENT
  const effectiveThreshold = Math.max(ABSOLUTE_THRESHOLD, relativeThreshold)
  
  // Get data after peak
  const afterPeak = varianceData.slice(peakIndex)
  
  // Find first generation that starts a stable run of STABILITY_WINDOW generations below threshold
  let convergenceGen: number | null = null
  for (let i = 0; i <= afterPeak.length - STABILITY_WINDOW; i++) {
    const window = afterPeak.slice(i, i + STABILITY_WINDOW)
    if (window.every(d => d.variance < effectiveThreshold)) {
      convergenceGen = window[0].gen
      break
    }
  }
  
  // Check if we have POST_CONVERGENCE_BUFFER generations after convergence
  if (convergenceGen !== null) {
    const maxGen = generations[generations.length - 1].generation_number
    const gensPastConvergence = maxGen - convergenceGen
    
    if (gensPastConvergence >= POST_CONVERGENCE_BUFFER) {
      console.log(`[detectEquilibrium] Nash equilibrium confirmed: convergence at gen ${convergenceGen}, ${gensPastConvergence} generations past (threshold: ${effectiveThreshold.toFixed(4)}, peak: ${peakVariance.toFixed(4)})`)
      return { equilibriumReached: true, convergenceGeneration: convergenceGen }
    }
  }
  
  return { equilibriumReached: false, convergenceGeneration: null }
}

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
            details: 'The results data exceeds the maximum allowed size (50MB configured in nginx). Consider reducing batch size or splitting the upload.',
            hint: 'Try reducing the number of generations per batch, matches per upload, or limit the amount of telemetry data included'
          },
          { status: 413 }
        )
      }
      // Re-throw if it's a different error
      throw parseError
    }
    
    const { job_id, experiment_id, worker_id, generation_stats, generation_stats_batch, matches } = body
    
    console.log(`[RESULTS] Received upload request for experiment ${experiment_id}, job ${job_id}, worker ${worker_id || 'unknown'}`)
    
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
    
    // Validate job assignment exists and verify ownership
    let jobGenerationStart: number | null = null
    let jobGenerationEnd: number | null = null
    if (job_id) {
      const jobAssignment = await queryOne(
        'SELECT * FROM job_assignments WHERE job_id = $1',
        [job_id]
      )

      if (!jobAssignment) {
        // Recovery: job may have been cascade-deleted when worker was removed
        if (worker_id) {
          const workerRow = await queryOne(
            'SELECT id FROM workers WHERE id = $1',
            [worker_id]
          )
          if (workerRow) {
            console.warn(
              `[RESULTS] Job ${job_id} not found (worker may have re-registered after removal); accepting upload for experiment ${experiment_id} to preserve data`
            )
          } else {
            return NextResponse.json(
              { error: 'Job assignment not found and worker not registered' },
              { status: 404 }
            )
          }
        } else {
          return NextResponse.json(
            { error: 'Job assignment not found' },
            { status: 404 }
          )
        }
      } else {
        jobGenerationStart = jobAssignment.generation_start
        jobGenerationEnd = jobAssignment.generation_end

        // CRITICAL: Verify worker owns this job
        if (worker_id && jobAssignment.worker_id !== worker_id) {
          console.error(`[RESULTS] SECURITY: Worker ${worker_id} attempted to update job ${job_id} owned by worker ${jobAssignment.worker_id}`)
          return NextResponse.json(
            { error: 'Unauthorized: Worker does not own this job' },
            { status: 403 }
          )
        }

        // Update job assignment status to processing (if not already)
        if (jobAssignment.status === 'assigned') {
          await query(
            `UPDATE job_assignments SET status = $1, started_at = $2 WHERE id = $3`,
            ['processing', new Date().toISOString(), jobAssignment.id]
          )
        }
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
        avg_fitness: stats.avg_fitness || null,
        avg_elo: stats.avg_elo || null,
        peak_elo: stats.peak_elo || null,
        min_elo: stats.min_elo || null,
        std_elo: stats.std_elo || null,
        policy_entropy: stats.policy_entropy || null,
        entropy_variance: stats.entropy_variance || null,
        population_diversity: stats.population_diversity || null,
        mutation_rate: stats.mutation_rate || null,
        min_fitness: stats.min_fitness || null,
        max_fitness: stats.max_fitness || null,
        std_fitness: stats.std_fitness || null
      }
    })
    
    // Check which generations already exist to avoid duplicate key errors
    const generationNumbers = generationInserts.map((g: any) => g.generation_number)
    const placeholders = generationNumbers.map((_: number, i: number) => `$${i + 2}`).join(', ')
    const existingGenerations = await queryAll<{ generation_number: number }>(
      `SELECT generation_number FROM generations 
       WHERE experiment_id = $1 AND generation_number IN (${placeholders})`,
      [experiment_id, ...generationNumbers]
    )
    
    // Filter out generations that already exist
    const existingNumbers = new Set((existingGenerations || []).map((g: any) => g.generation_number))
    const newGenerationInserts = generationInserts.filter((g: any) => !existingNumbers.has(g.generation_number))
    
    let insertedGenerations: any[] = []
    
    // Only insert if there are new generations
    if (newGenerationInserts.length > 0) {
      insertedGenerations = await insertMany('generations', newGenerationInserts)
      console.log(`[RESULTS] Successfully saved ${insertedGenerations.length} new generations for experiment ${experiment_id} (${existingNumbers.size} already existed)`)
    } else {
      console.log(`[RESULTS] All ${generationNumbers.length} generations already exist for experiment ${experiment_id}, skipping insert`)
      
      // Fetch existing generations for return value
      const placeholders2 = generationNumbers.map((_: number, i: number) => `$${i + 2}`).join(', ')
      insertedGenerations = await queryAll(
        `SELECT * FROM generations WHERE experiment_id = $1 AND generation_number IN (${placeholders2})`,
        [experiment_id, ...generationNumbers]
      ) || []
    }
    
    // Insert matches if provided
    if (matches && matches.length > 0) {
      const allMatches = Array.isArray(matches[0]) ? matches.flat() : matches
      const matchInserts = allMatches.map((match: any) => {
        const generation = insertedGenerations?.find((g: any) => 
          g.generation_number === match.generation_number
        )
        if (!generation) {
          return null
        }
        
        return {
          experiment_id,
          generation_id: generation.id,
          agent_a_id: match.agent_a_id,
          agent_b_id: match.agent_b_id,
          winner_id: match.winner_id || null,
          match_type: match.match_type || 'self_play',
          move_history: JSON.stringify(match.move_history || []),
          telemetry: JSON.stringify(match.telemetry || {})
        }
      }).filter((m: any) => m !== null)
      
      if (matchInserts.length > 0) {
        await insertMany('matches', matchInserts)
      }
    }
    
    // Mark job completed ONLY when all generations in the job's range exist in DB
    if (job_id && jobGenerationStart != null && jobGenerationEnd != null) {
      const rangePlaceholders = []
      for (let i = 0; i <= jobGenerationEnd - jobGenerationStart; i++) {
        rangePlaceholders.push(`$${i + 2}`)
      }
      const rangeNumbers = Array.from({ length: jobGenerationEnd - jobGenerationStart + 1 }, (_, i) => jobGenerationStart! + i)
      
      const rangeGens = await queryAll<{ generation_number: number }>(
        `SELECT generation_number FROM generations 
         WHERE experiment_id = $1 AND generation_number >= $2 AND generation_number <= $3`,
        [experiment_id, jobGenerationStart, jobGenerationEnd]
      )
      const present = new Set((rangeGens || []).map((g: any) => g.generation_number))
      const expectedCount = jobGenerationEnd - jobGenerationStart + 1
      const allInRangePresent =
        expectedCount === present.size &&
        rangeNumbers.every((n) => present.has(n))

      if (allInRangePresent) {
        if (worker_id) {
          const completed = await rpc<boolean>('complete_job_atomic', {
            p_job_id: job_id,
            p_worker_id: worker_id,
            p_status: 'completed'
          })
          if (completed) {
            console.log(`[RESULTS] Job ${job_id} marked as completed (atomic) — all ${expectedCount} generations [${jobGenerationStart}-${jobGenerationEnd}] present`)
          }
        } else {
          await query(
            `UPDATE job_assignments SET status = $1, completed_at = $2 
             WHERE job_id = $3 AND status = 'processing'`,
            ['completed', new Date().toISOString(), job_id]
          )
          console.log(`[RESULTS] Job ${job_id} marked as completed — all ${expectedCount} generations [${jobGenerationStart}-${jobGenerationEnd}] present (legacy path)`)
        }
      } else {
        console.log(
          `[RESULTS] Job ${job_id} not yet complete: ${present.size}/${expectedCount} generations in range [${jobGenerationStart},${jobGenerationEnd}]`
        )
      }
    }
    
    // Check if all batches for experiment are complete
    const experiment = await queryOne<{ max_generations: number; status: string }>(
      'SELECT max_generations, status FROM experiments WHERE id = $1',
      [experiment_id]
    )
    
    // Track whether we should signal job completion to the worker
    let jobComplete = false
    
    if (experiment) {
      // Check for Nash equilibrium (web app-side detection)
      // This runs on every results upload and checks if equilibrium conditions are met
      if (experiment.status === 'RUNNING' || experiment.status === 'PENDING') {
        const { equilibriumReached, convergenceGeneration } = await detectEquilibrium(experiment_id)
        
        if (equilibriumReached) {
          console.log(`[RESULTS] Nash equilibrium detected at generation ${convergenceGeneration}, ${POST_CONVERGENCE_BUFFER}+ generations past, marking COMPLETED`)
          
          // Mark experiment as COMPLETED
          await query(
            'UPDATE experiments SET status = $1, completed_at = $2 WHERE id = $3',
            ['COMPLETED', new Date().toISOString(), experiment_id]
          )
          
          // Cancel any pending job assignments for this experiment
          // This prevents other workers from picking up new batches
          const cancelResult = await query(
            `UPDATE job_assignments SET status = 'cancelled' 
             WHERE experiment_id = $1 AND status = 'assigned'
             RETURNING job_id`,
            [experiment_id]
          )
          
          const cancelledJobs = cancelResult.rows?.length || 0
          console.log(`[RESULTS] ✓ Experiment ${experiment_id} marked COMPLETED (Nash equilibrium at gen ${convergenceGeneration})`)
          console.log(`[RESULTS]   Cancelled ${cancelledJobs} pending job assignments`)
          
          // Signal to worker that job is complete
          jobComplete = true
        }
      }
      
      // If not completed by equilibrium, check if we have all generations (fallback completion)
      if (!jobComplete) {
        const allGenerations = await queryAll<{ generation_number: number }>(
          'SELECT generation_number FROM generations WHERE experiment_id = $1',
          [experiment_id]
        )
        
        const generationNums = new Set((allGenerations || []).map((g: any) => g.generation_number))
        const expectedGenerations = new Set(Array.from({ length: experiment.max_generations }, (_, i) => i))
        
        const hasAllGenerations = generationNums.size >= experiment.max_generations && 
          Array.from(expectedGenerations).every(gen => generationNums.has(gen))
        
        const finalGenerationExists = generationNums.has(experiment.max_generations - 1)
        const hasEnoughGenerations = generationNums.size >= experiment.max_generations
        const shouldComplete = hasAllGenerations || (finalGenerationExists && hasEnoughGenerations)
        
        // Get all job assignments
        const allAssignments = await queryAll(
          'SELECT status, started_at, assigned_at FROM job_assignments WHERE experiment_id = $1',
          [experiment_id]
        )
        
        // Only check for completion if experiment is still RUNNING or PENDING
        if (shouldComplete && (experiment.status === 'RUNNING' || experiment.status === 'PENDING')) {
          const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString()
          const hasActiveAssignments = allAssignments && allAssignments.some((a: any) => {
            if (a.status === 'assigned') return true
            if (a.status === 'processing') {
              const checkTime = a.started_at || a.assigned_at
              return checkTime && checkTime > tenMinutesAgo
            }
            return false
          })
          
          if (!hasActiveAssignments) {
            const reason = hasAllGenerations 
              ? `all ${generationNums.size} generations present`
              : `final generation ${experiment.max_generations - 1} exists with ${generationNums.size} total`
            console.log(`[RESULTS] Experiment ${experiment_id} completing: ${reason}`)
            await query(
              'UPDATE experiments SET status = $1, completed_at = $2 WHERE id = $3',
              ['COMPLETED', new Date().toISOString(), experiment_id]
            )
            console.log(`[RESULTS] ✓ Successfully marked experiment ${experiment_id} as COMPLETED`)
            jobComplete = true
          } else {
            const completedBatches = allAssignments?.filter((a: any) => a.status === 'completed').length || 0
            const totalBatches = allAssignments?.length || 0
            const activeBatches = allAssignments?.filter((a: any) => 
              a.status === 'assigned' || (a.status === 'processing' && (a.started_at || a.assigned_at) > tenMinutesAgo)
            ).length || 0
            const missingGenerations = Array.from(expectedGenerations).filter(gen => !generationNums.has(gen))
            console.log(`[RESULTS] Batch saved. Progress: ${completedBatches}/${totalBatches} batches (${activeBatches} active), ${generationNums.size}/${experiment.max_generations} generations. Missing: ${missingGenerations.length > 0 ? missingGenerations.slice(0, 10).join(',') + (missingGenerations.length > 10 ? '...' : '') : 'none'}`)
          }
        } else {
          const completedBatches = allAssignments?.filter((a: any) => a.status === 'completed').length || 0
          const totalBatches = allAssignments?.length || 0
          const activeBatches = allAssignments?.filter((a: any) => a.status === 'assigned' || a.status === 'processing').length || 0
          const missingGenerations = Array.from(expectedGenerations).filter(gen => !generationNums.has(gen))
          const maxGenInDb = generationNums.size > 0 ? Math.max(...Array.from(generationNums)) : -1
          console.log(`[RESULTS] Batch saved. Status: ${experiment.status}, Progress: ${completedBatches}/${totalBatches} batches (${activeBatches} active), ${generationNums.size}/${experiment.max_generations} generations (max: ${maxGenInDb}). Missing: ${missingGenerations.length > 0 ? missingGenerations.slice(0, 10).join(',') + (missingGenerations.length > 10 ? '...' : '') : 'none'}`)
        }
      }
    }
    
    return NextResponse.json({ 
      success: true, 
      generations_inserted: insertedGenerations?.length || 0,
      generation_ids: insertedGenerations?.map((g: any) => g.id) || [],
      job_complete: jobComplete  // Signal to worker that experiment is complete
    })
  } catch (error: any) {
    console.error(`[RESULTS] Unexpected error processing upload:`, error)
    return NextResponse.json(
      { error: 'Failed to upload results', details: error?.message || String(error) },
      { status: 500 }
    )
  }
}
