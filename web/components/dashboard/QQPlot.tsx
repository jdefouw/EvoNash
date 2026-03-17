'use client'

interface QQPlotProps {
  controlValues: number[]
  experimentalValues: number[]
  title?: string
}

export default function QQPlot({
  controlValues,
  experimentalValues,
  title = 'Q-Q Plot (Normality)'
}: QQPlotProps) {
  const cleanControl = controlValues.filter(x => !isNaN(x) && isFinite(x))
  const cleanExperimental = experimentalValues.filter(x => !isNaN(x) && isFinite(x))

  if (cleanControl.length < 3 && cleanExperimental.length < 3) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
        <h4 className="text-base font-semibold text-gray-900 dark:text-white mb-4">{title}</h4>
        <div className="flex items-center justify-center h-48 text-gray-400 text-sm">
          Need n ≥ 3 for Q-Q plot
        </div>
      </div>
    )
  }

  const normalQuantile = (p: number): number => {
    if (p <= 0) return -4
    if (p >= 1) return 4
    if (p === 0.5) return 0
    const a = [-3.969683028665376e+01, 2.209460984245205e+02, -2.759285104469687e+02, 1.383577518672690e+02, -3.066479806614716e+01, 2.506628277459239e+00]
    const b = [-5.447609879822406e+01, 1.615858368580409e+02, -1.556989798598866e+02, 6.680131188771972e+01, -1.328068155288572e+01]
    let q: number
    if (p < 0.5) {
      q = Math.sqrt(-2 * Math.log(p))
    } else {
      q = Math.sqrt(-2 * Math.log(1 - p))
    }
    const num = ((((a[0] * q + a[1]) * q + a[2]) * q + a[3]) * q + a[4]) * q + a[5]
    const den = ((((b[0] * q + b[1]) * q + b[2]) * q + b[3]) * q + b[4]) * q + 1
    return p < 0.5 ? -num / den : num / den
  }

  const generateQQPoints = (data: number[]) => {
    const sorted = [...data].sort((a, b) => a - b)
    const n = sorted.length
    return sorted.map((value, i) => {
      const p = (i + 1 - 0.375) / (n + 0.25)
      const theoretical = normalQuantile(p)
      return { theoretical, observed: value }
    })
  }

  const controlPoints = cleanControl.length >= 3 ? generateQQPoints(cleanControl) : []
  const experimentalPoints = cleanExperimental.length >= 3 ? generateQQPoints(cleanExperimental) : []

  const standardize = (points: typeof controlPoints) => {
    if (points.length === 0) return []
    const values = points.map(p => p.observed)
    const mean = values.reduce((a, b) => a + b, 0) / values.length
    const std = Math.sqrt(values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / (values.length - 1))
    if (std === 0) return points.map(p => ({ ...p, standardized: 0 }))
    return points.map(p => ({ ...p, standardized: (p.observed - mean) / std }))
  }

  const controlStandardized = standardize(controlPoints)
  const experimentalStandardized = standardize(experimentalPoints)

  // Responsive SVG via viewBox
  const svgWidth = 260
  const svgHeight = 220
  const plotMargin = { top: 15, right: 15, bottom: 30, left: 38 }
  const plotWidth = svgWidth - plotMargin.left - plotMargin.right
  const plotHeight = svgHeight - plotMargin.top - plotMargin.bottom

  const allTheoretical = [...controlStandardized, ...experimentalStandardized].map(p => p.theoretical)
  const rangeMin = Math.min(-3, ...allTheoretical)
  const rangeMax = Math.max(3, ...allTheoretical)
  const range = rangeMax - rangeMin

  const scaleX = (value: number) => plotMargin.left + ((value - rangeMin) / range) * plotWidth
  const scaleY = (value: number) => plotMargin.top + plotHeight - ((value - rangeMin) / range) * plotHeight

  const renderQQPlot = (
    points: Array<{ theoretical: number; standardized: number }>,
    color: string,
    label: string
  ) => (
    <div className="flex flex-col items-center flex-1 min-w-[140px]">
      <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="w-full h-auto max-w-[280px]" preserveAspectRatio="xMidYMid meet">
        {/* Axes */}
        <line x1={plotMargin.left} y1={plotMargin.top + plotHeight} x2={plotMargin.left + plotWidth} y2={plotMargin.top + plotHeight}
          className="stroke-gray-300 dark:stroke-gray-600" strokeWidth={1} />
        <line x1={plotMargin.left} y1={plotMargin.top} x2={plotMargin.left} y2={plotMargin.top + plotHeight}
          className="stroke-gray-300 dark:stroke-gray-600" strokeWidth={1} />

        {/* Grid & ticks */}
        {[-2, -1, 0, 1, 2].map(v => (
          <g key={v}>
            <line x1={plotMargin.left} y1={scaleY(v)} x2={plotMargin.left + plotWidth} y2={scaleY(v)}
              className="stroke-gray-100 dark:stroke-gray-700" strokeWidth={1} strokeDasharray="2,3" />
            <line x1={scaleX(v)} y1={plotMargin.top} x2={scaleX(v)} y2={plotMargin.top + plotHeight}
              className="stroke-gray-100 dark:stroke-gray-700" strokeWidth={1} strokeDasharray="2,3" />
            <text x={plotMargin.left - 6} y={scaleY(v)} textAnchor="end" dominantBaseline="middle"
              className="text-[9px] fill-gray-400 dark:fill-gray-500">{v}</text>
            <text x={scaleX(v)} y={plotMargin.top + plotHeight + 10} textAnchor="middle"
              className="text-[9px] fill-gray-400 dark:fill-gray-500">{v}</text>
          </g>
        ))}

        {/* Reference line */}
        <line x1={scaleX(rangeMin)} y1={scaleY(rangeMin)} x2={scaleX(rangeMax)} y2={scaleY(rangeMax)}
          stroke="#EF4444" strokeWidth={1.5} strokeDasharray="4,3" opacity={0.5} />

        {/* Data points */}
        {points.map((point, i) => (
          <circle key={i} cx={scaleX(point.theoretical)} cy={scaleY(point.standardized)}
            r={3} fill={color} opacity={0.7} />
        ))}

        {/* Axis labels */}
        <text x={plotMargin.left + plotWidth / 2} y={plotMargin.top + plotHeight + 24} textAnchor="middle"
          className="text-[9px] fill-gray-500 dark:fill-gray-400">Theoretical</text>
        <text x={10} y={plotMargin.top + plotHeight / 2} textAnchor="middle" dominantBaseline="middle"
          transform={`rotate(-90, 10, ${plotMargin.top + plotHeight / 2})`}
          className="text-[9px] fill-gray-500 dark:fill-gray-400">Sample</text>
      </svg>
      <div className="flex items-center gap-1.5 mt-1">
        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
        <span className="text-xs font-medium text-gray-700 dark:text-gray-300">{label}</span>
        <span className="text-[10px] text-gray-400">(n={points.length})</span>
      </div>
    </div>
  )

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 sm:p-5">
      <h4 className="text-base font-semibold text-gray-900 dark:text-white mb-1">{title}</h4>
      <p className="text-[11px] text-gray-400 dark:text-gray-500 mb-3">
        Points near the red line = normal distribution
      </p>

      <div className="flex flex-wrap justify-center gap-4">
        {controlStandardized.length > 0 && renderQQPlot(controlStandardized, '#3B82F6', 'Control')}
        {experimentalStandardized.length > 0 && renderQQPlot(experimentalStandardized, '#8B5CF6', 'Experimental')}
      </div>
    </div>
  )
}
