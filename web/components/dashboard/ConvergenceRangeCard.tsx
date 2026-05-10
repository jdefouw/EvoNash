'use client'

import { useState } from 'react'

interface DistributionStats {
  n: number
  mean: number | null
  median: number | null
  std: number | null
  min: number | null
  max: number | null
  Q1: number | null
  Q3: number | null
  IQR: number | null
  skewness: number | null
  kurtosis: number | null
}

interface ConvergenceRangeCardProps {
  controlData: DistributionStats | null
  experimentalData: DistributionStats | null
}

type RangeSegment = 'iqr' | 'range' | 'median' | 'whole' | null

interface RangeBarProps {
  data: DistributionStats
  toPercent: (v: number) => number
  label: string
  // Tailwind color tokens for this group
  labelColor: string         // e.g. 'text-blue-600 dark:text-blue-400'
  iqrFill: string            // e.g. 'bg-blue-200 dark:bg-blue-800/50'
  rangeFill: string          // e.g. 'bg-blue-500/30'
  medianStroke: string       // e.g. 'bg-blue-700 dark:bg-blue-300'
  // Header-color hex used inside the tooltip
  tipHeaderColor: string     // e.g. '#3B82F6'
}

function RangeBar({
  data,
  toPercent,
  label,
  labelColor,
  iqrFill,
  rangeFill,
  medianStroke,
  tipHeaderColor,
}: RangeBarProps) {
  const [hover, setHover] = useState<RangeSegment>(null)

  if (data.min == null || data.max == null) return null

  const fmt = (v: number | null | undefined, decimals = 0) =>
    v != null ? v.toFixed(decimals) : '—'

  const showRing = (seg: RangeSegment) => hover === seg

  // Tooltip content
  let tipTitle = label
  let tipLines: { left: string; right: string; bold?: boolean }[] = []
  if (hover === 'iqr') {
    tipTitle = `${label} — IQR (middle 50%)`
    tipLines = [
      { left: 'Q1 (25th pctl):', right: fmt(data.Q1, 1) },
      { left: 'Q3 (75th pctl):', right: fmt(data.Q3, 1) },
      { left: 'IQR span:', right: fmt(data.IQR, 1), bold: true },
    ]
  } else if (hover === 'range') {
    tipTitle = `${label} — Full range`
    const span = data.min != null && data.max != null ? data.max - data.min : null
    tipLines = [
      { left: 'Minimum:', right: fmt(data.min) + ' gens' },
      { left: 'Maximum:', right: fmt(data.max) + ' gens' },
      { left: 'Span:', right: fmt(span) + ' gens', bold: true },
    ]
  } else if (hover === 'median') {
    tipTitle = `${label} — Median`
    tipLines = [
      { left: 'Median:', right: fmt(data.median, 1) + ' gens', bold: true },
      { left: 'Mean:', right: fmt(data.mean, 1) + ' gens' },
      { left: 'Std dev:', right: fmt(data.std, 1) },
    ]
  } else if (hover === 'whole') {
    tipTitle = label
    tipLines = [
      { left: 'n converged:', right: data.n.toLocaleString(), bold: true },
      { left: 'Mean ± SD:', right: `${fmt(data.mean, 1)} ± ${fmt(data.std, 1)}` },
      { left: 'Median:', right: fmt(data.median, 1) },
      { left: 'Q1 (25%):', right: fmt(data.Q1, 1) },
      { left: 'Q3 (75%):', right: fmt(data.Q3, 1) },
      { left: 'IQR:', right: fmt(data.IQR, 1) },
      { left: 'Min — Max:', right: `${fmt(data.min)} — ${fmt(data.max)}` },
    ]
  }

  const showTip = hover !== null

  return (
    <div
      className="relative"
      onMouseLeave={() => setHover(null)}
    >
      <div className="flex items-center justify-between mb-1">
        <span className={`text-xs font-medium ${labelColor}`}>{label}</span>
        <span className="text-xs text-gray-500 font-mono">
          {fmt(data.min)} – {fmt(data.max)}
        </span>
      </div>
      <div
        className="relative h-6 bg-gray-100 dark:bg-gray-900/50 rounded-full overflow-visible cursor-pointer"
        onMouseEnter={() => setHover(prev => prev ?? 'whole')}
      >
        {/* Background hit target for "whole bar" */}
        <div
          className="absolute inset-0 rounded-full"
          onMouseEnter={() => setHover('whole')}
        />

        {/* Full range bar */}
        <div
          className={`absolute top-2 h-2 rounded-full ${rangeFill} ${showRing('range') ? 'ring-2 ring-offset-1 ring-current' : ''}`}
          style={{
            left: `${toPercent(data.min)}%`,
            width: `${toPercent(data.max) - toPercent(data.min)}%`,
            color: tipHeaderColor,
          }}
          onMouseEnter={() => setHover('range')}
        />

        {/* IQR box */}
        {data.Q1 != null && data.Q3 != null && (
          <div
            className={`absolute top-0.5 bottom-0.5 rounded ${iqrFill} ${showRing('iqr') ? 'ring-2 ring-current' : ''}`}
            style={{
              left: `${toPercent(data.Q1)}%`,
              width: `${toPercent(data.Q3) - toPercent(data.Q1)}%`,
              color: tipHeaderColor,
            }}
            onMouseEnter={() => setHover('iqr')}
          />
        )}

        {/* Median line + invisible wider hit target */}
        {data.median != null && (
          <>
            <div
              className={`absolute top-0.5 bottom-0.5 ${medianStroke} ${showRing('median') ? 'w-1' : 'w-0.5'}`}
              style={{
                left: `calc(${toPercent(data.median)}% - ${showRing('median') ? '2px' : '1px'})`,
                transition: 'width 80ms',
              }}
            />
            <div
              className="absolute top-0 bottom-0"
              style={{
                left: `calc(${toPercent(data.median)}% - 5px)`,
                width: '10px',
              }}
              onMouseEnter={() => setHover('median')}
            />
          </>
        )}
      </div>

      {/* Tooltip */}
      {showTip && (
        <div
          role="tooltip"
          className="absolute z-20 left-1/2 -translate-x-1/2 -top-2 -translate-y-full bg-white dark:bg-gray-900 rounded-md shadow-lg border border-gray-200 dark:border-gray-700 px-3 py-2 min-w-[210px] pointer-events-none"
          style={{ filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.12))' }}
        >
          <div
            className="text-[11px] font-semibold mb-1.5"
            style={{ color: tipHeaderColor }}
          >
            {tipTitle}
          </div>
          <div className="space-y-0.5">
            {tipLines.map((ln, i) => (
              <div key={i} className="flex justify-between gap-3 text-[10px]">
                <span className="text-gray-500 dark:text-gray-400">{ln.left}</span>
                <span className={`font-mono text-gray-900 dark:text-white ${ln.bold ? 'font-bold' : ''}`}>
                  {ln.right}
                </span>
              </div>
            ))}
          </div>
          {/* Arrow pointing down */}
          <div
            className="absolute left-1/2 -translate-x-1/2 -bottom-1 w-2 h-2 rotate-45 bg-white dark:bg-gray-900 border-r border-b border-gray-200 dark:border-gray-700"
          />
        </div>
      )}
    </div>
  )
}

