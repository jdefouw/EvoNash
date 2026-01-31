'use client'

type StatisticalPowerLevel = 'insufficient' | 'minimum' | 'recommended' | 'robust'

interface StatsSummaryProps {
  controlConvergenceGen: number | null
  experimentalConvergenceGen: number | null
  convergenceImprovement: number | null // percentage
  controlFinalElo: number | null
  experimentalFinalElo: number | null
  controlPeakElo: number | null
  experimentalPeakElo: number | null
  totalGenerationsControl: number
  totalGenerationsExperimental: number
  // Primary: convergence-generation t-test (hypothesis test)
  convergencePValue: number | null
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
  controlConvergedCount?: number
  experimentalConvergedCount?: number
  // Statistical power and sample size (from convergence analysis)
  controlExperimentCount?: number
  experimentalExperimentCount?: number
  statisticalPowerLevel?: StatisticalPowerLevel
  // Secondary/descriptive (Elo t-test - not used for hypothesis)
  pValue?: number | null
  isSignificant?: boolean
  tStatistic?: number | null
  degreesOfFreedom?: number | null
  cohensD?: number | null
  confidenceInterval?: { lower: number; upper: number } | null
  controlMean?: number | null
  experimentalMean?: number | null
  controlStd?: number | null
  experimentalStd?: number | null
  meanDifference?: number | null
}

