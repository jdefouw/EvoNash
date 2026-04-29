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
  ReferenceLine,
  ErrorBar
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
  const { seedBars, controlStats, experimentalStats } = useMemo(() => {
    const controlValues = data
      .filter(d => d.group === 'CONTROL')
      .map(d => d.convergenceGeneration)
    const experimentalValues = data
      .filter(d => d.group === 'EXPERIMENTAL')
      .map(d => d.convergenceGeneration)

    if (controlValues.length === 0 && experimentalValues.length === 0) {
      return { seedBars: [], controlStats: null, experimentalStats: null }
    }

    // Global stats
    const calcStats = (values: number[]) => {
      if (values.length === 0) return null
      const sorted = [...values].sort((a, b) => a - b)
      const n = sorted.length
      const sum = sorted.reduce((a, b) => a + b, 0)
      const mean = sum / n
      const median = n % 2 === 0
        ? (sorted[n / 2 - 1] + sorted[n / 2]) / 2
        : sorted[Math.floor(n / 2)]
      const variance = n > 1 ? sorted.reduce((acc, v) => acc + (v - mean) ** 2, 0) / (n - 1) : 0
      const std = Math.sqrt(variance)
      const q1 = sorted[Math.floor(n * 0.25)]
      const q3 = sorted[Math.floor(n * 0.75)]
      return { mean, median, std, min: sorted[0], max: sorted[n - 1], n, q1, q3 }
    }

    const cStats = calcStats(controlValues)
    const eStats = calcStats(experimentalValues)

    // Group by seed → compute mean convergence gen per seed per group
    const seedMap = new Map<number, { control: number[]; experimental: number[] }>()
    for (const d of data) {
      if (!seedMap.has(d.seed)) {
        seedMap.set(d.seed, { control: [], experimental: [] })
      }
      const entry = seedMap.get(d.seed)!
      if (d.group === 'CONTROL') {
        entry.control.push(d.convergenceGeneration)
      } else {
        entry.experimental.push(d.convergenceGeneration)
      }
    }

    // Build bars: one entry per seed with mean + std for each group
    const bars = Array.from(seedMap.entries())
      .map(([seed, groups]) => {
        const cMean = groups.control.length > 0
          ? groups.control.reduce((a, b) => a + b, 0) / groups.control.length
          : null
        const eMean = groups.experimental.length > 0
          ? groups.experimental.reduce((a, b) => a + b, 0) / groups.experimental.length
          : null
        const cStd = groups.control.length > 1
          ? Math.sqrt(groups.control.reduce((acc, v) => acc + (v - cMean!) ** 2, 0) / (groups.control.length - 1))
          : 0
        const eStd = groups.experimental.length > 1
          ? Math.sqrt(groups.experimental.reduce((acc, v) => acc + (v - eMean!) ** 2, 0) / (groups.experimental.length - 1))
          : 0
        return {
          seed: `${seed}`,
          seedShort: `${String(seed).slice(-4)}`,
          controlMean: cMean !== null ? Math.round(cMean) : null,
          experimentalMean: eMean !== null ? Math.round(eMean) : null,
          controlStd: Math.round(cStd),
          experimentalStd: Math.round(eStd),
          controlN: groups.control.length,
          experimentalN: groups.experimental.length,
        }
      })
      // Sort by control mean (or experimental if no control)
      .sort((a, b) => {
        const aVal = a.controlMean ?? a.experimentalMean ?? 0
        const bVal = b.controlMean ?? b.experimentalMean ?? 0
        return aVal - bVal
      })

    return { seedBars: bars, controlStats: cStats, experimentalStats: eStats }
  }, [data])

  if (seedBars.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
        <h4 className="text-base font-semibold text-gray-900 dark:text-white mb-4">
          Convergence Generation by Seed Pair
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
        Convergence Generation by Seed Pair
      </h4>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
        Mean convergence generation per seed — Control (blue) vs Experimental (purple). Lower = faster convergence.
      </p>

      {/* Global stats summary row */}
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

      <ResponsiveContainer width="100%" height={Math.max(340, seedBars.length * 45)}>
        <BarChart
          data={seedBars}
          layout="vertical"
          margin={{ top: 30, right: 30, left: 55, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" strokeOpacity={0.5} horizontal={false} />
          <XAxis
            type="number"
            label={{ value: 'Mean Convergence Generation (Fewer = Faster)', position: 'insideBottom', offset: -2, style: { fontSize: 12, fill: '#6b7280' } }}
            tick={{ fontSize: 11, fill: '#6b7280' }}
          />
          <YAxis
            type="category"
            dataKey="seedShort"
            tick={{ fontSize: 11, fill: '#6b7280' }}
            width={50}
            label={{ value: 'Seed', angle: -90, position: 'insideLeft', offset: -10, style: { fontSize: 12, fill: '#6b7280' } }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'rgba(17, 24, 39, 0.95)',
              border: '1px solid #374151',
              borderRadius: '8px',
              fontSize: '12px',
              color: '#f9fafb'
            }}
            formatter={(value: any, name: string, props: any) => {
              const entry = props.payload
              if (name === 'Control (Static)') {
                return [`${value} ± ${entry.controlStd} (n=${entry.controlN})`, name]
              }
              return [`${value} ± ${entry.experimentalStd} (n=${entry.experimentalN})`, name]
            }}
            labelFormatter={(label) => `Seed ...${label}`}
          />
          <Legend wrapperStyle={{ fontSize: '12px' }} />

          {/* Global mean reference lines */}
          {controlStats && (
            <ReferenceLine
              x={Math.round(controlStats.mean)}
              stroke="#2563eb"
              strokeWidth={2}
              strokeDasharray="6 3"
              label={{ value: `Ctrl μ: ${Math.round(controlStats.mean)}`, position: 'top', style: { fontSize: 10, fill: '#2563eb', fontWeight: 600 } }}
            />
          )}
          {experimentalStats && (
            <ReferenceLine
              x={Math.round(experimentalStats.mean)}
              stroke="#7c3aed"
              strokeWidth={2}
              strokeDasharray="6 3"
              label={{ value: `Exp μ: ${Math.round(experimentalStats.mean)}`, position: 'top', style: { fontSize: 10, fill: '#7c3aed', fontWeight: 600 } }}
            />
          )}

          <Bar
            dataKey="controlMean"
            name="Control (Static)"
            fill="#3b82f6"
            fillOpacity={0.8}
            stroke="#2563eb"
            strokeWidth={0.5}
            barSize={14}
            radius={[0, 3, 3, 0]}
          />
          <Bar
            dataKey="experimentalMean"
            name="Experimental (Adaptive)"
            fill="#a855f7"
            fillOpacity={0.8}
            stroke="#7c3aed"
            strokeWidth={0.5}
            barSize={14}
            radius={[0, 3, 3, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
