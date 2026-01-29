'use client'

interface QQPlotProps {
  controlValues: number[]
  experimentalValues: number[]
  title?: string
  height?: number
}

export default function QQPlot({
  controlValues,
  experimentalValues,
  title = 'Q-Q Plot (Normality Assessment)',
  height = 280
}: QQPlotProps) {
  // Clean data
  const cleanControl = controlValues.filter(x => !isNaN(x) && isFinite(x))
  const cleanExperimental = experimentalValues.filter(x => !isNaN(x) && isFinite(x))

  if (cleanControl.length < 3 && cleanExperimental.length < 3) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
        <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">{title}</h4>
        <div className="flex items-center justify-center h-48 text-gray-500 dark:text-gray-400">
          Insufficient data for Q-Q plot (need n ≥ 3)
        </div>
      </div>
    )
  }

  // Normal quantile function (inverse CDF approximation)
  const normalQuantile = (p: number): number => {
    if (p <= 0) return -4
    if (p >= 1) return 4
    if (p === 0.5) return 0
    
    // Approximation using rational function
    const a = [
      -3.969683028665376e+01,
      2.209460984245205e+02,
      -2.759285104469687e+02,
      1.383577518672690e+02,
      -3.066479806614716e+01,
      2.506628277459239e+00
    ]
    const b = [
      -5.447609879822406e+01,
      1.615858368580409e+02,
      -1.556989798598866e+02,
      6.680131188771972e+01,
      -1.328068155288572e+01
    ]
    
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

  // Generate Q-Q points for a dataset
  const generateQQPoints = (data: number[]) => {
    const sorted = [...data].sort((a, b) => a - b)
    const n = sorted.length
    
    return sorted.map((value, i) => {
      // Use plotting positions (Blom's formula for better small-sample performance)
      const p = (i + 1 - 0.375) / (n + 0.25)
      const theoretical = normalQuantile(p)
      return { theoretical, observed: value }
    })
  }

  const controlPoints = cleanControl.length >= 3 ? generateQQPoints(cleanControl) : []
  const experimentalPoints = cleanExperimental.length >= 3 ? generateQQPoints(cleanExperimental) : []

  // Calculate scales
  const allTheoretical = [...controlPoints, ...experimentalPoints].map(p => p.theoretical)
  const allObserved = [...controlPoints, ...experimentalPoints].map(p => p.observed)
  
  const theoreticalMin = Math.min(...allTheoretical)
  const theoreticalMax = Math.max(...allTheoretical)
  const observedMin = Math.min(...allObserved)
  const observedMax = Math.max(...allObserved)
  
  // Standardize observed values for each group
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

  // SVG dimensions
  const svgWidth = 280
  const svgHeight = height - 60
  const plotMargin = { top: 25, right: 20, bottom: 35, left: 45 }
  const plotWidth = svgWidth - plotMargin.left - plotMargin.right
  const plotHeight = svgHeight - plotMargin.top - plotMargin.bottom

  // Scale range for standardized values
  const rangeMin = Math.min(-3, theoreticalMin)
  const rangeMax = Math.max(3, theoreticalMax)
  const range = rangeMax - rangeMin

  // Scale functions
  const scaleX = (value: number) => plotMargin.left + ((value - rangeMin) / range) * plotWidth
  const scaleY = (value: number) => plotMargin.top + plotHeight - ((value - rangeMin) / range) * plotHeight

  // Reference line (y = x for perfectly normal data)
  const refLineX1 = scaleX(rangeMin)
  const refLineY1 = scaleY(rangeMin)
  const refLineX2 = scaleX(rangeMax)
  const refLineY2 = scaleY(rangeMax)

  const renderQQPlot = (
    points: Array<{ theoretical: number; standardized: number }>,
    color: string,
    label: string,
    xOffset: number
  ) => (
    <div className="flex flex-col items-center">
      <svg width={svgWidth} height={svgHeight} className="overflow-visible">
        {/* Axes */}
        <line
          x1={plotMargin.left}
          y1={plotMargin.top + plotHeight}
          x2={plotMargin.left + plotWidth}
          y2={plotMargin.top + plotHeight}
          className="stroke-gray-300 dark:stroke-gray-600"
          strokeWidth={1}
        />
        <line
          x1={plotMargin.left}
          y1={plotMargin.top}
          x2={plotMargin.left}
          y2={plotMargin.top + plotHeight}
          className="stroke-gray-300 dark:stroke-gray-600"
          strokeWidth={1}
        />
        
        {/* Grid and ticks */}
        {[-2, -1, 0, 1, 2].map(v => (
          <g key={v}>
            <line
              x1={plotMargin.left}
              y1={scaleY(v)}
              x2={plotMargin.left + plotWidth}
              y2={scaleY(v)}
              className="stroke-gray-200 dark:stroke-gray-700"
              strokeWidth={1}
              strokeDasharray="2,2"
            />
            <line
              x1={scaleX(v)}
              y1={plotMargin.top}
              x2={scaleX(v)}
              y2={plotMargin.top + plotHeight}
              className="stroke-gray-200 dark:stroke-gray-700"
              strokeWidth={1}
              strokeDasharray="2,2"
            />
            <text
              x={plotMargin.left - 8}
              y={scaleY(v)}
              textAnchor="end"
              dominantBaseline="middle"
              className="text-[10px] fill-gray-500 dark:fill-gray-400"
            >
              {v}
            </text>
            <text
              x={scaleX(v)}
              y={plotMargin.top + plotHeight + 12}
              textAnchor="middle"
              className="text-[10px] fill-gray-500 dark:fill-gray-400"
            >
              {v}
            </text>
          </g>
        ))}
        
        {/* Reference line (perfect normality) */}
        <line
          x1={refLineX1}
          y1={refLineY1}
          x2={refLineX2}
          y2={refLineY2}
          stroke="#EF4444"
          strokeWidth={2}
          strokeDasharray="6,3"
          opacity={0.6}
        />
        
        {/* Q-Q points */}
        {points.map((point, i) => (
          <circle
            key={i}
            cx={scaleX(point.theoretical)}
            cy={scaleY(point.standardized)}
            r={4}
            fill={color}
            opacity={0.7}
          />
        ))}
        
        {/* Labels */}
        <text
          x={plotMargin.left + plotWidth / 2}
          y={plotMargin.top + plotHeight + 28}
          textAnchor="middle"
          className="text-[10px] fill-gray-600 dark:fill-gray-400"
        >
          Theoretical Quantiles
        </text>
        <text
          x={12}
          y={plotMargin.top + plotHeight / 2}
          textAnchor="middle"
          dominantBaseline="middle"
          transform={`rotate(-90, 12, ${plotMargin.top + plotHeight / 2})`}
          className="text-[10px] fill-gray-600 dark:fill-gray-400"
        >
          Sample Quantiles
        </text>
      </svg>
      <div className="flex items-center gap-2 mt-2">
        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{label}</span>
        <span className="text-xs text-gray-500">(n={points.length})</span>
      </div>
    </div>
  )

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
      <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">{title}</h4>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
        Points close to the red line indicate normal distribution. Deviations suggest non-normality.
      </p>
      
      <div className="flex flex-wrap justify-center gap-4">
        {controlStandardized.length > 0 && renderQQPlot(controlStandardized, '#3B82F6', 'Control', 0)}
        {experimentalStandardized.length > 0 && renderQQPlot(experimentalStandardized, '#8B5CF6', 'Experimental', 1)}
      </div>
      
      <div className="flex justify-center gap-4 mt-4 text-xs text-gray-500 dark:text-gray-400">
        <div className="flex items-center gap-1">
          <div className="w-4 h-0.5 bg-red-500 opacity-60" style={{ borderStyle: 'dashed' }} />
          <span>Reference (Normal)</span>
        </div>
      </div>
    </div>
  )
}
