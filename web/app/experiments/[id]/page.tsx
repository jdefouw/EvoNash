'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { Experiment, Generation, Match } from '@/types/protocol'
import ExperimentChart from '@/components/ExperimentChart'
import EntropyChart from '@/components/EntropyChart'
import StatisticalSignificance from '@/components/StatisticalSignificance'
import LiveMetrics from '@/components/LiveMetrics'
import GenerationProgress from '@/components/GenerationProgress'
import StatusIndicator from '@/components/StatusIndicator'
import PetriDishViewer from '@/components/PetriDishViewer'
import MatchReplay from '@/components/MatchReplay'
import LiveViewLegend from '@/components/LiveViewLegend'
import SimulationReplay from '@/components/SimulationReplay'
import Tooltip from '@/components/Tooltip'
import WorkerList from '@/components/WorkerList'

export default function ExperimentDetailPage() {
  const params = useParams()
  const experimentId = params.id as string

  const [experiment, setExperiment] = useState<Experiment | null>(null)
  const [generations, setGenerations] = useState<Generation[]>([])
  const [latestGeneration, setLatestGeneration] = useState<Generation | null>(null)
  const [matches, setMatches] = useState<Match[]>([])
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null)
  const [loading, setLoading] = useState(true)
  const [pollingError, setPollingError] = useState<string | null>(null)
  const [retryCount, setRetryCount] = useState(0)
  const [workerStatus, setWorkerStatus] = useState<{ connected: boolean, pending_count: number } | null>(null)
  const [batches, setBatches] = useState<any[]>([])
  const [processingWorker, setProcessingWorker] = useState<{
    id: string
    worker_name: string | null
    gpu_type: string | null
    vram_gb: number
  } | null>(null)

  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const lastGenerationNumberRef = useRef<number>(-1)
  const lastPollTimeRef = useRef<string | null>(null)

  // Polling function with retry logic
  // NOTE: Uses functional state updates to avoid stale closure issues
  const pollLiveData = useCallback(async () => {
    if (!experimentId) return

    try {
      const url = new URL(`/api/experiments/${experimentId}/live`, window.location.origin)
      if (lastGenerationNumberRef.current >= 0) {
        url.searchParams.set('last_gen', lastGenerationNumberRef.current.toString())
      }
      if (lastPollTimeRef.current) {
        url.searchParams.set('since', lastPollTimeRef.current)
      }

      const response = await fetch(url.toString())
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      const data = await response.json()

      // Update experiment status if changed - use functional update to avoid stale closure
      if (data.experiment_status) {
        setExperiment(prev => {
          if (!prev) return prev
          if (prev.status !== data.experiment_status) {
            console.log(`[Experiment] Poll updating status: ${prev.status} -> ${data.experiment_status}`)
            // If experiment becomes RUNNING, update worker status to connected
            if (data.experiment_status === 'RUNNING') {
              setWorkerStatus(ws => ws ? { ...ws, connected: true } : { connected: true, pending_count: 0 })
            }
            return { ...prev, status: data.experiment_status }
          }
          return prev
        })
      }

      // Always update latest generation when the API returns one, so progress reflects server state.
      if (data.generation) {
        const newGen = data.generation
        setLatestGeneration(newGen)
        setGenerations(prev => {
          const exists = prev.some(g => g.generation_number === newGen.generation_number)
          if (exists) {
            return prev.map(g =>
              g.generation_number === newGen.generation_number ? newGen : g
            )
          }
          return [...prev, newGen].sort((a, b) => a.generation_number - b.generation_number)
        })
        lastGenerationNumberRef.current = newGen.generation_number
      }

      // Update matches
      if (data.matches && data.matches.length > 0) {
        setMatches(prev => {
          const newMatches = data.matches.filter((m: Match) =>
            !prev.some(existing => existing.agent_a_id === m.agent_a_id &&
              existing.agent_b_id === m.agent_b_id &&
              Math.abs(new Date(existing.created_at || '').getTime() - new Date(m.created_at || '').getTime()) < 1000)
          )
          return [...prev, ...newMatches].slice(-100) // Keep last 100 matches
        })
      }

      lastPollTimeRef.current = new Date().toISOString()
      setPollingError(null)
      setRetryCount(0)
    } catch (error) {
      console.error('Polling error:', error)
      setPollingError('Failed to fetch live data')
      setRetryCount(prev => prev + 1)

      // Exponential backoff: stop polling after 5 retries
      if (retryCount >= 5) {
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current)
          pollingIntervalRef.current = null
        }
      }
    }
  }, [experimentId, retryCount])

  // Initial data fetch
  useEffect(() => {
    if (!experimentId) {
      setLoading(false)
      return
    }

    let batchesInterval: NodeJS.Timeout | null = null
    let timeoutId: NodeJS.Timeout | null = null

    // Set a timeout to ensure loading is set to false even if fetch hangs
    timeoutId = setTimeout(() => {
      console.warn('Experiment fetch timeout, setting loading to false')
      setLoading(false)
    }, 10000) // 10 second timeout

    // Create AbortController for fetch timeout
    const abortController = new AbortController()
    const abortTimeout = setTimeout(() => {
      abortController.abort()
    }, 8000) // 8 second abort timeout

    // Fetch experiment - this is critical, set loading to false after this
    fetch(`/api/experiments/${experimentId}`, {
      signal: abortController.signal
    })
      .then(res => {
        clearTimeout(abortTimeout)
        if (timeoutId) clearTimeout(timeoutId)
        if (!res.ok) {
          throw new Error(`Failed to fetch experiment: ${res.status} ${res.statusText}`)
        }
        return res.json()
      })
      .then(data => {
        clearTimeout(abortTimeout)
        if (timeoutId) clearTimeout(timeoutId)
        if (!data || data.error) {
          throw new Error(data?.error || 'Invalid experiment data')
        }
        setExperiment(data)
        console.log('Experiment status:', data.status) // Debug log
        // Set loading to false once experiment is loaded
        setLoading(false)
      })
      .catch(err => {
        clearTimeout(abortTimeout)
        if (timeoutId) clearTimeout(timeoutId)
        if (err.name === 'AbortError') {
          console.warn('Experiment fetch aborted due to timeout')
        } else {
          console.error('Error fetching experiment:', err)
        }
        setLoading(false) // Set loading to false even on error
      })

    // Check worker status (non-blocking)
    fetch('/api/worker/status')
      .then(res => res.json())
      .then(data => {
        setWorkerStatus({
          connected: data.worker_connected || false,
          pending_count: data.pending_count || 0
        })
      })
      .catch(err => {
        console.error('Error fetching worker status:', err)
        // Don't block on this error
      })

    // Fetch batch assignments and worker info (non-blocking, handles missing tables gracefully)
    const fetchBatches = async () => {
      try {
        // Fetch batches for this experiment
        const batchRes = await fetch(`/api/experiments/${experimentId}/batches`)
        const batchData = batchRes.ok ? await batchRes.json() : { batches: [] }
        const batchList = batchData.batches || []
        setBatches(batchList)

        // Find the active batch (assigned or processing) and extract worker info
        const activeBatch = batchList.find((b: any) =>
          b.status === 'assigned' || b.status === 'processing'
        )

        if (activeBatch) {
          // Try to get worker info from the batch join first
          if (activeBatch.workers) {
            setProcessingWorker({
              id: activeBatch.workers.id,
              worker_name: activeBatch.workers.worker_name,
              gpu_type: activeBatch.workers.gpu_type,
              vram_gb: activeBatch.workers.vram_gb
            })
          } else if (activeBatch.worker_id) {
            // Fallback: fetch workers list and find the matching worker
            try {
              const workersRes = await fetch('/api/workers')
              if (workersRes.ok) {
                const workersData = await workersRes.json()
                const matchingWorker = (workersData.workers || []).find(
                  (w: any) => w.id === activeBatch.worker_id
                )
                if (matchingWorker) {
                  setProcessingWorker({
                    id: matchingWorker.id,
                    worker_name: matchingWorker.worker_name,
                    gpu_type: matchingWorker.gpu_type,
                    vram_gb: matchingWorker.vram_gb
                  })
                } else {
                  setProcessingWorker({
                    id: activeBatch.worker_id,
                    worker_name: null,
                    gpu_type: null,
                    vram_gb: 0
                  })
                }
              }
            } catch (workerErr) {
              console.error('Error fetching workers for fallback:', workerErr)
              if (activeBatch.worker_id) {
                setProcessingWorker({
                  id: activeBatch.worker_id,
                  worker_name: null,
                  gpu_type: null,
                  vram_gb: 0
                })
              } else {
                setProcessingWorker(null)
              }
            }
          } else {
            setProcessingWorker(null)
          }
        } else {
          setProcessingWorker(null)
        }
      } catch (err) {
        console.error('Error fetching batches:', err)
        setBatches([])
        setProcessingWorker(null)
      }
    }

    fetchBatches()

    // Refresh batches every 10 seconds
    batchesInterval = setInterval(fetchBatches, 10000)

    // Fetch generations (non-blocking)
    fetch(`/api/generations?experiment_id=${experimentId}`)
      .then(res => {
        if (!res.ok) {
          return []
        }
        return res.json()
      })
      .then(data => {
        setGenerations(data || [])
        if (data && data.length > 0) {
          const latest = data[data.length - 1]
          setLatestGeneration(latest)
          lastGenerationNumberRef.current = latest.generation_number
        }
      })
      .catch(err => {
        console.error('Error fetching generations:', err)
        // Don't block on this error
      })

    return () => {
      if (batchesInterval) clearInterval(batchesInterval)
      if (timeoutId) clearTimeout(timeoutId)
    }
  }, [experimentId])

  // Load generations for completed experiments
  useEffect(() => {
    if (experiment && experiment.status === 'COMPLETED' && generations.length === 0 && !loading) {
      console.log('[Experiment] Loading generations for completed experiment')
      fetch(`/api/generations?experiment_id=${experimentId}`)
        .then(res => res.json())
        .then(data => {
          setGenerations(data)
          if (data.length > 0) {
            const latest = data[data.length - 1]
            setLatestGeneration(latest)
            lastGenerationNumberRef.current = latest.generation_number
          }
        })
        .catch(err => {
          console.error('Error fetching generations for completed experiment:', err)
        })
    }
  }, [experiment?.status, experimentId, generations.length, loading])

  // Set up polling when experiment is running or pending
  useEffect(() => {
    const status = experiment?.status

    if (!status || (status !== 'RUNNING' && status !== 'PENDING')) {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current)
        pollingIntervalRef.current = null
      }
      return
    }

    // Poll every 3 seconds for RUNNING, every 5 seconds for PENDING
    const pollInterval = status === 'RUNNING' ? 3000 : 5000
    console.log(`[Experiment] Starting polling with interval: ${pollInterval}ms for status: ${status}`)
    pollingIntervalRef.current = setInterval(pollLiveData, pollInterval)

    // Initial poll
    pollLiveData()

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current)
        pollingIntervalRef.current = null
      }
    }
  }, [experiment?.status, pollLiveData, experimentId])

  if (loading) {
    return (
      <main className="min-h-screen">
        <div className="max-w-[1920px] mx-auto px-6 py-8">
          <div className="space-y-4">
            <div className="skeleton h-10 w-48 rounded-lg"></div>
            <div className="skeleton h-32 w-full rounded-xl"></div>
            <div className="grid lg:grid-cols-[60%_40%] gap-6">
              <div className="skeleton h-[500px] rounded-xl"></div>
              <div className="space-y-4">
                <div className="skeleton h-32 rounded-xl"></div>
                <div className="skeleton h-32 rounded-xl"></div>
                <div className="skeleton h-32 rounded-xl"></div>
              </div>
            </div>
          </div>
        </div>
      </main>
    )
  }

  if (!experiment) {
    return (
      <main className="min-h-screen">
        <div className="max-w-6xl mx-auto px-6 py-12">
          <div className="sci-card p-16 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-red-100 dark:bg-red-900/20 mb-4">
              <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-2">Experiment not found</p>
            <Link href="/experiments" className="btn-primary mt-4 inline-flex">
              Back to experiments
            </Link>
          </div>
        </div>
      </main>
    )
  }

  // Extract agents from latest generation for visualization
  const sampleAgents = latestGeneration ? Array.from({ length: Math.min(20, experiment.population_size) }, (_, i) => ({
    id: `agent-${i}`,
    x: Math.random() * 1000,
    y: Math.random() * 1000,
    angle: Math.random() * Math.PI * 2,
    energy: 50 + Math.random() * 50,
    vx: (Math.random() - 0.5) * 2,
    vy: (Math.random() - 0.5) * 2,
    fitness: (latestGeneration.avg_fitness || 1500) + (Math.random() - 0.5) * 200
  })) : []

  const sampleFood = Array.from({ length: 30 }, () => ({
    x: Math.random() * 1000,
    y: Math.random() * 1000,
    consumed: Math.random() > 0.7
  }))

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'RUNNING': return 'bg-blue-500 text-white'
      case 'COMPLETED': return 'bg-emerald-500 text-white'
      case 'FAILED': return 'bg-red-500 text-white'
      case 'PENDING': return 'bg-amber-500 text-white'
      case 'STOPPED': return 'bg-gray-500 text-white'
      default: return 'bg-gray-500 text-white'
    }
  }

  const getBatchStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-emerald-500'
      case 'processing': return 'bg-blue-500'
      case 'assigned': return 'bg-amber-500'
      case 'failed': return 'bg-red-500'
      default: return 'bg-gray-500'
    }
  }

  return (
    <main className="min-h-screen">
      <div className="max-w-[1920px] mx-auto px-4 md:px-6 py-6 space-y-6">
        {/* Breadcrumb */}
        <nav className="breadcrumb">
          <Link href="/">Dashboard</Link>
          <span className="separator">/</span>
          <Link href="/experiments">Experiments</Link>
          <span className="separator">/</span>
          <span className="text-gray-600 dark:text-gray-400 truncate max-w-[200px]">{experiment.experiment_name}</span>
        </nav>

        {/* Hero Banner */}
        <div className="hero-banner-sm animate-fade-in">
          <div className="relative z-10">
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-3 mb-2">
                  <h1 className="text-2xl md:text-3xl font-bold text-white truncate">
                    {experiment.experiment_name}
                  </h1>
                  <span className={`status-badge ${getStatusBadge(experiment.status)} ${experiment.status === 'RUNNING' ? 'animate-pulse-glow' : ''}`}>
                    {experiment.status === 'RUNNING' && <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />}
                    {experiment.status}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-3 text-sm">
                  <span className="text-white/70">
                    Group: <strong className="text-white">{experiment.experiment_group === 'CONTROL' ? 'Control (Static)' : 'Experimental (Adaptive)'}</strong>
                  </span>
                  {/* Processing worker pill */}
                  {experiment.status === 'RUNNING' && processingWorker && (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/15 text-white/90 text-xs backdrop-blur-sm">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      {processingWorker.worker_name || 'Worker'}
                      {processingWorker.gpu_type && <span className="text-white/60">({processingWorker.gpu_type})</span>}
                    </span>
                  )}
                  {experiment.status === 'PENDING' && (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-400/20 text-amber-200 text-xs backdrop-blur-sm">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                      Waiting for worker…
                    </span>
                  )}
                </div>
              </div>
              {/* Action Buttons */}
              <div className="flex gap-2 flex-shrink-0">
                <button
                  onClick={async (e) => {
                    e.preventDefault()
                    if (experiment.status === 'RUNNING' || experiment.status === 'COMPLETED') {
                      alert(`Cannot start experiment with status: ${experiment.status}`)
                      return
                    }
                    try {
                      const response = await fetch(`/api/experiments/${experimentId}/start`, { method: 'POST' })
                      if (response.ok) {
                        const data = await response.json()
                        setExperiment({ ...experiment, status: 'PENDING' })
                        alert(data.message || 'Experiment queued for GPU worker. Worker will pick it up within 30 seconds.')
                        setTimeout(() => { window.location.reload() }, 1000)
                      } else {
                        const error = await response.json()
                        alert(`Failed to queue experiment: ${error.error || 'Unknown error'}`)
                      }
                    } catch (error) {
                      alert(`Failed to queue experiment: ${error instanceof Error ? error.message : 'Unknown error'}`)
                    }
                  }}
                  className="text-sm inline-flex items-center gap-2 px-4 py-2 rounded-lg font-semibold transition-all bg-white text-emerald-600 hover:bg-white/90 shadow-lg shadow-emerald-500/10 disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={experiment.status === 'RUNNING' || experiment.status === 'COMPLETED'}
                  title={experiment.status === 'RUNNING' ? 'Experiment is already running' : experiment.status === 'COMPLETED' ? 'Experiment is completed' : 'Queue experiment for GPU worker'}
                >
                  {experiment.status === 'RUNNING' ? 'Running…' : experiment.status === 'PENDING' ? 'Queued' : experiment.status === 'COMPLETED' ? 'Completed' : 'Start'}
                </button>
                {experiment.status === 'RUNNING' && (
                  <>
                    <button
                      onClick={async () => {
                        if (!confirm('Are you sure you want to stop this experiment? The worker will finish the current generation before stopping.')) return
                        try {
                          const response = await fetch(`/api/experiments/${experimentId}/stop`, { method: 'POST' })
                          if (response.ok) {
                            setExperiment({ ...experiment, status: 'STOPPED' })
                            setTimeout(() => { window.location.reload() }, 500)
                          } else {
                            const error = await response.json()
                            alert(`Failed to stop experiment: ${error.error || 'Unknown error'}`)
                          }
                        } catch (error) {
                          alert(`Failed to stop experiment: ${error instanceof Error ? error.message : 'Unknown error'}`)
                        }
                      }}
                      className="text-sm inline-flex items-center gap-1.5 px-4 py-2 rounded-lg font-semibold bg-red-500/20 text-white/90 hover:bg-red-500/40 border border-white/20 transition-all"
                    >
                      Stop
                    </button>
                    {latestGeneration && latestGeneration.generation_number >= experiment.max_generations - 1 && (
                      <button
                        onClick={async () => {
                          if (!confirm('Force-complete this experiment? Use this if all generations are done but the experiment is stuck as "Running".')) return
                          try {
                            const response = await fetch(`/api/experiments/${experimentId}/complete`, { method: 'POST' })
                            if (response.ok) {
                              setExperiment({ ...experiment, status: 'COMPLETED' })
                              alert('Experiment marked as completed!')
                              setTimeout(() => { window.location.reload() }, 500)
                            } else {
                              const error = await response.json()
                              alert(`Failed to complete experiment: ${error.error || 'Unknown error'}`)
                            }
                          } catch (error) {
                            alert(`Failed to complete experiment: ${error instanceof Error ? error.message : 'Unknown error'}`)
                          }
                        }}
                        className="text-sm inline-flex items-center gap-1.5 px-4 py-2 rounded-lg font-semibold bg-purple-500/20 text-white/90 hover:bg-purple-500/40 border border-white/20 transition-all"
                        title="Force-complete this experiment if it's stuck at 100% progress"
                      >
                        Force Complete
                      </button>
                    )}
                  </>
                )}
                <button
                  onClick={async () => {
                    const warningMessage = experiment.status === 'RUNNING'
                      ? `WARNING: This experiment is currently running!\n\nAre you sure you want to delete "${experiment.experiment_name}"?\n\nThis will permanently delete all generations, matches, and analysis data. This action cannot be undone.`
                      : `Are you sure you want to delete "${experiment.experiment_name}"?\n\nThis will permanently delete all generations, matches, and analysis data. This action cannot be undone.`
                    if (!confirm(warningMessage)) return
                    try {
                      const response = await fetch(`/api/experiments/${experimentId}`, { method: 'DELETE' })
                      if (response.ok) {
                        window.location.href = '/experiments'
                      } else {
                        const error = await response.json()
                        alert(`Failed to delete experiment: ${error.error || 'Unknown error'}`)
                      }
                    } catch (error) {
                      alert(`Failed to delete experiment: ${error instanceof Error ? error.message : 'Unknown error'}`)
                    }
                  }}
                  className="text-sm inline-flex items-center gap-1.5 px-4 py-2 rounded-lg font-semibold bg-red-500/20 text-white/90 hover:bg-red-500/40 border border-white/20 transition-all"
                  title="Permanently delete this experiment and all its data"
                >
                  Delete
                </button>
              </div>
            </div>

            {/* Config Metrics Bar */}
            <div className="metrics-bar mt-5">
              <div className="metric-item">
                <div className="metric-value">{experiment.population_size}</div>
                <div className="metric-label">Population</div>
              </div>
              <div className="metric-item">
                <div className="metric-value">{experiment.max_generations}</div>
                <div className="metric-label">Max Gens</div>
              </div>
              <div className="metric-item">
                <div className="metric-value">{experiment.random_seed}</div>
                <div className="metric-label">Seed</div>
              </div>
              <div className="metric-item">
                <div className="metric-value text-sm">{experiment.mutation_mode === 'STATIC' ? 'Static' : 'Adaptive'}</div>
                <div className="metric-label">Mutation</div>
              </div>
              <div className="metric-item">
                <div className="metric-value">{experiment.selection_pressure}</div>
                <div className="metric-label">Selection</div>
              </div>
            </div>
          </div>
        </div>

        {/* Error Banner */}
        {pollingError && retryCount < 5 && (
          <div className="sci-card p-4 !border-amber-300 dark:!border-amber-700 !bg-amber-50 dark:!bg-amber-900/10 animate-fade-in">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-amber-700 dark:text-amber-300 text-sm">
                  ⚠️ {pollingError} (Retry {retryCount}/5)
                </span>
              </div>
              <button
                onClick={() => {
                  setPollingError(null)
                  setRetryCount(0)
                  pollLiveData()
                }}
                className="text-xs text-amber-700 dark:text-amber-300 hover:underline font-medium"
              >
                Retry Now
              </button>
            </div>
          </div>
        )}

        {pollingError && retryCount >= 5 && (
          <div className="sci-card p-4 !border-red-300 dark:!border-red-700 !bg-red-50 dark:!bg-red-900/10 animate-fade-in">
            <div className="flex items-center gap-2">
              <span className="text-red-700 dark:text-red-300 text-sm">
                ❌ Connection lost. Please refresh the page to resume live updates.
              </span>
            </div>
          </div>
        )}

        {/* Split View: Simulation and Metrics */}
        <div className="grid lg:grid-cols-[60%_40%] gap-6">
          {/* Left: Petri Dish Visualization */}
          <div className="space-y-4 animate-fade-in">
            <div className="sci-card p-5">
              <h2 className="section-heading !mb-4 !text-lg">
                <span className="section-number">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                </span>
                {experiment?.status === 'COMPLETED' ? 'Simulation Replay' : 'Live Simulation View'}
              </h2>
              {experiment?.status === 'COMPLETED' ? (
                <SimulationReplay
                  generations={generations}
                  experiment={experiment}
                  width={800}
                  height={600}
                />
              ) : experiment?.status === 'RUNNING' && latestGeneration ? (
                <PetriDishViewer
                  width={800}
                  height={600}
                  dishWidth={1000}
                  dishHeight={1000}
                  agents={sampleAgents}
                  food={sampleFood}
                  mode="live"
                />
              ) : (
                <div className="flex items-center justify-center h-[600px] bg-slate-900 rounded-xl border border-gray-700">
                  <div className="text-center text-gray-400">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gray-800 mb-4">
                      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <p className="text-lg mb-1 font-medium">
                      {experiment?.status === 'RUNNING' ? 'Waiting for simulation data…' : 'Start experiment to view simulation'}
                    </p>
                    <p className="text-sm text-gray-500">
                      {experiment?.status === 'PENDING' ? 'Worker will begin processing shortly' : 'Click Start above to begin'}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Match Replay Section */}
            {selectedMatch && (
              <div className="animate-fade-in">
                <MatchReplay match={selectedMatch} />
              </div>
            )}
          </div>

          {/* Right: Metrics Panel */}
          <div className="space-y-4 animate-fade-in" style={{ animationDelay: '100ms' }}>
            <LiveMetrics generation={latestGeneration} />
            <GenerationProgress
              experiment={experiment}
              currentGeneration={latestGeneration}
              generations={generations}
            />
            <LiveViewLegend />

            {/* All Workers */}
            <WorkerList compact={true} />

            {/* Worker Status Cards */}
            {experiment.status === 'PENDING' && (
              <div className="sci-card p-4 !border-amber-200 dark:!border-amber-800 !bg-amber-50 dark:!bg-amber-900/10">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-amber-500 rounded-full animate-pulse" />
                  <span className="text-sm font-medium text-amber-800 dark:text-amber-200">
                    Queued for GPU Worker
                  </span>
                </div>
                <p className="text-xs text-amber-700 dark:text-amber-300 mt-1 pl-4">
                  Worker polls every 30 seconds. Status will update to RUNNING when worker starts.
                </p>
              </div>
            )}

            {experiment.status === 'RUNNING' && latestGeneration && (
              <div className="sci-card p-4 !border-emerald-200 dark:!border-emerald-800 !bg-emerald-50 dark:!bg-emerald-900/10">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                  <span className="text-sm font-medium text-emerald-800 dark:text-emerald-200">
                    ✓ GPU Worker is Processing
                  </span>
                </div>
                <p className="text-xs text-emerald-700 dark:text-emerald-300 mt-1 pl-4">
                  Generation {latestGeneration.generation_number} completed. Worker is actively running on GPU.
                </p>
              </div>
            )}

            {experiment.status === 'RUNNING' && !latestGeneration && (
              <div className="sci-card p-4 !border-blue-200 dark:!border-blue-800 !bg-blue-50 dark:!bg-blue-900/10">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                  <span className="text-sm font-medium text-blue-800 dark:text-blue-200">
                    GPU Worker Started
                  </span>
                </div>
                <p className="text-xs text-blue-700 dark:text-blue-300 mt-1 pl-4">
                  Worker has claimed the job and is initializing. First generation data will appear shortly.
                </p>
              </div>
            )}

            {/* Batch Assignments */}
            {experiment.status === 'RUNNING' && batches.length > 0 && (
              <div className="sci-card p-5">
                <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                  <span className="section-number text-[10px]">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
                    </svg>
                  </span>
                  Generation Batches
                </h4>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {batches.map((batch: any) => {
                    const worker = batch.workers
                    return (
                      <div
                        key={batch.id}
                        className="flex items-center justify-between p-2.5 bg-gray-50 dark:bg-gray-800/50 rounded-lg text-xs"
                      >
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${getBatchStatusColor(batch.status)} ${batch.status === 'processing' ? 'animate-pulse' : ''}`} />
                          <span className="font-medium text-gray-900 dark:text-white">
                            Gens {batch.generation_start}-{batch.generation_end}
                          </span>
                        </div>
                        {worker && (
                          <div className="text-gray-600 dark:text-gray-400 flex items-center gap-1">
                            <span className="font-medium">{worker.worker_name || 'Unnamed'}</span>
                            <span className="text-gray-400">·</span>
                            <span>{worker.gpu_type || 'CPU'}</span>
                          </div>
                        )}
                        <span className="text-gray-500 dark:text-gray-400 capitalize">
                          {batch.status}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Configuration Card */}
            <div className="sci-card p-5">
              <h2 className="section-heading !text-base !mb-3">
                <span className="section-number text-[10px]">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </span>
                Configuration
              </h2>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="flex justify-between items-center p-2.5 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                  <span className="text-gray-500 dark:text-gray-400 text-xs">Population</span>
                  <Tooltip content="Number of neural network agents in each generation">
                    <span className="font-semibold text-gray-900 dark:text-white cursor-help">{experiment.population_size}</span>
                  </Tooltip>
                </div>
                <div className="flex justify-between items-center p-2.5 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                  <span className="text-gray-500 dark:text-gray-400 text-xs">Max Gens</span>
                  <Tooltip content="Total number of generations the experiment will run">
                    <span className="font-semibold text-gray-900 dark:text-white cursor-help">{experiment.max_generations}</span>
                  </Tooltip>
                </div>
                <div className="flex justify-between items-center p-2.5 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                  <span className="text-gray-500 dark:text-gray-400 text-xs">Seed</span>
                  <Tooltip content="Random seed value ensuring reproducible starting conditions">
                    <span className="font-semibold text-gray-900 dark:text-white cursor-help">{experiment.random_seed}</span>
                  </Tooltip>
                </div>
                <div className="flex justify-between items-center p-2.5 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                  <span className="text-gray-500 dark:text-gray-400 text-xs">Selection</span>
                  <Tooltip content="Strength of selection favoring high-performing agents">
                    <span className="font-semibold text-gray-900 dark:text-white cursor-help">{experiment.selection_pressure}</span>
                  </Tooltip>
                </div>
                {experiment.mutation_mode === 'STATIC' && experiment.mutation_rate && (
                  <div className="flex justify-between items-center p-2.5 bg-gray-50 dark:bg-gray-800/50 rounded-lg col-span-2">
                    <span className="text-gray-500 dark:text-gray-400 text-xs">Mutation Rate</span>
                    <Tooltip content="Fixed mutation rate for static mode - probability of random genetic changes">
                      <span className="font-semibold text-gray-900 dark:text-white cursor-help">{experiment.mutation_rate}</span>
                    </Tooltip>
                  </div>
                )}
                {experiment.mutation_mode === 'ADAPTIVE' && experiment.mutation_base && (
                  <div className="flex justify-between items-center p-2.5 bg-gray-50 dark:bg-gray-800/50 rounded-lg col-span-2">
                    <span className="text-gray-500 dark:text-gray-400 text-xs">Mutation Base</span>
                    <Tooltip content="Base rate for adaptive mutation. Default 0.0615 is calibrated so effective rate starts at ~5% (same as static) at initial fitness, ensuring fair comparison. Rate then scales by fitness.">
                      <span className="font-semibold text-gray-900 dark:text-white cursor-help">{experiment.mutation_base}</span>
                    </Tooltip>
                  </div>
                )}
              </div>
            </div>

            {/* Recent Matches */}
            {matches.length > 0 && (
              <div className="sci-card p-5">
                <h2 className="section-heading !text-base !mb-3">
                  <span className="section-number text-[10px]">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </span>
                  Recent Matches
                </h2>
                <div className="space-y-1.5 max-h-64 overflow-y-auto">
                  {matches.slice(-10).reverse().map((match, idx) => (
                    <button
                      key={idx}
                      onClick={() => setSelectedMatch(match)}
                      className="w-full text-left p-2.5 bg-gray-50 dark:bg-gray-800/50 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-900/10 transition-colors border border-transparent hover:border-indigo-200 dark:hover:border-indigo-800"
                    >
                      <div className="text-sm">
                        <div className="font-medium text-gray-900 dark:text-white text-xs">
                          Match {matches.length - idx}
                        </div>
                        <div className="text-gray-600 dark:text-gray-400 text-xs mt-0.5">
                          {match.winner_id ? `Winner: ${match.winner_id.slice(0, 8)}…` : 'Draw'}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Charts Section */}
        {generations.length > 0 && (
          <div className="space-y-6 animate-fade-in" style={{ animationDelay: '200ms' }}>
            <div className="sci-card p-5">
              <ExperimentChart
                generations={generations}
                experiment={experiment}
                isLive={experiment.status === 'RUNNING'}
              />
            </div>
            <div className="sci-card p-5">
              <EntropyChart
                generations={generations}
                experiment={experiment}
                isLive={experiment.status === 'RUNNING'}
              />
            </div>
            <div className="sci-card p-5">
              <StatisticalSignificance experimentId={experimentId} mutationMode={experiment.mutation_mode} />
            </div>
          </div>
        )}

        {generations.length === 0 && (
          <div className="sci-card p-16 text-center animate-fade-in">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gray-100 dark:bg-gray-800 mb-4">
              <svg className="w-7 h-7 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <p className="text-gray-600 dark:text-gray-400 font-medium">
              No generation data available yet
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">
              Start the experiment to begin collecting data
            </p>
          </div>
        )}
      </div>
    </main>
  )
}
