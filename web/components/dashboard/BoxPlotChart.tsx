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
  height?: number
}

export default function BoxPlotChart({
  controlData,
  experimentalData,
  title = 'Distribution Comparison',
  height = 300
}: BoxPlotChartProps) {
  if (!controlData && !experimentalData) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
        <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">{title}</h4>
        <div className="flex items-center justify-center h-48 text-gray-500 dark:text-gray-400">
          No distribution data available
        </div>
      </div>
    )
  }

  // Calculate scale for visualization
  const allValues: number[] = []
  if (controlData?.values) allValues.push(...controlData.values)
  if (experimentalData?.values) allValues.push(...experimentalData.values)
  
  if (allValues.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
        <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">{title}</h4>
        <div className="flex items-center justify-center h-48 text-gray-500 dark:text-gray-400">
          Insufficient data for box plot
        </div>
      </div>
    )
  }

  const globalMin = Math.min(...allValues)
  const globalMax = Math.max(...allValues)
  const range = globalMax - globalMin
  const padding = range * 0.1 // 10% padding
  const scaleMin = globalMin - padding
  const scaleMax = globalMax + padding
  const scaleRange = scaleMax - scaleMin

  // SVG dimensions
  const svgWidth = 400
  const svgHeight = height - 80
  const plotMargin = { top: 30, right: 40, bottom: 40, left: 60 }
  const plotWidth = svgWidth - plotMargin.left - plotMargin.right
  const plotHeight = svgHeight - plotMargin.top - plotMargin.bottom

  // Box plot dimensions
  const boxWidth = 60
  const controlX = plotMargin.left + plotWidth * 0.25
  const experimentalX = plotMargin.left + plotWidth * 0.75

  // Scale function
  const scaleY = (value: number) => {
    return plotMargin.top + plotHeight - ((value - scaleMin) / scaleRange) * plotHeight
  }

  // Render a single box plot
  const renderBoxPlot = (
    data: BoxPlotData | null,
    x: number,
    color: string,
    label: string
  ) => {
    if (!data || data.Q1 === null || data.Q3 === null || data.median === null) {
      return null
    }

    const { min, max, Q1, Q3, median, IQR, values, mean } = data
    
    // Calculate whisker bounds (1.5 * IQR from quartiles, but capped at min/max data)
    const lowerWhisker = Math.max(min ?? Q1, Q1 - 1.5 * (IQR ?? 0))
    const upperWhisker = Math.min(max ?? Q3, Q3 + 1.5 * (IQR ?? 0))
    
    // Find outliers
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
          fill={color}
          fillOpacity={0.3}
          stroke={color}
          strokeWidth={2}
        />
        
        {/* Median line */}
        <line
          x1={x - boxWidth / 2}
          y1={yMedian}
          x2={x + boxWidth / 2}
          y2={yMedian}
          stroke={color}
          strokeWidth={3}
        />
        
        {/* Mean marker (diamond) */}
        {yMean !== null && (
          <polygon
            points={`${x},${yMean - 5} ${x + 5},${yMean} ${x},${yMean + 5} ${x - 5},${yMean}`}
            fill="white"
            stroke={color}
            strokeWidth={2}
          />
        )}
        
        {/* Lower whisker */}
        <line
          x1={x}
          y1={y1}
          x2={x}
          y2={yLower}
          stroke={color}
          strokeWidth={2}
          strokeDasharray="4,2"
        />
        <line
          x1={x - boxWidth / 4}
          y1={yLower}
          x2={x + boxWidth / 4}
          y2={yLower}
          stroke={color}
          strokeWidth={2}
        />
        
        {/* Upper whisker */}
        <line
          x1={x}
          y1={y3}
          x2={x}
          y2={yUpper}
          stroke={color}
          strokeWidth={2}
          strokeDasharray="4,2"
        />
        <line
          x1={x - boxWidth / 4}
          y1={yUpper}
          x2={x + boxWidth / 4}
          y2={yUpper}
          stroke={color}
          strokeWidth={2}
        />
        
        {/* Outliers */}
        {outliers.map((v, i) => (
          <circle
            key={i}
            cx={x}
            cy={scaleY(v)}
            r={4}
            fill="none"
            stroke={color}
            strokeWidth={2}
          />
        ))}
        
        {/* Label */}
        <text
          x={x}
          y={svgHeight - 10}
          textAnchor="middle"
          className="text-xs fill-gray-600 dark:fill-gray-400"
        >
          {label}
        </text>
        
        {/* Sample size */}
        <text
          x={x}
          y={svgHeight - 25}
          textAnchor="middle"
          className="text-xs fill-gray-500 dark:fill-gray-500"
        >
          n={data.n}
        </text>
      </g>
    )
  }

  // Y-axis ticks
  const yTicks = 5
  const tickValues = Array.from({ length: yTicks + 1 }, (_, i) => 
    scaleMin + (scaleRange * i) / yTicks
  )

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
      <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">{title}</h4>
      
      <div className="flex justify-center">
        <svg width={svgWidth} height={svgHeight} className="overflow-visible">
          {/* Y-axis */}
          <line
            x1={plotMargin.left}
            y1={plotMargin.top}
            x2={plotMargin.left}
            y2={plotMargin.top + plotHeight}
            className="stroke-gray-300 dark:stroke-gray-600"
            strokeWidth={1}
          />
          
          {/* Y-axis ticks and labels */}
          {tickValues.map((value, i) => (
            <g key={i}>
              <line
                x1={plotMargin.left - 5}
                y1={scaleY(value)}
                x2={plotMargin.left}
                y2={scaleY(value)}
                className="stroke-gray-300 dark:stroke-gray-600"
                strokeWidth={1}
              />
              <text
                x={plotMargin.left - 10}
                y={scaleY(value)}
                textAnchor="end"
                dominantBaseline="middle"
                className="text-xs fill-gray-500 dark:fill-gray-400"
              >
                {value.toFixed(0)}
              </text>
              {/* Grid line */}
              <line
                x1={plotMargin.left}
                y1={scaleY(value)}
                x2={plotMargin.left + plotWidth}
                y2={scaleY(value)}
                className="stroke-gray-200 dark:stroke-gray-700"
                strokeWidth={1}
                strokeDasharray="2,2"
              />
            </g>
          ))}
          
          {/* Y-axis label */}
          <text
            x={15}
            y={plotMargin.top + plotHeight / 2}
            textAnchor="middle"
            dominantBaseline="middle"
            transform={`rotate(-90, 15, ${plotMargin.top + plotHeight / 2})`}
            className="text-xs fill-gray-600 dark:fill-gray-400 font-medium"
          >
            Final Elo Rating
          </text>
          
          {/* Box plots */}
          {renderBoxPlot(controlData, controlX, '#3B82F6', 'Control')}
          {renderBoxPlot(experimentalData, experimentalX, '#8B5CF6', 'Experimental')}
        </svg>
      </div>
      
      {/* Legend */}
      <div className="flex justify-center gap-6 mt-4 text-xs text-gray-600 dark:text-gray-400">
        <div className="flex items-center gap-2">
          <div className="w-4 h-0.5 bg-current" />
          <span>Median</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 border-2 border-current transform rotate-45" />
          <span>Mean</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full border-2 border-current" />
          <span>Outlier</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-3 bg-gray-300 dark:bg-gray-600 opacity-50" />
          <span>IQR (Q1-Q3)</span>
        </div>
      </div>
    </div>
  )
}
