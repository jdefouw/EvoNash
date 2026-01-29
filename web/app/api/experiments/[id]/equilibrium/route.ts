import { NextRequest, NextResponse } from 'next/server'
import { query, queryOne } from '@/lib/postgres'

// Force dynamic rendering since we modify the database
export const dynamic = 'force-dynamic'

/**
 * POST /api/experiments/[id]/equilibrium
 * 
 * Called by workers when Nash equilibrium is detected.
 * Marks the experiment as COMPLETED with the convergence generation.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { convergence_generation } = body

    if (convergence_generation === undefined || convergence_generation === null) {
      return NextResponse.json(
        { error: 'Missing convergence_generation' },
        { status: 400 }
      )
    }

    console.log(`[EQUILIBRIUM] Nash equilibrium reported for experiment ${id} at generation ${convergence_generation}`)

    // Check current experiment status
    const experiment = await queryOne<{ status: string; experiment_name: string }>(
      'SELECT status, experiment_name FROM experiments WHERE id = $1',
      [id]
    )

    if (!experiment) {
      return NextResponse.json(
        { error: 'Experiment not found' },
        { status: 404 }
      )
    }

    // Only mark as completed if still running
    if (experiment.status === 'RUNNING' || experiment.status === 'PENDING') {
      // Mark experiment as COMPLETED
      await query(
        `UPDATE experiments 
         SET status = 'COMPLETED', completed_at = NOW() 
         WHERE id = $1`,
        [id]
      )

      // Cancel any pending job assignments for this experiment
      // This prevents other workers from picking up new batches
      const cancelResult = await query(
        `UPDATE job_assignments 
         SET status = 'cancelled' 
         WHERE experiment_id = $1 AND status = 'assigned'
         RETURNING job_id`,
        [id]
      )

      const cancelledJobs = cancelResult.rows?.length || 0
      
      console.log(`[EQUILIBRIUM] ✓ Experiment ${id} (${experiment.experiment_name}) marked COMPLETED`)
      console.log(`[EQUILIBRIUM]   Convergence generation: ${convergence_generation}`)
      console.log(`[EQUILIBRIUM]   Cancelled ${cancelledJobs} pending job assignments`)

      return NextResponse.json({
        success: true,
        experiment_id: id,
        experiment_name: experiment.experiment_name,
        convergence_generation,
        previous_status: experiment.status,
        new_status: 'COMPLETED',
        cancelled_jobs: cancelledJobs
      })
    } else {
      // Experiment already completed or stopped
      console.log(`[EQUILIBRIUM] Experiment ${id} already ${experiment.status}, no action needed`)
      
      return NextResponse.json({
        success: true,
        experiment_id: id,
        experiment_name: experiment.experiment_name,
        convergence_generation,
        previous_status: experiment.status,
        new_status: experiment.status,
        message: `Experiment already ${experiment.status}`
      })
    }
  } catch (error) {
    console.error('[EQUILIBRIUM] Error processing equilibrium notification:', error)
    return NextResponse.json(
      { 
        error: 'Failed to process equilibrium notification',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    )
  }
}
