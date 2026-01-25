'use client'

import { useState } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts'
import { Generation } from '@/types/protocol'

interface ComparisonChartProps {
  controlGenerations: Generation[]
  experimentalGenerations: Generation[]
  metric: 'elo' | 'entropy'
  title?: string
  showConvergenceMarker?: boolean
  controlConvergenceGen?: number | null
  experimentalConvergenceGen?: number | null
}

export default function ComparisonChart({
  controlGenerations,
  experimentalGenerations,
  metric,
  title,
  showConvergenceMarker = false,
  controlConvergenceGen,
  experimentalConvergenceGen
}: ComparisonChartProps) {
  const [viewMode, setViewMode] = useState<'overlay' | 'side-by-side'>('overlay')

  // Merge data for overlay view
  const maxGen = Math.max(
    controlGenerations.length > 0 ? Math.max(...controlGenerations.map(g => g.generation_number)) : 0,
    experimentalGenerations.length > 0 ? Math.max(...experimentalGenerations.map(g => g.generation_number)) : 0
  )

  const overlayData = Array.from({ length: maxGen + 1 }, (_, i) => {
    const controlGen = controlGenerations.find(g => g.generation_number === i)
    const expGen = experimentalGenerations.find(g => g.generation_number === i)

    if (metric === 'elo') {
      return {
        generation: i,
        controlAvgElo: controlGen?.avg_elo || null,
        controlPeakElo: controlGen?.peak_elo || null,
        experimentalAvgElo: expGen?.avg_elo || null,
        experimentalPeakElo: expGen?.peak_elo || null,
      }
    } else {
      return {
        generation: i,
        controlEntropy: controlGen?.policy_entropy || null,
        controlVariance: controlGen?.entropy_variance || null,
        experimentalEntropy: expGen?.policy_entropy || null,
        experimentalVariance: expGen?.entropy_variance || null,
      }
    }
  }).filter(d => 
    (metric === 'elo' && (d.controlAvgElo !== null || d.experimentalAvgElo !== null)) ||
    (metric === 'entropy' && (d.controlEntropy !== null || d.experimentalEntropy !== null))
  )

  const chartTitle = title || (metric === 'elo' ? 'Convergence Velocity: Elo Rating Comparison' : 'Entropy Collapse: Policy Entropy Comparison')

  const renderOverlayChart = () => (
    <ResponsiveContainer width="100%" height={400}>
      <LineChart data={overlayData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-gray-300 dark:stroke-gray-700" />
        <XAxis 
          dataKey="generation" 
          label={{ value: 'Generation', position: 'insideBottom', offset: -10 }}
          className="text-gray-600 dark:text-gray-400"
        />
        <YAxis 
          label={{ 
            value: metric === 'elo' ? 'Elo Rating' : 'Policy Entropy', 
            angle: -90, 
            position: 'insideLeft' 
          }}
          className="text-gray-600 dark:text-gray-400"
        />
        <Tooltip 
          contentStyle={{ 
            backgroundColor: 'rgba(255, 255, 255, 0.95)',
            border: '1px solid #e5e7eb',
            borderRadius: '8px'
          }}
          formatter={(value: number, name: string) => [
            value?.toFixed(4),
            name.replace('control', 'Control ').replace('experimental', 'Experimental ').replace('Avg', 'Average ').replace('Peak', 'Peak ')
          ]}
        />
        <Legend />
        
        {/* Convergence reference lines */}
        {showConvergenceMarker && controlConvergenceGen && (
          <ReferenceLine 
            x={controlConvergenceGen} 
            stroke="#3b82f6" 
            strokeDasharray="5 5"
            label={{ value: `Control Conv.`, position: 'top', fill: '#3b82f6', fontSize: 10 }}
          />
        )}
        {showConvergenceMarker && experimentalConvergenceGen && (
          <ReferenceLine 
            x={experimentalConvergenceGen} 
            stroke="#8b5cf6" 
            strokeDasharray="5 5"
            label={{ value: `Exp. Conv.`, position: 'top', fill: '#8b5cf6', fontSize: 10 }}
          />
        )}

        {metric === 'elo' ? (
          <>
            <Line 
              type="monotone" 
              dataKey="controlAvgElo" 
              stroke="#3b82f6" 
              strokeWidth={2}
              name="Control Avg Elo"
              dot={false}
              connectNulls
            />
            <Line 
              type="monotone" 
              dataKey="experimentalAvgElo" 
              stroke="#8b5cf6" 
              strokeWidth={2}
              name="Experimental Avg Elo"
              dot={false}
              connectNulls
            />
            <Line 
              type="monotone" 
              dataKey="controlPeakElo" 
              stroke="#93c5fd" 
              strokeWidth={1}
              strokeDasharray="3 3"
              name="Control Peak Elo"
              dot={false}
              connectNulls
            />
            <Line 
              type="monotone" 
              dataKey="experimentalPeakElo" 
              stroke="#c4b5fd" 
              strokeWidth={1}
              strokeDasharray="3 3"
              name="Experimental Peak Elo"
              dot={false}
              connectNulls
            />
          </>
        ) : (
          <>
            <Line 
              type="monotone" 
              dataKey="controlEntropy" 
              stroke="#3b82f6" 
              strokeWidth={2}
              name="Control Entropy"
              dot={false}
              connectNulls
            />
            <Line 
              type="monotone" 
              dataKey="experimentalEntropy" 
              stroke="#8b5cf6" 
              strokeWidth={2}
              name="Experimental Entropy"
              dot={false}
              connectNulls
            />
            <Line 
              type="monotone" 
              dataKey="controlVariance" 
              stroke="#93c5fd" 
              strokeWidth={1}
              strokeDasharray="3 3"
              name="Control Variance"
              dot={false}
              connectNulls
            />
            <Line 
              type="monotone" 
              dataKey="experimentalVariance" 
              stroke="#c4b5fd" 
              strokeWidth={1}
              strokeDasharray="3 3"
              name="Experimental Variance"
              dot={false}
              connectNulls
            />
            {/* Nash Equilibrium threshold line */}
            <ReferenceLine 
              y={0.01} 
              stroke="#10b981" 
              strokeDasharray="5 5" 
              label={{ value: "Convergence Threshold (σ < 0.01)", position: "right", fontSize: 10 }}
            />
          </>
        )}
      </LineChart>
    </ResponsiveContainer>
  )

  const renderSideBySideCharts = () => {
    const controlData = controlGenerations.map(g => ({
      generation: g.generation_number,
      avgValue: metric === 'elo' ? g.avg_elo : g.policy_entropy,
      peakValue: metric === 'elo' ? g.peak_elo : g.entropy_variance,
    }))

    const expData = experimentalGenerations.map(g => ({
      generation: g.generation_number,
      avgValue: metric === 'elo' ? g.avg_elo : g.policy_entropy,
      peakValue: metric === 'elo' ? g.peak_elo : g.entropy_variance,
    }))

    const yLabel = metric === 'elo' ? 'Elo Rating' : 'Entropy'
    const avgLabel = metric === 'elo' ? 'Avg Elo' : 'Entropy'
    const peakLabel = metric === 'elo' ? 'Peak Elo' : 'Variance'

    return (
      <div className="grid md:grid-cols-2 gap-4">
        {/* Control Chart */}
        <div className="bg-blue-50 dark:bg-blue-900/10 rounded-lg p-4">
          <h4 className="font-medium text-blue-700 dark:text-blue-400 mb-2 text-center">
            Control Group (Static Mutation)
          </h4>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={controlData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-gray-300 dark:stroke-gray-700" />
              <XAxis dataKey="generation" />
              <YAxis label={{ value: yLabel, angle: -90, position: 'insideLeft' }} />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="avgValue" stroke="#3b82f6" name={avgLabel} dot={false} />
              <Line type="monotone" dataKey="peakValue" stroke="#93c5fd" name={peakLabel} dot={false} strokeDasharray="3 3" />
              {showConvergenceMarker && controlConvergenceGen && (
                <ReferenceLine x={controlConvergenceGen} stroke="#ef4444" strokeDasharray="5 5" />
              )}
            </LineChart>
          </ResponsiveContainer>
          {controlConvergenceGen && (
            <p className="text-xs text-center text-blue-600 dark:text-blue-400 mt-2">
              Converged at Generation {controlConvergenceGen}
            </p>
          )}
        </div>

        {/* Experimental Chart */}
        <div className="bg-purple-50 dark:bg-purple-900/10 rounded-lg p-4">
          <h4 className="font-medium text-purple-700 dark:text-purple-400 mb-2 text-center">
            Experimental Group (Adaptive Mutation)
          </h4>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={expData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-gray-300 dark:stroke-gray-700" />
              <XAxis dataKey="generation" />
              <YAxis label={{ value: yLabel, angle: -90, position: 'insideLeft' }} />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="avgValue" stroke="#8b5cf6" name={avgLabel} dot={false} />
              <Line type="monotone" dataKey="peakValue" stroke="#c4b5fd" name={peakLabel} dot={false} strokeDasharray="3 3" />
              {showConvergenceMarker && experimentalConvergenceGen && (
                <ReferenceLine x={experimentalConvergenceGen} stroke="#ef4444" strokeDasharray="5 5" />
              )}
            </LineChart>
          </ResponsiveContainer>
          {experimentalConvergenceGen && (
            <p className="text-xs text-center text-purple-600 dark:text-purple-400 mt-2">
              Converged at Generation {experimentalConvergenceGen}
            </p>
          )}
        </div>
      </div>
    )
  }

  const hasData = controlGenerations.length > 0 || experimentalGenerations.length > 0

  return (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700">
      <div className="flex flex-wrap justify-between items-center gap-4 mb-4">
        <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
          {chartTitle}
        </h3>
        {hasData && (
          <div className="flex gap-2">
            <button
              onClick={() => setViewMode('overlay')}
              className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                viewMode === 'overlay'
                  ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              Overlay
            </button>
            <button
              onClick={() => setViewMode('side-by-side')}
              className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                viewMode === 'side-by-side'
                  ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              Side by Side
            </button>
          </div>
        )}
      </div>

      {hasData ? (
        viewMode === 'overlay' ? renderOverlayChart() : renderSideBySideCharts()
      ) : (
        <div className="flex items-center justify-center h-64 text-gray-500 dark:text-gray-400">
          <p>No experiment data available. Run experiments to see comparison charts.</p>
        </div>
      )}

      {/* Legend explanation */}
      <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
        <div className="flex flex-wrap gap-6 text-xs text-gray-600 dark:text-gray-400">
          <div className="flex items-center gap-2">
            <div className="w-4 h-0.5 bg-blue-500" />
            <span>Control Group (Static ε = 0.05)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-0.5 bg-purple-500" />
            <span>Experimental Group (Adaptive ε)</span>
          </div>
          {showConvergenceMarker && (
            <div className="flex items-center gap-2">
              <div className="w-4 h-0.5 bg-green-500 border-dashed" style={{ borderTop: '2px dashed' }} />
              <span>Convergence Threshold</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
