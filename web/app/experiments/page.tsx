'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Experiment } from '@/types/protocol'
import WorkerList from '@/components/WorkerList'

const EXPERIMENTS_PER_PAGE = 25

export default function ExperimentsPage() {
  const [experiments, setExperiments] = useState<Experiment[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showWorkers, setShowWorkers] = useState(true)
  const [deletingAll, setDeletingAll] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [totalLoaded, setTotalLoaded] = useState(0)
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

  const fetchExperiments = async (page: number, append: boolean = false) => {
    const offset = (page - 1) * EXPERIMENTS_PER_PAGE
    
    try {
      const res = await fetch(`/api/experiments?limit=${EXPERIMENTS_PER_PAGE}&offset=${offset}`)
      const data = await res.json()
      
      // Check if the response is an error
      if (data.error) {
        console.error('API returned error:', data)
        setError(`Database error: ${data.details || data.error}`)
        if (!append) setExperiments([])
        return
      }
      
      // Ensure data is an array (could be data.experiments or data directly)
      const experimentsArray = Array.isArray(data) ? data : (data.experiments || [])
      
      if (append) {
        setExperiments(prev => [...prev, ...experimentsArray])
      } else {
        setExperiments(experimentsArray)
      }
      
      setTotalLoaded(prev => append ? prev + experimentsArray.length : experimentsArray.length)
      setHasMore(experimentsArray.length === EXPERIMENTS_PER_PAGE)
      setError(null)
    } catch (err) {
      console.error('Error fetching experiments:', err)
      setError(`Failed to load experiments: ${err instanceof Error ? err.message : 'Unknown error'}`)
      if (!append) setExperiments([])
    }
  }

  useEffect(() => {
    setLoading(true)
    fetchExperiments(1).finally(() => setLoading(false))
  }, [])

  const loadMore = async () => {
    setLoadingMore(true)
    const nextPage = currentPage + 1
    await fetchExperiments(nextPage, true)
    setCurrentPage(nextPage)
    setLoadingMore(false)
  }

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

  // Get sort priority for experiment status (lower = higher priority)
  const getStatusSortOrder = (status: string) => {
    switch (status) {
      case 'RUNNING': return 0   // Running first
      case 'COMPLETED': return 1 // Completed second
      case 'PENDING': return 2   // Pending third
      case 'FAILED': return 3    // Failed fourth
      case 'STOPPED': return 4   // Stopped last
      default: return 5
    }
  }

  // Sort experiments: RUNNING first, COMPLETED second, PENDING last, then by created_at desc within each group
  const sortedExperiments = [...experiments].sort((a, b) => {
    const statusOrderA = getStatusSortOrder(a.status)
    const statusOrderB = getStatusSortOrder(b.status)
    
    if (statusOrderA !== statusOrderB) {
      return statusOrderA - statusOrderB
    }
    
    // Within same status, sort by created_at descending (newest first)
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  })

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

  const handleDeleteAll = async () => {
    // First, get total count from server
    let totalCount = experiments.length
    try {
      const countRes = await fetch('/api/experiments?limit=1&count=true')
      const countData = await countRes.json()
      if (countData.total) {
        totalCount = countData.total
      }
    } catch {
      // Use local count as fallback
    }
    
    // First confirmation
    const firstConfirm = confirm(
      `⚠️ DELETE ALL EXPERIMENTS ⚠️\n\n` +
      `Are you sure you want to delete ALL ${totalCount} experiments?\n\n` +
      `This will permanently delete:\n` +
      `• All experiments\n` +
      `• All generation data\n` +
      `• All checkpoints\n` +
      `• All job assignments\n\n` +
      `This action CANNOT be undone!`
    )
    
    if (!firstConfirm) {
      return
    }
    
    // Second confirmation
    const secondConfirm = confirm(
      `🚨 FINAL WARNING 🚨\n\n` +
      `Are you REALLY sure?\n\n` +
      `You are about to permanently delete ALL data for ${totalCount} experiments.\n\n` +
      `There is NO way to recover this data after deletion.\n\n` +
      `Click OK to proceed with deletion, or Cancel to abort.`
    )
    
    if (!secondConfirm) {
      return
    }
    
    setDeletingAll(true)
    
    try {
      const response = await fetch('/api/experiments/delete-all', { method: 'DELETE' })
      
      if (response.ok) {
        const result = await response.json()
        setExperiments([])
        alert(
          `✓ Successfully deleted all experiments!\n\n` +
          `Deleted:\n` +
          `• ${result.details?.experiments || 0} experiments\n` +
          `• ${result.details?.generations || 0} generations\n` +
          `• ${result.details?.checkpoints || 0} checkpoints\n` +
          `• ${result.details?.job_assignments || 0} job assignments`
        )
      } else {
        const error = await response.json()
        alert(`Failed to delete all experiments: ${error.error || 'Unknown error'}`)
      }
    } catch (error) {
      alert(`Failed to delete all experiments: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setDeletingAll(false)
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
            {experiments.length > 0 && (
              <button
                onClick={handleDeleteAll}
                disabled={deletingAll}
                className="px-5 py-3 rounded-lg font-medium transition-all flex items-center gap-2 bg-red-600 text-white hover:bg-red-700 shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                {deletingAll ? 'Deleting...' : 'Delete All'}
              </button>
            )}
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
          {error ? (
            <div className="p-12 text-center border-2 border-dashed border-red-300 dark:border-red-700 rounded-xl bg-red-50 dark:bg-red-900/20">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 mb-4">
                <svg className="w-6 h-6 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <p className="text-red-600 dark:text-red-400 font-medium mb-2">Error Loading Experiments</p>
              <p className="text-red-500 dark:text-red-400 text-sm mb-4">{error}</p>
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                Retry
              </button>
            </div>
          ) : sortedExperiments.length === 0 ? (
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
            <>
              {sortedExperiments.map((exp) => (
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
              ))}
              
              {/* Pagination Controls */}
              <div className="mt-6 flex flex-col items-center gap-4">
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Showing {sortedExperiments.length} experiment{sortedExperiments.length !== 1 ? 's' : ''}
                  {hasMore && ' (more available)'}
                </p>
                
                {hasMore && (
                  <button
                    onClick={loadMore}
                    disabled={loadingMore}
                    className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium shadow-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {loadingMore ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        Loading...
                      </>
                    ) : (
                      <>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                        Load More Experiments
                      </>
                    )}
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </main>
  )
}
