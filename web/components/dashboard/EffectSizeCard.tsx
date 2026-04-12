'use client'

interface HedgesGResult {
  hedgesG: number | null
  cohensD: number | null
  correctionFactor: number | null
  ciLower: number | null
  ciUpper: number | null
  interpretation: string
  sampleSizes: { control: number; experimental: number }
}

interface EffectSizeCardProps {
  hedgesG: HedgesGResult | null
  cohensD: number | null
}

export default function EffectSizeCard({
  hedgesG,
  cohensD
}: EffectSizeCardProps) {
  // Use cohensD from hedgesG result or fallback prop
  const d = hedgesG?.cohensD ?? cohensD
  const interpretation = hedgesG?.interpretation ?? getInterpretation(d)
  const ciLower = hedgesG?.ciLower ?? null
  const ciUpper = hedgesG?.ciUpper ?? null

  function getInterpretation(val: number | null): string {
    if (val === null) return 'Unknown'
    const abs = Math.abs(val)
    if (abs >= 0.8) return 'Large'
    if (abs >= 0.5) return 'Medium'
    if (abs >= 0.2) return 'Small'
    return 'Negligible'
  }

  const getAccentColor = (interp: string) => {
    switch (interp.toLowerCase()) {
      case 'large': return { text: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-500', bgLight: 'bg-emerald-50 dark:bg-emerald-900/20', border: 'border-emerald-200 dark:border-emerald-800' }
      case 'medium': return { text: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-500', bgLight: 'bg-blue-50 dark:bg-blue-900/20', border: 'border-blue-200 dark:border-blue-800' }
      case 'small': return { text: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-500', bgLight: 'bg-amber-50 dark:bg-amber-900/20', border: 'border-amber-200 dark:border-amber-800' }
      default: return { text: 'text-gray-500', bg: 'bg-gray-400', bgLight: 'bg-gray-50 dark:bg-gray-900/20', border: 'border-gray-200 dark:border-gray-800' }
    }
  }

  const accent = getAccentColor(interpretation)

  const getScalePosition = (val: number | null) => {
    if (val === null) return 0
    const abs = Math.abs(val)
    if (abs <= 0.2) return (abs / 0.2) * 16.67
    if (abs <= 0.5) return 16.67 + ((abs - 0.2) / 0.3) * 25
    if (abs <= 0.8) return 41.67 + ((abs - 0.5) / 0.3) * 25
    return 66.67 + Math.min((abs - 0.8) / 0.4, 1) * 33.33
  }

  const directionLabel = d !== null
    ? d < 0 ? 'favoring experimental' : d > 0 ? 'favoring control' : ''
    : ''

  const formatSigned = (v: number | null, decimals: number) => {
    if (v === null) return '—'
    return (v > 0 ? '+' : '') + v.toFixed(decimals)
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
      <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
        Effect Size Analysis
      </h4>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-5">
        How meaningful is the convergence speed difference?
      </p>

      {/* Main Cohen's d Display */}
      <div className={`p-5 rounded-xl border ${accent.border} ${accent.bgLight}`}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h5 className="text-sm font-semibold text-gray-800 dark:text-gray-200">Cohen&apos;s d</h5>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Standardized mean difference
            </p>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">
              {formatSigned(d, 3)}
            </div>
            <div className={`text-sm font-semibold ${accent.text}`}>
              {interpretation}{directionLabel ? `, ${directionLabel}` : ''}
            </div>
          </div>
        </div>

        {/* Direction explanation */}
        {d !== null && d < 0 && (
          <div className="text-xs text-gray-500 dark:text-gray-400 mb-3 flex items-center gap-1.5">
            <span className="w-1 h-1 rounded-full bg-emerald-500"></span>
            Negative = experimental converges faster (supports hypothesis)
          </div>
        )}

        {/* Scale visualization */}
        <div className="mt-2">
          <div className="relative h-2.5 rounded-full overflow-hidden flex">
            <div className="w-[16.67%] bg-gray-300 dark:bg-gray-600" />
            <div className="w-[25%] bg-amber-400" />
            <div className="w-[25%] bg-blue-400" />
            <div className="w-[33.33%] bg-emerald-500" />
          </div>
          {/* Marker */}
          <div
            className="relative h-0"
            style={{ marginLeft: `${getScalePosition(d)}%` }}
          >
            <div className="absolute -top-0.5 -translate-x-1/2 w-0 h-0 border-l-[5px] border-r-[5px] border-b-[7px] border-l-transparent border-r-transparent border-b-gray-900 dark:border-b-white" />
          </div>
          <div className="flex justify-between mt-2 text-[10px] text-gray-400 dark:text-gray-500">
            <span>0</span>
            <span>0.2</span>
            <span>0.5</span>
            <span>0.8</span>
            <span>1.2+</span>
          </div>
        </div>

        {/* 95% CI */}
        {ciLower != null && ciUpper != null && (
          <div className="mt-3 pt-3 border-t border-gray-200/60 dark:border-gray-600/40">
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500 dark:text-gray-400">95% Confidence Interval</span>
              <span className="text-xs font-mono font-semibold text-gray-700 dark:text-gray-300">
                [{ciLower.toFixed(3)}, {ciUpper.toFixed(3)}]
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Cohen's Conventions Legend */}
      <div className="mt-5">
        <h5 className="text-[11px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2.5">
          Cohen&apos;s Conventions (1988)
        </h5>
        <div className="grid grid-cols-4 gap-2">
          {[
            { range: '|d| < 0.2', label: 'Negligible', color: 'bg-gray-300 dark:bg-gray-600', textColor: 'text-gray-500 dark:text-gray-400' },
            { range: '0.2 – 0.5', label: 'Small', color: 'bg-amber-400', textColor: 'text-amber-600 dark:text-amber-400' },
            { range: '0.5 – 0.8', label: 'Medium', color: 'bg-blue-400', textColor: 'text-blue-600 dark:text-blue-400' },
            { range: '|d| ≥ 0.8', label: 'Large', color: 'bg-emerald-500', textColor: 'text-emerald-600 dark:text-emerald-400' },
          ].map(({ range, label, color, textColor }) => (
            <div key={label} className="text-center">
              <div className={`w-full h-1.5 ${color} rounded-full mb-1.5`} />
              <div className="text-[10px] text-gray-400 dark:text-gray-500">{range}</div>
              <div className={`text-[11px] font-semibold ${textColor}`}>{label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
