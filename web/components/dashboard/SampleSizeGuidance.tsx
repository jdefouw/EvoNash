'use client'

type StatisticalPowerLevel = 'insufficient' | 'minimum' | 'recommended' | 'robust'

interface SampleSizeGuidanceProps {
  controlExperimentCount: number
  experimentalExperimentCount: number
  controlAvgGenerations: number
  experimentalAvgGenerations: number
  statisticalPowerLevel: StatisticalPowerLevel
  // New: actual achieved power from power analysis (if available)
  achievedPower?: number | null
}

// =============================================================================
// STATISTICAL POWER THRESHOLDS
// =============================================================================
// These thresholds are based on established statistical conventions (Cohen, 1988):
// - 80% power is the standard "adequate" threshold for scientific research
// - Power = probability of detecting a true effect when it exists
// - Below 50% means you're more likely to miss a real effect than detect it
// 
// The power level shown is based on ACTUAL CALCULATED POWER using observed
// effect size, not arbitrary sample size thresholds. This is the scientifically
// rigorous approach.
// =============================================================================
const POWER_THRESHOLDS = [
  { 
    level: 'minimum', 
    powerRange: '40-59%', 
    label: 'Minimum', 
    description: 'Low power - may miss real effects (Type II error risk)' 
  },
  { 
    level: 'recommended', 
    powerRange: '60-79%', 
    label: 'Moderate', 
    description: 'Moderate power - can detect large effects reliably' 
  },
  { 
    level: 'robust', 
    powerRange: '≥80%', 
    label: 'Adequate', 
    description: 'Standard threshold for publication-quality research (Cohen, 1988)' 
  },
] as const

