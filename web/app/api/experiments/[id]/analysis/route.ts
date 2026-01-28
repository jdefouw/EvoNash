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
    
    // Find convergence point using improved relative threshold detection
    // This handles cases where variance never exceeds the absolute threshold but clearly converges
    //
    // Use different base thresholds based on mutation mode:
    // - CONTROL (STATIC mutation): 0.01 - uniform mutation leads to homogeneous population
    // - EXPERIMENTAL (ADAPTIVE mutation): 0.025 - fitness-scaled mutation maintains more diversity
    const absoluteThreshold = experiment.experiment_group === 'EXPERIMENTAL' ? 0.025 : 0.01
    
    // Calculate convergence using relative threshold approach
    let convergence_gen = null
    if (generations.length >= 10) {
      // Get variance data (skip first few gens)
      const varianceData = generations.slice(5)
        .filter((g: any) => g.entropy_variance !== null)
        .map((g: any) => ({
          gen: g.generation_number,
          variance: g.entropy_variance as number
        }))
      
      if (varianceData.length > 0) {
        // Find peak variance
        const peakVariance = Math.max(...varianceData.map(d => d.variance))
        const peakIndex = varianceData.findIndex(d => d.variance === peakVariance)
        
        // Must have diverged (peak > minimum)
        if (peakVariance > 0.0001) {
          // Use stricter of absolute or relative (5% of peak) threshold
          const relativeThreshold = peakVariance * 0.05
          const effectiveThreshold = Math.min(absoluteThreshold, relativeThreshold)
          
          // Find convergence after peak
          const convergencePoint = varianceData.slice(peakIndex).find(
            d => d.variance < effectiveThreshold
          )
          
          convergence_gen = convergencePoint ? { generation_number: convergencePoint.gen } : null
        }
      }
    }
    
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