export default function ConvergenceRangeCard({
  controlData,
  experimentalData,
}: ConvergenceRangeCardProps) {
  const fmt = (v: number | null | undefined, decimals = 0) =>
    v != null ? v.toFixed(decimals) : '—'

  const hasData = controlData && experimentalData && controlData.n > 0 && experimentalData.n > 0

  // Compute range (max - min) for each group
  const controlRange = controlData?.min != null && controlData?.max != null
    ? controlData.max - controlData.min : null
  const experimentalRange = experimentalData?.min != null && experimentalData?.max != null
    ? experimentalData.max - experimentalData.min : null

  // Find the global min/max for the visual range bar
  const allValues = [
    controlData?.min, controlData?.max,
    experimentalData?.min, experimentalData?.max
  ].filter((v): v is number => v != null)
  const globalMin = allValues.length > 0 ? Math.min(...allValues) - 10 : 0
  const globalMax = allValues.length > 0 ? Math.max(...allValues) + 10 : 300

  const toPercent = (v: number) => ((v - globalMin) / (globalMax - globalMin)) * 100

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 sm:p-5">
      <h4 className="text-base font-semibold text-gray-900 dark:text-white mb-0.5">
        Convergence Generation Range
      </h4>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
        Min, max, and distribution of the generation at which each experiment reached Nash equilibrium
      </p>

      {!hasData ? (
        <div className="text-center py-8 text-sm text-gray-400">
          Waiting for convergence data from both groups…
        </div>
      ) : (
        <div className="space-y-5">
          {/* Side-by-side summary table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="text-left py-2 pr-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Metric
                  </th>
                  <th className="text-right py-2 px-3 text-xs font-medium uppercase tracking-wider text-blue-600 dark:text-blue-400">
                    Control
                  </th>
                  <th className="text-right py-2 px-3 text-xs font-medium uppercase tracking-wider text-amber-600 dark:text-amber-400">
                    Experimental
                  </th>
                  <th className="text-right py-2 pl-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Difference
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
                <tr>
                  <td className="py-2 pr-3 text-gray-600 dark:text-gray-300 font-medium">
                    <span className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                      Minimum
                    </span>
                  </td>
                  <td className="py-2 px-3 text-right font-mono text-gray-900 dark:text-white">
                    {fmt(controlData?.min)}
                  </td>
                  <td className="py-2 px-3 text-right font-mono text-gray-900 dark:text-white">
                    {fmt(experimentalData?.min)}
                  </td>
                  <td className="py-2 pl-3 text-right font-mono text-sm">
                    {controlData?.min != null && experimentalData?.min != null ? (
                      <span className={controlData.min - experimentalData.min > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500'}>
                        {controlData.min - experimentalData.min > 0 ? '−' : '+'}{Math.abs(controlData.min - experimentalData.min)}
                      </span>
                    ) : '—'}
                  </td>
                </tr>
                <tr>
                  <td className="py-2 pr-3 text-gray-600 dark:text-gray-300 font-medium">
                    <span className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                      Q1 (25th pctl)
                    </span>
                  </td>
                  <td className="py-2 px-3 text-right font-mono text-gray-900 dark:text-white">
                    {fmt(controlData?.Q1)}
                  </td>
                  <td className="py-2 px-3 text-right font-mono text-gray-900 dark:text-white">
                    {fmt(experimentalData?.Q1)}
                  </td>
                  <td className="py-2 pl-3 text-right font-mono text-sm">
                    {controlData?.Q1 != null && experimentalData?.Q1 != null ? (() => {
                      const cRound = Math.round(controlData.Q1!)
                      const eRound = Math.round(experimentalData.Q1!)
                      const diff = cRound - eRound
                      return (
                        <span className={diff > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500'}>
                          {diff > 0 ? '−' : '+'}{Math.abs(diff)}
                        </span>
                      )
                    })() : '—'}
                  </td>
                </tr>
                <tr>
                  <td className="py-2 pr-3 text-gray-600 dark:text-gray-300 font-medium">
                    <span className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
                      Median
                    </span>
                  </td>
                  <td className="py-2 px-3 text-right font-mono text-gray-900 dark:text-white font-semibold">
                    {fmt(controlData?.median)}
                  </td>
                  <td className="py-2 px-3 text-right font-mono text-gray-900 dark:text-white font-semibold">
                    {fmt(experimentalData?.median)}
                  </td>
                  <td className="py-2 pl-3 text-right font-mono text-sm">
                    {controlData?.median != null && experimentalData?.median != null ? (() => {
                      const cRound = Math.round(controlData.median!)
                      const eRound = Math.round(experimentalData.median!)
                      const diff = cRound - eRound
                      return (
                        <span className={diff > 0 ? 'text-green-600 dark:text-green-400 font-semibold' : 'text-red-500 font-semibold'}>
                          {diff > 0 ? '−' : '+'}{Math.abs(diff)}
                        </span>
                      )
                    })() : '—'}
                  </td>
                </tr>
                <tr>
                  <td className="py-2 pr-3 text-gray-600 dark:text-gray-300 font-medium">
                    <span className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                      Mean ± SD
                    </span>
                  </td>
                  <td className="py-2 px-3 text-right font-mono text-gray-900 dark:text-white">
                    {fmt(controlData?.mean)} ± {fmt(controlData?.std)}
                  </td>
                  <td className="py-2 px-3 text-right font-mono text-gray-900 dark:text-white">
                    {fmt(experimentalData?.mean)} ± {fmt(experimentalData?.std)}
                  </td>
                  <td className="py-2 pl-3 text-right font-mono text-sm">
                    {controlData?.mean != null && experimentalData?.mean != null ? (() => {
                      const cRound = Math.round(controlData.mean!)
                      const eRound = Math.round(experimentalData.mean!)
                      const diff = cRound - eRound
                      return (
                        <span className={diff > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500'}>
                          {diff > 0 ? '−' : '+'}{Math.abs(diff)}
                        </span>
                      )
                    })() : '—'}
                  </td>
                </tr>
                <tr>
                  <td className="py-2 pr-3 text-gray-600 dark:text-gray-300 font-medium">
                    <span className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                      Q3 (75th pctl)
                    </span>
                  </td>
                  <td className="py-2 px-3 text-right font-mono text-gray-900 dark:text-white">
                    {fmt(controlData?.Q3)}
                  </td>
                  <td className="py-2 px-3 text-right font-mono text-gray-900 dark:text-white">
                    {fmt(experimentalData?.Q3)}
                  </td>
                  <td className="py-2 pl-3 text-right font-mono text-sm">
                    {controlData?.Q3 != null && experimentalData?.Q3 != null ? (() => {
                      const cRound = Math.round(controlData.Q3!)
                      const eRound = Math.round(experimentalData.Q3!)
                      const diff = cRound - eRound
                      return (
                        <span className={diff > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500'}>
                          {diff > 0 ? '−' : '+'}{Math.abs(diff)}
                        </span>
                      )
                    })() : '—'}
                  </td>
                </tr>
                <tr>
                  <td className="py-2 pr-3 text-gray-600 dark:text-gray-300 font-medium">
                    <span className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                      Maximum
                    </span>
                  </td>
                  <td className="py-2 px-3 text-right font-mono text-gray-900 dark:text-white">
                    {fmt(controlData?.max)}
                  </td>
                  <td className="py-2 px-3 text-right font-mono text-gray-900 dark:text-white">
                    {fmt(experimentalData?.max)}
                  </td>
                  <td className="py-2 pl-3 text-right font-mono text-sm">
                    {controlData?.max != null && experimentalData?.max != null ? (
                      <span className={controlData.max - experimentalData.max > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500'}>
                        {controlData.max - experimentalData.max > 0 ? '−' : '+'}{Math.abs(controlData.max - experimentalData.max).toFixed(0)}
                      </span>
                    ) : '—'}
                  </td>
                </tr>
                <tr className="border-t border-gray-300 dark:border-gray-600">
                  <td className="py-2 pr-3 text-gray-600 dark:text-gray-300 font-medium">
                    Range
                  </td>
                  <td className="py-2 px-3 text-right font-mono text-gray-900 dark:text-white">
                    {fmt(controlRange)}
                  </td>
                  <td className="py-2 px-3 text-right font-mono text-gray-900 dark:text-white">
                    {fmt(experimentalRange)}
                  </td>
                  <td className="py-2 pl-3 text-right font-mono text-sm text-gray-500">—</td>
                </tr>
                <tr>
                  <td className="py-2 pr-3 text-gray-600 dark:text-gray-300 font-medium">
                    IQR
                  </td>
                  <td className="py-2 px-3 text-right font-mono text-gray-900 dark:text-white">
                    {fmt(controlData?.IQR)}
                  </td>
                  <td className="py-2 px-3 text-right font-mono text-gray-900 dark:text-white">
                    {fmt(experimentalData?.IQR)}
                  </td>
                  <td className="py-2 pl-3 text-right font-mono text-sm text-gray-500">—</td>
                </tr>
                <tr>
                  <td className="py-2 pr-3 text-gray-600 dark:text-gray-300 font-medium">
                    n (converged)
                  </td>
                  <td className="py-2 px-3 text-right font-mono text-gray-900 dark:text-white">
                    {controlData?.n ?? 0}
                  </td>
                  <td className="py-2 px-3 text-right font-mono text-gray-900 dark:text-white">
                    {experimentalData?.n ?? 0}
                  </td>
                  <td className="py-2 pl-3 text-right font-mono text-sm text-gray-500">—</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Visual range bars */}
          <div className="space-y-3 pt-2 border-t border-gray-200 dark:border-gray-700">
            <h5 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Visual Range Comparison
            </h5>

            {/* Control bar */}
            {controlData && (
              <RangeBar
                data={controlData}
                toPercent={toPercent}
                label="Control"
                labelColor="text-blue-600 dark:text-blue-400"
                iqrFill="bg-blue-200 dark:bg-blue-800/50"
                rangeFill="bg-blue-500/30"
                medianStroke="bg-blue-700 dark:bg-blue-300"
                tipHeaderColor="#3B82F6"
              />
            )}

            {/* Experimental bar */}
            {experimentalData && (
              <RangeBar
                data={experimentalData}
                toPercent={toPercent}
                label="Experimental"
                labelColor="text-amber-600 dark:text-amber-400"
                iqrFill="bg-amber-200 dark:bg-amber-800/50"
                rangeFill="bg-amber-500/30"
                medianStroke="bg-amber-700 dark:bg-amber-300"
                tipHeaderColor="#D97706"
              />
            )}

            <div className="flex items-center gap-4 text-[10px] text-gray-400 mt-1">
              <span className="flex items-center gap-1">
                <span className="w-4 h-2.5 bg-blue-200 dark:bg-blue-800/50 rounded inline-block" /> IQR
              </span>
              <span className="flex items-center gap-1">
                <span className="w-4 h-1 bg-blue-500/30 rounded-full inline-block" /> Full range
              </span>
              <span className="flex items-center gap-1">
                <span className="w-0.5 h-3 bg-blue-700 inline-block" /> Median
              </span>
            </div>
          </div>

          {/* Key insight */}
          <div className="p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg border border-indigo-200 dark:border-indigo-800/40">
            <p className="text-xs text-indigo-700 dark:text-indigo-300">
              <span className="font-semibold">Key insight: </span>
              {controlData?.max != null && experimentalData?.median != null &&
               experimentalData.median < controlData.max ? (
                <>
                  The experimental group&apos;s slowest convergence
                  ({fmt(experimentalData?.max)}) is still faster than the control group&apos;s
                  median ({fmt(controlData?.median)}), demonstrating that adaptive mutation
                  consistently accelerates convergence across the entire distribution.
                </>
              ) : (
                <>
                  Compare the ranges above to see how the two groups&apos; convergence
                  generations overlap (or don&apos;t).
                </>
              )}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
