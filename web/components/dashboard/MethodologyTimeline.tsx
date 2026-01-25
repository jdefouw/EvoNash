'use client'

interface MethodologyStep {
  phase: string
  title: string
  description: string
  details?: string[]
  status?: 'completed' | 'in_progress' | 'pending'
}

interface MethodologyTimelineProps {
  steps: MethodologyStep[]
  materialsAndApparatus?: {
    hardware: string[]
    software: string[]
  }
}

export default function MethodologyTimeline({
  steps,
  materialsAndApparatus
}: MethodologyTimelineProps) {
  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-500'
      case 'in_progress':
        return 'bg-blue-500 animate-pulse'
      case 'pending':
        return 'bg-gray-300 dark:bg-gray-600'
      default:
        return 'bg-green-500'
    }
  }

  return (
    <section id="methodology" className="scroll-mt-20">
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-8">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          5. Methodology
        </h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
          Controlled comparative experiment design
        </p>

        {/* Materials & Apparatus */}
        {materialsAndApparatus && (
          <div className="grid md:grid-cols-2 gap-4 mb-8">
            <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4">
              <h4 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                <svg className="w-5 h-5 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
                </svg>
                Hardware
              </h4>
              <ul className="space-y-1">
                {materialsAndApparatus.hardware.map((item, idx) => (
                  <li key={idx} className="text-sm text-gray-600 dark:text-gray-400 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4">
              <h4 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                <svg className="w-5 h-5 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                </svg>
                Software Stack
              </h4>
              <ul className="space-y-1">
                {materialsAndApparatus.software.map((item, idx) => (
                  <li key={idx} className="text-sm text-gray-600 dark:text-gray-400 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* Procedure Timeline */}
        <h4 className="font-semibold text-gray-900 dark:text-white mb-4">Procedure</h4>
        <div className="relative">
          {/* Timeline line */}
          <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200 dark:bg-gray-700" />

          <div className="space-y-6">
            {steps.map((step, idx) => (
              <div key={idx} className="relative pl-12">
                {/* Timeline dot */}
                <div className={`absolute left-2.5 w-3 h-3 rounded-full ${getStatusColor(step.status)} ring-4 ring-white dark:ring-gray-800`} />
                
                <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">
                      {step.phase}
                    </span>
                    <span className="text-xs text-gray-400 dark:text-gray-500">|</span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      Step {idx + 1}
                    </span>
                  </div>
                  <h5 className="font-semibold text-gray-900 dark:text-white mb-1">
                    {step.title}
                  </h5>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {step.description}
                  </p>
                  {step.details && step.details.length > 0 && (
                    <ul className="mt-2 space-y-1">
                      {step.details.map((detail, detailIdx) => (
                        <li key={detailIdx} className="text-xs text-gray-500 dark:text-gray-400 flex items-start gap-2">
                          <span className="mt-1.5 w-1 h-1 bg-gray-400 rounded-full flex-shrink-0" />
                          {detail}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
