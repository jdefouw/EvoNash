'use client'

type StatisticalPowerLevel = 'insufficient' | 'minimum' | 'recommended' | 'robust'

interface SampleSizeGuidanceProps {
  controlExperimentCount: number
  experimentalExperimentCount: number
  controlAvgGenerations: number
  experimentalAvgGenerations: number
  statisticalPowerLevel: StatisticalPowerLevel
}

const THRESHOLDS = [
  { level: 'minimum', experiments: 1, generations: 500, label: 'Minimum' },
  { level: 'recommended', experiments: 2, generations: 1000, label: 'Recommended' },
  { level: 'robust', experiments: 5, generations: 2000, label: 'Robust' },
] as const

export default function SampleSizeGuidance({
  controlExperimentCount,
  experimentalExperimentCount,
  controlAvgGenerations,
  experimentalAvgGenerations,
  statisticalPowerLevel
}: SampleSizeGuidanceProps) {
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
    switch (level) {
      case 'robust':
        return 'Robust Level Achieved'
      case 'recommended':
        return 'Recommended Level Achieved'
      case 'minimum':
        return 'Minimum Level Achieved'
      case 'insufficient':
        return 'Insufficient Data'
    }
  }

  const getLevelDescription = (level: StatisticalPowerLevel) => {
    switch (level) {
      case 'robust':
        return 'Excellent statistical power. Results are highly reliable and publishable.'
      case 'recommended':
        return 'Good statistical power. Results demonstrate reproducibility across seeds.'
      case 'minimum':
        return 'Basic statistical power. Consider running more experiments for stronger evidence.'
      case 'insufficient':
        return 'Not enough data for reliable statistical analysis. Run more experiments.'
    }
  }

  // Calculate progress toward next level
  const getProgressToNextLevel = () => {
    const minCount = Math.min(controlExperimentCount, experimentalExperimentCount)
    const minGens = Math.min(controlAvgGenerations, experimentalAvgGenerations)

    if (statisticalPowerLevel === 'robust') {
      return { progress: 100, nextLevel: null, needed: null }
    }

    let targetExperiments = 0
    let targetGens = 0
    let nextLevel = ''

    if (statisticalPowerLevel === 'insufficient') {
      targetExperiments = 1
      targetGens = 500
      nextLevel = 'Minimum'
    } else if (statisticalPowerLevel === 'minimum') {
      targetExperiments = 2
      targetGens = 1000
      nextLevel = 'Recommended'
    } else if (statisticalPowerLevel === 'recommended') {
      targetExperiments = 5
      targetGens = 2000
      nextLevel = 'Robust'
    }

    const expProgress = Math.min(100, (minCount / targetExperiments) * 100)
    const genProgress = Math.min(100, (minGens / targetGens) * 100)
    const overallProgress = Math.round((expProgress + genProgress) / 2)

    const neededExps = Math.max(0, targetExperiments - minCount)
    const neededGens = Math.max(0, targetGens - minGens)

    return {
      progress: overallProgress,
      nextLevel,
      needed: { experiments: neededExps, generations: neededGens }
    }
  }

  const progressInfo = getProgressToNextLevel()

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

      {/* Progress to Next Level */}
      {progressInfo.nextLevel && (
        <div className="mb-6">
          <div className="flex justify-between text-sm mb-2">
            <span className="text-gray-600 dark:text-gray-400">
              Progress to {progressInfo.nextLevel} Level
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
          {progressInfo.needed && (progressInfo.needed.experiments > 0 || progressInfo.needed.generations > 0) && (
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-2">
              Need: {progressInfo.needed.experiments > 0 && `${progressInfo.needed.experiments} more experiment${progressInfo.needed.experiments > 1 ? 's' : ''} per group`}
              {progressInfo.needed.experiments > 0 && progressInfo.needed.generations > 0 && ' or '}
              {progressInfo.needed.generations > 0 && `${progressInfo.needed.generations.toLocaleString()}+ generations each`}
            </div>
          )}
        </div>
      )}

      {/* Thresholds Table */}
      <div className="overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-900/50">
            <tr>
              <th className="text-left py-2 px-3 font-medium text-gray-600 dark:text-gray-400">Level</th>
              <th className="text-center py-2 px-3 font-medium text-gray-600 dark:text-gray-400">Experiments</th>
              <th className="text-center py-2 px-3 font-medium text-gray-600 dark:text-gray-400">Generations</th>
              <th className="text-center py-2 px-3 font-medium text-gray-600 dark:text-gray-400">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {THRESHOLDS.map((threshold) => {
              const achieved = isLevelAchieved(threshold.level)
              return (
                <tr key={threshold.level} className={achieved ? 'bg-green-50/50 dark:bg-green-900/10' : ''}>
                  <td className="py-2 px-3 font-medium text-gray-900 dark:text-white">
                    {threshold.label}
                  </td>
                  <td className="py-2 px-3 text-center text-gray-600 dark:text-gray-400">
                    {threshold.experiments}+ per group
                  </td>
                  <td className="py-2 px-3 text-center text-gray-600 dark:text-gray-400">
                    {threshold.generations.toLocaleString()}+
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

      {/* Why This Matters */}
      <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
        <div className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
          Understanding the Experiment
        </div>
        <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">
          This experiment compares <strong>Control</strong> (static ε = 0.05) vs <strong>Experimental</strong> (adaptive, calibrated to start at ~5% then scales by fitness). 
          Both groups begin with identical mutation rates to ensure fair comparison of the scaling mechanism.
        </p>
        <p className="text-xs text-gray-600 dark:text-gray-400">
          Running multiple experiments with different random seeds demonstrates reproducibility. 
          A two-sample t-test requires sufficient data points to achieve statistical significance (p &lt; 0.05).
          <strong> Aim for 5+ experiments per group</strong> with 2,000+ generations each for publication-quality results.
        </p>
      </div>
    </div>
  )
}
