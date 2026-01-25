'use client'

interface BackgroundConcept {
  term: string
  definition: string
}

interface ProblemStatementProps {
  problemStatement: string
  backgroundConcepts: BackgroundConcept[]
}

export default function ProblemStatement({
  problemStatement,
  backgroundConcepts
}: ProblemStatementProps) {
  return (
    <section id="problem" className="scroll-mt-20">
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-8">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          2. Problem Statement
        </h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
          Introduction and background research
        </p>

        {/* Problem Statement */}
        <div className="bg-red-50 dark:bg-red-900/10 rounded-lg p-6 mb-6 border-l-4 border-red-500">
          <h3 className="font-semibold text-red-800 dark:text-red-300 mb-2 flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            The Challenge
          </h3>
          <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
            {problemStatement}
          </p>
        </div>

        {/* Background Concepts */}
        <h3 className="font-semibold text-gray-900 dark:text-white mb-4">
          Background Knowledge
        </h3>
        <div className="grid md:grid-cols-3 gap-4">
          {backgroundConcepts.map((concept, idx) => (
            <div 
              key={idx} 
              className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4 border border-gray-200 dark:border-gray-700"
            >
              <h4 className="font-medium text-gray-900 dark:text-white mb-2 text-sm">
                {concept.term}
              </h4>
              <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
                {concept.definition}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
