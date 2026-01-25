'use client'

interface ConclusionCardProps {
  summary: string
  hypothesisSupported: boolean | null
  keyFindings: string[]
  implications: string
  sourcesOfError?: string[]
  futureWork?: string
}

export default function ConclusionCard({
  summary,
  hypothesisSupported,
  keyFindings,
  implications,
  sourcesOfError,
  futureWork
}: ConclusionCardProps) {
  return (
    <section id="conclusion" className="scroll-mt-20">
      <div className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-xl border border-green-200 dark:border-green-800 p-8">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          8. Conclusion
        </h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
          Summary of findings and their significance
        </p>

        {/* Hypothesis Result Banner */}
        {hypothesisSupported !== null && (
          <div className={`mb-6 p-4 rounded-lg flex items-center gap-3 ${
            hypothesisSupported 
              ? 'bg-green-100 dark:bg-green-900/30 border border-green-300 dark:border-green-700' 
              : 'bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700'
          }`}>
            <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
              hypothesisSupported ? 'bg-green-500' : 'bg-red-500'
            }`}>
              <span className="text-white text-2xl">
                {hypothesisSupported ? '✓' : '✗'}
              </span>
            </div>
            <div>
              <h3 className={`font-bold ${
                hypothesisSupported ? 'text-green-800 dark:text-green-300' : 'text-red-800 dark:text-red-300'
              }`}>
                Hypothesis {hypothesisSupported ? 'Supported' : 'Not Supported'}
              </h3>
              <p className={`text-sm ${
                hypothesisSupported ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'
              }`}>
                The experimental data {hypothesisSupported ? 'supports' : 'does not support'} the original hypothesis
              </p>
            </div>
          </div>
        )}

        {/* Summary */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 mb-6">
          <h4 className="font-semibold text-gray-900 dark:text-white mb-3">Summary</h4>
          <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
            {summary}
          </p>
        </div>

        {/* Key Findings */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 mb-6">
          <h4 className="font-semibold text-gray-900 dark:text-white mb-3">Key Findings</h4>
          <ul className="space-y-2">
            {keyFindings.map((finding, idx) => (
              <li key={idx} className="flex items-start gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 flex items-center justify-center text-sm font-bold">
                  {idx + 1}
                </span>
                <span className="text-gray-700 dark:text-gray-300">{finding}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Implications */}
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6">
            <h4 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
              <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
              Implications
            </h4>
            <p className="text-gray-700 dark:text-gray-300 text-sm">
              {implications}
            </p>
          </div>

          {/* Sources of Error */}
          {sourcesOfError && sourcesOfError.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6">
              <h4 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                <svg className="w-5 h-5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                Sources of Error
              </h4>
              <ul className="space-y-1">
                {sourcesOfError.map((error, idx) => (
                  <li key={idx} className="text-gray-700 dark:text-gray-300 text-sm flex items-start gap-2">
                    <span className="w-1.5 h-1.5 bg-amber-500 rounded-full mt-2 flex-shrink-0" />
                    {error}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Future Work */}
        {futureWork && (
          <div className="mt-6 bg-white dark:bg-gray-800 rounded-lg p-6">
            <h4 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
              <svg className="w-5 h-5 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
              Future Work
            </h4>
            <p className="text-gray-700 dark:text-gray-300 text-sm">
              {futureWork}
            </p>
          </div>
        )}
      </div>
    </section>
  )
}
