'use client'

import { useMemo } from 'react'

interface PairedSeedScatterProps {
  convergenceData: { experimentId: string; group: string; seed: number; convergenceGeneration: number }[]
  pairedAnalysis?: {
    nPairs: number
    meanDifference: number
    pValueOneTailed: number
    cohensD: number | null
    pairs: { seed: number; control: number; experimental: number; difference: number }[]
  } | null
}

export default function PairedSeedScatter({ convergenceData, pairedAnalysis }: PairedSeedScatterProps) {
  const pairs = useMemo(() => {
    // If pairedAnalysis provides pre-computed pairs, use them
    if (pairedAnalysis?.pairs && pairedAnalysis.pairs.length > 0) {
      return pairedAnalysis.pairs
    }

    // Otherwise, build pairs from convergenceData
    const controlBySeed = new Map<number, number[]>()
    const experimentalBySeed = new Map<number, number[]>()

    for (const d of convergenceData) {
      const map = d.group === 'CONTROL' ? controlBySeed : experimentalBySeed
      if (!map.has(d.seed)) map.set(d.seed, [])
      map.get(d.seed)!.push(d.convergenceGeneration)
    }

    const result: { seed: number; control: number; experimental: number; difference: number }[] = []
    for (const [seed, controlValues] of controlBySeed) {
      const expValues = experimentalBySeed.get(seed)
      if (!expValues || expValues.length === 0) continue
      const controlMean = controlValues.reduce((a, b) => a + b, 0) / controlValues.length
      const expMean = expValues.reduce((a, b) => a + b, 0) / expValues.length
      result.push({ seed, control: controlMean, experimental: expMean, difference: controlMean - expMean })
    }

    return result.sort((a, b) => a.control - b.control)
  }, [convergenceData, pairedAnalysis])

  if (pairs.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
        <h4 className="text-base font-semibold text-gray-900 dark:text-white mb-4">
          Paired Seed Comparison
        </h4>
        <div className="flex items-center justify-center h-48 text-gray-400 text-sm">
          No paired seed data available
        </div>
      </div>
    )
  }

  const allValues = pairs.flatMap(p => [p.control, p.experimental])
  const minVal = Math.min(...allValues)
  const maxVal = Math.max(...allValues)
  const padding = (maxVal - minVal) * 0.1
  const axMin = Math.floor(minVal - padding)
  const axMax = Math.ceil(maxVal + padding)

  const chartSize = 380
  const margin = { top: 20, right: 20, bottom: 50, left: 55 }
  const plotW = chartSize - margin.left - margin.right
  const plotH = chartSize - margin.top - margin.bottom

  const scaleX = (v: number) => margin.left + ((v - axMin) / (axMax - axMin)) * plotW
  const scaleY = (v: number) => margin.top + plotH - ((v - axMin) / (axMax - axMin)) * plotH

  const belowLine = pairs.filter(p => p.experimental < p.control).length
  const onLine = pairs.filter(p => p.experimental === p.control).length
  const aboveLine = pairs.filter(p => p.experimental > p.control).length
  const pctBelow = Math.round((belowLine / pairs.length) * 100)

  // Generate tick values
  const tickCount = 5
  const step = Math.round((axMax - axMin) / tickCount / 10) * 10 || 10
  const ticks: number[] = []
  for (let v = Math.ceil(axMin / step) * step; v <= axMax; v += step) {
    ticks.push(v)
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 sm:p-5">
      <h4 className="text-base font-semibold text-gray-900 dark:text-white mb-0.5">
        Paired Seed Comparison — Convergence Generations
      </h4>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
        Each dot = one matched seed. Points below the diagonal = adaptive was faster. {pairs.length} pairs plotted.
      </p>

      <div className="flex justify-center">
        <svg viewBox={`0 0 ${chartSize} ${chartSize}`} width="100%" style={{ maxWidth: chartSize }} className="overflow-visible">
          {/* Grid */}
          {ticks.map(v => (
            <g key={v}>
              <line x1={scaleX(v)} y1={margin.top} x2={scaleX(v)} y2={margin.top + plotH} stroke="#f3f4f6" strokeWidth={0.5} />
              <line x1={margin.left} y1={scaleY(v)} x2={margin.left + plotW} y2={scaleY(v)} stroke="#f3f4f6" strokeWidth={0.5} />
              <text x={scaleX(v)} y={margin.top + plotH + 16} textAnchor="middle" fontSize={10} fill="#6b7280">{v}</text>
              <text x={margin.left - 6} y={scaleY(v) + 3} textAnchor="end" fontSize={10} fill="#6b7280">{v}</text>
            </g>
          ))}

          {/* Axes */}
          <line x1={margin.left} y1={margin.top} x2={margin.left} y2={margin.top + plotH} stroke="#d1d5db" />
          <line x1={margin.left} y1={margin.top + plotH} x2={margin.left + plotW} y2={margin.top + plotH} stroke="#d1d5db" />

          {/* Diagonal y=x line */}
          <line
            x1={scaleX(axMin)} y1={scaleY(axMin)}
            x2={scaleX(axMax)} y2={scaleY(axMax)}
            stroke="#d1d5db" strokeWidth={1.5} strokeDasharray="6 3"
          />
          <text
            x={scaleX(axMax) - 4} y={scaleY(axMax) - 6}
            fontSize={9} fill="#9ca3af" textAnchor="end"
          >
            y = x (equal)
          </text>

          {/* Shaded region below diagonal = experimental faster */}
          <polygon
            points={`${scaleX(axMin)},${scaleY(axMin)} ${scaleX(axMax)},${scaleY(axMax)} ${scaleX(axMax)},${scaleY(axMin)}`}
            fill="#6366f1" fillOpacity={0.04}
          />
          <text
            x={scaleX(axMax) - 8} y={scaleY(axMin) + 14}
            fontSize={9} fill="#6366f1" textAnchor="end" fontStyle="italic"
          >
            Adaptive faster →
          </text>

          {/* Data points */}
          {pairs.map((p, i) => {
            const below = p.experimental < p.control
            return (
              <circle
                key={i}
                cx={scaleX(p.control)}
                cy={scaleY(p.experimental)}
                r={3.5}
                fill={below ? '#6366f1' : '#ef4444'}
                fillOpacity={0.7}
                stroke={below ? '#4f46e5' : '#dc2626'}
                strokeWidth={0.5}
              />
            )
          })}

          {/* Axis labels */}
          <text x={margin.left + plotW / 2} y={chartSize - 4} textAnchor="middle" fontSize={12} fill="#374151" fontWeight={600}>
            Control (Static ε) — Convergence Generation
          </text>
          <text x={14} y={margin.top + plotH / 2} textAnchor="middle" fontSize={12} fill="#374151" fontWeight={600} transform={`rotate(-90, 14, ${margin.top + plotH / 2})`}>
            Experimental (Adaptive ε) — Convergence Gen.
          </text>
        </svg>
      </div>

      {/* Summary stats */}
      <div className="mt-4 grid grid-cols-3 gap-3">
        <div className="text-center p-2 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg">
          <div className="text-lg font-bold text-indigo-600 dark:text-indigo-400">{belowLine}</div>
          <div className="text-xs text-gray-500">Adaptive faster</div>
          <div className="text-xs font-semibold text-indigo-600 dark:text-indigo-400">{pctBelow}%</div>
        </div>
        <div className="text-center p-2 bg-gray-50 dark:bg-gray-700/30 rounded-lg">
          <div className="text-lg font-bold text-gray-500">{onLine}</div>
          <div className="text-xs text-gray-500">Equal</div>
        </div>
        <div className="text-center p-2 bg-red-50 dark:bg-red-900/20 rounded-lg">
          <div className="text-lg font-bold text-red-500">{aboveLine}</div>
          <div className="text-xs text-gray-500">Static faster</div>
          <div className="text-xs font-semibold text-red-500">{100 - pctBelow - Math.round((onLine / pairs.length) * 100)}%</div>
        </div>
      </div>

      {pairedAnalysis && (
        <div className="mt-3 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
          <p className="text-xs text-green-800 dark:text-green-300">
            <strong>Paired t-test:</strong>{' '}
            Mean difference = {pairedAnalysis.meanDifference.toFixed(1)} generations{' '}
            (p = {pairedAnalysis.pValueOneTailed < 0.0001
              ? pairedAnalysis.pValueOneTailed.toExponential(2)
              : pairedAnalysis.pValueOneTailed.toFixed(4)}, one-tailed)
            {pairedAnalysis.cohensD !== null && (
              <> · Cohen's d = {pairedAnalysis.cohensD.toFixed(2)}</>
            )}
          </p>
        </div>
      )}
    </div>
  )
}
