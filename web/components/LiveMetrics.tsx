'use client'

import { Generation } from '@/types/protocol'
import Tooltip from './Tooltip'

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
              <Tooltip content="Population average Elo rating - the mean skill level across all agents">
                <div className="text-2xl font-bold text-gray-900 dark:text-white cursor-help">
                  {generation.avg_elo?.toFixed(2) || 'N/A'}
                </div>
              </Tooltip>
            </div>
            <div className="bg-gray-50 dark:bg-gray-900 p-3 rounded-lg">
              <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">Peak Elo</div>
              <Tooltip content="Highest individual agent Elo rating - the best performing agent in the population">
                <div className="text-2xl font-bold text-gray-900 dark:text-white cursor-help">
                  {generation.peak_elo?.toFixed(2) || 'N/A'}
                </div>
              </Tooltip>
            </div>
            <div className="bg-gray-50 dark:bg-gray-900 p-3 rounded-lg">
              <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">Policy Entropy</div>
              <Tooltip content="Average action distribution entropy - measures randomness of AI moves (higher = more exploration)">
                <div className="text-2xl font-bold text-gray-900 dark:text-white cursor-help">
                  {generation.policy_entropy?.toFixed(4) || 'N/A'}
                </div>
              </Tooltip>
            </div>
            <div className="bg-gray-50 dark:bg-gray-900 p-3 rounded-lg">
              <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">Generation</div>
              <Tooltip content="Current generation number in the evolutionary process">
                <div className="text-2xl font-bold text-gray-900 dark:text-white cursor-help">
                  {generation.generation_number}
                </div>
              </Tooltip>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 text-sm pt-2 border-t border-gray-200 dark:border-gray-700">
            <div>
              <span className="text-gray-600 dark:text-gray-400">Entropy Variance:</span>
              <Tooltip content="Spread of entropy values across population - lower values indicate convergence to Nash Equilibrium">
                <span className="ml-2 font-medium text-gray-900 dark:text-white cursor-help">
                  {generation.entropy_variance?.toFixed(6) || 'N/A'}
                </span>
              </Tooltip>
            </div>
            <div>
              <span className="text-gray-600 dark:text-gray-400">Diversity:</span>
              <Tooltip content="Average Euclidean distance between agent weight vectors - measures genetic diversity in the population">
                <span className="ml-2 font-medium text-gray-900 dark:text-white cursor-help">
                  {generation.population_diversity?.toFixed(4) || 'N/A'}
                </span>
              </Tooltip>
            </div>
            <div>
              <span className="text-gray-600 dark:text-gray-400">Min Elo:</span>
              <Tooltip content="Lowest Elo rating in population - the worst performing agent">
                <span className="ml-2 font-medium text-gray-900 dark:text-white cursor-help">
                  {generation.min_elo?.toFixed(2) || 'N/A'}
                </span>
              </Tooltip>
            </div>
            <div>
              <span className="text-gray-600 dark:text-gray-400">Avg Fitness:</span>
              <Tooltip content="Average fitness score combining energy and survival time - measures overall agent performance">
                <span className="ml-2 font-medium text-gray-900 dark:text-white cursor-help">
                  {generation.avg_fitness?.toFixed(2) || 'N/A'}
                </span>
              </Tooltip>
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
