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
  const [summary, setSummary] = useState<{
    completed: { control: number; experimental: number; total: number }
    pending: { control: number; experimental: number; total: number }
    running: { control: number; experimental: number; total: number }
  } | null>(null)

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
    const isFirstPage = page === 1 && !append
    const params = new URLSearchParams({
      limit: String(EXPERIMENTS_PER_PAGE),
      offset: String(offset)
    })
    if (isFirstPage) {
      params.set('count', 'true')
      params.set('summary', 'true')
    }

    try {
      const res = await fetch(`/api/experiments?${params}`)
      const data = await res.json()

      // Check if the response is an error
      if (data.error) {
        console.error('API returned error:', data)
        setError(`Database error: ${data.details || data.error}`)
        if (!append) setExperiments([])
        return
      }

      // Response may be array or { experiments, total, summary }
      const experimentsArray = Array.isArray(data) ? data : (data.experiments || [])

      if (append) {
        setExperiments(prev => [...prev, ...experimentsArray])
      } else {
        setExperiments(experimentsArray)
      }

      if (isFirstPage && data.summary) {
        setSummary(data.summary)
      }

      setTotalLoaded(prev => append ? prev + experimentsArray.length : experimentsArray.length)
      setHasMore(data.hasMore ?? experimentsArray.length === EXPERIMENTS_PER_PAGE)
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
      case 'RUNNING': return 'bg-blue-500 text-white'
      case 'COMPLETED': return 'bg-emerald-500 text-white'
      case 'FAILED': return 'bg-red-500 text-white'
      case 'PENDING': return 'bg-amber-500 text-white'
      case 'STOPPED': return 'bg-gray-500 text-white'
      default: return 'bg-gray-500 text-white'
    }
  }

  const getStatusDot = (status: string) => {
    switch (status) {
      case 'RUNNING': return 'bg-blue-500'
      case 'COMPLETED': return 'bg-emerald-500'
      case 'FAILED': return 'bg-red-500'
      case 'PENDING': return 'bg-amber-500'
      case 'STOPPED': return 'bg-gray-500'
      default: return 'bg-gray-500'
    }
  }

  const getGroupBadge = (group: string) => {
    return group === 'CONTROL'
      ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
      : 'bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800'
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

    const keyword = prompt(
      'To delete all experiments, enter the confirmation keyword:'
    )
    if (keyword?.trim() !== 'sciencefair2026') {
      if (keyword !== null) {
        alert('Incorrect keyword. Deletion cancelled.')
      }
      return
    }

    setDeletingAll(true)

    try {
      const response = await fetch(`/api/experiments/delete-all?keyword=${encodeURIComponent(keyword.trim())}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', 'x-delete-keyword': keyword.trim() },
        body: JSON.stringify({ keyword: keyword.trim() })
      })

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
      <main className="min-h-screen">
        <div className="max-w-6xl mx-auto px-6 py-8">
          <div className="space-y-4">
            {/* Skeleton hero */}
            <div className="skeleton h-32 w-full rounded-xl"></div>
            {/* Skeleton cards */}
            {[1, 2, 3].map(i => (
              <div key={i} className="skeleton h-24 w-full rounded-xl"></div>
            ))}
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen">
      <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">
        {/* Breadcrumb */}
        <nav className="breadcrumb">
          <Link href="/">Dashboard</Link>
          <span className="separator">/</span>
          <span>Experiments</span>
        </nav>

        {/* Hero Banner */}
        <div className="hero-banner-sm animate-fade-in">
          <div className="relative z-10">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <h1 className="text-3xl md:text-4xl font-bold text-white mb-1">
                  Experiments
                </h1>
                <p className="text-white/70 text-sm">
                  Manage and monitor genetic algorithm experiments
                </p>
              </div>
              <div className="flex gap-3">
                {experiments.length > 0 && (
                  <button
                    onClick={handleDeleteAll}
                    disabled={deletingAll}
                    className="btn-danger text-sm !py-2 !px-4 !bg-red-500/20 !text-white/90 hover:!bg-red-500/40 !shadow-none !border !border-white/20 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    {deletingAll ? 'Deleting...' : 'Delete All'}
                  </button>
                )}
                <button
                  onClick={() => setShowWorkers(!showWorkers)}
                  className={`text-sm inline-flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all border ${showWorkers
                    ? 'bg-white/20 text-white border-white/30'
                    : 'bg-white/10 text-white/70 border-white/15 hover:bg-white/20 hover:text-white'
                    }`}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
                  </svg>
                  Workers
                  {workerStats.active > 0 && (
                    <span className="px-1.5 py-0.5 text-xs rounded-full bg-emerald-400 text-white font-bold">
                      {workerStats.active}
                    </span>
                  )}
                </button>
                <Link
                  href="/experiments/new"
                  className="text-sm inline-flex items-center gap-2 px-5 py-2 rounded-lg font-semibold transition-all bg-white text-indigo-600 hover:bg-white/90 shadow-lg shadow-indigo-500/20"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  New Experiment
                </Link>
              </div>
            </div>

            {/* Metrics Bar inside hero */}
            {summary && (
              <div className="metrics-bar mt-5">
                <div className="metric-item">
                  <div className="metric-value text-emerald-300">{summary.completed.total}</div>
                  <div className="metric-label">Completed</div>
                  <div className="text-[10px] text-white/50 mt-0.5">
                    {summary.completed.control}C · {summary.completed.experimental}E
                  </div>
                </div>
                <div className="metric-item">
                  <div className="metric-value text-blue-300">{summary.running.total}</div>
                  <div className="metric-label">Running</div>
                  <div className="text-[10px] text-white/50 mt-0.5">
                    {summary.running.control}C · {summary.running.experimental}E
                  </div>
                </div>
                <div className="metric-item">
                  <div className="metric-value text-amber-300">{summary.pending.total}</div>
                  <div className="metric-label">Pending</div>
                  <div className="text-[10px] text-white/50 mt-0.5">
                    {summary.pending.control}C · {summary.pending.experimental}E
                  </div>
                </div>
                <div className="metric-item">
                  <div className="metric-value">{summary.completed.total + summary.running.total + summary.pending.total}</div>
                  <div className="metric-label">Total</div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Workers Section - Collapsible */}
        {showWorkers && (
          <div className="animate-fade-in">
            <WorkerList className="" />
          </div>
        )}

        {/* Experiment Cards */}
        <div className="space-y-3">
          {error ? (
            <div className="sci-card p-12 text-center animate-fade-in">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-red-100 dark:bg-red-900/30 mb-4">
                <svg className="w-7 h-7 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <p className="text-lg font-semibold text-red-600 dark:text-red-400 mb-2">Error Loading Experiments</p>
              <p className="text-sm text-red-500/80 dark:text-red-400/70 mb-4 max-w-md mx-auto">{error}</p>
              <button
                onClick={() => window.location.reload()}
                className="btn-danger"
              >
                Retry
              </button>
            </div>
          ) : sortedExperiments.length === 0 ? (
            <div className="sci-card p-16 text-center animate-fade-in">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-indigo-100 dark:bg-indigo-900/20 mb-4">
                <svg className="w-8 h-8 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                </svg>
              </div>
              <p className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-2">No experiments yet</p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">Create your first experiment to get started</p>
              <Link
                href="/experiments/new"
                className="btn-primary"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Create Experiment
              </Link>
            </div>
          ) : (
            <>
              {sortedExperiments.map((exp, idx) => (
                <Link
                  key={exp.id}
                  href={`/experiments/${exp.id}`}
                  className="experiment-card animate-fade-in"
                  style={{ animationDelay: `${idx * 30}ms` }}
                >
                  <div className="flex justify-between items-center">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2">
                        <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${getStatusDot(exp.status)} ${exp.status === 'RUNNING' ? 'animate-pulse' : ''}`} />
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-white truncate">
                          {exp.experiment_name}
                        </h2>
                      </div>
                      <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-gray-500 dark:text-gray-400 pl-5">
                        <span>
                          Mutation: <strong className="text-gray-700 dark:text-gray-300">{exp.mutation_mode === 'STATIC' ? 'Static (ε=0.05)' : 'Adaptive'}</strong>
                        </span>
                        <span>
                          Pop: <strong className="text-gray-700 dark:text-gray-300">{exp.population_size}</strong>
                        </span>
                        <span>
                          Gens: <strong className="text-gray-700 dark:text-gray-300">{exp.max_generations}</strong>
                        </span>
                        <span>
                          Seed: <strong className="text-gray-700 dark:text-gray-300">{exp.random_seed}</strong>
                        </span>
                        <span>{new Date(exp.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0 ml-4">
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${getGroupBadge(exp.experiment_group)}`}>
                        {exp.experiment_group}
                      </span>
                      <span className={`status-badge ${getStatusColor(exp.status)}`}>
                        {exp.status}
                      </span>
                      <button
                        onClick={(e) => handleDelete(e, exp.id, exp.experiment_name, exp.status)}
                        className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                        title="Delete experiment"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </Link>
              ))}

              {/* Pagination Controls */}
              <div className="mt-6 flex flex-col items-center gap-4">
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Showing {sortedExperiments.length} experiment{sortedExperiments.length !== 1 ? 's' : ''}
                  {hasMore && ' (more available)'}
                </p>

                {hasMore && (
                  <button
                    onClick={loadMore}
                    disabled={loadingMore}
                    className="btn-secondary disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loadingMore ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-indigo-600"></div>
                        Loading...
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                        Load More
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
