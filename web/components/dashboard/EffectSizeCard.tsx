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
  const getEffectSizeColor = (interpretation: string) => {
    switch (interpretation.toLowerCase()) {
      case 'large':
        return 'text-green-600 dark:text-green-400'
      case 'medium':
        return 'text-blue-600 dark:text-blue-400'
      case 'small':
        return 'text-yellow-600 dark:text-yellow-400'
      default:
        return 'text-gray-500'
    }
  }

  const getEffectSizeBg = (interpretation: string) => {
    switch (interpretation.toLowerCase()) {
      case 'large':
        return 'bg-green-100 dark:bg-green-900/30'
      case 'medium':
        return 'bg-blue-100 dark:bg-blue-900/30'
      case 'small':
        return 'bg-yellow-100 dark:bg-yellow-900/30'
      default:
        return 'bg-gray-100 dark:bg-gray-900/30'
    }
  }

  const getScalePosition = (d: number | null) => {
    if (d === null) return 0
    const absD = Math.abs(d)
    if (absD <= 0.2) return (absD / 0.2) * 16.67
    if (absD <= 0.5) return 16.67 + ((absD - 0.2) / 0.3) * 25
    if (absD <= 0.8) return 41.67 + ((absD - 0.5) / 0.3) * 25
    return 66.67 + Math.min((absD - 0.8) / 0.4, 1) * 33.33
  }

  // Directional interpretation for signed effect sizes
  const getDirectionLabel = (g: number | null) => {
    if (g === null) return ''
    if (g < 0) return ', favoring experimental'
    if (g > 0) return ', favoring control'
    return ''
  }

  const formatSigned = (v: number | null, decimals: number) => {
    if (v === null) return 'N/A'
    return (v > 0 ? '+' : '') + v.toFixed(decimals)
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 sm:p-5">
      <h4 className="text-base font-semibold text-gray-900 dark:text-white mb-0.5">
        Effect Size Analysis
      </h4>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
        Practical significance — how meaningful is the convergence speed difference?
      </p>

      <div className="space-y-4">
        {/* Hedges' g (Primary) */}
        <div className={`p-4 rounded-lg ${getEffectSizeBg(hedgesG?.interpretation ?? '')}`}>
          <div className="flex items-start justify-between mb-2">
            <div>
              <h5 className="text-sm font-medium text-gray-700 dark:text-gray-300">Hedges&apos; g</h5>
              <p className="text-xs text-gray-500">Small-sample corrected effect size (bias-corrected Cohen&apos;s d)</p>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {formatSigned(hedgesG?.hedgesG ?? null, 3)}
              </div>
              <div className={`text-sm font-medium ${getEffectSizeColor(hedgesG?.interpretation ?? '')}`}>
                {hedgesG?.interpretation ?? 'Unknown'}{getDirectionLabel(hedgesG?.hedgesG ?? null)}
              </div>
            </div>
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">
            Negative = experimental converges in fewer generations (supports hypothesis)
          </div>
          
          {/* Effect size scale visualization */}
          <div className="mt-3">
            <div className="relative h-3 rounded-full overflow-hidden flex">
              <div className="w-[16.67%] bg-gray-300 dark:bg-gray-600" />
              <div className="w-[25%] bg-yellow-400" />
              <div className="w-[25%] bg-blue-400" />
              <div className="w-[33.33%] bg-green-500" />
            </div>
            {/* Marker */}
            <div 
              className="relative h-0"
              style={{ marginLeft: `${getScalePosition(hedgesG?.hedgesG ?? null)}%` }}
            >
              <div className="absolute -top-1 -translate-x-1/2 w-0 h-0 border-l-[6px] border-r-[6px] border-b-[8px] border-l-transparent border-r-transparent border-b-gray-900 dark:border-b-white" />
            </div>
            <div className="flex justify-between mt-2 text-[10px] text-gray-500">
              <span>0</span>
              <span>0.2</span>
              <span>0.5</span>
              <span>0.8</span>
              <span>1.2+</span>
            </div>
          </div>

          {/* Confidence Interval */}
          {hedgesG?.ciLower != null && hedgesG?.ciUpper != null && (
            <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-600">
              <div className="text-xs text-gray-600 dark:text-gray-400">
                95% CI: [{hedgesG?.ciLower?.toFixed(3)}, {hedgesG?.ciUpper?.toFixed(3)}]
              </div>
            </div>
          )}
        </div>

        {/* Cohen's d (Reference) */}
        <div className="p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <h5 className="text-sm font-medium text-gray-700 dark:text-gray-300">Cohen&apos;s d</h5>
              <p className="text-xs text-gray-500">Uncorrected effect size</p>
            </div>
            <div className="text-lg font-bold text-gray-900 dark:text-white">
              {formatSigned(cohensD, 3)}
            </div>
          </div>
          {hedgesG?.correctionFactor != null && (
            <div className="text-xs text-gray-500 mt-1">
              Correction factor: {hedgesG?.correctionFactor?.toFixed(4)}
            </div>
          )}
        </div>
      </div>

      {/* Effect Size Guidelines */}
      <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
        <h5 className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">
          Cohen&apos;s Conventions
        </h5>
        <div className="grid grid-cols-4 gap-2 text-xs">
          <div className="text-center">
            <div className="w-full h-2 bg-gray-300 dark:bg-gray-600 rounded mb-1" />
            <div className="text-gray-500">|d| &lt; 0.2</div>
            <div className="text-gray-600 dark:text-gray-400 font-medium">Negligible</div>
          </div>
          <div className="text-center">
            <div className="w-full h-2 bg-yellow-400 rounded mb-1" />
            <div className="text-gray-500">0.2 - 0.5</div>
            <div className="text-yellow-600 dark:text-yellow-400 font-medium">Small</div>
          </div>
          <div className="text-center">
            <div className="w-full h-2 bg-blue-400 rounded mb-1" />
            <div className="text-gray-500">0.5 - 0.8</div>
            <div className="text-blue-600 dark:text-blue-400 font-medium">Medium</div>
          </div>
          <div className="text-center">
            <div className="w-full h-2 bg-green-500 rounded mb-1" />
            <div className="text-gray-500">|d| ≥ 0.8</div>
            <div className="text-green-600 dark:text-green-400 font-medium">Large</div>
          </div>
        </div>
      </div>
    </div>
  )
}

