'use client'

import { useMemo } from 'react'

interface ConvergenceMeanBarChartProps {
  controlMean: number | null
  experimentalMean: number | null
  controlStd: number | null
  experimentalStd: number | null
  controlN: number
  experimentalN: number
  confidenceInterval: { lower: number; upper: number } | null
  meanDifference: number | null
}

export default function ConvergenceMeanBarChart({
  controlMean,
  experimentalMean,
  controlStd,
  experimentalStd,
  controlN,
  experimentalN,
  confidenceInterval,
  meanDifference,
}: ConvergenceMeanBarChartProps) {
  const chartData = useMemo(() => {
    if (controlMean === null || experimentalMean === null) return null

    // 95% CI for each group mean: mean ± 1.96 * (std / sqrt(n))
    const controlSE = controlStd !== null && controlN > 0 ? controlStd / Math.sqrt(controlN) : 0
    const experimentalSE = experimentalStd !== null && experimentalN > 0 ? experimentalStd / Math.sqrt(experimentalN) : 0
    const controlCI = controlSE * 1.96
    const experimentalCI = experimentalSE * 1.96

    return {
      controlMean,
      experimentalMean,
      controlCILower: controlMean - controlCI,
      controlCIUpper: controlMean + controlCI,
      experimentalCILower: experimentalMean - experimentalCI,
      experimentalCIUpper: experimentalMean + experimentalCI,
      controlSE,
      experimentalSE,
    }
  }, [controlMean, experimentalMean, controlStd, experimentalStd, controlN, experimentalN])

  if (!chartData) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
        <h4 className="text-base font-semibold text-gray-900 dark:text-white mb-4">
          Mean Convergence Generation with 95% CI
        </h4>
        <div className="flex items-center justify-center h-48 text-gray-400 text-sm">
          Waiting for convergence data…
        </div>
      </div>
    )
  }

  const maxVal = Math.max(chartData.controlCIUpper, chartData.experimentalCIUpper) * 1.15
  const barWidth = 80
  const chartHeight = 320
  const chartWidth = 400
  const marginLeft = 60
  const marginBottom = 50
  const marginTop = 30
  const plotHeight = chartHeight - marginBottom - marginTop
  const scale = (v: number) => marginTop + plotHeight * (1 - v / maxVal)

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 sm:p-5">
      <h4 className="text-base font-semibold text-gray-900 dark:text-white mb-0.5">
        Mean Convergence Generation with 95% Confidence Intervals
      </h4>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
        Error bars show 95% CI for each group mean — non-overlapping bars indicate significant difference
      </p>

      <div className="flex justify-center">
        <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} width="100%" style={{ maxWidth: chartWidth }} className="overflow-visible">
          {/* Y-axis */}
          <line x1={marginLeft} y1={marginTop} x2={marginLeft} y2={chartHeight - marginBottom} stroke="#d1d5db" strokeWidth={1} />
          {/* Y-axis ticks */}
          {[0, 50, 100, 150, 200, 250].filter(v => v <= maxVal).map(v => (
            <g key={v}>
              <line x1={marginLeft - 4} y1={scale(v)} x2={marginLeft} y2={scale(v)} stroke="#9ca3af" strokeWidth={1} />
              <text x={marginLeft - 8} y={scale(v) + 4} textAnchor="end" fontSize={11} fill="#6b7280">{v}</text>
              <line x1={marginLeft} y1={scale(v)} x2={chartWidth - 20} y2={scale(v)} stroke="#f3f4f6" strokeWidth={0.5} />
            </g>
          ))}
          {/* Y-axis label */}
          <text x={14} y={chartHeight / 2} textAnchor="middle" fontSize={12} fill="#374151" fontWeight={600} transform={`rotate(-90, 14, ${chartHeight / 2})`}>
            Generations
          </text>

          {/* Control bar */}
          <rect
            x={marginLeft + 40}
            y={scale(chartData.controlMean)}
            width={barWidth}
            height={scale(0) - scale(chartData.controlMean)}
            fill="#6b7280"
            fillOpacity={0.65}
            stroke="#4b5563"
            strokeWidth={1.5}
            rx={4}
          />
          {/* Control CI whiskers */}
          <line
            x1={marginLeft + 40 + barWidth / 2} y1={scale(chartData.controlCIUpper)}
            x2={marginLeft + 40 + barWidth / 2} y2={scale(chartData.controlCILower)}
            stroke="#1f2937" strokeWidth={2}
          />
          <line
            x1={marginLeft + 40 + barWidth / 2 - 12} y1={scale(chartData.controlCIUpper)}
            x2={marginLeft + 40 + barWidth / 2 + 12} y2={scale(chartData.controlCIUpper)}
            stroke="#1f2937" strokeWidth={2}
          />
          <line
            x1={marginLeft + 40 + barWidth / 2 - 12} y1={scale(chartData.controlCILower)}
            x2={marginLeft + 40 + barWidth / 2 + 12} y2={scale(chartData.controlCILower)}
            stroke="#1f2937" strokeWidth={2}
          />
          {/* Control mean label */}
          <text
            x={marginLeft + 40 + barWidth / 2} y={scale(chartData.controlMean) - 8}
            textAnchor="middle" fontSize={13} fontWeight={700} fill="#374151"
          >
            {Math.round(chartData.controlMean)}
          </text>

          {/* Experimental bar */}
          <rect
            x={marginLeft + 40 + barWidth + 50}
            y={scale(chartData.experimentalMean)}
            width={barWidth}
            height={scale(0) - scale(chartData.experimentalMean)}
            fill="#6366f1"
            fillOpacity={0.65}
            stroke="#4f46e5"
            strokeWidth={1.5}
            rx={4}
          />
          {/* Experimental CI whiskers */}
          <line
            x1={marginLeft + 40 + barWidth + 50 + barWidth / 2} y1={scale(chartData.experimentalCIUpper)}
            x2={marginLeft + 40 + barWidth + 50 + barWidth / 2} y2={scale(chartData.experimentalCILower)}
            stroke="#1f2937" strokeWidth={2}
          />
          <line
            x1={marginLeft + 40 + barWidth + 50 + barWidth / 2 - 12} y1={scale(chartData.experimentalCIUpper)}
            x2={marginLeft + 40 + barWidth + 50 + barWidth / 2 + 12} y2={scale(chartData.experimentalCIUpper)}
            stroke="#1f2937" strokeWidth={2}
          />
          <line
            x1={marginLeft + 40 + barWidth + 50 + barWidth / 2 - 12} y1={scale(chartData.experimentalCILower)}
            x2={marginLeft + 40 + barWidth + 50 + barWidth / 2 + 12} y2={scale(chartData.experimentalCILower)}
            stroke="#1f2937" strokeWidth={2}
          />
          {/* Experimental mean label */}
          <text
            x={marginLeft + 40 + barWidth + 50 + barWidth / 2} y={scale(chartData.experimentalMean) - 8}
            textAnchor="middle" fontSize={13} fontWeight={700} fill="#374151"
          >
            {Math.round(chartData.experimentalMean)}
          </text>

          {/* X-axis labels */}
          <text x={marginLeft + 40 + barWidth / 2} y={chartHeight - marginBottom + 20} textAnchor="middle" fontSize={12} fill="#374151" fontWeight={600}>
            Control
          </text>
          <text x={marginLeft + 40 + barWidth / 2} y={chartHeight - marginBottom + 33} textAnchor="middle" fontSize={10} fill="#6b7280">
            (Static ε)
          </text>
          <text x={marginLeft + 40 + barWidth + 50 + barWidth / 2} y={chartHeight - marginBottom + 20} textAnchor="middle" fontSize={12} fill="#374151" fontWeight={600}>
            Experimental
          </text>
          <text x={marginLeft + 40 + barWidth + 50 + barWidth / 2} y={chartHeight - marginBottom + 33} textAnchor="middle" fontSize={10} fill="#6b7280">
            (Adaptive ε)
          </text>
        </svg>
      </div>

      {/* Stats below */}
      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="text-center p-2 bg-gray-50 dark:bg-gray-700/30 rounded-lg">
          <div className="text-xs text-gray-500 dark:text-gray-400">Control 95% CI</div>
          <div className="text-sm font-semibold text-gray-700 dark:text-gray-200">
            [{Math.round(chartData.controlCILower)}, {Math.round(chartData.controlCIUpper)}]
          </div>
          <div className="text-xs text-gray-400">n = {controlN}</div>
        </div>
        <div className="text-center p-2 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg">
          <div className="text-xs text-gray-500 dark:text-gray-400">Experimental 95% CI</div>
          <div className="text-sm font-semibold text-indigo-700 dark:text-indigo-300">
            [{Math.round(chartData.experimentalCILower)}, {Math.round(chartData.experimentalCIUpper)}]
          </div>
          <div className="text-xs text-gray-400">n = {experimentalN}</div>
        </div>
      </div>

      {confidenceInterval && meanDifference !== null && (
        <div className="mt-3 text-center p-2 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
          <div className="text-xs text-gray-500 dark:text-gray-400">95% CI for Mean Difference (Control − Experimental)</div>
          <div className="text-sm font-semibold text-green-700 dark:text-green-300">
            {Math.round(meanDifference)} generations [{confidenceInterval.lower.toFixed(1)}, {confidenceInterval.upper.toFixed(1)}]
          </div>
        </div>
      )}
    </div>
  )
}
