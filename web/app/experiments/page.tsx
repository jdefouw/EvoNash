'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Experiment } from '@/types/protocol'
import WorkerList from '@/components/WorkerList'

export default function ExperimentsPage() {
  const [experiments, setExperiments] = useState<Experiment[]>([])
  const [loading, setLoading] = useState(true)
  const [showWorkers, setShowWorkers] = useState(true)
  const [workerStats, setWorkerStats] = useState<{
    active: number
    processing: number
    total: number
  }>({ active: 0, processing: 0, total: 0 })

  // Load workers visibility preference from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('showWorkers')
      if (saved !== null) {
        setShowWorkers(saved !== 'false')
      }
    }
  }, [])

  // Save workers visibility preference to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('showWorkers', String(showWorkers))
    }
  }, [showWorkers])

  // Fetch worker stats for the button badge
  useEffect(() => {
    const fetchWorkerStats = async () => {
      try {
        const response = await fetch('/api/workers')
        if (response.ok) {
          const data = await response.json()
          setWorkerStats({
            active: data.active_workers_count || 0,
            processing: data.processing_workers_count || 0,
            total: data.total_workers_count || 0
          })
        }
      } catch (error) {
        console.error('Error fetching worker stats:', error)
      }
    }

    fetchWorkerStats()
    const interval = setInterval(fetchWorkerStats, 10000)
    return () => clearInterval(interval)
  }, [])

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

  const handleDelete = async (e: React.MouseEvent, expId: string, expName: string, expStatus: string) => {
    e.preventDefault()
    e.stopPropagation()
    
    const warningMessage = expStatus === 'RUNNING'
      ? `WARNING: This experiment is currently running!\n\nAre you sure you want to delete "${expName}"?\n\nThis will permanently delete all generations, matches, and analysis data. This action cannot be undone.`
      : `Are you sure you want to delete "${expName}"?\n\nThis will permanently delete all generations, matches, and analysis data. This action cannot be undone.`
    
    if (!confirm(warningMessage)) {
      return
    }
    
    try {
      const response = await fetch(`/api/experiments/${expId}`, { method: 'DELETE' })
      if (response.ok) {
        // Remove the experiment from the list
        setExperiments(prev => prev.filter(exp => exp.id !== expId))
      } else {
        const error = await response.json()
        alert(`Failed to delete experiment: ${error.error || 'Unknown error'}`)
      }
    } catch (error) {
      alert(`Failed to delete experiment: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
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
        {/* Breadcrumb */}
        <div className="mb-6">
          <Link 
            href="/"
            className="text-blue-600 dark:text-blue-400 hover:underline text-sm flex items-center gap-1"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Science Fair Dashboard
          </Link>
        </div>

        <div className="flex justify-between items-start mb-8">
          <div>
            <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">Experiments</h1>
            <p className="text-gray-600 dark:text-gray-400">
              Manage and monitor genetic algorithm experiments
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setShowWorkers(!showWorkers)}
              className={`px-5 py-3 rounded-lg font-medium transition-all flex items-center gap-2 ${
                showWorkers 
                  ? 'bg-green-600 text-white hover:bg-green-700 shadow-md' 
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
              }`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
              </svg>
              Workers
              {workerStats.active > 0 && (
                <span className={`px-2 py-0.5 text-xs rounded-full ${
                  showWorkers 
                    ? 'bg-green-500 text-white' 
                    : 'bg-green-600 text-white'
                }`}>
                  {workerStats.active}
                </span>
              )}
            </button>
            <Link
              href="/experiments/new"
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium shadow-md"
            >
              New Experiment
            </Link>
          </div>
        </div>

        {/* Workers Section - Collapsible */}
        {showWorkers && <WorkerList className="mb-8" />}

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
                      <span>Mutation: <strong>{exp.mutation_mode === 'STATIC' ? 'Static (ε=0.05)' : 'Adaptive (starts ~5%, scales by Elo)'}</strong></span>
                      <span>Population: <strong>{exp.population_size}</strong></span>
                      <span>Max Generations: <strong>{exp.max_generations}</strong></span>
                      <span>Seed: <strong>{exp.random_seed}</strong></span>
                      <span>Created: {new Date(exp.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`px-4 py-2 rounded-lg text-white text-sm font-medium ${getStatusColor(exp.status)}`}>
                      {exp.status}
                    </span>
                    <button
                      onClick={(e) => handleDelete(e, exp.id, exp.experiment_name, exp.status)}
                      className="p-2 text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                      title="Delete experiment"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              </Link>
            ))
          )}
        </div>
      </div>
    </main>
  )
}
