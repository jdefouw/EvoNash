'use client'

interface NormalityTestResult {
  statistic: number | null  // JB statistic for Jarque-Bera test
  pValue: number | null
  isNormal: boolean | null
  interpretation: string
  sampleSize: number
  testName: string
}

interface LeveneTestResult {
  statistic: number | null
  pValue: number | null
  equalVariances: boolean | null
  interpretation: string
  sampleSizes: { control: number; experimental: number }
}

interface OutlierResult {
  outlierCount: number
  outlierIndices: number[]
  outlierValues: number[]
  lowerBound: number | null
  upperBound: number | null
  Q1: number | null
  Q3: number | null
  IQR: number | null
  outlierPercentage: number
}

interface AssumptionChecksCardProps {
  normalityControl: NormalityTestResult | null
  normalityExperimental: NormalityTestResult | null
  varianceEquality: LeveneTestResult | null
  outlierControl: OutlierResult | null
  outlierExperimental: OutlierResult | null
  bothNormal: boolean
  anyOutliers: boolean
  recommendation: 'parametric' | 'parametric_with_caution' | 'non_parametric'
  recommendationText: string
}

export default function AssumptionChecksCard({
  normalityControl,
  normalityExperimental,
  varianceEquality,
  outlierControl,
  outlierExperimental,
  bothNormal,
  anyOutliers,
  recommendation,
  recommendationText
}: AssumptionChecksCardProps) {
  const getStatusIcon = (passed: boolean | null) => {
    if (passed === null) return <span className="text-gray-400">?</span>
    return passed 
      ? <span className="text-green-500">✓</span>
      : <span className="text-red-500">✗</span>
  }

  const getRecommendationStyle = () => {
    switch (recommendation) {
      case 'parametric':
        return 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-700 dark:text-green-400'
      case 'parametric_with_caution':
        return 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800 text-yellow-700 dark:text-yellow-400'
      case 'non_parametric':
        return 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800 text-orange-700 dark:text-orange-400'
    }
  }

  const getRecommendationIcon = () => {
    switch (recommendation) {
      case 'parametric':
        return '✓'
      case 'parametric_with_caution':
        return '⚠'
      case 'non_parametric':
        return '→'
    }
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
      <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
        Assumption Checks
      </h4>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
        Verifying statistical test assumptions for scientific rigor
      </p>

      {/* Recommendation Banner */}
      <div className={`p-3 rounded-lg border mb-4 ${getRecommendationStyle()}`}>
        <div className="flex items-start gap-2">
          <span className="text-lg">{getRecommendationIcon()}</span>
          <div>
            <div className="font-semibold text-sm">
              {recommendation === 'parametric' && 'Parametric Tests Recommended'}
              {recommendation === 'parametric_with_caution' && 'Parametric Tests (With Caution)'}
              {recommendation === 'non_parametric' && 'Non-Parametric Tests Recommended'}
            </div>
            <div className="text-xs mt-1 opacity-90">{recommendationText}</div>
          </div>
        </div>
      </div>

      {/* Normality Tests */}
      <div className="mb-4">
        <h5 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Normality Tests (Jarque-Bera)
        </h5>
        <div className="grid grid-cols-2 gap-3">
          {/* Control */}
          <div className="p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-blue-600 dark:text-blue-400">Control</span>
              {getStatusIcon(normalityControl?.isNormal ?? null)}
            </div>
            {normalityControl ? (
              <>
                <div className="text-xs text-gray-600 dark:text-gray-400">
                  JB = {normalityControl.statistic?.toFixed(4) ?? 'N/A'}
                </div>
                <div className="text-xs text-gray-600 dark:text-gray-400">
                  p = {normalityControl.pValue !== null 
                    ? (normalityControl.pValue < 0.0001 ? '< 0.0001' : normalityControl.pValue.toFixed(4))
                    : 'N/A'}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                  {normalityControl.interpretation}
                </div>
              </>
            ) : (
              <div className="text-xs text-gray-500">No data</div>
            )}
          </div>

          {/* Experimental */}
          <div className="p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-purple-600 dark:text-purple-400">Experimental</span>
              {getStatusIcon(normalityExperimental?.isNormal ?? null)}
            </div>
            {normalityExperimental ? (
              <>
                <div className="text-xs text-gray-600 dark:text-gray-400">
                  JB = {normalityExperimental.statistic?.toFixed(4) ?? 'N/A'}
                </div>
                <div className="text-xs text-gray-600 dark:text-gray-400">
                  p = {normalityExperimental.pValue !== null 
                    ? (normalityExperimental.pValue < 0.0001 ? '< 0.0001' : normalityExperimental.pValue.toFixed(4))
                    : 'N/A'}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                  {normalityExperimental.interpretation}
                </div>
              </>
            ) : (
              <div className="text-xs text-gray-500">No data</div>
            )}
          </div>
        </div>
        <div className="text-xs text-gray-500 dark:text-gray-500 mt-2">
          H₀: Data is normally distributed (skewness=0, excess kurtosis=0). Reject if p &lt; 0.05
        </div>
      </div>

      {/* Variance Equality Test (Levene's Test) */}
      <div className="mb-4">
        <h5 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Variance Equality (Levene&apos;s Test)
        </h5>
        <div className="p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-gray-600 dark:text-gray-400">Homoscedasticity</span>
            {getStatusIcon(varianceEquality?.equalVariances ?? null)}
          </div>
          {varianceEquality ? (
            <>
              <div className="text-xs text-gray-600 dark:text-gray-400">
                W = {varianceEquality.statistic?.toFixed(4) ?? 'N/A'}
              </div>
              <div className="text-xs text-gray-600 dark:text-gray-400">
                p = {varianceEquality.pValue !== null 
                  ? (varianceEquality.pValue < 0.0001 ? '< 0.0001' : varianceEquality.pValue.toFixed(4))
                  : 'N/A'}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                {varianceEquality.interpretation}
              </div>
            </>
          ) : (
            <div className="text-xs text-gray-500">No data</div>
          )}
        </div>
        <div className="text-xs text-gray-500 dark:text-gray-500 mt-2">
          H₀: Groups have equal variances. Uses Brown-Forsythe variant (median-based). Note: Welch&apos;s t-test is robust to unequal variances.
        </div>
      </div>

      {/* Outlier Detection */}
      <div>
        <h5 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Outlier Detection (IQR Method)
        </h5>
        <div className="grid grid-cols-2 gap-3">
          {/* Control */}
          <div className="p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-blue-600 dark:text-blue-400">Control</span>
              {getStatusIcon(outlierControl ? outlierControl.outlierCount === 0 : null)}
            </div>
            {outlierControl ? (
              <>
                <div className="text-xs text-gray-600 dark:text-gray-400">
                  Outliers: {outlierControl.outlierCount} ({outlierControl.outlierPercentage.toFixed(1)}%)
                </div>
                {outlierControl.IQR !== null && (
                  <div className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                    IQR: {outlierControl.IQR.toFixed(2)}
                  </div>
                )}
                {outlierControl.outlierCount > 0 && (
                  <div className="text-xs text-orange-600 dark:text-orange-400 mt-1">
                    Values: {outlierControl.outlierValues.map(v => v.toFixed(1)).join(', ')}
                  </div>
                )}
              </>
            ) : (
              <div className="text-xs text-gray-500">No data</div>
            )}
          </div>

          {/* Experimental */}
          <div className="p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-purple-600 dark:text-purple-400">Experimental</span>
              {getStatusIcon(outlierExperimental ? outlierExperimental.outlierCount === 0 : null)}
            </div>
            {outlierExperimental ? (
              <>
                <div className="text-xs text-gray-600 dark:text-gray-400">
                  Outliers: {outlierExperimental.outlierCount} ({outlierExperimental.outlierPercentage.toFixed(1)}%)
                </div>
                {outlierExperimental.IQR !== null && (
                  <div className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                    IQR: {outlierExperimental.IQR.toFixed(2)}
                  </div>
                )}
                {outlierExperimental.outlierCount > 0 && (
                  <div className="text-xs text-orange-600 dark:text-orange-400 mt-1">
                    Values: {outlierExperimental.outlierValues.map(v => v.toFixed(1)).join(', ')}
                  </div>
                )}
              </>
            ) : (
              <div className="text-xs text-gray-500">No data</div>
            )}
          </div>
        </div>
        <div className="text-xs text-gray-500 dark:text-gray-500 mt-2">
          Outliers defined as values outside Q1 - 1.5×IQR to Q3 + 1.5×IQR
        </div>
      </div>

      {/* Summary */}
      <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-4 text-xs flex-wrap">
          <div className="flex items-center gap-1">
            {getStatusIcon(bothNormal)}
            <span className="text-gray-600 dark:text-gray-400">Both groups normal</span>
          </div>
          <div className="flex items-center gap-1">
            {getStatusIcon(varianceEquality?.equalVariances ?? null)}
            <span className="text-gray-600 dark:text-gray-400">Equal variances</span>
          </div>
          <div className="flex items-center gap-1">
            {getStatusIcon(!anyOutliers)}
            <span className="text-gray-600 dark:text-gray-400">No outliers</span>
          </div>
        </div>
      </div>
    </div>
  )
}
