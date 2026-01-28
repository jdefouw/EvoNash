import { NextRequest, NextResponse } from 'next/server'
import { queryOne, queryAll } from '@/lib/postgres'

// Force dynamic rendering since we query the database
export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Get experiment
    const experiment = await queryOne(
      'SELECT * FROM experiments WHERE id = $1',
      [params.id]
    )
    
    if (!experiment) {
      return NextResponse.json({ error: 'Experiment not found' }, { status: 404 })
    }
    
    // Get all generations for this experiment
    const generations = await queryAll(
      `SELECT * FROM generations 
       WHERE experiment_id = $1 
       ORDER BY generation_number ASC`,
      [params.id]
    )
    
    if (!generations || generations.length === 0) {
      return NextResponse.json({
        error: 'No generation data available',
        experiment: experiment
      })
    }
    
    // Calculate basic statistics
    const avg_elos = generations.map((g: any) => g.avg_elo).filter(Boolean) as number[]
    const peak_elos = generations.map((g: any) => g.peak_elo).filter(Boolean) as number[]
    const entropies = generations.map((g: any) => g.policy_entropy).filter(Boolean) as number[]
    const entropy_variances = generations.map((g: any) => g.entropy_variance).filter(Boolean) as number[]
    
    // Find convergence point using entropy variance threshold
    // IMPORTANT: We need to find convergence AFTER the population has diverged first.
    // At generation 0, all agents are identical (same seed), so variance is artificially low.
    // True convergence = population evolved, diverged, then stabilized to Nash Equilibrium.
    //
    // Use different thresholds based on mutation mode:
    // - CONTROL (STATIC mutation): 0.01 - uniform mutation leads to homogeneous population
    // - EXPERIMENTAL (ADAPTIVE mutation): 0.025 - fitness-scaled mutation maintains more diversity
    const threshold = experiment.experiment_group === 'EXPERIMENTAL' ? 0.025 : 0.01
    
    // First, find where entropy variance exceeds threshold (population diverged)
    const divergenceIndex = generations.findIndex((g: any) => 
      g.entropy_variance !== null && g.entropy_variance >= threshold
    )
    
    // Find convergence only if population diverged first, then converged again
    const convergence_gen = divergenceIndex === -1 
      ? null 
      : generations.slice(divergenceIndex).find((g: any) => 
          g.entropy_variance !== null && g.entropy_variance < threshold
        )
    
    const analysis = {
      experiment_id: params.id,
      total_generations: generations.length,
      final_avg_elo: avg_elos[avg_elos.length - 1] || null,
      final_peak_elo: peak_elos[peak_elos.length - 1] || null,
      peak_elo_overall: peak_elos.length > 0 ? Math.max(...peak_elos) : null,
      final_entropy: entropies[entropies.length - 1] || null,
      convergence_generation: convergence_gen?.generation_number || null,
      avg_elo_trend: avg_elos,
      entropy_trend: entropies,
      entropy_variance_trend: entropy_variances
    }
    
    return NextResponse.json(analysis)
  } catch (error: any) {
    console.error('Error generating analysis:', error)
    return NextResponse.json(
      { error: 'Failed to generate analysis' },
      { status: 500 }
    )
  }
}
