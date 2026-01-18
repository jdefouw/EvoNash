'use client'

import { Experiment, Generation } from '@/types/protocol'
import Tooltip from './Tooltip'

interface GenerationProgressProps {
  experiment: Experiment
  currentGeneration: Generation | null
  generations: Generation[]
}

export default function GenerationProgress({ 
  experiment, 
  currentGeneration, 
  generations 
}: GenerationProgressProps) {
  const currentGenNum = currentGeneration?.generation_number || 0
  
  // If experiment is completed, show 100% progress
  // Otherwise, calculate based on completed generations or current generation number
  let progress = 0
  if (experiment.status === 'COMPLETED') {
    progress = 100
  } else if (generations.length > 0) {
    // Use the actual number of completed generations
    // Generation numbers are 0-indexed, so generation 4 means 5 generations completed (0,1,2,3,4)
    const completedGenerations = generations.length
    progress = Math.min(100, (completedGenerations / experiment.max_generations) * 100)
  } else if (currentGenNum > 0) {
    // Fallback: use current generation number (0-indexed, so add 1)
    progress = Math.min(100, ((currentGenNum + 1) / experiment.max_generations) * 100)
  }
  
  // If completed, remaining is always 0
  const remaining = experiment.status === 'COMPLETED' 
    ? 0 
    : Math.max(0, experiment.max_generations - (generations.length || (currentGenNum + 1)))
  const elapsed = generations.length > 0 
    ? Math.floor((new Date().getTime() - new Date(generations[0].created_at).getTime()) / 1000 / 60)
    : 0

  return (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700">
      <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">Progress</h2>
      <div className="space-y-4">
        <div>
          <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400 mb-2">
            <Tooltip content="Current generation number out of total planned generations">
              <span className="cursor-help">Generation {generations.length > 0 ? generations.length : (currentGenNum + 1)} of {experiment.max_generations}</span>
            </Tooltip>
            <Tooltip content="Percentage of generations completed">
              <span className="font-semibold text-gray-900 dark:text-white cursor-help">{progress.toFixed(1)}%</span>
            </Tooltip>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
            <div 
              className="bg-blue-600 h-3 rounded-full transition-all duration-500 ease-out"
              style={{ width: `${Math.min(progress, 100)}%` }}
            />
          </div>
        </div>
        {(currentGenNum > 0 || generations.length > 0) && (
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-600 dark:text-gray-400">Remaining:</span>
              <Tooltip content="Number of generations remaining to complete">
                <span className="ml-2 font-medium text-gray-900 dark:text-white cursor-help">{remaining.toLocaleString()}</span>
              </Tooltip>
            </div>
            <div>
              <span className="text-gray-600 dark:text-gray-400">Total Completed:</span>
              <Tooltip content="Total number of generations that have been completed">
                <span className="ml-2 font-medium text-gray-900 dark:text-white cursor-help">{generations.length || (currentGenNum + 1)}</span>
              </Tooltip>
            </div>
          </div>
        )}
        {experiment.status === 'RUNNING' && currentGenNum === 0 && (
          <div className="text-sm text-yellow-600 dark:text-yellow-400">
            ⏳ Waiting for first generation data...
          </div>
        )}
      </div>
    </div>
  )
}
