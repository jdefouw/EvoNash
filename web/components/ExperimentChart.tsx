'use client'

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { Experiment, Generation } from '@/types/protocol'

interface ExperimentChartProps {
  generations: Generation[]
  experiment: Experiment
}

export default function ExperimentChart({ generations, experiment }: ExperimentChartProps) {
  const data = generations.map(gen => ({
    generation: gen.generation_number,
    avgElo: gen.avg_elo || 0,
    peakElo: gen.peak_elo || 0
  }))

  return (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700">
      <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">
        Convergence Velocity: Generation vs Average Elo
      </h2>
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
          />
          <Line 
            type="monotone" 
            dataKey="peakElo" 
            stroke="#8b5cf6" 
            strokeWidth={2}
            name="Peak Elo"
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
