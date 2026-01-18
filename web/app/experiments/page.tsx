'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Experiment } from '@/types/protocol'

export default function ExperimentsPage() {
  const [experiments, setExperiments] = useState<Experiment[]>([])
  const [loading, setLoading] = useState(true)
  const [workerStatus, setWorkerStatus] = useState<any>(null)

  useEffect(() => {
    fetch('/api/experiments')
      .then(res => {
        if (!res.ok) {
          throw new Error(`HTTP error! status: ${res.status}`)
        }
        return res.json()
      })
      .then(data => {
        // Ensure data is an array
        const experimentsArray = Array.isArray(data) ? data : []
        setExperiments(experimentsArray)
        setLoading(false)
      })
      .catch(err => {
        console.error('Error fetching experiments:', err)
        setExperiments([]) // Set empty array on error
        setLoading(false)
      })

    // Check worker status
    fetch('/api/worker/status')
      .then(res => res.json())
      .then(data => {
        setWorkerStatus(data)
      })
      .catch(err => {
        console.error('Error fetching worker status:', err)
      })
    
    // Refresh worker status every 10 seconds
    const statusInterval = setInterval(() => {
      fetch('/api/worker/status')
        .then(res => res.json())
        .then(data => {
          setWorkerStatus(data)
        })
        .catch(err => {
          console.error('Error fetching worker status:', err)
        })
    }, 10000)
    
    return () => clearInterval(statusInterval)
  }, [])

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'RUNNING': return 'bg-blue-500'
      case 'COMPLETED': return 'bg-green-500'
      case 'FAILED': return 'bg-red-500'
      default: return 'bg-gray-500'
    }
  }

  const getGroupColor = (group: string) => {
    return group === 'CONTROL' ? 'text-blue-600 dark:text-blue-400' : 'text-purple-600 dark:text-purple-400'
  }

  if (loading) {
    return (
      <main className="min-h-screen p-8">
        <div className="max-w-6xl mx-auto">
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p className="mt-4 text-gray-600 dark:text-gray-400">Loading experiments...</p>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen p-8 bg-gray-50 dark:bg-gray-900">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">Experiments</h1>
            <p className="text-gray-600 dark:text-gray-400">
              Manage and monitor genetic algorithm experiments
            </p>
            {workerStatus && (
              <div className="mt-2 space-y-1">
                <div className="flex items-center gap-2 text-sm">
                  <div className={`w-2 h-2 rounded-full ${workerStatus.connected ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
                  <span className="text-gray-600 dark:text-gray-400">
                    {workerStatus.active_workers_count || 0} Active Worker{workerStatus.active_workers_count !== 1 ? 's' : ''}
                    {workerStatus.total_capacity > 0 && ` • ${workerStatus.utilized_capacity || 0}/${workerStatus.total_capacity || 0} jobs`}
                    {workerStatus.pending_count > 0 && ` • ${workerStatus.pending_count} pending`}
                  </span>
                </div>
                {workerStatus.workers && workerStatus.workers.length > 0 && (
                  <div className="text-xs text-gray-500 dark:text-gray-400 ml-4">
                    {workerStatus.workers.slice(0, 3).map((worker: any) => (
                      <span key={worker.id} className="mr-3">
                        {worker.gpu_type || 'CPU'} ({worker.vram_gb}GB) - {worker.active_jobs_count}/{worker.max_parallel_jobs} jobs
                      </span>
                    ))}
                    {workerStatus.workers.length > 3 && ` +${workerStatus.workers.length - 3} more`}
                  </div>
                )}
                {!workerStatus.connected && workerStatus.pending_count > 0 && (
                  <span className="text-yellow-600 dark:text-yellow-400 text-xs ml-4">
                    Workers should pick up pending experiments automatically
                  </span>
                )}
              </div>
            )}
          </div>
          <Link
            href="/experiments/new"
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            New Experiment
          </Link>
        </div>

        <div className="grid gap-4">
          {experiments.length === 0 ? (
            <div className="p-12 text-center border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800">
              <p className="text-gray-600 dark:text-gray-400 mb-4">No experiments yet.</p>
              <Link
                href="/experiments/new"
                className="text-blue-600 dark:text-blue-400 hover:underline"
              >
                Create your first experiment
              </Link>
            </div>
          ) : (
            experiments.map((exp) => (
              <Link
                key={exp.id}
                href={`/experiments/${exp.id}`}
                className="block p-6 border border-gray-200 dark:border-gray-700 rounded-lg hover:border-blue-500 dark:hover:border-blue-500 hover:shadow-md transition-all bg-white dark:bg-gray-800"
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">
                        {exp.experiment_name}
                      </h2>
                      <span className={`px-3 py-1 rounded-full text-sm font-medium ${getGroupColor(exp.experiment_group)} bg-opacity-10`}>
                        {exp.experiment_group}
                      </span>
                    </div>
                    <div className="flex gap-6 text-sm text-gray-600 dark:text-gray-400">
                      <span>Mode: <strong>{exp.mutation_mode}</strong></span>
                      <span>Population: <strong>{exp.population_size}</strong></span>
                      <span>Max Generations: <strong>{exp.max_generations}</strong></span>
                      <span>Seed: <strong>{exp.random_seed}</strong></span>
                      <span>Created: {new Date(exp.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <span className={`px-4 py-2 rounded-lg text-white text-sm font-medium ${getStatusColor(exp.status)}`}>
                    {exp.status}
                  </span>
                </div>
              </Link>
            ))
          )}
        </div>
      </div>
    </main>
  )
}