export default function StatsSummary({
  controlConvergenceGen,
  experimentalConvergenceGen,
  convergenceImprovement,
  controlFinalElo,
  experimentalFinalElo,
  controlPeakElo,
  experimentalPeakElo,
  convergencePValue,
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
  controlConvergedCount,
  experimentalConvergedCount,
  totalGenerationsControl,
  totalGenerationsExperimental,
  controlExperimentCount = 0,
  experimentalExperimentCount = 0,
  statisticalPowerLevel = 'insufficient',
  tStatistic = null,
  degreesOfFreedom = null,
  cohensD = null,
  confidenceInterval = null,
  controlMean = null,
  experimentalMean = null,
  controlStd = null,
  experimentalStd = null,
  meanDifference = null
}: StatsSummaryProps) {
  // Effect size interpretation (Cohen's conventions) - use convergence for primary display
  const getEffectSizeLabel = (d: number | null): { label: string; color: string } => {
    if (d === null) return { label: 'N/A', color: 'text-gray-500' }
    const absD = Math.abs(d)
    if (absD < 0.2) return { label: 'Negligible', color: 'text-gray-500' }
    if (absD < 0.5) return { label: 'Small', color: 'text-yellow-600 dark:text-yellow-400' }
    if (absD < 0.8) return { label: 'Medium', color: 'text-blue-600 dark:text-blue-400' }
    return { label: 'Large', color: 'text-green-600 dark:text-green-400' }
  }

  const effectSize = getEffectSizeLabel(convergenceCohensD ?? cohensD)
  const convergedN = controlConvergedCount ?? controlExperimentCount
  const convergedM = experimentalConvergedCount ?? experimentalExperimentCount
  const hasData = totalGenerationsControl > 0 || totalGenerationsExperimental > 0

  const getConfidenceLabel = (level: StatisticalPowerLevel) => {
    switch (level) {
      case 'robust':
        return { label: 'High Confidence', color: 'text-green-600 dark:text-green-400', bg: 'bg-green-100 dark:bg-green-900/30' }
      case 'recommended':
        return { label: 'Moderate Confidence', color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-100 dark:bg-blue-900/30' }
      case 'minimum':
        return { label: 'Limited Confidence', color: 'text-yellow-600 dark:text-yellow-400', bg: 'bg-yellow-100 dark:bg-yellow-900/30' }
      case 'insufficient':
        return { label: 'Insufficient Data', color: 'text-red-600 dark:text-red-400', bg: 'bg-red-100 dark:bg-red-900/30' }
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
      <div className={`p-4 rounded-lg ${highlight ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800' : 'bg-gray-50 dark:bg-gray-900/50'}`}>
        <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
          {label}
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-xs text-blue-600 dark:text-blue-400 mb-1">Control</div>
            <div className={`text-lg font-bold ${controlBetter ? 'text-green-600 dark:text-green-400' : 'text-gray-900 dark:text-white'}`}>
              {controlValue !== null ? `${controlValue}${unit}` : '-'}
              {controlBetter && <span className="ml-1 text-xs">✓</span>}
            </div>
          </div>
          <div>
            <div className="text-xs text-purple-600 dark:text-purple-400 mb-1">Experimental</div>
            <div className={`text-lg font-bold ${experimentalBetter ? 'text-green-600 dark:text-green-400' : 'text-gray-900 dark:text-white'}`}>
              {experimentalValue !== null ? `${experimentalValue}${unit}` : '-'}
              {experimentalBetter && <span className="ml-1 text-xs">✓</span>}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <section id="statistics" className="scroll-mt-20">
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
        <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
          Statistical Significance
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
          Comparison of key metrics between Control and Experimental groups
        </p>

        {hasData ? (
          <>
            {/* Main Result Banner - Generations to Nash equilibrium */}
            <div className={`mb-6 p-6 rounded-xl ${
              convergenceIsSignificant
                ? 'bg-gradient-to-r from-green-500 to-emerald-500'
                : 'bg-gradient-to-r from-gray-400 to-gray-500'
            } text-white`}>
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-2xl font-bold mb-1">
                    {convergenceImprovement !== null && convergenceImprovement > 0
                      ? `${convergenceImprovement.toFixed(0)}% Faster Convergence`
                      : 'Analysis Results'
                    }
                  </h4>
                  <p className="text-white/90">
                    {convergenceIsSignificant && convergencePValue !== null
                      ? `Generations to Nash equilibrium: statistically significant (p = ${convergencePValue.toFixed(4)} < 0.05)`
                      : 'Results pending sufficient converged experiments for statistical significance'
                    }
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-4xl font-bold">
                    {convergencePValue !== null ? `p = ${convergencePValue.toFixed(3)}` : 'p = -'}
                  </div>
                  <div className="text-sm text-white/80">
                    {convergenceIsSignificant ? 'Significant' : 'Not Significant'}
                  </div>
                </div>
              </div>
            </div>

            {/* Confidence Level Indicator */}
            <div className={`mb-6 p-4 rounded-lg flex items-center justify-between ${confidence.bg}`}>
              <div className="flex items-center gap-3">
                <div className={`font-semibold ${confidence.color}`}>
                  {confidence.label}
                </div>
                <span className="text-gray-500 dark:text-gray-400 text-sm">
                  Based on {convergedN} control + {convergedM} experimental experiments that reached Nash equilibrium
                </span>
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                Power Level: {statisticalPowerLevel.charAt(0).toUpperCase() + statisticalPowerLevel.slice(1)}
              </div>
            </div>

            {/* Stats Grid */}
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              <StatCard
                label="Convergence Generation"
                controlValue={controlConvergenceGen}
                experimentalValue={experimentalConvergenceGen}
                comparison="lower-better"
                highlight={experimentalConvergenceGen !== null && controlConvergenceGen !== null && experimentalConvergenceGen < controlConvergenceGen}
              />
              <StatCard
                label="Final Average Elo (descriptive)"
                controlValue={controlFinalElo?.toFixed(2) ?? null}
                experimentalValue={experimentalFinalElo?.toFixed(2) ?? null}
                comparison="higher-better"
              />
              <StatCard
                label="Peak Elo Achieved (descriptive)"
                controlValue={controlPeakElo?.toFixed(2) ?? null}
                experimentalValue={experimentalPeakElo?.toFixed(2) ?? null}
                comparison="higher-better"
              />
              <StatCard
                label="Total Generations Run"
                controlValue={totalGenerationsControl}
                experimentalValue={totalGenerationsExperimental}
              />
            </div>

            {/* Welch's t-test: Generations to Nash equilibrium (hypothesis test) */}
            <div className="mt-4 p-4 rounded-lg bg-gray-50 dark:bg-gray-900/50">
              <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
                Welch&apos;s Two-Sample T-Test: Generations to Nash Equilibrium (experiment-level)
              </div>

              {(convergedN < 5 || convergedM < 5) && (
                <div className="mb-3 p-2 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded text-xs text-yellow-700 dark:text-yellow-400">
                  <strong>Sample size:</strong> n={convergedN} control and n={convergedM} experimental experiments reached Nash equilibrium. Aim for n≥5 per group for reliable significance testing.
                </div>
              )}

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mb-4">
                <div>
                  <div className="text-gray-500 dark:text-gray-400">t-Statistic</div>
                  <div className="font-mono font-bold text-gray-900 dark:text-white">
                    {convergenceTStatistic !== null ? convergenceTStatistic.toFixed(4) : '-'}
                  </div>
                </div>
                <div>
                  <div className="text-gray-500 dark:text-gray-400">Degrees of Freedom</div>
                  <div className="font-mono font-bold text-gray-900 dark:text-white">
                    {convergenceDegreesOfFreedom !== null ? convergenceDegreesOfFreedom.toFixed(2) : '-'}
                  </div>
                </div>
                <div>
                  <div className="text-gray-500 dark:text-gray-400">p-Value (two-tailed)</div>
                  <div className="font-mono font-bold text-gray-900 dark:text-white">
                    {convergencePValue !== null ? (convergencePValue < 0.0001 ? '< 0.0001' : convergencePValue.toFixed(4)) : '-'}
                  </div>
                </div>
                <div>
                  <div className="text-gray-500 dark:text-gray-400">Significance (α = 0.05)</div>
                  <div className={`font-bold ${convergenceIsSignificant ? 'text-green-600 dark:text-green-400' : 'text-gray-600 dark:text-gray-400'}`}>
                    {convergencePValue !== null ? (convergenceIsSignificant ? 'Reject H₀' : 'Fail to Reject H₀') : '-'}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm border-t border-gray-200 dark:border-gray-700 pt-4">
                <div>
                  <div className="text-gray-500 dark:text-gray-400">Cohen&apos;s d (Effect Size)</div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-gray-900 dark:text-white">
                      {convergenceCohensD !== null ? convergenceCohensD.toFixed(3) : '-'}
                    </span>
                    <span className={`text-xs font-medium ${effectSize.color}`}>
                      ({effectSize.label})
                    </span>
                  </div>
                </div>
                <div>
                  <div className="text-gray-500 dark:text-gray-400">Mean Difference (Ctrl − Exp) generations</div>
                  <div className="font-mono font-bold text-gray-900 dark:text-white">
                    {convergenceMeanDifference !== null ? (convergenceMeanDifference > 0 ? '+' : '') + convergenceMeanDifference.toFixed(0) : '-'}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">Positive = experimental faster</div>
                </div>
                <div>
                  <div className="text-gray-500 dark:text-gray-400">95% Confidence Interval</div>
                  <div className="font-mono font-bold text-gray-900 dark:text-white">
                    {convergenceConfidenceInterval
                      ? `[${convergenceConfidenceInterval.lower.toFixed(0)}, ${convergenceConfidenceInterval.upper.toFixed(0)}]`
                      : '-'}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm border-t border-gray-200 dark:border-gray-700 pt-4 mt-4">
                <div>
                  <div className="text-xs text-blue-600 dark:text-blue-400 font-medium mb-1">Control: mean generations to Nash (n={convergedN})</div>
                  <div className="text-gray-600 dark:text-gray-400">
                    Mean: <span className="font-mono font-bold text-gray-900 dark:text-white">{convergenceControlMean !== null ? convergenceControlMean.toFixed(0) : '-'}</span>
                    {' '}± <span className="font-mono">{convergenceControlStd !== null ? convergenceControlStd.toFixed(0) : '-'}</span>
                  </div>
                </div>
                <div>
                  <div className="text-xs text-purple-600 dark:text-purple-400 font-medium mb-1">Experimental: mean generations to Nash (n={convergedM})</div>
                  <div className="text-gray-600 dark:text-gray-400">
                    Mean: <span className="font-mono font-bold text-gray-900 dark:text-white">{convergenceExperimentalMean !== null ? convergenceExperimentalMean.toFixed(0) : '-'}</span>
                    {' '}± <span className="font-mono">{convergenceExperimentalStd !== null ? convergenceExperimentalStd.toFixed(0) : '-'}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Interpretation */}
            <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
              <h4 className="font-semibold text-blue-800 dark:text-blue-300 mb-2">
                Interpretation
              </h4>
              <p className="text-sm text-blue-700 dark:text-blue-400">
                {convergenceIsSignificant ? (
                  <>
                    The experimental group (Adaptive Mutation) reached Nash equilibrium in significantly fewer generations than the control group (p = {convergencePValue?.toFixed(4) ?? '—'}).
                    {convergenceImprovement !== null && convergenceImprovement > 0 && (
                      <> The adaptive strategy converged {convergenceImprovement.toFixed(0)}% faster, supporting the hypothesis that fitness-scaled mutation rates accelerate convergence to Nash equilibrium.</>
                    )}
                  </>
                ) : (
                  <>
                    More converged experiments are needed to determine statistical significance for generations to Nash equilibrium. Run additional experiments until enough reach Nash in both groups.
                  </>
                )}
              </p>
            </div>

            {/* Convergence Detection Methodology */}
            <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
              <h5 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">
                Nash Equilibrium Detection
              </h5>
              <div className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
                <p><strong>Metric:</strong> Entropy Variance (σ) — measures how similar all agents&apos; strategies are</p>
                <p><strong>Threshold:</strong> σ &lt; 0.01 (same for both groups for fair comparison)</p>
                <p><strong>Stability:</strong> 20+ consecutive generations below threshold required</p>
                <p><strong>Method:</strong> Population must first diverge (σ ≥ threshold), then converge. Prevents false positives from identical initial agents.</p>
              </div>
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center h-48 text-gray-500 dark:text-gray-400">
            <div className="text-center">
              <svg className="w-12 h-12 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              <p>No experiment data available.</p>
              <p className="text-sm mt-1">Run Control and Experimental experiments to see statistical analysis.</p>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
