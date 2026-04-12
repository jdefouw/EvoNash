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
  requiredFor95,
  currentControlN,
  currentExperimentalN,
  effectSize,
  statisticalPowerLevel,
  controlExperimentCount,
  experimentalExperimentCount,
}: PowerAnalysisCardProps) {
  const totalExperiments = controlExperimentCount + experimentalExperimentCount
  const totalConverged = currentControlN + currentExperimentalN
  const overallConvergenceRate = totalExperiments > 0 ? Math.round((totalConverged / totalExperiments) * 100) : 0
  const controlConvergenceRate = controlExperimentCount > 0 ? Math.round((currentControlN / controlExperimentCount) * 100) : 0
  const experimentalConvergenceRate = experimentalExperimentCount > 0 ? Math.round((currentExperimentalN / experimentalExperimentCount) * 100) : 0

  const observedPower = achievedPower?.power ?? null
  const observedPowerPct = observedPower !== null ? observedPower * 100 : null

  // How many times over the required sample size do we have?
  const requiredN = requiredFor80?.nPerGroup ?? null
  const dataMultiplier = requiredN !== null && requiredN > 0
    ? Math.min(currentControlN, currentExperimentalN) / requiredN
    : null

  // Verdict text
  const getVerdict = () => {
    if (statisticalPowerLevel === 'robust') {
      return {
        headline: 'Yes — we have enough data',
        detail: requiredN !== null
          ? `We needed ${requiredN} converged experiments per group for 80% power. We have ${currentControlN} control and ${currentExperimentalN} experimental — ${dataMultiplier !== null ? `${dataMultiplier.toFixed(0)}×` : 'far'} more than required.`
          : `With ${currentControlN} control and ${currentExperimentalN} experimental converged experiments, this study far exceeds the sample size needed for reliable conclusions.`,
        color: 'emerald'
      }
    }
    if (statisticalPowerLevel === 'recommended') {
      return {
        headline: 'Mostly — results are directionally reliable',
        detail: `We have ${totalConverged} converged experiments. The study can detect large effects but may miss subtler differences. More data would strengthen confidence.`,
        color: 'blue'
      }
    }
    if (statisticalPowerLevel === 'minimum') {
      return {
        headline: 'Not yet — early results only',
        detail: `With only ${totalConverged} converged experiments, there is a meaningful risk of missing real effects. Continue running experiments.`,
        color: 'amber'
      }
    }
    return {
      headline: 'Not enough data yet',
      detail: `We need at least 2 converged experiments per group before any statistical analysis is possible. Currently: ${currentControlN} control, ${currentExperimentalN} experimental.`,
      color: 'red'
    }
  }

  const verdict = getVerdict()

  const colorMap: Record<string, { bg: string; border: string; text: string; dot: string; bannerBg: string }> = {
    emerald: {
      bg: 'bg-emerald-50 dark:bg-emerald-900/15',
      border: 'border-emerald-200 dark:border-emerald-800',
      text: 'text-emerald-700 dark:text-emerald-400',
      dot: 'bg-emerald-500',
      bannerBg: 'bg-gradient-to-r from-emerald-500 to-teal-500',
    },
    blue: {
      bg: 'bg-blue-50 dark:bg-blue-900/15',
      border: 'border-blue-200 dark:border-blue-800',
      text: 'text-blue-700 dark:text-blue-400',
      dot: 'bg-blue-500',
      bannerBg: 'bg-gradient-to-r from-blue-500 to-cyan-500',
    },
    amber: {
      bg: 'bg-amber-50 dark:bg-amber-900/15',
      border: 'border-amber-200 dark:border-amber-800',
      text: 'text-amber-700 dark:text-amber-400',
      dot: 'bg-amber-500',
      bannerBg: 'bg-gradient-to-r from-amber-500 to-orange-500',
    },
    red: {
      bg: 'bg-red-50 dark:bg-red-900/15',
      border: 'border-red-200 dark:border-red-800',
      text: 'text-red-700 dark:text-red-400',
      dot: 'bg-red-500',
      bannerBg: 'bg-gradient-to-r from-red-500 to-rose-500',
    },
  }

  const colors = colorMap[verdict.color]

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">

      {/* Title */}
      <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
        Do We Have Enough Data?
      </h4>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-5">
        Can we trust the results of this experiment?
      </p>

      {/* Verdict Banner */}
      <div className={`${colors.bannerBg} text-white p-4 rounded-xl mb-5`}>
        <div className="text-xl font-bold mb-1">{verdict.headline}</div>
        <p className="text-sm text-white/85 leading-relaxed">{verdict.detail}</p>
      </div>

      {/* Data Overview */}
      <div className="mb-5">
        <div className="flex items-baseline justify-between mb-3">
          <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">Experiment Data</span>
          <span className="text-xs text-gray-400 dark:text-gray-500">{overallConvergenceRate}% overall convergence</span>
        </div>

        {/* Total */}
        <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-3 mb-3 flex items-center justify-between">
          <span className="text-sm text-gray-600 dark:text-gray-400">Total experiments run</span>
          <span className="text-2xl font-bold text-gray-900 dark:text-white">{totalExperiments.toLocaleString()}</span>
        </div>

        {/* Control / Experimental side by side */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg p-3 bg-blue-50 dark:bg-blue-900/15 border border-blue-100 dark:border-blue-800/40">
            <div className="text-lg font-bold text-blue-600 dark:text-blue-400">{controlExperimentCount}</div>
            <div className="text-[11px] font-medium text-gray-700 dark:text-gray-300">Control (Static)</div>
            <div className="flex items-center gap-1 mt-1.5">
              <div className="flex-1 h-1.5 bg-blue-200 dark:bg-blue-800 rounded-full overflow-hidden">
                <div className="h-full bg-blue-500 rounded-full" style={{ width: `${controlConvergenceRate}%` }} />
              </div>
              <span className="text-[10px] text-gray-500 dark:text-gray-400 whitespace-nowrap">{currentControlN} conv ({controlConvergenceRate}%)</span>
            </div>
          </div>
          <div className="rounded-lg p-3 bg-purple-50 dark:bg-purple-900/15 border border-purple-100 dark:border-purple-800/40">
            <div className="text-lg font-bold text-purple-600 dark:text-purple-400">{experimentalExperimentCount}</div>
            <div className="text-[11px] font-medium text-gray-700 dark:text-gray-300">Experimental (Adaptive)</div>
            <div className="flex items-center gap-1 mt-1.5">
              <div className="flex-1 h-1.5 bg-purple-200 dark:bg-purple-800 rounded-full overflow-hidden">
                <div className="h-full bg-purple-500 rounded-full" style={{ width: `${experimentalConvergenceRate}%` }} />
              </div>
              <span className="text-[10px] text-gray-500 dark:text-gray-400 whitespace-nowrap">{currentExperimentalN} conv ({experimentalConvergenceRate}%)</span>
            </div>
          </div>
        </div>
      </div>

      {/* Data vs Required comparison */}
      {requiredN !== null && (
        <div className="mb-5">
          <div className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-3">
            How much data did we need?
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className={`rounded-lg p-3 border ${colors.border} ${colors.bg}`}>
              <div className="text-[11px] uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1">Required</div>
              <div className={`text-xl font-bold ${colors.text}`}>{requiredN}</div>
              <div className="text-[10px] text-gray-500 dark:text-gray-400">per group for 80% power</div>
            </div>
            <div className="rounded-lg p-3 border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/30">
              <div className="text-[11px] uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1">We have</div>
              <div className="text-xl font-bold text-gray-900 dark:text-white">{Math.min(currentControlN, currentExperimentalN)}+</div>
              <div className="text-[10px] text-gray-500 dark:text-gray-400">per group (smallest group)</div>
            </div>
          </div>
          {dataMultiplier !== null && dataMultiplier >= 2 && (
            <div className={`mt-2 text-center text-xs font-semibold ${colors.text}`}>
              {dataMultiplier.toFixed(0)}× more data than the minimum required
            </div>
          )}
          {requiredFor95?.nPerGroup != null && (
            <div className="mt-2 text-[10px] text-gray-400 dark:text-gray-500 text-center">
              For 95% power: {requiredFor95.nPerGroup} per group needed — we exceed this too
            </div>
          )}
        </div>
      )}

      {/* Statistical Power bar */}
      {observedPowerPct !== null && (
        <div className="mb-5">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">Statistical Power</span>
            <span className="text-sm font-bold text-gray-900 dark:text-white">{observedPowerPct.toFixed(0)}%</span>
          </div>
          <div className="relative h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            {/* 80% threshold marker */}
            <div className="absolute top-0 bottom-0 left-[80%] w-px bg-gray-400 dark:bg-gray-500 z-10" />
            <div
              className={`h-full rounded-full transition-all duration-700 ${observedPowerPct >= 80 ? 'bg-emerald-500' : 'bg-amber-400'}`}
              style={{ width: `${Math.min(observedPowerPct, 100)}%` }}
            />
          </div>
          <div className="flex items-center justify-between mt-1">
            <span className="text-[10px] text-gray-400">0%</span>
            <span className="text-[10px] text-gray-400">80% threshold</span>
            <span className="text-[10px] text-gray-400">100%</span>
          </div>
          <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-2 leading-relaxed">
            {observedPowerPct >= 80
              ? 'Power exceeds 80% — the standard for publication-quality research (Cohen, 1988). If there is a real difference between groups, this study has a very high probability of detecting it.'
              : 'Power is below the 80% threshold. More converged experiments would increase the study\'s ability to detect real differences between groups.'
            }
          </p>
        </div>
      )}

      {/* Bottom summary */}
      <div className="p-3 bg-gray-50 dark:bg-gray-900/40 rounded-lg">
        <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-relaxed">
          <strong>In plain terms:</strong> Statistical power tells us whether we ran enough experiments to trust our conclusions.
          With {totalConverged.toLocaleString()} converged experiments across both groups, {statisticalPowerLevel === 'robust'
            ? 'this study has more than enough data. The conclusions drawn from these results are statistically reliable.'
            : 'more experiments will increase our confidence in the findings.'
          }
        </p>
      </div>
    </div>
  )
}
