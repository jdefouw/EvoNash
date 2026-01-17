'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { Experiment, Generation } from '@/types/protocol'
import ExperimentChart from '@/components/ExperimentChart'
import EntropyChart from '@/components/EntropyChart'
import StatisticalSignificance from '@/components/StatisticalSignificance'

export default function ExperimentDetailPage() {
  const params = useParams()
  const experimentId = params.id as string
  
  const [experiment, setExperiment] = useState<Experiment | null>(null)
  const [generations, setGenerations] = useState<Generation[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!experimentId) return

    // Fetch experiment
    fetch(`/api/experiments/${experimentId}`)
      .then(res => res.json())
      .then(data => {
        setExperiment(data)
      })
      .catch(err => {
        console.error('Error fetching experiment:', err)
      })

    // Fetch generations
    fetch(`/api/generations?experiment_id=${experimentId}`)
      .then(res => res.json())
      .then(data => {
        setGenerations(data)
        setLoading(false)
      })
      .catch(err => {
        console.error('Error fetching generations:', err)
        setLoading(false)
      })
  }, [experimentId])

  if (loading) {
    return (
      <main className="min-h-screen p-8">
        <div className="max-w-6xl mx-auto">
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p className="mt-4 text-gray-600 dark:text-gray-400">Loading experiment...</p>
          </div>
        </div>
      </main>
    )
  }

  if (!experiment) {
    return (
      <main className="min-h-screen p-8">
        <div className="max-w-6xl mx-auto">
          <div className="text-center py-12">
            <p className="text-red-600 dark:text-red-400">Experiment not found</p>
            <Link href="/experiments" className="text-blue-600 dark:text-blue-400 hover:underline mt-4 inline-block">
              Back to experiments
            </Link>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen p-8 bg-gray-50 dark:bg-gray-900">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <Link 
            href="/experiments"
            className="text-blue-600 dark:text-blue-400 hover:underline mb-4 inline-block"
          >
            ← Back to experiments
          </Link>
          <div className="flex justify-between items-start mt-4">
            <div>
              <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
                {experiment.experiment_name}
              </h1>
              <div className="flex gap-4 text-sm text-gray-600 dark:text-gray-400">
                <span>Group: <strong>{experiment.experiment_group}</strong></span>
                <span>Mode: <strong>{experiment.mutation_mode}</strong></span>
                <span>Status: <strong>{experiment.status}</strong></span>
              </div>
            </div>
            <button
              onClick={() => {
                fetch(`/api/experiments/${experimentId}/start`, { method: 'POST' })
                  .then(() => window.location.reload())
              }}
              className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
              disabled={experiment.status === 'RUNNING'}
            >
              {experiment.status === 'RUNNING' ? 'Running...' : 'Start Experiment'}
            </button>
          </div>
        </div>

        <div className="grid gap-6 mb-8">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700">
            <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">Configuration</h2>
            <div className="grid md:grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-600 dark:text-gray-400">Population Size:</span>
                <span className="ml-2 font-medium">{experiment.population_size}</span>
              </div>
              <div>
                <span className="text-gray-600 dark:text-gray-400">Max Generations:</span>
                <span className="ml-2 font-medium">{experiment.max_generations}</span>
              </div>
              <div>
                <span className="text-gray-600 dark:text-gray-400">Random Seed:</span>
                <span className="ml-2 font-medium">{experiment.random_seed}</span>
              </div>
              <div>
                <span className="text-gray-600 dark:text-gray-400">Selection Pressure:</span>
                <span className="ml-2 font-medium">{experiment.selection_pressure}</span>
              </div>
              {experiment.mutation_mode === 'STATIC' && experiment.mutation_rate && (
                <div>
                  <span className="text-gray-600 dark:text-gray-400">Mutation Rate:</span>
                  <span className="ml-2 font-medium">{experiment.mutation_rate}</span>
                </div>
              )}
              {experiment.mutation_mode === 'ADAPTIVE' && experiment.mutation_base && (
                <div>
                  <span className="text-gray-600 dark:text-gray-400">Mutation Base:</span>
                  <span className="ml-2 font-medium">{experiment.mutation_base}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {generations.length > 0 && (
          <div className="space-y-6">
            <ExperimentChart generations={generations} experiment={experiment} />
            <EntropyChart generations={generations} experiment={experiment} />
            <StatisticalSignificance experimentId={experimentId} />
          </div>
        )}

        {generations.length === 0 && (
          <div className="bg-white dark:bg-gray-800 p-12 text-center rounded-lg border border-gray-200 dark:border-gray-700">
            <p className="text-gray-600 dark:text-gray-400">
              No generation data available yet. Start the experiment to begin collecting data.
            </p>
          </div>
        )}
      </div>
    </main>
  )
}
