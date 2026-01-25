'use client'

interface HypothesisCardProps {
  ifStatement: string
  thenStatement: string
  becauseStatement: string
  isSupported: boolean | null // null means no data yet
  supportingEvidence?: string
}

export default function HypothesisCard({
  ifStatement,
  thenStatement,
  becauseStatement,
  isSupported,
  supportingEvidence
}: HypothesisCardProps) {
  return (
    <section id="hypothesis" className="scroll-mt-20">
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              3. Hypothesis
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              The testable prediction guiding this research
            </p>
          </div>
          {isSupported !== null && (
            <div className={`flex items-center gap-2 px-4 py-2 rounded-full ${
              isSupported 
                ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' 
                : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
            }`}>
              <span className="text-xl">{isSupported ? '✓' : '✗'}</span>
              <span className="font-medium">
                {isSupported ? 'Hypothesis Supported' : 'Hypothesis Not Supported'}
              </span>
            </div>
          )}
        </div>

        <div className="space-y-4">
          {/* IF Statement */}
          <div className="flex gap-4">
            <div className="flex-shrink-0 w-20">
              <span className="inline-block px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-full text-sm font-bold">
                IF
              </span>
            </div>
            <p className="text-gray-700 dark:text-gray-300 leading-relaxed flex-1">
              {ifStatement}
            </p>
          </div>

          {/* THEN Statement */}
          <div className="flex gap-4">
            <div className="flex-shrink-0 w-20">
              <span className="inline-block px-3 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 rounded-full text-sm font-bold">
                THEN
              </span>
            </div>
            <p className="text-gray-700 dark:text-gray-300 leading-relaxed flex-1">
              {thenStatement}
            </p>
          </div>

          {/* BECAUSE Statement */}
          <div className="flex gap-4">
            <div className="flex-shrink-0 w-20">
              <span className="inline-block px-3 py-1 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded-full text-sm font-bold">
                BECAUSE
              </span>
            </div>
            <p className="text-gray-700 dark:text-gray-300 leading-relaxed flex-1">
              {becauseStatement}
            </p>
          </div>
        </div>

        {/* Supporting Evidence */}
        {supportingEvidence && isSupported !== null && (
          <div className={`mt-6 p-4 rounded-lg ${
            isSupported 
              ? 'bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800' 
              : 'bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800'
          }`}>
            <h4 className={`text-sm font-semibold mb-2 ${
              isSupported ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'
            }`}>
              Evidence from Data:
            </h4>
            <p className={`text-sm ${
              isSupported ? 'text-green-600 dark:text-green-300' : 'text-red-600 dark:text-red-300'
            }`}>
              {supportingEvidence}
            </p>
          </div>
        )}
      </div>
    </section>
  )
}
