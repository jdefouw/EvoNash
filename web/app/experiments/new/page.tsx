'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

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
        throw new Error(errorData.error || 'Failed to create experiment')
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
      [name]: name === 'random_seed' || name === 'population_size' || name === 'max_generations'
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
              <label htmlFor="experiment_name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Experiment Name *
              </label>
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
                <label htmlFor="experiment_group" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Experiment Group *
                </label>
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
                <label htmlFor="mutation_mode" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Mutation Mode *
                </label>
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

            <div className="grid md:grid-cols-3 gap-6">
              <div>
                <label htmlFor="random_seed" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Random Seed
                </label>
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
                <label htmlFor="population_size" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Population Size
                </label>
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
                <label htmlFor="max_generations" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Max Generations
                </label>
                <input
                  type="number"
                  id="max_generations"
                  name="max_generations"
                  value={formData.max_generations}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
            </div>

            {formData.mutation_mode === 'STATIC' ? (
              <div>
                <label htmlFor="mutation_rate" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Mutation Rate (Static)
                </label>
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
                <label htmlFor="mutation_base" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Mutation Base (Adaptive)
                </label>
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
                <label htmlFor="max_possible_elo" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Max Possible Elo
                </label>
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
                <label htmlFor="selection_pressure" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Selection Pressure
                </label>
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
