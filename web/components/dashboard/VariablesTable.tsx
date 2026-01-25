'use client'

interface Variable {
  name: string
  description: string
  value?: string | number
}

interface VariablesTableProps {
  independent: Variable[]
  dependent: Variable[]
  controlled: Variable[]
}

export default function VariablesTable({
  independent,
  dependent,
  controlled
}: VariablesTableProps) {
  return (
    <section id="variables" className="scroll-mt-20">
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-8">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          4. Variables
        </h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
          The experimental design controls all factors except the independent variable
        </p>

        <div className="grid md:grid-cols-3 gap-6">
          {/* Independent Variable */}
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-5 border border-blue-200 dark:border-blue-800">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center">
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                </svg>
              </div>
              <h3 className="font-bold text-blue-700 dark:text-blue-400">
                Independent Variable
              </h3>
            </div>
            <p className="text-xs text-blue-600 dark:text-blue-300 mb-3">
              The factor that is intentionally changed
            </p>
            <div className="space-y-3">
              {independent.map((variable, idx) => (
                <div key={idx} className="bg-white dark:bg-gray-800 rounded p-3">
                  <div className="font-medium text-gray-900 dark:text-white text-sm">
                    {variable.name}
                  </div>
                  <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                    {variable.description}
                  </div>
                  {variable.value && (
                    <div className="mt-2 text-xs font-mono bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2 py-1 rounded inline-block">
                      {variable.value}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Dependent Variables */}
          <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-5 border border-purple-200 dark:border-purple-800">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-full bg-purple-500 flex items-center justify-center">
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <h3 className="font-bold text-purple-700 dark:text-purple-400">
                Dependent Variables
              </h3>
            </div>
            <p className="text-xs text-purple-600 dark:text-purple-300 mb-3">
              The outcomes being measured
            </p>
            <div className="space-y-3">
              {dependent.map((variable, idx) => (
                <div key={idx} className="bg-white dark:bg-gray-800 rounded p-3">
                  <div className="font-medium text-gray-900 dark:text-white text-sm">
                    {variable.name}
                  </div>
                  <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                    {variable.description}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Controlled Variables */}
          <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-5 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-full bg-gray-500 flex items-center justify-center">
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <h3 className="font-bold text-gray-700 dark:text-gray-300">
                Controlled Variables
              </h3>
            </div>
            <p className="text-xs text-gray-600 dark:text-gray-400 mb-3">
              Factors kept constant to ensure validity
            </p>
            <div className="space-y-2">
              {controlled.map((variable, idx) => (
                <div key={idx} className="bg-white dark:bg-gray-800 rounded p-3">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-gray-900 dark:text-white text-sm">
                      {variable.name}
                    </span>
                    {variable.value && (
                      <span className="text-xs font-mono bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-2 py-0.5 rounded">
                        {variable.value}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {variable.description}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
