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
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Live Metrics</h2>
        {generation && (
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span className="text-xs text-gray-600 dark:text-gray-400">Live</span>
          </div>
        )}
      </div>
      {generation ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gray-50 dark:bg-gray-900 p-3 rounded-lg">
              <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">Avg Elo</div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {generation.avg_elo?.toFixed(2) || 'N/A'}
              </div>
            </div>
            <div className="bg-gray-50 dark:bg-gray-900 p-3 rounded-lg">
              <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">Peak Elo</div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {generation.peak_elo?.toFixed(2) || 'N/A'}
              </div>
            </div>
            <div className="bg-gray-50 dark:bg-gray-900 p-3 rounded-lg">
              <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">Policy Entropy</div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {generation.policy_entropy?.toFixed(4) || 'N/A'}
              </div>
            </div>
            <div className="bg-gray-50 dark:bg-gray-900 p-3 rounded-lg">
              <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">Generation</div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {generation.generation_number}
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 text-sm pt-2 border-t border-gray-200 dark:border-gray-700">
            <div>
              <span className="text-gray-600 dark:text-gray-400">Entropy Variance:</span>
              <span className="ml-2 font-medium text-gray-900 dark:text-white">
                {generation.entropy_variance?.toFixed(6) || 'N/A'}
              </span>
            </div>
            <div>
              <span className="text-gray-600 dark:text-gray-400">Diversity:</span>
              <span className="ml-2 font-medium text-gray-900 dark:text-white">
                {generation.population_diversity?.toFixed(4) || 'N/A'}
              </span>
            </div>
            <div>
              <span className="text-gray-600 dark:text-gray-400">Min Elo:</span>
              <span className="ml-2 font-medium text-gray-900 dark:text-white">
                {generation.min_elo?.toFixed(2) || 'N/A'}
              </span>
            </div>
            <div>
              <span className="text-gray-600 dark:text-gray-400">Avg Fitness:</span>
              <span className="ml-2 font-medium text-gray-900 dark:text-white">
                {generation.avg_fitness?.toFixed(2) || 'N/A'}
              </span>
            </div>
          </div>
        </div>
      ) : (
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
          <p>Waiting for generation data...</p>
        </div>
      )}
    </div>
  )
}
