'use client'

type StatisticalPowerLevel = 'insufficient' | 'minimum' | 'recommended' | 'robust'

interface StatsSummaryProps {
  controlConvergenceGen: number | null
  experimentalConvergenceGen: number | null
  convergenceImprovement: number | null // percentage
  controlFinalFitness: number | null
  experimentalFinalFitness: number | null
  controlPeakFitness: number | null
  experimentalPeakFitness: number | null
  totalGenerationsControl: number
  totalGenerationsExperimental: number
  convergencePValue: number | null           // Two-tailed
  convergencePValueOneTailed?: number | null  // One-tailed (directional)
  convergenceIsSignificant: boolean
  convergenceTStatistic?: number | null
  convergenceDegreesOfFreedom?: number | null
  convergenceCohensD?: number | null
  convergenceConfidenceInterval?: { lower: number; upper: number } | null
  convergenceControlMean?: number | null
  convergenceExperimentalMean?: number | null
  convergenceControlStd?: number | null
  convergenceExperimentalStd?: number | null
  convergenceMeanDifference?: number | null
  convergenceControlMedian?: number | null
  convergenceExperimentalMedian?: number | null
  convergenceControlIQR?: { Q1: number; Q3: number } | null
  convergenceExperimentalIQR?: { Q1: number; Q3: number } | null
  controlConvergedCount?: number
  experimentalConvergedCount?: number
  controlExperimentCount?: number
  experimentalExperimentCount?: number
  statisticalPowerLevel?: StatisticalPowerLevel
}

