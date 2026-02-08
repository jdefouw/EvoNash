'use client'

import { useEffect, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ErrorBar } from 'recharts'

interface StatisticalSignificanceProps {
  experimentId: string
  mutationMode?: 'STATIC' | 'ADAPTIVE'
}

interface AnalysisData {
  final_avg_fitness: number
  final_peak_fitness: number
  convergence_generation: number | null
  avg_fitness_trend: number[]
  entropy_trend: number[]
}

// Unified convergence threshold for all experiments (scientific best practice)
const CONVERGENCE_THRESHOLD = 0.01

export default function StatisticalSignificance({ experimentId, mutationMode }: StatisticalSignificanceProps) {
  // Same threshold for all experiments (fair comparison)
  const convergenceThreshold = CONVERGENCE_THRESHOLD
  const [analysis, setAnalysis] = useState<AnalysisData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/experiments/${experimentId}/analysis`)
      .then(res => res.json())
      .then(data => {
        setAnalysis(data)
        setLoading(false)
      })
      .catch(err => {
        console.error('Error fetching analysis:', err)
        setLoading(false)
      })
  }, [experimentId])

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700">
        <div className="text-center py-8">
          <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">Loading analysis...</p>
        </div>
      </div>
    )
  }

  if (!analysis) {
    return (
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700">
        <p className="text-gray-600 dark:text-gray-400">No analysis data available</p>
      </div>
    )
  }

  // Calculate statistics from trend data
  const avgFitnessMean = analysis.avg_fitness_trend.length > 0
    ? analysis.avg_fitness_trend.reduce((a, b) => a + b, 0) / analysis.avg_fitness_trend.length
    : 0

  const avgFitnessStd = analysis.avg_fitness_trend.length > 1
    ? Math.sqrt(
      analysis.avg_fitness_trend.reduce((sum, val) => sum + Math.pow(val - avgFitnessMean, 2), 0) /
      (analysis.avg_fitness_trend.length - 1)
    )
    : 0

  const chartData = [
    {
      name: 'Final Performance',
      avgFitness: analysis.final_avg_fitness || 0,
      peakFitness: analysis.final_peak_fitness || 0,
      stdDev: avgFitnessStd
    }
  ]

  return (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700">
      <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">
        Statistical Significance: Final Mean Performance
      </h2>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-gray-300 dark:stroke-gray-700" />
          <XAxis
            dataKey="name"
            className="text-gray-600 dark:text-gray-400"
          />
          <YAxis
            className="text-gray-600 dark:text-gray-400"
            label={{ value: 'Fitness Score', angle: -90, position: 'insideLeft' }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'rgba(255, 255, 255, 0.95)',
              border: '1px solid #e5e7eb',
              borderRadius: '8px'
            }}
          />
          <Legend />
          <Bar
            dataKey="avgFitness"
            fill="#3b82f6"
            name="Average Fitness"
          >
            <ErrorBar dataKey="stdDev" stroke="#ef4444" strokeWidth={2} />
          </Bar>
          <Bar
            dataKey="peakFitness"
            fill="#8b5cf6"
            name="Peak Fitness"
          />
        </BarChart>
      </ResponsiveContainer>
      <div className="mt-4 grid md:grid-cols-3 gap-4 text-sm">
        <div>
          <span className="text-gray-600 dark:text-gray-400">Final Avg Fitness:</span>
          <span className="ml-2 font-medium">{analysis.final_avg_fitness?.toFixed(2) || 'N/A'}</span>
        </div>
        <div>
          <span className="text-gray-600 dark:text-gray-400">Final Peak Fitness:</span>
          <span className="ml-2 font-medium">{analysis.final_peak_fitness?.toFixed(2) || 'N/A'}</span>
        </div>
        <div>
          <span className="text-gray-600 dark:text-gray-400">Convergence Gen (σ &lt; {convergenceThreshold}):</span>
          <span className="ml-2 font-medium">{analysis.convergence_generation || 'Not converged'}</span>
        </div>
      </div>
    </div>
  )
}
