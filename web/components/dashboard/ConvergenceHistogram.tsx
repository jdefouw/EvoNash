'use client'

import { useMemo } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine
} from 'recharts'

interface ConvergenceDataPoint {
  experimentId: string
  group: string
  seed: number
  convergenceGeneration: number
}

interface ConvergenceHistogramProps {
  data: ConvergenceDataPoint[]
}

export default function ConvergenceHistogram({ data }: ConvergenceHistogramProps) {
  const { bins, controlStats, experimentalStats } = useMemo(() => {
    const controlValues = data
      .filter(d => d.group === 'CONTROL')
      .map(d => d.convergenceGeneration)
    const experimentalValues = data
      .filter(d => d.group === 'EXPERIMENTAL')
      .map(d => d.convergenceGeneration)

    if (controlValues.length === 0 && experimentalValues.length === 0) {
      return { bins: [], controlStats: null, experimentalStats: null }
    }

    // Calculate stats for each group
    const calcStats = (values: number[]) => {
      if (values.length === 0) return null
      const sorted = [...values].sort((a, b) => a - b)
      const n = sorted.length
      const sum = sorted.reduce((a, b) => a + b, 0)
      const mean = sum / n
      const median = n % 2 === 0
        ? (sorted[n / 2 - 1] + sorted[n / 2]) / 2
        : sorted[Math.floor(n / 2)]
      const variance = sorted.reduce((acc, v) => acc + (v - mean) ** 2, 0) / (n - 1)
      const std = Math.sqrt(variance)
      const q1 = sorted[Math.floor(n * 0.25)]
      const q3 = sorted[Math.floor(n * 0.75)]
      return { mean, median, std, min: sorted[0], max: sorted[n - 1], n, q1, q3 }
    }

    const cStats = calcStats(controlValues)
    const eStats = calcStats(experimentalValues)

    // Determine bin range from ALL data
    const allValues = [...controlValues, ...experimentalValues]
    const globalMin = Math.min(...allValues)
    const globalMax = Math.max(...allValues)

    // Create bins with width of 1 generation for full resolution
    const binWidth = 1
    const binStart = globalMin
    const binEnd = globalMax + 1

    const histBins: { generation: number; control: number; experimental: number }[] = []
    for (let gen = binStart; gen < binEnd; gen += binWidth) {
      const cCount = controlValues.filter(v => v >= gen && v < gen + binWidth).length
      const eCount = experimentalValues.filter(v => v >= gen && v < gen + binWidth).length
      if (cCount > 0 || eCount > 0) {
        histBins.push({
          generation: gen,
          control: cCount,
          experimental: eCount
        })
      }
    }

    return { bins: histBins, controlStats: cStats, experimentalStats: eStats }
  }, [data])

  if (bins.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
        <h4 className="text-base font-semibold text-gray-900 dark:text-white mb-4">
          Convergence Generation Distribution
        </h4>
        <div className="flex items-center justify-center h-48 text-gray-400 text-sm">
          No convergence data available
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 sm:p-5">
      <h4 className="text-base font-semibold text-gray-900 dark:text-white mb-0.5">
        Convergence Generation Distribution
      </h4>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
        Histogram of all {data.length} converged experiments — every data point from the database
      </p>

      {/* Stats summary row */}
      {controlStats && experimentalStats && (
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="bg-blue-50 dark:bg-blue-950/30 rounded-lg p-3 border border-blue-200 dark:border-blue-800">
            <div className="text-xs font-medium text-blue-700 dark:text-blue-300 mb-1">
              Control (Static) — n={controlStats.n}
            </div>
            <div className="text-sm text-blue-900 dark:text-blue-100">
              Mean: <strong>{Math.round(controlStats.mean)}</strong> ± {Math.round(controlStats.std)} &nbsp;|&nbsp;
              Median: <strong>{controlStats.median}</strong> &nbsp;|&nbsp;
              Range: [{controlStats.min}, {controlStats.max}]
            </div>
          </div>
          <div className="bg-purple-50 dark:bg-purple-950/30 rounded-lg p-3 border border-purple-200 dark:border-purple-800">
            <div className="text-xs font-medium text-purple-700 dark:text-purple-300 mb-1">
              Experimental (Adaptive) — n={experimentalStats.n}
            </div>
            <div className="text-sm text-purple-900 dark:text-purple-100">
              Mean: <strong>{Math.round(experimentalStats.mean)}</strong> ± {Math.round(experimentalStats.std)} &nbsp;|&nbsp;
              Median: <strong>{experimentalStats.median}</strong> &nbsp;|&nbsp;
              Range: [{experimentalStats.min}, {experimentalStats.max}]
            </div>
          </div>
        </div>
      )}

      <ResponsiveContainer width="100%" height={340}>
        <BarChart data={bins} margin={{ top: 10, right: 20, left: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" strokeOpacity={0.5} />
          <XAxis
            dataKey="generation"
            label={{ value: 'Convergence Generation (Fewer = Faster)', position: 'insideBottom', offset: -2, style: { fontSize: 12, fill: '#6b7280' } }}
            tick={{ fontSize: 11, fill: '#6b7280' }}
          />
          <YAxis
            label={{ value: 'Number of Experiments', angle: -90, position: 'insideLeft', offset: 5, style: { fontSize: 12, fill: '#6b7280' } }}
            tick={{ fontSize: 11, fill: '#6b7280' }}
            allowDecimals={false}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'rgba(255, 255, 255, 0.95)',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              fontSize: '12px'
            }}
            labelFormatter={(label) => `Generation ${label}`}
          />
          <Legend wrapperStyle={{ fontSize: '12px' }} />

          {/* Mean reference lines */}
          {controlStats && (
            <ReferenceLine
              x={Math.round(controlStats.mean)}
              stroke="#2563eb"
              strokeWidth={2}
              strokeDasharray="6 3"
              label={{ value: `Ctrl Mean: ${Math.round(controlStats.mean)}`, position: 'top', style: { fontSize: 10, fill: '#2563eb', fontWeight: 600 } }}
            />
          )}
          {experimentalStats && (
            <ReferenceLine
              x={Math.round(experimentalStats.mean)}
              stroke="#7c3aed"
              strokeWidth={2}
              strokeDasharray="6 3"
              label={{ value: `Exp Mean: ${Math.round(experimentalStats.mean)}`, position: 'top', style: { fontSize: 10, fill: '#7c3aed', fontWeight: 600 } }}
            />
          )}

          {/* Median reference lines */}
          {controlStats && (
            <ReferenceLine
              x={controlStats.median}
              stroke="#3b82f6"
              strokeWidth={1.5}
              strokeDasharray="3 2"
            />
          )}
          {experimentalStats && (
            <ReferenceLine
              x={experimentalStats.median}
              stroke="#a855f7"
              strokeWidth={1.5}
              strokeDasharray="3 2"
            />
          )}

          <Bar
            dataKey="control"
            name="Control (Static)"
            fill="#3b82f6"
            fillOpacity={0.7}
            stroke="#2563eb"
            strokeWidth={0.5}
          />
          <Bar
            dataKey="experimental"
            name="Experimental (Adaptive)"
            fill="#a855f7"
            fillOpacity={0.7}
            stroke="#7c3aed"
            strokeWidth={0.5}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
