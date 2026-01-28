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

  // Check for convergence using improved detection logic:
  // 1. Find peak entropy variance (must be above minimum to show divergence)
  // 2. Find when variance drops significantly from peak AND below threshold
  // This handles cases where variance never exceeds the threshold but clearly converges
  const convergenceInfo = useMemo(() => {
    if (generations.length < 10) {
      return { isConverged: false, convergenceGen: null, hasDiverged: false, peakVariance: 0 }
    }

    // Get all variance values (skip first few gens where data might be unstable)
    const varianceData = generations.slice(5).map(g => ({
      gen: g.generation_number,
      variance: g.entropy_variance ?? 0
    }))
    
    if (varianceData.length === 0) {
      return { isConverged: false, convergenceGen: null, hasDiverged: false, peakVariance: 0 }
    }

    // Find peak variance
    const peakVariance = Math.max(...varianceData.map(d => d.variance))
    const peakIndex = varianceData.findIndex(d => d.variance === peakVariance)
    
    // Consider "diverged" if peak variance is above a minimum threshold (0.0001)
    // This means the population actually evolved and differentiated
    const hasDiverged = peakVariance > 0.0001
    
    if (!hasDiverged) {
      return { isConverged: false, convergenceGen: null, hasDiverged: false, peakVariance }
    }

    // For convergence detection, use the stricter of:
    // - The absolute threshold (0.01 or 0.025)
    // - 5% of peak variance (relative threshold for cases where peak is small)
    const relativeThreshold = peakVariance * 0.05
    const effectiveThreshold = Math.min(convergenceThreshold, relativeThreshold)
    
    // Find first generation AFTER peak where variance drops below effective threshold
    const convergencePoint = varianceData.slice(peakIndex).find(
      d => d.variance < effectiveThreshold
    )
    
    return {
      isConverged: convergencePoint !== undefined,
      convergenceGen: convergencePoint?.gen ?? null,
      hasDiverged: true,
      peakVariance,
      effectiveThreshold
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
          {/* Horizontal threshold line when population has diverged */}
          {convergenceInfo.hasDiverged && (
            <ReferenceLine 
              y={convergenceThreshold} 
              stroke="#10b981" 
              strokeDasharray="5 5" 
              label={{ 
                value: `Threshold (σ < ${convergenceThreshold})`, 
                position: "right",
                fontSize: 10
              }}
            />
          )}
          {/* Vertical line marking Nash Equilibrium achievement */}
          {convergenceInfo.isConverged && convergenceInfo.convergenceGen !== null && (
            <ReferenceLine 
              x={convergenceInfo.convergenceGen} 
              stroke="#22c55e" 
              strokeWidth={2}
              strokeDasharray="3 3"
              label={{ 
                value: `Nash Equilibrium (Gen ${convergenceInfo.convergenceGen})`, 
                position: "top",
                fontSize: 11,
                fill: "#16a34a",
                fontWeight: "bold"
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
