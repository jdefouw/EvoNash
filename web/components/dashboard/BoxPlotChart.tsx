'use client'

import { useState } from 'react'

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

type HoverInfo =
  | { kind: 'box'; group: 'control' | 'experimental'; x: number; y: number }
  | { kind: 'outlier'; group: 'control' | 'experimental'; value: number; x: number; y: number }
  | { kind: 'whisker'; group: 'control' | 'experimental'; label: string; value: number; x: number; y: number }
  | null

export default function BoxPlotChart({
  controlData,
  experimentalData,
  title = 'Distribution Comparison'
}: BoxPlotChartProps) {
  const [hover, setHover] = useState<HoverInfo>(null)

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
    label: string,
    group: 'control' | 'experimental'
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

    const isBoxHover = hover?.kind === 'box' && hover.group === group

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
          strokeWidth={isBoxHover ? 2.5 : 1.5}
          rx={3}
          style={{ transition: 'stroke-width 80ms' }}
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

        {/* Whisker hit targets */}
        <rect
          x={x - boxWidth / 3} y={yUpper - 4}
          width={(boxWidth / 3) * 2} height={8}
          fill="transparent"
          style={{ cursor: 'pointer' }}
          onMouseEnter={() => setHover({ kind: 'whisker', group, label: 'Upper whisker', value: upperWhisker, x, y: yUpper })}
          onMouseLeave={() => setHover(prev => (prev?.kind === 'whisker' && prev.group === group ? null : prev))}
        />
        <rect
          x={x - boxWidth / 3} y={yLower - 4}
          width={(boxWidth / 3) * 2} height={8}
          fill="transparent"
          style={{ cursor: 'pointer' }}
          onMouseEnter={() => setHover({ kind: 'whisker', group, label: 'Lower whisker', value: lowerWhisker, x, y: yLower })}
          onMouseLeave={() => setHover(prev => (prev?.kind === 'whisker' && prev.group === group ? null : prev))}
        />

        {/* Outliers (rendered + hoverable) */}
        {outliers.map((v, i) => {
          const cy = scaleY(v)
          const isOutlierHover =
            hover?.kind === 'outlier' && hover.group === group && hover.value === v
          return (
            <g key={i}>
              <circle
                cx={x} cy={cy}
                r={isOutlierHover ? 4.5 : 3}
                fill="none"
                stroke={color}
                strokeWidth={isOutlierHover ? 2 : 1.5}
                style={{ pointerEvents: 'none', transition: 'r 80ms, stroke-width 80ms' }}
              />
              <circle
                cx={x} cy={cy} r={8}
                fill="transparent"
                style={{ cursor: 'pointer' }}
                onMouseEnter={() => setHover({ kind: 'outlier', group, value: v, x, y: cy })}
                onMouseLeave={() => setHover(prev => (prev?.kind === 'outlier' && prev.group === group && prev.value === v ? null : prev))}
              />
            </g>
          )
        })}

        {/* Box hit target — covers whole box (Q1 to Q3) */}
        <rect
          x={x - boxWidth / 2}
          y={y3}
          width={boxWidth}
          height={y1 - y3}
          fill="transparent"
          style={{ cursor: 'pointer' }}
          onMouseEnter={() => setHover({ kind: 'box', group, x, y: yMedian })}
          onMouseLeave={() => setHover(prev => (prev?.kind === 'box' && prev.group === group ? null : prev))}
        />

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

  const renderTooltip = () => {
    if (!hover) return null
    const data = hover.group === 'control' ? controlData : experimentalData
    const groupLabel = hover.group === 'control' ? 'Control (Static ε)' : 'Experimental (Adaptive ε)'
    const stroke = hover.group === 'control' ? '#3B82F6' : '#8B5CF6'

    let lines: { left: string; right: string; bold?: boolean; color?: string }[] = []
    let tipW = 188
    let tipH = 28

    if (hover.kind === 'box' && data) {
      lines = [
        { left: 'n converged:', right: data.n.toLocaleString(), bold: true },
        { left: 'Mean:', right: `${data.mean?.toFixed(1) ?? '—'} gens` },
        { left: 'Median:', right: `${data.median?.toFixed(1) ?? '—'} gens` },
        { left: 'Std dev:', right: `${data.std?.toFixed(1) ?? '—'}` },
        { left: 'Q1 (25%):', right: `${data.Q1?.toFixed(1) ?? '—'}` },
        { left: 'Q3 (75%):', right: `${data.Q3?.toFixed(1) ?? '—'}` },
        { left: 'IQR:', right: `${data.IQR?.toFixed(1) ?? '—'}` },
        { left: 'Min — Max:', right: `${data.min?.toFixed(0) ?? '—'} — ${data.max?.toFixed(0) ?? '—'}` },
      ]
      tipH = 28 + lines.length * 14 + 6
    } else if (hover.kind === 'outlier') {
      lines = [
        { left: 'Outlier value:', right: `${hover.value.toFixed(1)} gens`, bold: true, color: stroke },
        { left: 'Status:', right: 'Outside 1.5 × IQR fences' },
      ]
      tipH = 28 + lines.length * 14 + 6
    } else if (hover.kind === 'whisker') {
      lines = [
        { left: hover.label + ':', right: `${hover.value.toFixed(1)} gens`, bold: true, color: stroke },
        { left: 'Definition:', right: 'Inner 1.5 × IQR fence' },
      ]
      tipH = 28 + lines.length * 14 + 6
    }

    // Smart placement
    const placeRight = hover.x + 14 + tipW <= plotMargin.left + plotWidth + 4
    const tipX = placeRight ? hover.x + 14 : hover.x - 14 - tipW
    const placeBelow = hover.y - tipH < plotMargin.top
    const tipY = placeBelow ? hover.y + 12 : hover.y - 8 - tipH

    return (
      <g style={{ pointerEvents: 'none' }}>
        <rect
          x={tipX} y={tipY}
          width={tipW} height={tipH}
          rx={6} ry={6}
          fill="#ffffff"
          stroke="#d1d5db"
          strokeWidth={1}
          style={{ filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.12))' }}
        />
        <text x={tipX + 10} y={tipY + 16} fontSize={10} fontWeight={700} fill={stroke}>
          {groupLabel}
        </text>
        {lines.map((ln, i) => (
          <g key={i}>
            <text
              x={tipX + 10}
              y={tipY + 32 + i * 14}
              fontSize={9}
              fill="#6b7280"
            >
              {ln.left}
            </text>
            <text
              x={tipX + tipW - 10}
              y={tipY + 32 + i * 14}
              fontSize={9}
              fill={ln.color || '#111827'}
              textAnchor="end"
              fontFamily="ui-monospace, monospace"
              fontWeight={ln.bold ? 700 : 400}
            >
              {ln.right}
            </text>
          </g>
        ))}
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

          {renderBoxPlot(controlData, controlX, '#3B82F6', '#DBEAFE', 'Control', 'control')}
          {renderBoxPlot(experimentalData, experimentalX, '#8B5CF6', '#EDE9FE', 'Experimental', 'experimental')}

          {/* Tooltip — rendered last so it always layers on top */}
          {renderTooltip()}
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
