'use client'

import { useState } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts'
import type { TooltipProps } from 'recharts'
import { Generation } from '@/types/protocol'

interface ComparisonChartProps {
  controlGenerations: Generation[]
  experimentalGenerations: Generation[]
  metric: 'fitness' | 'entropy'
  title?: string
  showConvergenceMarker?: boolean
  controlConvergenceGen?: number | null
  experimentalConvergenceGen?: number | null
}

export default function ComparisonChart({
  controlGenerations,
  experimentalGenerations,
  metric,
  title,
  showConvergenceMarker = false,
  controlConvergenceGen,
  experimentalConvergenceGen
}: ComparisonChartProps) {
  const [viewMode, setViewMode] = useState<'overlay' | 'side-by-side'>('overlay')

  // Aggregate by generation_number
  const maxGen = Math.max(
    controlGenerations.length > 0 ? Math.max(...controlGenerations.map(g => g.generation_number)) : 0,
    experimentalGenerations.length > 0 ? Math.max(...experimentalGenerations.map(g => g.generation_number)) : 0
  )

  const controlExpIds = new Set(controlGenerations.map((g) => g.experiment_id))
  const experimentalExpIds = new Set(experimentalGenerations.map((g) => g.experiment_id))
  const overlappingExpIds = [...controlExpIds].filter((id) => experimentalExpIds.has(id))
  if (overlappingExpIds.length > 0) {
    console.error('[ComparisonChart] Bug: same experiment(s) in both control and experimental', overlappingExpIds)
  }

  type GenBucket = { avgFitness: number[]; peakFitness: number[]; entropy: number[]; variance: number[] }
  const controlByGen = new Map<number, GenBucket>()
  const experimentalByGen = new Map<number, GenBucket>()
  const seenControl = new Map<number, Set<string>>()
  const seenExperimental = new Map<number, Set<string>>()

  for (const g of controlGenerations) {
    const i = g.generation_number
    if (!seenControl.has(i)) seenControl.set(i, new Set())
    if (seenControl.get(i)!.has(g.experiment_id)) continue
    seenControl.get(i)!.add(g.experiment_id)
    if (!controlByGen.has(i)) controlByGen.set(i, { avgFitness: [], peakFitness: [], entropy: [], variance: [] })
    const b = controlByGen.get(i)!
    if (g.avg_fitness != null) b.avgFitness.push(g.avg_fitness)
    if (g.peak_fitness != null) b.peakFitness.push(g.peak_fitness)
    if (g.policy_entropy != null) b.entropy.push(g.policy_entropy)
    if (g.entropy_variance != null) b.variance.push(g.entropy_variance)
  }
  for (const g of experimentalGenerations) {
    const i = g.generation_number
    if (!seenExperimental.has(i)) seenExperimental.set(i, new Set())
    if (seenExperimental.get(i)!.has(g.experiment_id)) continue
    seenExperimental.get(i)!.add(g.experiment_id)
    if (!experimentalByGen.has(i)) experimentalByGen.set(i, { avgFitness: [], peakFitness: [], entropy: [], variance: [] })
    const b = experimentalByGen.get(i)!
    if (g.avg_fitness != null) b.avgFitness.push(g.avg_fitness)
    if (g.peak_fitness != null) b.peakFitness.push(g.peak_fitness)
    if (g.policy_entropy != null) b.entropy.push(g.policy_entropy)
    if (g.entropy_variance != null) b.variance.push(g.entropy_variance)
  }

  const mean = (arr: number[]) => (arr.length === 0 ? null : arr.reduce((a, b) => a + b, 0) / arr.length)

  const overlayData = Array.from({ length: maxGen + 1 }, (_, i) => {
    const c = controlByGen.get(i)
    const e = experimentalByGen.get(i)
    if (metric === 'fitness') {
      return {
        generation: i,
        controlAvgFitness: c ? mean(c.avgFitness) : null,
        controlPeakFitness: c ? mean(c.peakFitness) : null,
        experimentalAvgFitness: e ? mean(e.avgFitness) : null,
        experimentalPeakFitness: e ? mean(e.peakFitness) : null,
      }
    } else {
      return {
        generation: i,
        controlEntropy: c ? mean(c.entropy) : null,
        controlVariance: c ? mean(c.variance) : null,
        experimentalEntropy: e ? mean(e.entropy) : null,
        experimentalVariance: e ? mean(e.variance) : null,
      }
    }
  }).filter(d =>
    (metric === 'fitness' && (d.controlAvgFitness !== null || d.experimentalAvgFitness !== null)) ||
    (metric === 'entropy' && (d.controlEntropy !== null || d.experimentalEntropy !== null))
  )

  const chartTitle = title || (metric === 'fitness' ? 'Fitness Score Comparison' : 'Policy Entropy Comparison')

  const renderTooltipContent = (props: TooltipProps<number, string>) => {
    const { active, payload, label } = props
    if (!active || !payload?.length) return null
    const raw = payload[0]?.payload
    if (raw == null) return null
    const p = raw as Record<string, unknown>
    const gen = (p.generation as number) ?? label
    return (
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg p-3 text-xs max-w-[220px]">
        <div className="font-semibold text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-600 pb-1 mb-1.5">
          Gen {gen}
        </div>
        <div className="space-y-0.5 text-gray-700 dark:text-gray-300">
          {metric === 'fitness' ? (
            <>
              <div className="flex justify-between gap-3">
                <span className="text-blue-500">Ctrl Avg:</span>
                <span className="font-mono">{(p.controlAvgFitness as number) != null ? Number(p.controlAvgFitness).toFixed(1) : '—'}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-purple-500">Exp Avg:</span>
                <span className="font-mono">{(p.experimentalAvgFitness as number) != null ? Number(p.experimentalAvgFitness).toFixed(1) : '—'}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-blue-300">Ctrl Peak:</span>
                <span className="font-mono">{(p.controlPeakFitness as number) != null ? Number(p.controlPeakFitness).toFixed(1) : '—'}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-purple-300">Exp Peak:</span>
                <span className="font-mono">{(p.experimentalPeakFitness as number) != null ? Number(p.experimentalPeakFitness).toFixed(1) : '—'}</span>
              </div>
            </>
          ) : (
            <>
              <div className="flex justify-between gap-3">
                <span className="text-blue-500">Ctrl Entropy:</span>
                <span className="font-mono">{(p.controlEntropy as number) != null ? Number(p.controlEntropy).toFixed(4) : '—'}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-purple-500">Exp Entropy:</span>
                <span className="font-mono">{(p.experimentalEntropy as number) != null ? Number(p.experimentalEntropy).toFixed(4) : '—'}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-blue-300">Ctrl σ²:</span>
                <span className="font-mono">{(p.controlVariance as number) != null ? Number(p.controlVariance).toFixed(6) : '—'}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-purple-300">Exp σ²:</span>
                <span className="font-mono">{(p.experimentalVariance as number) != null ? Number(p.experimentalVariance).toFixed(6) : '—'}</span>
              </div>
            </>
          )}
        </div>
      </div>
    )
  }

  const renderOverlayChart = () => (
    <ResponsiveContainer width="100%" height={320}>
      <LineChart data={overlayData} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" />
        <XAxis
          dataKey="generation"
          tick={{ fontSize: 11 }}
          tickLine={false}
          axisLine={{ className: 'stroke-gray-300 dark:stroke-gray-600' }}
        />
        <YAxis
          tick={{ fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          width={50}
        />
        <Tooltip content={renderTooltipContent} />

        {/* Convergence reference lines */}
        {showConvergenceMarker && controlConvergenceGen && (
          <ReferenceLine
            x={controlConvergenceGen}
            stroke="#3b82f6"
            strokeDasharray="5 5"
            strokeWidth={1.5}
          />
        )}
        {showConvergenceMarker && experimentalConvergenceGen && (
          <ReferenceLine
            x={experimentalConvergenceGen}
            stroke="#8b5cf6"
            strokeDasharray="5 5"
            strokeWidth={1.5}
          />
        )}

        {metric === 'fitness' ? (
          <>
            <Line type="monotone" dataKey="controlAvgFitness" stroke="#3b82f6" strokeWidth={2} name="Control Avg" dot={false} connectNulls />
            <Line type="monotone" dataKey="experimentalAvgFitness" stroke="#8b5cf6" strokeWidth={2} name="Exp Avg" dot={false} connectNulls />
            <Line type="monotone" dataKey="controlPeakFitness" stroke="#93c5fd" strokeWidth={1} strokeDasharray="4 2" name="Control Peak" dot={false} connectNulls />
            <Line type="monotone" dataKey="experimentalPeakFitness" stroke="#c4b5fd" strokeWidth={1} strokeDasharray="4 2" name="Exp Peak" dot={false} connectNulls />
          </>
        ) : (
          <>
            <Line type="monotone" dataKey="controlEntropy" stroke="#3b82f6" strokeWidth={2} name="Control" dot={false} connectNulls />
            <Line type="monotone" dataKey="experimentalEntropy" stroke="#8b5cf6" strokeWidth={2} name="Experimental" dot={false} connectNulls />
            <Line type="monotone" dataKey="controlVariance" stroke="#93c5fd" strokeWidth={1} strokeDasharray="4 2" name="Control σ²" dot={false} connectNulls />
            <Line type="monotone" dataKey="experimentalVariance" stroke="#c4b5fd" strokeWidth={1} strokeDasharray="4 2" name="Exp σ²" dot={false} connectNulls />
            <ReferenceLine y={0.001} stroke="#ef4444" strokeDasharray="5 5" strokeWidth={1} />
          </>
        )}
      </LineChart>
    </ResponsiveContainer>
  )

  const renderSideBySideCharts = () => {
    const controlData = controlGenerations.map(g => ({
      generation: g.generation_number,
      avgValue: metric === 'fitness' ? g.avg_fitness : g.policy_entropy,
      peakValue: metric === 'fitness' ? g.peak_fitness : g.entropy_variance,
    }))

    const expData = experimentalGenerations.map(g => ({
      generation: g.generation_number,
      avgValue: metric === 'fitness' ? g.avg_fitness : g.policy_entropy,
      peakValue: metric === 'fitness' ? g.peak_fitness : g.entropy_variance,
    }))

    const avgLabel = metric === 'fitness' ? 'Avg Fitness' : 'Entropy'
    const peakLabel = metric === 'fitness' ? 'Peak Fitness' : 'Variance'

    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-blue-50/50 dark:bg-blue-900/10 rounded-lg p-3">
          <h4 className="font-medium text-blue-700 dark:text-blue-400 mb-2 text-center text-sm">
            Control (Static)
          </h4>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={controlData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" />
              <XAxis dataKey="generation" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} width={45} />
              <Tooltip />
              <Line type="monotone" dataKey="avgValue" stroke="#3b82f6" name={avgLabel} dot={false} strokeWidth={1.5} />
              <Line type="monotone" dataKey="peakValue" stroke="#93c5fd" name={peakLabel} dot={false} strokeDasharray="3 3" strokeWidth={1} />
              {showConvergenceMarker && controlConvergenceGen && (
                <ReferenceLine x={controlConvergenceGen} stroke="#ef4444" strokeDasharray="5 5" />
              )}
            </LineChart>
          </ResponsiveContainer>
          {controlConvergenceGen && (
            <p className="text-[10px] text-center text-blue-600 dark:text-blue-400 mt-1">
              Converged at Gen {controlConvergenceGen}
            </p>
          )}
        </div>

        <div className="bg-purple-50/50 dark:bg-purple-900/10 rounded-lg p-3">
          <h4 className="font-medium text-purple-700 dark:text-purple-400 mb-2 text-center text-sm">
            Experimental (Adaptive)
          </h4>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={expData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" />
              <XAxis dataKey="generation" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} width={45} />
              <Tooltip />
              <Line type="monotone" dataKey="avgValue" stroke="#8b5cf6" name={avgLabel} dot={false} strokeWidth={1.5} />
              <Line type="monotone" dataKey="peakValue" stroke="#c4b5fd" name={peakLabel} dot={false} strokeDasharray="3 3" strokeWidth={1} />
              {showConvergenceMarker && experimentalConvergenceGen && (
                <ReferenceLine x={experimentalConvergenceGen} stroke="#ef4444" strokeDasharray="5 5" />
              )}
            </LineChart>
          </ResponsiveContainer>
          {experimentalConvergenceGen && (
            <p className="text-[10px] text-center text-purple-600 dark:text-purple-400 mt-1">
              Converged at Gen {experimentalConvergenceGen}
            </p>
          )}
        </div>
      </div>
    )
  }

  const hasData = controlGenerations.length > 0 || experimentalGenerations.length > 0

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 sm:p-5">
      <div className="flex flex-wrap justify-between items-center gap-3 mb-3">
        <h3 className="text-base font-semibold text-gray-900 dark:text-white">
          {chartTitle}
        </h3>
        {hasData && (
          <div className="flex gap-1">
            <button
              onClick={() => setViewMode('overlay')}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${viewMode === 'overlay'
                ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
            >
              Overlay
            </button>
            <button
              onClick={() => setViewMode('side-by-side')}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${viewMode === 'side-by-side'
                ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
            >
              Split
            </button>
          </div>
        )}
      </div>

      {hasData ? (
        viewMode === 'overlay' ? renderOverlayChart() : renderSideBySideCharts()
      ) : (
        <div className="flex items-center justify-center h-48 text-gray-400 dark:text-gray-500 text-sm">
          No experiment data available
        </div>
      )}

      {/* Compact legend below chart */}
      {hasData && (
        <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700/50">
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[11px] text-gray-500 dark:text-gray-400">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-0.5 bg-blue-500 rounded" />
              <span>Control (Static ε)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-0.5 bg-purple-500 rounded" />
              <span>Experimental (Adaptive ε)</span>
            </div>
            {metric === 'entropy' && showConvergenceMarker && (
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-px bg-red-400" style={{ borderTop: '1px dashed' }} />
                <span>Convergence (σ &lt; 0.001)</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
