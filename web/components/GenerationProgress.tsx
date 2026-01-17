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
  const progress = currentGeneration 
    ? (currentGeneration.generation_number / experiment.max_generations) * 100 
    : 0

  return (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700">
      <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">Progress</h2>
      <div className="space-y-2">
        <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400">
          <span>Generation {currentGeneration?.generation_number || 0} of {experiment.max_generations}</span>
          <span>{progress.toFixed(1)}%</span>
        </div>
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
          <div 
            className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
            style={{ width: `${Math.min(progress, 100)}%` }}
          />
        </div>
      </div>
    </div>
  )
}
