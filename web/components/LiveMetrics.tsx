'use client'

import { Generation } from '@/types/protocol'

interface LiveMetricsProps {
  generation: Generation | null
}

export default function LiveMetrics({ generation }: LiveMetricsProps) {
  if (!generation) {
    return (
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700">
        <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">Live Metrics</h2>
        <p className="text-gray-600 dark:text-gray-400">No data available yet</p>
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700">
      <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">Live Metrics</h2>
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <span className="text-gray-600 dark:text-gray-400">Avg Elo:</span>
          <span className="ml-2 font-medium text-gray-900 dark:text-white">
            {generation.avg_elo?.toFixed(2) || 'N/A'}
          </span>
        </div>
        <div>
          <span className="text-gray-600 dark:text-gray-400">Peak Elo:</span>
          <span className="ml-2 font-medium text-gray-900 dark:text-white">
            {generation.peak_elo?.toFixed(2) || 'N/A'}
          </span>
        </div>
        <div>
          <span className="text-gray-600 dark:text-gray-400">Entropy:</span>
          <span className="ml-2 font-medium text-gray-900 dark:text-white">
            {generation.policy_entropy?.toFixed(4) || 'N/A'}
          </span>
        </div>
        <div>
          <span className="text-gray-600 dark:text-gray-400">Generation:</span>
          <span className="ml-2 font-medium text-gray-900 dark:text-white">
            {generation.generation_number}
          </span>
        </div>
      </div>
    </div>
  )
}