export default function SampleSizeGuidance({
  controlExperimentCount,
  experimentalExperimentCount,
  controlAvgGenerations,
  experimentalAvgGenerations,
  statisticalPowerLevel,
  achievedPower
}: SampleSizeGuidanceProps) {
  // Format power as percentage
  const powerPercentage = achievedPower !== null && achievedPower !== undefined
    ? (achievedPower * 100).toFixed(1)
    : null

  const getLevelColor = (level: StatisticalPowerLevel) => {
    switch (level) {
      case 'robust':
        return 'bg-green-500'
      case 'recommended':
        return 'bg-blue-500'
      case 'minimum':
        return 'bg-yellow-500'
      case 'insufficient':
        return 'bg-red-500'
    }
  }

  const getLevelBgColor = (level: StatisticalPowerLevel) => {
    switch (level) {
      case 'robust':
        return 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
      case 'recommended':
        return 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
      case 'minimum':
        return 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800'
      case 'insufficient':
        return 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
    }
  }

  const getLevelTextColor = (level: StatisticalPowerLevel) => {
    switch (level) {
      case 'robust':
        return 'text-green-700 dark:text-green-400'
      case 'recommended':
        return 'text-blue-700 dark:text-blue-400'
      case 'minimum':
        return 'text-yellow-700 dark:text-yellow-400'
      case 'insufficient':
        return 'text-red-700 dark:text-red-400'
    }
  }

  const getLevelLabel = (level: StatisticalPowerLevel) => {
    // Show actual power percentage when available
    const powerStr = powerPercentage ? ` (${powerPercentage}%)` : ''
    switch (level) {
      case 'robust':
        return `Adequate Power${powerStr}`
      case 'recommended':
        return `Moderate Power${powerStr}`
      case 'minimum':
        return `Low Power${powerStr}`
      case 'insufficient':
        return 'Insufficient Data'
    }
  }

  const getLevelDescription = (level: StatisticalPowerLevel) => {
    switch (level) {
      case 'robust':
        return '≥80% power: Standard threshold for publication-quality research. High probability of detecting true effects.'
      case 'recommended':
        return '60-79% power: Moderate ability to detect effects. May miss smaller true differences.'
      case 'minimum':
        return '40-59% power: Low power - significant risk of Type II error (failing to detect real effects).'
      case 'insufficient':
        return 'Cannot calculate power. Need at least 2 experiments per group with measurable effect size.'
    }
  }

  // Calculate progress toward 80% power (the standard threshold)
  const getProgressToAdequatePower = () => {
    if (achievedPower === null || achievedPower === undefined) {
      // Can't calculate power yet - show sample size progress
      const minCount = Math.min(controlExperimentCount, experimentalExperimentCount)
      // Need at least 2 per group to calculate power
      if (minCount < 2) {
        return {
          progress: Math.round((minCount / 2) * 100),
          target: '2 per group',
          description: 'Need 2+ experiments per group to calculate statistical power'
        }
      }
      // Waiting for effect size calculation
      return {
        progress: 50,
        target: 'effect size',
        description: 'Calculating effect size from observed data...'
      }
    }

    // We have actual power - show progress toward 80%
    const progress = Math.min(100, Math.round((achievedPower / 0.80) * 100))
    
    if (achievedPower >= 0.80) {
      return {
        progress: 100,
        target: null,
        description: 'Adequate power achieved (≥80%)'
      }
    }

    return {
      progress,
      target: '80%',
      description: `Current: ${(achievedPower * 100).toFixed(1)}% → Target: 80% power`
    }
  }

  const progressInfo = getProgressToAdequatePower()

  const isLevelAchieved = (level: string) => {
    const levelOrder = ['insufficient', 'minimum', 'recommended', 'robust']
    const currentIndex = levelOrder.indexOf(statisticalPowerLevel)
    const checkIndex = levelOrder.indexOf(level)
    return currentIndex >= checkIndex
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
        Statistical Power Analysis
      </h3>
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
        Sample size requirements for statistically significant findings
      </p>

      {/* Current Status Banner */}
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

      {/* Current Experiment Counts */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 text-center">
          <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">
            {controlExperimentCount}
          </div>
          <div className="text-sm font-medium text-gray-700 dark:text-gray-300">Control Group</div>
          <div className="text-xs text-gray-500 dark:text-gray-500 mt-1">
            Static Mutation (ε = 0.05)
          </div>
          <div className="text-xs text-gray-400 dark:text-gray-600 mt-1">
            {controlAvgGenerations.toLocaleString()} avg generations
          </div>
        </div>
        <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4 text-center">
          <div className="text-3xl font-bold text-purple-600 dark:text-purple-400">
            {experimentalExperimentCount}
          </div>
          <div className="text-sm font-medium text-gray-700 dark:text-gray-300">Experimental Group</div>
          <div className="text-xs text-gray-500 dark:text-gray-500 mt-1">
            Adaptive Mutation (starts ~5%, scales by Elo)
          </div>
          <div className="text-xs text-gray-400 dark:text-gray-600 mt-1">
            {experimentalAvgGenerations.toLocaleString()} avg generations
          </div>
        </div>
      </div>

      {/* Progress to Adequate Power (80%) */}
      <div className="mb-6">
        <div className="flex justify-between text-sm mb-2">
          <span className="text-gray-600 dark:text-gray-400">
            Progress to Adequate Power (80%)
          </span>
          <span className="font-medium text-gray-900 dark:text-white">
            {progressInfo.progress}%
          </span>
        </div>
        <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div 
            className={`h-full ${getLevelColor(statisticalPowerLevel)} transition-all duration-500`}
            style={{ width: `${progressInfo.progress}%` }}
          />
        </div>
        <div className="text-xs text-gray-500 dark:text-gray-400 mt-2">
          {progressInfo.description}
        </div>
      </div>

      {/* Power Level Thresholds Table */}
      <div className="overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-900/50">
            <tr>
              <th className="text-left py-2 px-3 font-medium text-gray-600 dark:text-gray-400">Level</th>
              <th className="text-center py-2 px-3 font-medium text-gray-600 dark:text-gray-400">Power Range</th>
              <th className="text-left py-2 px-3 font-medium text-gray-600 dark:text-gray-400">Interpretation</th>
              <th className="text-center py-2 px-3 font-medium text-gray-600 dark:text-gray-400">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {POWER_THRESHOLDS.map((threshold) => {
              const achieved = isLevelAchieved(threshold.level)
              return (
                <tr key={threshold.level} className={achieved ? 'bg-green-50/50 dark:bg-green-900/10' : ''}>
                  <td className="py-2 px-3 font-medium text-gray-900 dark:text-white">
                    {threshold.label}
                  </td>
                  <td className="py-2 px-3 text-center text-gray-600 dark:text-gray-400">
                    {threshold.powerRange}
                  </td>
                  <td className="py-2 px-3 text-xs text-gray-500 dark:text-gray-400">
                    {threshold.description}
                  </td>
                  <td className="py-2 px-3 text-center">
                    {achieved ? (
                      <span className="inline-flex items-center justify-center w-6 h-6 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-full">
                        ✓
                      </span>
                    ) : (
                      <span className="inline-flex items-center justify-center w-6 h-6 bg-gray-100 dark:bg-gray-700 text-gray-400 rounded-full">
                        -
                      </span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Understanding Statistical Power */}
      <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
        <div className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
          Understanding Statistical Power
        </div>
        <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">
          <strong>Statistical power</strong> is the probability of correctly detecting a true effect when one exists. 
          The <strong>80% threshold</strong> (Cohen, 1988) is the standard for publication-quality research.
        </p>
        <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">
          Power depends on: <strong>(1) sample size</strong> (number of independent experiments), 
          <strong>(2) effect size</strong> (how different the groups are), and <strong>(3) data variance</strong>. 
          The power shown above is calculated from your actual observed effect size, not arbitrary thresholds.
        </p>
        <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">
          <strong>Type II Error Risk:</strong> With power below 80%, you have a significant chance of failing to detect 
          a real effect (false negative). For example, 60% power means a 40% chance of missing a true difference.
        </p>
        <p className="text-xs text-gray-600 dark:text-gray-400">
          <strong>Note:</strong> Each experiment provides one independent data point for the statistical test. 
          Running experiments longer doesn&apos;t increase power—running more independent experiments with different random seeds does.
        </p>
      </div>
    </div>
  )
}
