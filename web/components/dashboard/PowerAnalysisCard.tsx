'use client'

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
}

export default function PowerAnalysisCard({
  achievedPower,
  requiredFor80,
  requiredFor90,
  requiredFor95,
  currentControlN,
  currentExperimentalN,
  effectSize
}: PowerAnalysisCardProps) {
  const power = achievedPower?.power ?? null
  const powerPct = power !== null ? power * 100 : null

  // Power gauge color
  const getPowerColor = (p: number | null) => {
    if (p === null) return 'bg-gray-300 dark:bg-gray-600'
    if (p >= 0.80) return 'bg-green-500'
    if (p >= 0.60) return 'bg-yellow-500'
    if (p >= 0.40) return 'bg-orange-500'
    return 'bg-red-500'
  }

  const getPowerTextColor = (p: number | null) => {
    if (p === null) return 'text-gray-500'
    if (p >= 0.80) return 'text-green-600 dark:text-green-400'
    if (p >= 0.60) return 'text-yellow-600 dark:text-yellow-400'
    if (p >= 0.40) return 'text-orange-600 dark:text-orange-400'
    return 'text-red-600 dark:text-red-400'
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
      <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
        Statistical Power Analysis
      </h4>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
        Power = probability of detecting a real effect. Aim for ≥ 80%.
      </p>

      {/* Power Gauge */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Achieved Power</span>
          <span className={`text-2xl font-bold ${getPowerTextColor(power)}`}>
            {powerPct !== null ? `${powerPct.toFixed(1)}%` : 'N/A'}
          </span>
        </div>
        
        {/* Progress bar */}
        <div className="relative h-4 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          {/* Threshold markers */}
          <div className="absolute top-0 bottom-0 left-[40%] w-px bg-gray-400 dark:bg-gray-500 z-10" />
          <div className="absolute top-0 bottom-0 left-[60%] w-px bg-gray-400 dark:bg-gray-500 z-10" />
          <div className="absolute top-0 bottom-0 left-[80%] w-px bg-green-600 z-10" />
          
          {/* Fill */}
          <div 
            className={`h-full transition-all duration-500 ${getPowerColor(power)}`}
            style={{ width: `${Math.min(powerPct ?? 0, 100)}%` }}
          />
        </div>
        
        {/* Scale labels */}
        <div className="flex justify-between mt-1 text-[10px] text-gray-500">
          <span>0%</span>
          <span>40%</span>
          <span>60%</span>
          <span className="text-green-600 font-medium">80%</span>
          <span>100%</span>
        </div>
      </div>

      {/* Status Badge */}
      {achievedPower && (
        <div className={`p-3 rounded-lg mb-4 ${
          achievedPower.isAdequate 
            ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
            : 'bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800'
        }`}>
          <div className={`text-sm font-medium ${
            achievedPower.isAdequate 
              ? 'text-green-700 dark:text-green-400'
              : 'text-yellow-700 dark:text-yellow-400'
          }`}>
            {achievedPower.isAdequate ? '✓ ' : '⚠ '}{achievedPower.interpretation}
          </div>
          <div className={`text-xs mt-1 ${
            achievedPower.isAdequate 
              ? 'text-green-600 dark:text-green-500'
              : 'text-yellow-600 dark:text-yellow-500'
          }`}>
            {achievedPower.recommendation}
          </div>
        </div>
      )}

      {/* Current Sample Sizes */}
      <div className="mb-4">
        <h5 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Current Sample Sizes</h5>
        <div className="grid grid-cols-2 gap-3">
          <div className="p-2 bg-gray-50 dark:bg-gray-900/50 rounded">
            <div className="text-xs text-blue-600 dark:text-blue-400">Control</div>
            <div className="text-lg font-bold text-gray-900 dark:text-white">n = {currentControlN}</div>
          </div>
          <div className="p-2 bg-gray-50 dark:bg-gray-900/50 rounded">
            <div className="text-xs text-purple-600 dark:text-purple-400">Experimental</div>
            <div className="text-lg font-bold text-gray-900 dark:text-white">n = {currentExperimentalN}</div>
          </div>
        </div>
        {effectSize !== null && (
          <div className="text-xs text-gray-500 mt-2">
            Based on effect size d = {effectSize.toFixed(3)}
          </div>
        )}
      </div>

      {/* Required Sample Sizes */}
      <div>
        <h5 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Required Sample Sizes</h5>
        <div className="space-y-2">
          {/* 80% Power */}
          <div className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-900/50 rounded">
            <span className="text-xs text-gray-600 dark:text-gray-400">For 80% power:</span>
            <span className="text-sm font-medium text-gray-900 dark:text-white">
              {requiredFor80?.nPerGroup !== null 
                ? `n = ${requiredFor80.nPerGroup} per group`
                : 'Cannot calculate'}
            </span>
          </div>
          
          {/* 90% Power */}
          <div className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-900/50 rounded">
            <span className="text-xs text-gray-600 dark:text-gray-400">For 90% power:</span>
            <span className="text-sm font-medium text-gray-900 dark:text-white">
              {requiredFor90?.nPerGroup !== null 
                ? `n = ${requiredFor90.nPerGroup} per group`
                : 'Cannot calculate'}
            </span>
          </div>
          
          {/* 95% Power */}
          <div className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-900/50 rounded">
            <span className="text-xs text-gray-600 dark:text-gray-400">For 95% power:</span>
            <span className="text-sm font-medium text-gray-900 dark:text-white">
              {requiredFor95?.nPerGroup !== null 
                ? `n = ${requiredFor95.nPerGroup} per group`
                : 'Cannot calculate'}
            </span>
          </div>
        </div>
        
        {/* Progress towards goal */}
        {requiredFor80?.nPerGroup !== null && (
          <div className="mt-3">
            <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">
              Progress to 80% power goal:
            </div>
            <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div 
                className="h-full bg-blue-500 transition-all"
                style={{ 
                  width: `${Math.min(
                    (Math.min(currentControlN, currentExperimentalN) / requiredFor80.nPerGroup) * 100, 
                    100
                  )}%` 
                }}
              />
            </div>
            <div className="text-xs text-gray-500 mt-1">
              {Math.min(currentControlN, currentExperimentalN)} / {requiredFor80.nPerGroup} experiments
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
