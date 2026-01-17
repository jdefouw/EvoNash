'use client'

import { useEffect, useRef } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Dot } from 'recharts'
import { Experiment, Generation } from '@/types/protocol'

interface ExperimentChartProps {
  generations: Generation[]
  experiment: Experiment
  isLive?: boolean
}

export default function ExperimentChart({ generations, experiment, isLive = false }: ExperimentChartProps) {
  const prevLengthRef = useRef(0)

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
    </div>
  )
}
