'use client'

import { useEffect, useRef, useMemo } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Dot, ReferenceLine } from 'recharts'
import { Experiment, Generation } from '@/types/protocol'

interface ExperimentChartProps {
  generations: Generation[]
  experiment: Experiment
  isLive?: boolean
}

// Unified convergence threshold for BOTH groups (scientific best practice)
// Using the same threshold enables fair comparison of convergence generations
const CONVERGENCE_THRESHOLD = 0.01

// Stability window: require N consecutive generations below threshold
// UI uses 10 for faster visual feedback; backend early stopping uses 20 for scientific rigor
const STABILITY_WINDOW = 10

export default function ExperimentChart({ generations, experiment, isLive = false }: ExperimentChartProps) {
  const prevLengthRef = useRef(0)

  // Same threshold for all experiments (fair comparison)
  const convergenceThreshold = CONVERGENCE_THRESHOLD

  useEffect(() => {
    if (generations.length > prevLengthRef.current) {
      prevLengthRef.current = generations.length
    }
  }, [generations.length])

  const data = generations.map(gen => ({
    generation: gen.generation_number,
    avgElo: gen.avg_elo || 0,
    peakElo: gen.peak_elo || 0
  }))

  // Calculate convergence generation using improved detection logic with stability window
  const convergenceGen = useMemo(() => {
    if (generations.length < 10) return null

    // Get variance data (skip first few gens)
    const varianceData = generations.slice(5).map(g => ({
      gen: g.generation_number,
      variance: g.entropy_variance ?? 0
    }))
    
    if (varianceData.length === 0) return null

    // Find peak variance
    const peakVariance = Math.max(...varianceData.map(d => d.variance))
    const peakIndex = varianceData.findIndex(d => d.variance === peakVariance)
    
    // Must have diverged (peak > minimum)
    if (peakVariance <= 0.0001) return null

    // Use relative threshold (10% of peak) when peak is high, absolute when peak is low
    // This ensures convergence detection scales appropriately with the magnitude of variance
    // 10% provides a good balance between detecting true convergence and avoiding false positives
    const relativeThreshold = peakVariance * 0.10
    const effectiveThreshold = Math.max(convergenceThreshold, relativeThreshold)
    
    // Get data after peak
    const afterPeak = varianceData.slice(peakIndex)
    
    // Find first generation that starts a stable run of STABILITY_WINDOW generations below threshold
    for (let i = 0; i <= afterPeak.length - STABILITY_WINDOW; i++) {
      const window = afterPeak.slice(i, i + STABILITY_WINDOW)
      if (window.every(d => d.variance < effectiveThreshold)) {
        return window[0].gen
      }
    }
    
    return null
  }, [generations, convergenceThreshold])

  const latestGen = generations.length > 0 ? generations[generations.length - 1] : null

  const CustomDot = (props: any) => {
    const { cx, cy, payload } = props
    const isLatest = latestGen && payload.generation === latestGen.generation_number
    if (!isLatest) return null
    
    return (
      <g>
        <circle cx={cx} cy={cy} r={6} fill="#ef4444" className="animate-pulse" />
        <circle cx={cx} cy={cy} r={10} fill="#ef4444" opacity={0.3} className="animate-ping" />
      </g>
    )
  }

  return (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
          Convergence Velocity: Generation vs Average Elo
        </h2>
        {isLive && (
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span className="text-xs text-gray-600 dark:text-gray-400">Live</span>
          </div>
        )}
      </div>
      <ResponsiveContainer width="100%" height={400}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-gray-300 dark:stroke-gray-700" />
          <XAxis 
            dataKey="generation" 
            className="text-gray-600 dark:text-gray-400"
            label={{ value: 'Generation', position: 'insideBottom', offset: -5 }}
          />
          <YAxis 
            className="text-gray-600 dark:text-gray-400"
            label={{ value: 'Elo Rating', angle: -90, position: 'insideLeft' }}
          />
          <Tooltip 
            contentStyle={{ 
              backgroundColor: 'rgba(255, 255, 255, 0.95)',
              border: '1px solid #e5e7eb',
              borderRadius: '8px'
            }}
          />
          <Legend />
          {/* Vertical line marking Nash Equilibrium achievement */}
          {convergenceGen !== null && (
            <ReferenceLine 
              x={convergenceGen} 
              stroke="#22c55e" 
              strokeWidth={2}
              strokeDasharray="3 3"
              label={{ 
                value: `Nash Equilibrium (Gen ${convergenceGen})`, 
                position: "top",
                fontSize: 11,
                fill: "#16a34a",
                fontWeight: "bold"
              }}
            />
          )}
          <Line 
            type="monotone" 
            dataKey="avgElo" 
            stroke="#3b82f6" 
            strokeWidth={2}
            name="Average Elo"
            dot={false}
            animationDuration={300}
            isAnimationActive={isLive}
          />
          <Line 
            type="monotone" 
            dataKey="peakElo" 
            stroke="#8b5cf6" 
            strokeWidth={2}
            name="Peak Elo"
            dot={false}
            animationDuration={300}
            isAnimationActive={isLive}
          />
          {latestGen && (
            <Line
              type="monotone"
              dataKey="generation"
              stroke="transparent"
              dot={<CustomDot />}
              activeDot={false}
            />
          )}
        </LineChart>
      </ResponsiveContainer>
      {/* Nash Equilibrium indicator */}
      <div className="mt-3 flex items-center justify-between text-sm">
        <span className="text-gray-500 dark:text-gray-400">
          {experiment.mutation_mode === 'ADAPTIVE' ? 'Adaptive Mutation' : 'Static Mutation'} (threshold: σ &lt; {convergenceThreshold})
        </span>
        {convergenceGen !== null ? (
          <div className="flex items-center gap-2 px-3 py-1 bg-green-100 dark:bg-green-900/30 rounded-full">
            <div className="w-2 h-2 bg-green-500 rounded-full" />
            <span className="text-green-700 dark:text-green-400 font-medium text-xs">
              Nash Equilibrium at Generation {convergenceGen}
            </span>
          </div>
        ) : (
          <span className="text-gray-400 dark:text-gray-500 text-xs">
            Nash Equilibrium not yet reached
          </span>
        )}
      </div>
    </div>
  )
}
