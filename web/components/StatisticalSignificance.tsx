'use client'

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ErrorBar } from 'recharts'

interface StatisticalSignificanceProps {
  controlMean: number
  experimentalMean: number
  controlStd: number
  experimentalStd: number
  pValue: number
}

export default function StatisticalSignificance({
  controlMean,
  experimentalMean,
  controlStd,
  experimentalStd,
  pValue
}: StatisticalSignificanceProps) {
  const data = [
    {
      group: 'Control',
      mean: controlMean,
      std: controlStd
    },
    {
      group: 'Experimental',
      mean: experimentalMean,
      std: experimentalStd
    }
  ]

  const isSignificant = pValue < 0.05

  return (
    <div className="p-6 border rounded-lg bg-white dark:bg-gray-800">
      <h2 className="text-xl font-semibold mb-4">Statistical Significance</h2>
      <div className="mb-4">
        <p className="text-sm text-gray-600">
          p-value: <span className={`font-semibold ${isSignificant ? 'text-green-600' : 'text-red-600'}`}>
            {pValue.toFixed(4)} {isSignificant && '*'}
          </span>
        </p>
      </div>
      <ResponsiveContainer width="100%" height={400}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="group" />
          <YAxis label={{ value: 'Average Elo Rating', angle: -90, position: 'insideLeft' }} />
          <Tooltip />
          <Legend />
          <Bar dataKey="mean" fill="#8884d8" name="Mean Elo">
            <ErrorBar dataKey="std" strokeWidth={2} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
