'use client'

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

interface Generation {
  generation_number: number
  policy_entropy: number
  entropy_variance: number
}

interface EntropyChartProps {
  generations: Generation[]
}

export default function EntropyChart({ generations }: EntropyChartProps) {
  const data = generations.map(gen => ({
    generation: gen.generation_number,
    entropy: gen.policy_entropy || 0,
    variance: gen.entropy_variance || 0
  }))

  return (
    <div className="p-6 border rounded-lg bg-white dark:bg-gray-800">
      <h2 className="text-xl font-semibold mb-4">Entropy Collapse</h2>
      <ResponsiveContainer width="100%" height={400}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="generation" label={{ value: 'Generation', position: 'insideBottom', offset: -5 }} />
          <YAxis label={{ value: 'Entropy', angle: -90, position: 'insideLeft' }} />
          <Tooltip />
          <Legend />
          <Line type="monotone" dataKey="entropy" stroke="#ff7300" name="Policy Entropy" strokeWidth={2} />
          <Line type="monotone" dataKey="variance" stroke="#ff0000" name="Entropy Variance" strokeWidth={2} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
