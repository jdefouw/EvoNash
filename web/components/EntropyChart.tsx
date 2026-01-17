'use client'

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { Experiment, Generation } from '@/types/protocol'

interface EntropyChartProps {
  generations: Generation[]
  experiment: Experiment
}

export default function EntropyChart({ generations, experiment }: EntropyChartProps) {
  const data = generations.map(gen => ({
    generation: gen.generation_number,
    entropy: gen.policy_entropy || 0,
    entropyVariance: gen.entropy_variance || 0
  }))

  return (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700">
      <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">
        Entropy Collapse: Generation vs Policy Entropy
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
          <Line 
            type="monotone" 
            dataKey="entropy" 
            stroke="#10b981" 
            strokeWidth={2}
            name="Policy Entropy"
            dot={false}
          />
          <Line 
            type="monotone" 
            dataKey="entropyVariance" 
            stroke="#f59e0b" 
            strokeWidth={2}
            name="Entropy Variance"
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
      <p className="text-sm text-gray-600 dark:text-gray-400 mt-4">
        Convergence to Nash Equilibrium occurs when entropy variance drops below 0.01
      </p>
    </div>
  )
}
