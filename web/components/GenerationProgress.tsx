'use client'

import { Experiment, Generation } from '@/types/protocol'

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
  const progress = currentGenNum > 0
    ? (currentGenNum / experiment.max_generations) * 100 
    : 0
  const remaining = Math.max(0, experiment.max_generations - currentGenNum)
  const elapsed = generations.length > 0 
    ? Math.floor((new Date().getTime() - new Date(generations[0].created_at).getTime()) / 1000 / 60)
    : 0

  return (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700">
      <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">Progress</h2>
      <div className="space-y-4">
        <div>
          <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400 mb-2">
            <span>Generation {currentGenNum} of {experiment.max_generations}</span>
            <span className="font-semibold text-gray-900 dark:text-white">{progress.toFixed(1)}%</span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
            <div 
              className="bg-blue-600 h-3 rounded-full transition-all duration-500 ease-out"
              style={{ width: `${Math.min(progress, 100)}%` }}
            />
          </div>
        </div>
        {currentGenNum > 0 && (
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-600 dark:text-gray-400">Remaining:</span>
              <span className="ml-2 font-medium text-gray-900 dark:text-white">{remaining.toLocaleString()}</span>
            </div>
            <div>
              <span className="text-gray-600 dark:text-gray-400">Total Completed:</span>
              <span className="ml-2 font-medium text-gray-900 dark:text-white">{generations.length}</span>
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
