import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

// Force dynamic rendering since we modify the database
export const dynamic = 'force-dynamic'

/**
 * POST /api/experiments/[id]/complete
 * 
 * Force-complete an experiment that is stuck.
 * This is useful when all generations are done but the experiment
 * wasn't automatically marked as complete due to edge cases.
 * 
 * Requires that the experiment has at least 95% of its generations
 * and the final generation must exist.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const supabase = await createServerClient()
    
    // Handle both sync and async params (Next.js 13+ vs 15+)
    const resolvedParams = await Promise.resolve(params)
    const experimentId = resolvedParams.id
    
    // First, check if experiment exists and is RUNNING or PENDING
    const { data: experiment, error: fetchError } = await supabase
      .from('experiments')
      .select('status, max_generations')
      .eq('id', experimentId)
      .single()
    
    if (fetchError || !experiment) {
      return NextResponse.json(
        { error: 'Experiment not found' },
        { status: 404 }
      )
    }
    
    if (experiment.status === 'COMPLETED') {
      return NextResponse.json(
        { success: true, message: 'Experiment is already completed', status: 'COMPLETED' }
      )
    }
    
    if (experiment.status !== 'RUNNING' && experiment.status !== 'PENDING') {
      return NextResponse.json(
        { error: `Cannot complete experiment with status: ${experiment.status}. Only RUNNING or PENDING experiments can be completed.` },
        { status: 400 }
      )
    }
    
    // Check how many generations exist
    const { data: allGenerations } = await supabase
      .from('generations')
      .select('generation_number')
      .eq('experiment_id', experimentId)
    
    const generationNumbers = new Set((allGenerations || []).map((g: any) => g.generation_number))
    const generationCount = generationNumbers.size
    const finalGenerationExists = generationNumbers.has(experiment.max_generations - 1)
    const maxGenInDb = generationCount > 0 ? Math.max(...Array.from(generationNumbers)) : -1
    
    // Calculate completion percentage
    const completionPercent = (generationCount / experiment.max_generations) * 100
    
    // Require at least 95% completion OR final generation exists with sufficient data
    const minCompletionThreshold = 95
    const canComplete = completionPercent >= minCompletionThreshold || 
      (finalGenerationExists && generationCount >= experiment.max_generations * 0.9)
    
    if (!canComplete) {
      return NextResponse.json(
        { 
          error: `Cannot force-complete: experiment is only ${completionPercent.toFixed(1)}% complete (${generationCount}/${experiment.max_generations} generations). ` +
                 `Need at least ${minCompletionThreshold}% completion or the final generation with 90% of data.`,
          details: {
            generation_count: generationCount,
            max_generations: experiment.max_generations,
            completion_percent: completionPercent,
            final_generation_exists: finalGenerationExists,
            max_generation_in_db: maxGenInDb
          }
        },
        { status: 400 }
      )
    }
    
    // Mark any stuck job assignments as completed or failed
    const { error: cleanupError } = await supabase
      .from('job_assignments')
      .update({ 
        status: 'completed',
        completed_at: new Date().toISOString()
      })
      .eq('experiment_id', experimentId)
      .in('status', ['assigned', 'processing'])
    
    if (cleanupError) {
      console.error(`[COMPLETE] Error cleaning up job assignments:`, cleanupError)
    }
    
    // Update status to COMPLETED
    const { error: updateError } = await supabase
      .from('experiments')
      .update({ 
        status: 'COMPLETED',
        completed_at: new Date().toISOString()
      })
      .eq('id', experimentId)
    
    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }
    
    console.log(`[COMPLETE] Force-completed experiment ${experimentId}: ${generationCount}/${experiment.max_generations} generations (${completionPercent.toFixed(1)}%)`)
    
    return NextResponse.json({ 
      success: true, 
      status: 'COMPLETED',
      details: {
        generation_count: generationCount,
        max_generations: experiment.max_generations,
        completion_percent: completionPercent,
        final_generation_exists: finalGenerationExists,
        max_generation_in_db: maxGenInDb
      }
    })
  } catch (error: any) {
    console.error(`[COMPLETE] Error:`, error)
    return NextResponse.json(
      { error: 'Failed to complete experiment', details: error?.message || String(error) },
      { status: 500 }
    )
  }
}
