'use client'

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

interface Generation {
  generation_number: number
  avg_elo: number
  peak_elo: number
}

interface ExperimentChartProps {
  generations: Generation[]
}

export default function ExperimentChart({ generations }: ExperimentChartProps) {
  const data = generations.map(gen => ({
    generation: gen.generation_number,
    avgElo: gen.avg_elo || 0,
    peakElo: gen.peak_elo || 0
  }))

  return (
    <div className="p-6 border rounded-lg bg-white dark:bg-gray-800">
      <h2 className="text-xl font-semibold mb-4">Convergence Velocity</h2>
      <ResponsiveContainer width="100%" height={400}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="generation" label={{ value: 'Generation', position: 'insideBottom', offset: -5 }} />
          <YAxis label={{ value: 'Elo Rating', angle: -90, position: 'insideLeft' }} />
          <Tooltip />
          <Legend />
          <Line type="monotone" dataKey="avgElo" stroke="#8884d8" name="Average Elo" strokeWidth={2} />
          <Line type="monotone" dataKey="peakElo" stroke="#82ca9d" name="Peak Elo" strokeWidth={2} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
