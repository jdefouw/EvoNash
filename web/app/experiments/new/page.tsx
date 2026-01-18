'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Tooltip from '@/components/Tooltip'

export default function NewExperimentPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const [formData, setFormData] = useState({
    experiment_name: '',
    experiment_group: 'CONTROL' as 'CONTROL' | 'EXPERIMENTAL',
    mutation_mode: 'STATIC' as 'STATIC' | 'ADAPTIVE',
    random_seed: 42,
    population_size: 1000,
    max_generations: 5000,
    ticks_per_generation: 500,
    mutation_rate: 0.05,
    mutation_base: 0.1,
    max_possible_elo: 2000.0,
    selection_pressure: 0.2
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/experiments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...formData,
          network_architecture: {
            input_size: 24,
            hidden_layers: [64],
            output_size: 4
          }
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        const errorMessage = errorData.error || 'Failed to create experiment'
        const details = errorData.details ? ` Details: ${errorData.details}` : ''
        const hint = errorData.hint ? ` Hint: ${errorData.hint}` : ''
        throw new Error(`${errorMessage}${details}${hint}`)
      }

      const data = await response.json()
      router.push(`/experiments/${data.experiment.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create experiment')
      setLoading(false)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: name === 'random_seed' || name === 'population_size' || name === 'max_generations' || name === 'ticks_per_generation'
        ? parseInt(value) || 0
        : name === 'mutation_rate' || name === 'mutation_base' || name === 'max_possible_elo' || name === 'selection_pressure'
        ? parseFloat(value) || 0
        : value
    }))
  }

  return (
    <main className="min-h-screen p-8 bg-gray-50 dark:bg-gray-900">
      <div className="max-w-4xl mx-auto">
        <Link 
          href="/experiments"
          className="text-blue-600 dark:text-blue-400 hover:underline mb-6 inline-block"
        >
          ← Back to experiments
        </Link>

        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-6">
            Create New Experiment
          </h1>

          {error && (
            <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-red-800 dark:text-red-200">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <Tooltip content="A unique identifier or title for this specific experiment.">
                <label htmlFor="experiment_name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 cursor-help">
                  Experiment Name *
                </label>
              </Tooltip>
              <input
                type="text"
                id="experiment_name"
                name="experiment_name"
                required
                value={formData.experiment_name}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder="e.g., Control Group - Static Mutation"
              />
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <Tooltip content="Categorize this experiment into a group for easier organization and comparison with other related experiments.">
                  <label htmlFor="experiment_group" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 cursor-help">
                    Experiment Group *
                  </label>
                </Tooltip>
                <select
                  id="experiment_group"
                  name="experiment_group"
                  required
                  value={formData.experiment_group}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="CONTROL">Control</option>
                  <option value="EXPERIMENTAL">Experimental</option>
                </select>
              </div>

              <div>
                <Tooltip content="Determines how genetic mutations are applied during evolution. 'Static' uses a constant rate, while 'Adaptive' allows the rate to change dynamically based on experiment progress.">
                  <label htmlFor="mutation_mode" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 cursor-help">
                    Mutation Mode *
                  </label>
                </Tooltip>
                <select
                  id="mutation_mode"
                  name="mutation_mode"
                  required
                  value={formData.mutation_mode}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="STATIC">Static (Fixed Rate)</option>
                  <option value="ADAPTIVE">Adaptive (Fitness-Scaled)</option>
                </select>
              </div>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div>
                <Tooltip content="An integer value used to initialize the random number generator, ensuring that the experiment's starting conditions and subsequent 'random' events are reproducible.">
                  <label htmlFor="random_seed" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 cursor-help">
                    Random Seed
                  </label>
                </Tooltip>
                <input
                  type="number"
                  id="random_seed"
                  name="random_seed"
                  value={formData.random_seed}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>

              <div>
                <Tooltip content="The number of individual agents (e.g., neural networks or organisms) that will be present in each generation of the experiment.">
                  <label htmlFor="population_size" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 cursor-help">
                    Population Size
                  </label>
                </Tooltip>
                <input
                  type="number"
                  id="population_size"
                  name="population_size"
                  value={formData.population_size}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>

              <div>
                <Tooltip content="The total number of evolutionary cycles or generations the experiment will run before automatically stopping.">
                  <label htmlFor="max_generations" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 cursor-help">
                    Max Generations
                  </label>
                </Tooltip>
                <input
                  type="number"
                  id="max_generations"
                  name="max_generations"
                  value={formData.max_generations}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>

              <div>
                <Tooltip content="The number of discrete simulation steps or time units during which each agent is evaluated within a single generation to determine its performance or fitness.">
                  <label htmlFor="ticks_per_generation" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 cursor-help">
                    Ticks Per Generation
                  </label>
                </Tooltip>
                <input
                  type="number"
                  id="ticks_per_generation"
                  name="ticks_per_generation"
                  min="1"
                  value={formData.ticks_per_generation}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Simulation ticks per generation</p>
              </div>
            </div>

            {formData.mutation_mode === 'STATIC' ? (
              <div>
                <Tooltip content="The fixed probability (as a decimal) that a genetic characteristic (e.g., a weight in a neural network) of an agent will randomly change during reproduction. For example, 0.05 means a 5% chance of mutation.">
                  <label htmlFor="mutation_rate" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 cursor-help">
                    Mutation Rate (Static)
                  </label>
                </Tooltip>
                <input
                  type="number"
                  id="mutation_rate"
                  name="mutation_rate"
                  step="0.01"
                  min="0"
                  max="1"
                  value={formData.mutation_rate}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Fixed mutation rate (e.g., 0.05 = 5%)</p>
              </div>
            ) : (
              <div>
                <Tooltip content="Base mutation rate for adaptive mode - starting point for dynamic mutation scaling. The actual mutation rate will change based on agent fitness, with lower-performing agents mutating more and higher-performing agents mutating less.">
                  <label htmlFor="mutation_base" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 cursor-help">
                    Mutation Base (Adaptive)
                  </label>
                </Tooltip>
                <input
                  type="number"
                  id="mutation_base"
                  name="mutation_base"
                  step="0.01"
                  min="0"
                  max="1"
                  value={formData.mutation_base}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Base mutation rate for adaptive mode</p>
              </div>
            )}

            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <Tooltip content="The highest possible Elo rating that an agent can achieve within the experiment's scoring system. This helps define the scale of performance and is used in adaptive mutation calculations.">
                  <label htmlFor="max_possible_elo" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 cursor-help">
                    Max Possible Elo
                  </label>
                </Tooltip>
                <input
                  type="number"
                  id="max_possible_elo"
                  name="max_possible_elo"
                  step="100"
                  value={formData.max_possible_elo}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>

              <div>
                <Tooltip content="The proportion of the highest-performing agents from the current generation that are chosen to reproduce and contribute to the next generation. A value of 0.2 means the top 20% of agents are selected.">
                  <label htmlFor="selection_pressure" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 cursor-help">
                    Selection Pressure
                  </label>
                </Tooltip>
                <input
                  type="number"
                  id="selection_pressure"
                  name="selection_pressure"
                  step="0.01"
                  min="0"
                  max="1"
                  value={formData.selection_pressure}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Top percentage to select (e.g., 0.2 = top 20%)</p>
              </div>
            </div>

            <div className="flex gap-4 pt-4">
              <button
                type="submit"
                disabled={loading}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Creating...' : 'Create Experiment'}
              </button>
              <Link
                href="/experiments"
                className="px-6 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors font-medium"
              >
                Cancel
              </Link>
            </div>
          </form>
        </div>
      </div>
    </main>
  )
}
