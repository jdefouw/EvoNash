'use client'

type StatisticalPowerLevel = 'insufficient' | 'minimum' | 'recommended' | 'robust'

interface PowerAnalysisResult {
  power: number | null
  powerPercentage: number | null
  isAdequate: boolean | null
  interpretation: string
  recommendation: string
}

interface RequiredSampleSizeResult {
  nPerGroup: number | null
  totalN: number | null
  effectSizeUsed: number | null
  targetPower: number
  interpretation: string
}

interface PowerAnalysisCardProps {
  achievedPower: PowerAnalysisResult | null
  requiredFor80: RequiredSampleSizeResult | null
  requiredFor90: RequiredSampleSizeResult | null
  requiredFor95: RequiredSampleSizeResult | null
  currentControlN: number
  currentExperimentalN: number
  effectSize: number | null
  statisticalPowerLevel: StatisticalPowerLevel
  controlExperimentCount: number
  experimentalExperimentCount: number
  controlAvgGenerations: number
  experimentalAvgGenerations: number
}

export default function PowerAnalysisCard({
  achievedPower,
  requiredFor80,
  requiredFor90,
  requiredFor95,
  currentControlN,
  currentExperimentalN,
  effectSize,
  statisticalPowerLevel,
  controlExperimentCount,
  experimentalExperimentCount,
  controlAvgGenerations,
  experimentalAvgGenerations
}: PowerAnalysisCardProps) {
  const observedPower = achievedPower?.power ?? null
  const observedPowerPct = observedPower !== null ? observedPower * 100 : null
  const isNegligibleEffect = effectSize !== null && Math.abs(effectSize) < 0.1

  const getLevelColor = (level: StatisticalPowerLevel) => {
    switch (level) {
      case 'robust': return 'bg-green-500'
      case 'recommended': return 'bg-blue-500'
      case 'minimum': return 'bg-yellow-500'
      case 'insufficient': return 'bg-red-500'
    }
  }

  const getLevelBgColor = (level: StatisticalPowerLevel) => {
    switch (level) {
      case 'robust': return 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
      case 'recommended': return 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
      case 'minimum': return 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800'
      case 'insufficient': return 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
    }
  }

  const getLevelTextColor = (level: StatisticalPowerLevel) => {
    switch (level) {
      case 'robust': return 'text-green-700 dark:text-green-400'
      case 'recommended': return 'text-blue-700 dark:text-blue-400'
      case 'minimum': return 'text-yellow-700 dark:text-yellow-400'
      case 'insufficient': return 'text-red-700 dark:text-red-400'
    }
  }

  const getLevelLabel = (level: StatisticalPowerLevel) => {
    switch (level) {
      case 'robust': return 'Robust — Study Well-Powered'
      case 'recommended': return 'Moderate — Can Detect Large Effects'
      case 'minimum': return 'Low — May Miss Real Effects'
      case 'insufficient': return 'Insufficient Data for Analysis'
    }
  }

  const getLevelDescription = (level: StatisticalPowerLevel) => {
    switch (level) {
      case 'robust':
        return '≥80% power to detect a medium effect (d=0.5). This exceeds the standard threshold for publication-quality research (Cohen, 1988).'
      case 'recommended':
        return '60–79% power to detect a medium effect. May miss smaller true differences.'
      case 'minimum':
        return '40–59% power. Significant risk of Type II error (failing to detect real effects).'
      case 'insufficient':
        return 'Need at least 2 converged experiments per group with measurable effect for power calculation.'
    }
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
      <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
        Statistical Power &amp; Sample Size
      </h4>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
        Power = probability of detecting a real effect when one exists
      </p>

      {/* Power Level Banner */}
      <div className={`p-4 rounded-lg border mb-6 ${getLevelBgColor(statisticalPowerLevel)}`}>
        <div className="flex items-center gap-3">
          <div className={`w-3 h-3 rounded-full ${getLevelColor(statisticalPowerLevel)}`} />
          <div>
            <div className={`font-semibold ${getLevelTextColor(statisticalPowerLevel)}`}>
              {getLevelLabel(statisticalPowerLevel)}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">
              {getLevelDescription(statisticalPowerLevel)}
            </div>
          </div>
        </div>
      </div>

      {/* Experiment Counts */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
            {controlExperimentCount}
          </div>
          <div className="text-xs font-medium text-gray-700 dark:text-gray-300">Control (Static)</div>
          <div className="text-[10px] text-gray-400 dark:text-gray-600 mt-1">
            {controlAvgGenerations.toLocaleString()} avg gen · {currentControlN} converged
          </div>
        </div>
        <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
            {experimentalExperimentCount}
          </div>
          <div className="text-xs font-medium text-gray-700 dark:text-gray-300">Experimental (Adaptive)</div>
          <div className="text-[10px] text-gray-400 dark:text-gray-600 mt-1">
            {experimentalAvgGenerations.toLocaleString()} avg gen · {currentExperimentalN} converged
          </div>
        </div>
      </div>

      {/* Observed Power Details */}
      {observedPowerPct !== null && (
        <div className="mb-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
              Observed Power (for detected effect d={effectSize?.toFixed(3) ?? '?'})
            </span>
            <span className="text-sm font-bold text-gray-900 dark:text-white">
              {observedPowerPct.toFixed(1)}%
            </span>
          </div>
          <div className="relative h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div className="absolute top-0 bottom-0 left-[80%] w-px bg-green-600 z-10" />
            <div
              className={`h-full transition-all duration-500 ${observedPower !== null && observedPower >= 0.80 ? 'bg-green-500' : 'bg-orange-400'}`}
              style={{ width: `${Math.min(observedPowerPct, 100)}%` }}
            />
          </div>
        </div>
      )}

      {/* Negligible Effect Explanation */}
      {isNegligibleEffect && statisticalPowerLevel === 'robust' && (
        <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
          <div className="text-xs font-medium text-blue-700 dark:text-blue-300 mb-1">
            Why is observed power low but the study well-powered?
          </div>
          <div className="text-xs text-blue-600 dark:text-blue-400">
            The observed effect (d={effectSize?.toFixed(3)}) is negligible — both groups converge at similar speeds.
            With {currentControlN}+{currentExperimentalN} converged experiments, this study has <strong>robust power
            to detect a medium effect</strong> (d=0.5). The low observed power simply means the true
            difference between groups is genuinely small, not that more data is needed.
          </div>
        </div>
      )}

      {/* Required Sample Sizes */}
      <div className="mb-4">
        <h5 className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
          Required Sample Sizes {isNegligibleEffect && '(for medium effect d=0.5)'}
        </h5>
        <div className="space-y-1">
          {[
            { label: '80% power', data: requiredFor80 },
            { label: '90% power', data: requiredFor90 },
            { label: '95% power', data: requiredFor95 }
          ].map(({ label, data }) => (
            <div key={label} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-900/50 rounded text-xs">
              <span className="text-gray-600 dark:text-gray-400">{label}:</span>
              <span className="font-medium text-gray-900 dark:text-white">
                {data?.nPerGroup != null ? `n = ${data.nPerGroup} per group` : '—'}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Understanding Power */}
      <div className="p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
        <div className="text-[10px] text-gray-600 dark:text-gray-400 space-y-1">
          <p><strong>Statistical power</strong> is the probability of correctly detecting a true effect. The 80% threshold (Cohen, 1988) is the standard for scientific research.</p>
          <p>Power depends on: (1) sample size, (2) effect size, and (3) data variance. Each experiment is one independent data point.</p>
        </div>
      </div>
    </div>
  )
}
