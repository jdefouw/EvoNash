'use client'

import { useEffect, useRef, useMemo } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts'
import { Experiment, Generation } from '@/types/protocol'

interface EntropyChartProps {
  generations: Generation[]
  experiment: Experiment
  isLive?: boolean
}

// Convergence thresholds differ by mutation mode:
// STATIC mutation (CONTROL): 0.01 - uniform mutation leads to homogeneous population
// ADAPTIVE mutation (EXPERIMENTAL): 0.025 - fitness-scaled mutation maintains more diversity
const CONTROL_CONVERGENCE_THRESHOLD = 0.01
const EXPERIMENTAL_CONVERGENCE_THRESHOLD = 0.025

export default function EntropyChart({ generations, experiment, isLive = false }: EntropyChartProps) {
  const prevLengthRef = useRef(0)

  // Determine threshold based on experiment type
  const convergenceThreshold = experiment.mutation_mode === 'ADAPTIVE' 
    ? EXPERIMENTAL_CONVERGENCE_THRESHOLD 
    : CONTROL_CONVERGENCE_THRESHOLD

  useEffect(() => {
    if (generations.length > prevLengthRef.current) {
      prevLengthRef.current = generations.length
    }
  }, [generations.length])

  const data = generations.map(gen => ({
    generation: gen.generation_number,
    entropy: gen.policy_entropy || 0,
    entropyVariance: gen.entropy_variance || 0
  }))

  // Check for convergence using divergence-first logic:
  // 1. Population must first diverge (entropy variance >= threshold)
  // 2. Then converge (entropy variance < threshold)
  // This prevents false positives from generation 0 when all agents are identical
  const convergenceInfo = useMemo(() => {
    // Find first divergence point
    const divergenceIndex = generations.findIndex(
      g => (g.entropy_variance ?? 0) >= convergenceThreshold
    )
    
    if (divergenceIndex === -1) {
      return { isConverged: false, convergenceGen: null, hasDiverged: false }
    }
    
    // Find convergence after divergence
    const convergenceGen = generations.slice(divergenceIndex).find(
      g => (g.entropy_variance ?? 0) < convergenceThreshold
    )
    
    return {
      isConverged: convergenceGen !== undefined,
      convergenceGen: convergenceGen?.generation_number ?? null,
      hasDiverged: true
    }
  }, [generations, convergenceThreshold])

  const latestGen = generations.length > 0 ? generations[generations.length - 1] : null

  return (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
          Entropy Collapse: Generation vs Policy Entropy
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
            label={{ value: 'Policy Entropy', angle: -90, position: 'insideLeft' }}
          />
          <Tooltip 
            contentStyle={{ 
              backgroundColor: 'rgba(255, 255, 255, 0.95)',
              border: '1px solid #e5e7eb',
              borderRadius: '8px'
            }}
          />
          <Legend />
          {/* Always show threshold line when population has diverged */}
          {convergenceInfo.hasDiverged && (
            <ReferenceLine 
              y={convergenceThreshold} 
              stroke="#10b981" 
              strokeDasharray="5 5" 
              label={{ 
                value: `Convergence Threshold (σ < ${convergenceThreshold})`, 
                position: "right" 
              }}
            />
          )}
          <Line 
            type="monotone" 
            dataKey="entropy" 
            stroke="#10b981" 
            strokeWidth={2}
            name="Policy Entropy"
            dot={false}
            animationDuration={300}
            isAnimationActive={isLive}
          />
          <Line 
            type="monotone" 
            dataKey="entropyVariance" 
            stroke="#f59e0b" 
            strokeWidth={2}
            name="Entropy Variance"
            dot={false}
            animationDuration={300}
            isAnimationActive={isLive}
          />
        </LineChart>
      </ResponsiveContainer>
      <div className="mt-4 space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            <strong>Threshold:</strong> σ &lt; {convergenceThreshold} ({experiment.mutation_mode === 'ADAPTIVE' ? 'Adaptive maintains more diversity' : 'Static converges to lower variance'})
          </p>
          {convergenceInfo.isConverged && (
            <div className="flex items-center gap-2 px-3 py-1 bg-green-100 dark:bg-green-900/30 rounded-full">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              <span className="text-green-700 dark:text-green-400 font-medium text-xs">
                Nash Equilibrium Reached (Gen {convergenceInfo.convergenceGen})
              </span>
            </div>
          )}
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-500">
          <strong>Detection Method:</strong> Population must first diverge (σ ≥ threshold), then converge (σ &lt; threshold). 
          This prevents false positives from generation 0 when all agents are identical clones.
        </p>
      </div>
    </div>
  )
}
