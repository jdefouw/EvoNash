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
    random_seed: 42,
    population_size: 1000,
    max_generations: 1500,
    ticks_per_generation: 750,
    mutation_rate: 0.05,
    mutation_base: 0.0615,
    max_possible_elo: 8000.0,
    selection_pressure: 0.2
  })

  // Derive mutation_mode from experiment_group
  // CONTROL = STATIC mutation (fixed rate ε = 0.05)
  // EXPERIMENTAL = ADAPTIVE mutation (fitness-scaled ε = f(Elo))
  const mutation_mode = formData.experiment_group === 'CONTROL' ? 'STATIC' : 'ADAPTIVE'

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
          mutation_mode, // Derived from experiment_group
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
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm mb-6">
          <Link 
            href="/"
            className="text-blue-600 dark:text-blue-400 hover:underline transition-colors"
          >
            Dashboard
          </Link>
          <span className="text-gray-400">/</span>
          <Link 
            href="/experiments"
            className="text-blue-600 dark:text-blue-400 hover:underline transition-colors"
          >
            Experiments
          </Link>
          <span className="text-gray-400">/</span>
          <span className="text-gray-600 dark:text-gray-400">New</span>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-6">
            Create New Experiment
          </h1>

          {error && (
            <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-red-800 dark:text-red-200">{error}</p>
            </div>
          )}

          {/* Experiment Design Explanation */}
          <div className="mb-8 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
            <h3 className="text-sm font-semibold text-blue-800 dark:text-blue-300 mb-2">
              Understanding Experiment Groups
            </h3>
            <p className="text-sm text-blue-700 dark:text-blue-400 mb-3">
              This experiment tests whether <strong>adaptive mutation</strong> (scaling mutation rate by fitness) 
              accelerates convergence to Nash Equilibrium compared to <strong>static mutation</strong>.
            </p>
            <div className="grid md:grid-cols-2 gap-4 text-xs">
              <div className="bg-white dark:bg-gray-800 p-3 rounded border border-blue-100 dark:border-blue-900">
                <div className="font-semibold text-gray-900 dark:text-white mb-1">Control Group</div>
                <div className="text-gray-600 dark:text-gray-400">
                  <strong>Static Mutation</strong> — Fixed rate ε = 0.05 applied uniformly to all offspring. 
                  Traditional genetic algorithm approach serving as the baseline.
                </div>
              </div>
              <div className="bg-white dark:bg-gray-800 p-3 rounded border border-blue-100 dark:border-blue-900">
                <div className="font-semibold text-gray-900 dark:text-white mb-1">Experimental Group</div>
                <div className="text-gray-600 dark:text-gray-400">
                  <strong>Adaptive Mutation</strong> — Dynamic rate calibrated to start at ~5% (same as Control), 
                  then scales with fitness: low-fitness agents mutate more (exploration), high-fitness agents mutate less (exploitation).
                </div>
              </div>
            </div>
            <p className="text-xs text-blue-600 dark:text-blue-500 mt-3">
              For statistical significance, run at least 5 experiments of each group with different random seeds.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <Tooltip content="A descriptive name for this experiment run. Include the group type and seed for easy identification (e.g., 'Control Run - Seed 42').">
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
                placeholder="e.g., Control Run - Seed 42"
              />
            </div>

            <div>
              <Tooltip content="Control group uses static mutation (fixed ε = 0.05). Experimental group uses adaptive mutation calibrated to also start at ~5% at initial Elo, then scales by fitness (lower-fitness agents mutate more). This ensures fair comparison.">
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
                <option value="CONTROL">Control (Static Mutation)</option>
                <option value="EXPERIMENTAL">Experimental (Adaptive Mutation)</option>
              </select>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                {formData.experiment_group === 'CONTROL' 
                  ? 'Static mutation: Fixed rate ε = 0.05'
                  : 'Adaptive mutation: ε = Base × (1 - CurrentElo/MaxElo)'}
              </p>
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
                <Tooltip content="A tick is one discrete simulation step (~16ms of simulated time). Each tick updates agent physics (energy decay, movement), processes neural network decisions, handles collisions, and respawns food. At 750 ticks, agents have ~12 seconds of simulated lifetime per generation.">
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
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">750 ticks ≈ 12 seconds of simulated agent lifetime</p>
              </div>
            </div>

            {mutation_mode === 'STATIC' ? (
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
                  step="0.0001"
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
                <Tooltip content="Base mutation rate for adaptive mode. Default 0.0615 is calibrated so that at initial Elo (~1500), the effective rate equals the static rate (5%). Formula: 0.05 / (1 - 1500/8000) = 0.0615. This ensures both groups start with identical mutation rates for fair comparison.">
                  <label htmlFor="mutation_base" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 cursor-help">
                    Mutation Base (Adaptive)
                  </label>
                </Tooltip>
                <input
                  type="number"
                  id="mutation_base"
                  name="mutation_base"
                  step="0.0001"
                  min="0"
                  max="1"
                  value={formData.mutation_base}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Calibrated so adaptive starts at ~5% (same as static) at initial Elo</p>
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
