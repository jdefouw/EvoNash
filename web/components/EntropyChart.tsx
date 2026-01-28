'use client'

import { useEffect, useRef } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts'
import { Experiment, Generation } from '@/types/protocol'

interface EntropyChartProps {
  generations: Generation[]
  experiment: Experiment
  isLive?: boolean
}

export default function EntropyChart({ generations, experiment, isLive = false }: EntropyChartProps) {
  const prevLengthRef = useRef(0)

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

  const latestGen = generations.length > 0 ? generations[generations.length - 1] : null
  const isConverged = latestGen && (latestGen.entropy_variance || 0) < 0.01

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
          {isConverged && (
            <ReferenceLine 
              y={0.01} 
              stroke="#10b981" 
              strokeDasharray="5 5" 
              label={{ value: "Convergence Threshold (σ < 0.01)", position: "right" }}
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
      <div className="flex items-center justify-between mt-4">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          <strong>Definition:</strong> Convergence is defined as entropy variance &lt; 0.01 (policy stability threshold)
        </p>
        {isConverged && (
          <div className="flex items-center gap-2 px-3 py-1 bg-green-100 dark:bg-green-900/30 rounded-full">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span className="text-green-700 dark:text-green-400 font-medium text-xs">
              Convergence Threshold Reached
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
