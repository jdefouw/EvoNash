'use client'

type StatisticalPowerLevel = 'insufficient' | 'minimum' | 'recommended' | 'robust'

interface Statistics {
  controlConvergenceGen: number | null
  experimentalConvergenceGen: number | null
  convergenceImprovement: number | null
  controlFinalElo: number | null
  experimentalFinalElo: number | null
  controlPeakElo: number | null
  experimentalPeakElo: number | null
  pValue: number | null
  tStatistic: number | null
  isSignificant: boolean
  totalGenerationsControl: number
  totalGenerationsExperimental: number
  controlExperimentCount: number
  experimentalExperimentCount: number
  controlAvgGenerations: number
  experimentalAvgGenerations: number
  statisticalPowerLevel: StatisticalPowerLevel
}

interface ScientificAbstractProps {
  title: string
  subtitle: string
  studentName: string
  division: string
  category: string
  abstract: string
  statistics?: Statistics | null
}

export default function ScientificAbstract({
  title,
  subtitle,
  studentName,
  division,
  category,
  abstract,
  statistics
}: ScientificAbstractProps) {
  // Highlight key terms in the abstract - using dynamic data-aware highlighting
  let highlightedAbstract = abstract
    .replace(/Adaptive Mutation Strategy/g, '<strong class="text-purple-600 dark:text-purple-400">Adaptive Mutation Strategy</strong>')
    .replace(/Nash Equilibrium/g, '<strong class="text-blue-600 dark:text-blue-400">Nash Equilibrium</strong>')
  
  // Only highlight percentages and p-values if they represent actual calculated values
  // Match percentage patterns (e.g., "40%", "35%") and highlight in green if significant
  if (statistics?.convergenceImprovement != null && statistics.convergenceImprovement > 0) {
    highlightedAbstract = highlightedAbstract.replace(
      /(\d+)% faster/g, 
      '<strong class="text-green-600 dark:text-green-400">$1% faster</strong>'
    )
  }
  
  // Highlight p-values that appear in the text (these are dynamically generated from actual data)
  if (statistics?.pValue !== null) {
    highlightedAbstract = highlightedAbstract.replace(
      /p = ([\d.]+)/g,
      statistics.isSignificant 
        ? '<strong class="text-green-600 dark:text-green-400">p = $1</strong>'
        : '<span class="text-amber-600 dark:text-amber-400">p = $1</span>'
    )
  }
  
  // Highlight "statistically significant" only if data actually is significant
  if (statistics?.isSignificant) {
    highlightedAbstract = highlightedAbstract.replace(
      /statistically significant/g, 
      '<strong class="text-green-600 dark:text-green-400">statistically significant</strong>'
    )
  }
  
  // Highlight "did not reach statistical significance" as a neutral/warning indicator
  highlightedAbstract = highlightedAbstract.replace(
    /did not reach statistical significance/g,
    '<span class="text-amber-600 dark:text-amber-400">did not reach statistical significance</span>'
  )

  return (
    <section id="abstract" className="scroll-mt-20">
      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-xl border border-blue-200 dark:border-blue-800 p-8">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              1. Abstract
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              150-word summary of the research
            </p>
          </div>
          <div className="text-right text-sm">
            <div className="text-gray-600 dark:text-gray-400">
              <span className="font-medium text-gray-900 dark:text-white">{studentName}</span>
            </div>
            <div className="text-gray-500 dark:text-gray-500">
              {division} | {category}
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
            {title}
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 italic mb-4">
            {subtitle}
          </p>
          <p 
            className="text-gray-700 dark:text-gray-300 leading-relaxed"
            dangerouslySetInnerHTML={{ __html: highlightedAbstract }}
          />
        </div>
      </div>
    </section>
  )
}
