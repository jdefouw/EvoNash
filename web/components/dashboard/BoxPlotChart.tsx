'use client'

interface BoxPlotData {
  n: number
  mean: number | null
  median: number | null
  std: number | null
  min: number | null
  max: number | null
  Q1: number | null
  Q3: number | null
  IQR: number | null
  values: number[]
}

interface BoxPlotChartProps {
  controlData: BoxPlotData | null
  experimentalData: BoxPlotData | null
  title?: string
}

export default function BoxPlotChart({
  controlData,
  experimentalData,
  title = 'Distribution Comparison'
}: BoxPlotChartProps) {
  if (!controlData && !experimentalData) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
        <h4 className="text-base font-semibold text-gray-900 dark:text-white mb-4">{title}</h4>
        <div className="flex items-center justify-center h-48 text-gray-400 text-sm">
          No distribution data available
        </div>
      </div>
    )
  }

  const allValues: number[] = []
  if (controlData?.values) allValues.push(...controlData.values)
  if (experimentalData?.values) allValues.push(...experimentalData.values)

  if (allValues.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
        <h4 className="text-base font-semibold text-gray-900 dark:text-white mb-4">{title}</h4>
        <div className="flex items-center justify-center h-48 text-gray-400 text-sm">
          Insufficient data for box plot
        </div>
      </div>
    )
  }

  const globalMin = Math.min(...allValues)
  const globalMax = Math.max(...allValues)
  const range = globalMax - globalMin
  const padding = range * 0.1
  const scaleMin = globalMin - padding
  const scaleMax = globalMax + padding
  const scaleRange = scaleMax - scaleMin

  // Use viewBox for responsive SVG
  const svgWidth = 400
  const svgHeight = 240
  const plotMargin = { top: 20, right: 30, bottom: 40, left: 55 }
  const plotWidth = svgWidth - plotMargin.left - plotMargin.right
  const plotHeight = svgHeight - plotMargin.top - plotMargin.bottom

  const boxWidth = 50
  const controlX = plotMargin.left + plotWidth * 0.3
  const experimentalX = plotMargin.left + plotWidth * 0.7

  const scaleY = (value: number) => {
    return plotMargin.top + plotHeight - ((value - scaleMin) / scaleRange) * plotHeight
  }

  const renderBoxPlot = (
    data: BoxPlotData | null,
    x: number,
    color: string,
    fillColor: string,
    label: string
  ) => {
    if (!data || data.Q1 === null || data.Q3 === null || data.median === null) {
      return null
    }

    const { min, max, Q1, Q3, median, IQR, values, mean } = data

    const lowerWhisker = Math.max(min ?? Q1, Q1 - 1.5 * (IQR ?? 0))
    const upperWhisker = Math.min(max ?? Q3, Q3 + 1.5 * (IQR ?? 0))
    const outliers = values.filter(v => v < lowerWhisker || v > upperWhisker)

    const y1 = scaleY(Q1)
    const y3 = scaleY(Q3)
    const yMedian = scaleY(median)
    const yLower = scaleY(lowerWhisker)
    const yUpper = scaleY(upperWhisker)
    const yMean = mean !== null ? scaleY(mean) : null

    return (
      <g key={label}>
        {/* Box (IQR) */}
        <rect
          x={x - boxWidth / 2}
          y={y3}
          width={boxWidth}
          height={y1 - y3}
          fill={fillColor}
          stroke={color}
          strokeWidth={1.5}
          rx={3}
        />

        {/* Median line */}
        <line
          x1={x - boxWidth / 2 + 2}
          y1={yMedian}
          x2={x + boxWidth / 2 - 2}
          y2={yMedian}
          stroke={color}
          strokeWidth={2.5}
          strokeLinecap="round"
        />

        {/* Mean marker */}
        {yMean !== null && (
          <polygon
            points={`${x},${yMean - 4} ${x + 4},${yMean} ${x},${yMean + 4} ${x - 4},${yMean}`}
            fill="white"
            stroke={color}
            strokeWidth={1.5}
          />
        )}

        {/* Lower whisker */}
        <line x1={x} y1={y1} x2={x} y2={yLower} stroke={color} strokeWidth={1.5} strokeDasharray="3,2" />
        <line x1={x - boxWidth / 4} y1={yLower} x2={x + boxWidth / 4} y2={yLower} stroke={color} strokeWidth={1.5} strokeLinecap="round" />

        {/* Upper whisker */}
        <line x1={x} y1={y3} x2={x} y2={yUpper} stroke={color} strokeWidth={1.5} strokeDasharray="3,2" />
        <line x1={x - boxWidth / 4} y1={yUpper} x2={x + boxWidth / 4} y2={yUpper} stroke={color} strokeWidth={1.5} strokeLinecap="round" />

        {/* Outliers */}
        {outliers.map((v, i) => (
          <circle key={i} cx={x} cy={scaleY(v)} r={3} fill="none" stroke={color} strokeWidth={1.5} />
        ))}

        {/* Label */}
        <text x={x} y={svgHeight - 8} textAnchor="middle" className="text-[11px] fill-gray-700 dark:fill-gray-300 font-medium">
          {label}
        </text>
        <text x={x} y={svgHeight - 22} textAnchor="middle" className="text-[10px] fill-gray-400 dark:fill-gray-500">
          n={data.n}
        </text>
      </g>
    )
  }

  const yTicks = 5
  const tickValues = Array.from({ length: yTicks + 1 }, (_, i) =>
    scaleMin + (scaleRange * i) / yTicks
  )

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 sm:p-5">
      <h4 className="text-base font-semibold text-gray-900 dark:text-white mb-3">{title}</h4>

      <div className="w-full">
        <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="w-full h-auto" preserveAspectRatio="xMidYMid meet">
          {/* Y-axis */}
          <line
            x1={plotMargin.left} y1={plotMargin.top}
            x2={plotMargin.left} y2={plotMargin.top + plotHeight}
            className="stroke-gray-300 dark:stroke-gray-600" strokeWidth={1}
          />

          {tickValues.map((value, i) => (
            <g key={i}>
              <line
                x1={plotMargin.left - 4} y1={scaleY(value)}
                x2={plotMargin.left} y2={scaleY(value)}
                className="stroke-gray-300 dark:stroke-gray-600" strokeWidth={1}
              />
              <text x={plotMargin.left - 8} y={scaleY(value)} textAnchor="end" dominantBaseline="middle"
                className="text-[10px] fill-gray-500 dark:fill-gray-400">
                {value.toFixed(0)}
              </text>
              <line
                x1={plotMargin.left} y1={scaleY(value)}
                x2={plotMargin.left + plotWidth} y2={scaleY(value)}
                className="stroke-gray-100 dark:stroke-gray-700" strokeWidth={1} strokeDasharray="2,3"
              />
            </g>
          ))}

          {/* Y-axis label */}
          <text x={12} y={plotMargin.top + plotHeight / 2} textAnchor="middle" dominantBaseline="middle"
            transform={`rotate(-90, 12, ${plotMargin.top + plotHeight / 2})`}
            className="text-[10px] fill-gray-500 dark:fill-gray-400">
            Generations to Nash
          </text>

          {renderBoxPlot(controlData, controlX, '#3B82F6', '#DBEAFE', 'Control')}
          {renderBoxPlot(experimentalData, experimentalX, '#8B5CF6', '#EDE9FE', 'Experimental')}
        </svg>
      </div>

      {/* Compact legend */}
      <div className="flex justify-center gap-4 mt-2 text-[10px] text-gray-500 dark:text-gray-400">
        <span>━ Median</span>
        <span>◇ Mean</span>
        <span>○ Outlier</span>
        <span>█ IQR</span>
      </div>
    </div>
  )
}
