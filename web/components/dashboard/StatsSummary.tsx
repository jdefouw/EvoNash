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
  pValue: number | null
  isSignificant: boolean
  totalGenerationsControl: number
  totalGenerationsExperimental: number
  // New fields for statistical power
  controlExperimentCount?: number
  experimentalExperimentCount?: number
  statisticalPowerLevel?: StatisticalPowerLevel
}

export default function StatsSummary({
  controlConvergenceGen,
  experimentalConvergenceGen,
  convergenceImprovement,
  controlFinalElo,
  experimentalFinalElo,
  controlPeakElo,
  experimentalPeakElo,
  pValue,
  isSignificant,
  totalGenerationsControl,
  totalGenerationsExperimental,
  controlExperimentCount = 0,
  experimentalExperimentCount = 0,
  statisticalPowerLevel = 'insufficient'
}: StatsSummaryProps) {
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
            {/* Main Result Banner */}
            <div className={`mb-6 p-6 rounded-xl ${
              isSignificant 
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
                    {isSignificant && pValue !== null
                      ? `Results are statistically significant (p = ${pValue.toFixed(4)} < 0.05)`
                      : 'Results pending sufficient data for statistical significance'
                    }
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-4xl font-bold">
                    {pValue !== null ? `p = ${pValue.toFixed(3)}` : 'p = -'}
                  </div>
                  <div className="text-sm text-white/80">
                    {isSignificant ? 'Significant' : 'Not Significant'}
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
                  Based on {controlExperimentCount} control + {experimentalExperimentCount} experimental experiments
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
                label="Final Average Elo"
                controlValue={controlFinalElo?.toFixed(2) ?? null}
                experimentalValue={experimentalFinalElo?.toFixed(2) ?? null}
                comparison="higher-better"
              />
              <StatCard
                label="Peak Elo Achieved"
                controlValue={controlPeakElo?.toFixed(2) ?? null}
                experimentalValue={experimentalPeakElo?.toFixed(2) ?? null}
                comparison="higher-better"
              />
              <StatCard
                label="Total Generations Run"
                controlValue={totalGenerationsControl}
                experimentalValue={totalGenerationsExperimental}
              />
              <div className="p-4 rounded-lg bg-gray-50 dark:bg-gray-900/50 md:col-span-2">
                <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
                  T-Test Details
                </div>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <div className="text-gray-500 dark:text-gray-400">p-Value</div>
                    <div className="font-mono font-bold text-gray-900 dark:text-white">
                      {pValue !== null ? pValue.toFixed(6) : '-'}
                    </div>
                  </div>
                  <div>
                    <div className="text-gray-500 dark:text-gray-400">Significance Level</div>
                    <div className="font-mono font-bold text-gray-900 dark:text-white">
                      α = 0.05
                    </div>
                  </div>
                  <div>
                    <div className="text-gray-500 dark:text-gray-400">Result</div>
                    <div className={`font-bold ${isSignificant ? 'text-green-600 dark:text-green-400' : 'text-gray-600 dark:text-gray-400'}`}>
                      {isSignificant ? 'Reject H₀' : 'Fail to Reject H₀'}
                    </div>
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
                {isSignificant ? (
                  <>
                    The experimental group (Adaptive Mutation) showed significantly better performance than the control group (Static Mutation). 
                    {convergenceImprovement !== null && convergenceImprovement > 0 && (
                      <> The adaptive strategy achieved Nash Equilibrium {convergenceImprovement.toFixed(0)}% faster, supporting the hypothesis that fitness-scaled mutation rates accelerate convergence.</>
                    )}
                  </>
                ) : (
                  <>
                    More data is needed to determine statistical significance. Continue running experiments to gather sufficient data points for analysis.
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
                <p><strong>Control Threshold:</strong> σ &lt; 0.01 (static mutation → homogeneous population)</p>
                <p><strong>Experimental Threshold:</strong> σ &lt; 0.025 (adaptive mutation → maintains diversity)</p>
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