export default function StatsSummary({
  controlConvergenceGen,
  experimentalConvergenceGen,
  convergenceImprovement,
  controlFinalFitness,
  experimentalFinalFitness,
  controlPeakFitness,
  experimentalPeakFitness,
  convergencePValue,
  convergencePValueOneTailed = null,
  convergenceIsSignificant,
  convergenceTStatistic = null,
  convergenceDegreesOfFreedom = null,
  convergenceCohensD = null,
  convergenceConfidenceInterval = null,
  convergenceControlMean = null,
  convergenceExperimentalMean = null,
  convergenceControlStd = null,
  convergenceExperimentalStd = null,
  convergenceMeanDifference = null,
  convergenceControlMedian = null,
  convergenceExperimentalMedian = null,
  convergenceControlIQR = null,
  convergenceExperimentalIQR = null,
  controlConvergedCount,
  experimentalConvergedCount,
  totalGenerationsControl,
  totalGenerationsExperimental,
  controlExperimentCount = 0,
  experimentalExperimentCount = 0,
  statisticalPowerLevel = 'insufficient'
}: StatsSummaryProps) {
  const getEffectSizeLabel = (d: number | null): { label: string; color: string } => {
    if (d === null) return { label: 'N/A', color: 'text-gray-500' }
    const absD = Math.abs(d)
    if (absD < 0.2) return { label: 'Negligible', color: 'text-gray-500' }
    if (absD < 0.5) return { label: 'Small', color: 'text-yellow-600 dark:text-yellow-400' }
    if (absD < 0.8) return { label: 'Medium', color: 'text-blue-600 dark:text-blue-400' }
    return { label: 'Large', color: 'text-green-600 dark:text-green-400' }
  }

  const effectSize = getEffectSizeLabel(convergenceCohensD ?? null)
  const convergedN = controlConvergedCount ?? controlExperimentCount
  const convergedM = experimentalConvergedCount ?? experimentalExperimentCount

  // Primary p-value: use TWO-TAILED (more conservative, standard)
  const primaryP = convergencePValue
  const secondaryP = convergencePValueOneTailed

  const formatPValue = (p: number, fixedDecimals = 4) =>
    p < 0.0001 ? p.toExponential(2) : p.toFixed(fixedDecimals)
  const hasData = totalGenerationsControl > 0 || totalGenerationsExperimental > 0

  const getConfidenceLabel = (level: StatisticalPowerLevel) => {
    switch (level) {
      case 'robust': return { label: 'High Confidence', color: 'text-green-600 dark:text-green-400', bg: 'bg-green-50 dark:bg-green-900/20' }
      case 'recommended': return { label: 'Moderate Confidence', color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-900/20' }
      case 'minimum': return { label: 'Limited Confidence', color: 'text-yellow-600 dark:text-yellow-400', bg: 'bg-yellow-50 dark:bg-yellow-900/20' }
      case 'insufficient': return { label: 'Insufficient Data', color: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-900/20' }
    }
  }

  const confidence = getConfidenceLabel(statisticalPowerLevel)

  const StatCard = ({
    label,
    controlValue,
    experimentalValue,
    unit = '',
    comparison,
    highlight = false
  }: {
    label: string
    controlValue: string | number | null
    experimentalValue: string | number | null
    unit?: string
    comparison?: 'lower-better' | 'higher-better'
    highlight?: boolean
  }) => {
    let controlBetter = false
    let experimentalBetter = false

    if (comparison && controlValue !== null && experimentalValue !== null) {
      const cv = typeof controlValue === 'string' ? parseFloat(controlValue) : controlValue
      const ev = typeof experimentalValue === 'string' ? parseFloat(experimentalValue) : experimentalValue

      if (comparison === 'lower-better') {
        controlBetter = cv < ev
        experimentalBetter = ev < cv
      } else {
        controlBetter = cv > ev
        experimentalBetter = ev > cv
      }
    }

    return (
      <div className={`p-3 rounded-lg ${highlight ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800' : 'bg-gray-50 dark:bg-gray-900/50'}`}>
        <div className="text-[11px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
          {label}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="text-[10px] text-blue-600 dark:text-blue-400 mb-0.5">Control</div>
            <div className={`text-base font-bold ${controlBetter ? 'text-green-600 dark:text-green-400' : 'text-gray-900 dark:text-white'}`}>
              {controlValue !== null ? `${controlValue}${unit}` : '—'}
              {controlBetter && <span className="ml-1 text-xs">✓</span>}
            </div>
          </div>
          <div>
            <div className="text-[10px] text-purple-600 dark:text-purple-400 mb-0.5">Experimental</div>
            <div className={`text-base font-bold ${experimentalBetter ? 'text-green-600 dark:text-green-400' : 'text-gray-900 dark:text-white'}`}>
              {experimentalValue !== null ? `${experimentalValue}${unit}` : '—'}
              {experimentalBetter && <span className="ml-1 text-xs">✓</span>}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <section id="statistics" className="scroll-mt-20">
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 sm:p-6">
        <div className="flex items-baseline justify-between mb-1">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Statistical Significance
          </h3>
          <span className="text-[10px] text-gray-400 dark:text-gray-500">Welch&apos;s two-sample t-test</span>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
          Paired-seed comparison of convergence speed (generations to Nash equilibrium)
        </p>

        {hasData ? (
          <>
            {/* Main Result Banner */}
            <div className={`mb-4 p-4 sm:p-5 rounded-xl ${convergenceIsSignificant
              ? 'bg-gradient-to-r from-green-500 to-emerald-500'
              : convergenceImprovement !== null && convergenceImprovement < 0
                ? 'bg-gradient-to-r from-amber-500 to-orange-500'
                : 'bg-gradient-to-r from-slate-500 to-slate-600'
              } text-white`}>
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                <div>
                  <h4 className="text-xl sm:text-2xl font-bold mb-0.5">
                    {convergenceIsSignificant && convergenceImprovement !== null && convergenceImprovement > 0
                      ? `${convergenceImprovement.toFixed(0)}% Faster Convergence`
                      : convergenceImprovement !== null && convergenceImprovement < -1
                        ? `${Math.abs(convergenceImprovement).toFixed(0)}% Slower Convergence`
                        : 'No Significant Difference Detected'
                    }
                  </h4>
                  <p className="text-white/80 text-sm">
                    {convergenceIsSignificant && primaryP !== null
                      ? `Statistically significant (p = ${formatPValue(primaryP)} < 0.05, two-tailed)`
                      : primaryP !== null
                        ? `Not statistically significant (p = ${formatPValue(primaryP)}, two-tailed, α = 0.05)`
                        : 'Awaiting converged experiments for analysis'
                    }
                  </p>
                </div>
                <div className="text-left sm:text-right shrink-0">
                  <div className="text-3xl sm:text-4xl font-bold font-mono">
                    {primaryP !== null ? `p = ${formatPValue(primaryP, 3)}` : 'p = —'}
                  </div>
                  <div className="text-xs text-white/70">
                    {convergenceIsSignificant ? 'Significant' : 'Not Significant'} (two-tailed)
                  </div>
                </div>
              </div>
            </div>

            {/* Confidence Indicator */}
            <div className={`mb-4 px-4 py-3 rounded-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-1 ${confidence.bg}`}>
              <div className="flex items-center gap-2">
                <span className={`text-sm font-semibold ${confidence.color}`}>{confidence.label}</span>
                <span className="text-gray-500 dark:text-gray-400 text-xs">
                  {convergedN} ctrl + {convergedM} exp converged
                </span>
              </div>
              <span className="text-[10px] text-gray-400 dark:text-gray-500">
                Power: {statisticalPowerLevel.charAt(0).toUpperCase() + statisticalPowerLevel.slice(1)}
              </span>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
              <StatCard
                label="Convergence Gen"
                controlValue={controlConvergenceGen}
                experimentalValue={experimentalConvergenceGen}
                comparison="lower-better"
                highlight={experimentalConvergenceGen !== null && controlConvergenceGen !== null && experimentalConvergenceGen < controlConvergenceGen}
              />
              <StatCard
                label="Final Avg Fitness"
                controlValue={controlFinalFitness?.toFixed(1) ?? null}
                experimentalValue={experimentalFinalFitness?.toFixed(1) ?? null}
                comparison="higher-better"
              />
              <StatCard
                label="Peak Fitness"
                controlValue={controlPeakFitness?.toFixed(1) ?? null}
                experimentalValue={experimentalPeakFitness?.toFixed(1) ?? null}
                comparison="higher-better"
              />
              <StatCard
                label="Total Generations"
                controlValue={totalGenerationsControl}
                experimentalValue={totalGenerationsExperimental}
              />
            </div>

            {/* T-Test Details */}
            <div className="p-3 sm:p-4 rounded-lg bg-gray-50 dark:bg-gray-900/50">
              <div className="text-[11px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
                Welch&apos;s T-Test Details
              </div>

              {(convergedN < 5 || convergedM < 5) && (
                <div className="mb-3 p-2 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded text-xs text-yellow-700 dark:text-yellow-400">
                  <strong>Note:</strong> n={convergedN} ctrl, n={convergedM} exp. Aim for n≥5 per group.
                </div>
              )}

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm mb-3">
                <div>
                  <div className="text-xs text-gray-400">t-Statistic</div>
                  <div className="font-mono font-bold text-gray-900 dark:text-white text-sm">
                    {convergenceTStatistic !== null ? convergenceTStatistic.toFixed(4) : '—'}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-400">Degrees of Freedom</div>
                  <div className="font-mono font-bold text-gray-900 dark:text-white text-sm">
                    {convergenceDegreesOfFreedom !== null ? convergenceDegreesOfFreedom.toFixed(2) : '—'}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-400">p-Value (two-tailed)</div>
                  <div className="font-mono font-bold text-gray-900 dark:text-white text-sm">
                    {primaryP !== null ? formatPValue(primaryP) : '—'}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-400">Significance (α = 0.05)</div>
                  <div className={`font-bold text-sm ${convergenceIsSignificant ? 'text-green-600 dark:text-green-400' : 'text-gray-500'}`}>
                    {primaryP !== null ? (convergenceIsSignificant ? 'Reject H₀' : 'Fail to Reject H₀') : '—'}
                  </div>
                </div>
              </div>

              {/* One-tailed for transparency */}
              {secondaryP !== null && (
                <div className="text-[11px] text-gray-400 dark:text-gray-500 mb-3">
                  One-tailed p = {formatPValue(secondaryP)} (directional H₁: exp &lt; ctrl; reported for reference)
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm border-t border-gray-200 dark:border-gray-700 pt-3">
                <div>
                  <div className="text-xs text-gray-400">Cohen&apos;s d</div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono font-bold text-gray-900 dark:text-white text-sm">
                      {convergenceCohensD !== null ? (convergenceCohensD > 0 ? '+' : '') + convergenceCohensD.toFixed(3) : '—'}
                    </span>
                    <span className={`text-[10px] font-medium ${effectSize.color}`}>
                      {effectSize.label}{convergenceCohensD !== null ? (convergenceCohensD < 0 ? ' (→exp)' : convergenceCohensD > 0 ? ' (→ctrl)' : '') : ''}
                    </span>
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-400">Mean Diff (Ctrl − Exp)</div>
                  <div className="font-mono font-bold text-gray-900 dark:text-white text-sm">
                    {convergenceMeanDifference !== null ? (convergenceMeanDifference > 0 ? '+' : '') + convergenceMeanDifference.toFixed(0) + ' gen' : '—'}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-400">95% CI</div>
                  <div className="font-mono font-bold text-gray-900 dark:text-white text-sm">
                    {convergenceConfidenceInterval
                      ? `[${convergenceConfidenceInterval.lower.toFixed(0)}, ${convergenceConfidenceInterval.upper.toFixed(0)}]`
                      : '—'}
                  </div>
                </div>
              </div>

              {/* Group descriptive stats */}
              <div className="grid grid-cols-2 gap-3 text-sm border-t border-gray-200 dark:border-gray-700 pt-3 mt-3">
                <div>
                  <div className="text-[10px] text-blue-600 dark:text-blue-400 font-medium mb-0.5">Control (n={convergedN})</div>
                  <div className="text-xs text-gray-600 dark:text-gray-400">
                    Mean: <span className="font-mono font-bold text-gray-900 dark:text-white">{convergenceControlMean !== null ? convergenceControlMean.toFixed(0) : '—'}</span>
                    {' '}± <span className="font-mono">{convergenceControlStd !== null ? convergenceControlStd.toFixed(0) : '—'}</span>
                  </div>
                  <div className="text-xs text-gray-600 dark:text-gray-400">
                    Median: <span className="font-mono font-bold text-gray-900 dark:text-white">{convergenceControlMedian !== null ? convergenceControlMedian.toFixed(0) : '—'}</span>
                    {convergenceControlIQR && (
                      <span className="text-[10px] ml-1">(IQR: {convergenceControlIQR.Q1.toFixed(0)}–{convergenceControlIQR.Q3.toFixed(0)})</span>
                    )}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-purple-600 dark:text-purple-400 font-medium mb-0.5">Experimental (n={convergedM})</div>
                  <div className="text-xs text-gray-600 dark:text-gray-400">
                    Mean: <span className="font-mono font-bold text-gray-900 dark:text-white">{convergenceExperimentalMean !== null ? convergenceExperimentalMean.toFixed(0) : '—'}</span>
                    {' '}± <span className="font-mono">{convergenceExperimentalStd !== null ? convergenceExperimentalStd.toFixed(0) : '—'}</span>
                  </div>
                  <div className="text-xs text-gray-600 dark:text-gray-400">
                    Median: <span className="font-mono font-bold text-gray-900 dark:text-white">{convergenceExperimentalMedian !== null ? convergenceExperimentalMedian.toFixed(0) : '—'}</span>
                    {convergenceExperimentalIQR && (
                      <span className="text-[10px] ml-1">(IQR: {convergenceExperimentalIQR.Q1.toFixed(0)}–{convergenceExperimentalIQR.Q3.toFixed(0)})</span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Interpretation */}
            <div className="mt-4 p-3 sm:p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
              <h4 className="font-semibold text-blue-800 dark:text-blue-300 mb-1.5 text-sm">
                Interpretation
              </h4>
              <p className="text-sm text-blue-700 dark:text-blue-400 leading-relaxed">
                {convergenceIsSignificant ? (
                  <>
                    The experimental group (Adaptive Mutation) reached Nash equilibrium in significantly fewer generations than the control group (p = {primaryP != null ? formatPValue(primaryP) : '—'}, two-tailed).
                    {convergenceImprovement !== null && convergenceImprovement > 0 && (
                      <> The adaptive strategy converged {convergenceImprovement.toFixed(0)}% faster, supporting the hypothesis that fitness-scaled mutation rates accelerate convergence.</>
                    )}
                    {convergenceCohensD !== null && (
                      <> Effect size: d = {convergenceCohensD.toFixed(2)} ({effectSize.label.toLowerCase()}{convergenceCohensD < 0 ? ', favoring experimental' : ''}).</>
                    )}
                  </>
                ) : (statisticalPowerLevel === 'robust' || statisticalPowerLevel === 'recommended') ? (
                  <>
                    No statistically significant difference was found between groups
                    (p = {primaryP != null ? formatPValue(primaryP) : '—'}, two-tailed).
                    {convergenceCohensD !== null && Math.abs(convergenceCohensD) < 0.2 && (
                      <> With {statisticalPowerLevel === 'robust' ? 'robust' : 'moderate'} statistical power and a negligible effect size (d = {convergenceCohensD.toFixed(3)}), the true difference is likely genuinely small or absent.</>
                    )}
                    {convergenceCohensD !== null && Math.abs(convergenceCohensD) >= 0.2 && (
                      <> Effect size d = {convergenceCohensD.toFixed(3)} ({effectSize.label.toLowerCase()}) but does not reach significance at α = 0.05.</>
                    )}
                  </>
                ) : (
                  <>
                    Significance not yet reached.
                    {(convergedN < 30 || convergedM < 30)
                      ? <> More converged experiments ({convergedN} ctrl + {convergedM} exp so far) will increase power to detect a true effect if one exists.</>
                      : <> Additional converged experiments may help clarify the result.</>
                    }
                  </>
                )}
              </p>
            </div>

            {/* Collapsible methodology */}
            <details className="mt-3">
              <summary className="text-xs text-gray-500 dark:text-gray-400 cursor-pointer hover:text-gray-700 dark:hover:text-gray-300 select-none">
                Understanding the p-value &amp; Nash detection methodology
              </summary>
              <div className="mt-2 p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg text-xs text-gray-600 dark:text-gray-400 space-y-2">
                <p>
                  <strong>p-value:</strong> The probability of observing a difference this large (or larger) between groups if there were truly no difference. Small p (&lt; 0.05) = evidence against &quot;no difference.&quot;
                </p>
                <p>
                  <strong>Two-tailed test:</strong> Tests for any difference in either direction (H₁: μ<sub>exp</sub> ≠ μ<sub>ctrl</sub>). This is the standard, more conservative approach. The one-tailed p-value is also reported for reference.
                </p>
                <p>
                  <strong>Nash detection:</strong> Entropy variance σ &lt; 0.001 sustained for 20+ consecutive generations, after population has first diverged. Same threshold for both groups.
                </p>
              </div>
            </details>
          </>
        ) : (
          <div className="flex items-center justify-center h-40 text-gray-400 dark:text-gray-500">
            <div className="text-center text-sm">
              <p>No experiment data available.</p>
              <p className="text-xs mt-1">Run Control and Experimental experiments to see analysis.</p>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
