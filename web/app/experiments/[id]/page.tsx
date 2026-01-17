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
  const [workerStatus, setWorkerStatus] = useState<{connected: boolean, pending_count: number} | null>(null)
  
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const lastGenerationNumberRef = useRef<number>(-1)
  const lastPollTimeRef = useRef<string | null>(null)

  // Polling function with retry logic
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
      
      // Update experiment status if changed
      if (data.experiment_status && experiment && data.experiment_status !== experiment.status) {
        setExperiment({ ...experiment, status: data.experiment_status })
      }

      // Always update latest generation if available (for progress display)
      if (data.generation) {
        const newGen = data.generation
        const isNew = !lastGenerationNumberRef.current || newGen.generation_number > lastGenerationNumberRef.current
        
        if (isNew || data.has_updates) {
          setLatestGeneration(newGen)
          setGenerations(prev => {
            // Check if this generation already exists
            const exists = prev.some(g => g.generation_number === newGen.generation_number)
            if (exists) {
              // Update existing
              return prev.map(g => 
                g.generation_number === newGen.generation_number ? newGen : g
              )
            } else {
              // Add new
              return [...prev, newGen].sort((a, b) => a.generation_number - b.generation_number)
            }
          })
          lastGenerationNumberRef.current = newGen.generation_number
        }
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
  }, [experimentId, experiment, retryCount])

  // Initial data fetch
  useEffect(() => {
    if (!experimentId) return

    // Fetch experiment
    fetch(`/api/experiments/${experimentId}`)
      .then(res => res.json())
      .then(data => {
        setExperiment(data)
        console.log('Experiment status:', data.status) // Debug log
      })
      .catch(err => {
        console.error('Error fetching experiment:', err)
      })

    // Check worker status
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
      })

    // Fetch generations
    fetch(`/api/generations?experiment_id=${experimentId}`)
      .then(res => res.json())
      .then(data => {
        setGenerations(data)
        if (data.length > 0) {
          const latest = data[data.length - 1]
          setLatestGeneration(latest)
          lastGenerationNumberRef.current = latest.generation_number
        }
        setLoading(false)
      })
      .catch(err => {
        console.error('Error fetching generations:', err)
        setLoading(false)
      })
  }, [experimentId])

  // Set up polling when experiment is running or pending
  useEffect(() => {
    if (!experiment || (experiment.status !== 'RUNNING' && experiment.status !== 'PENDING')) {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current)
        pollingIntervalRef.current = null
      }
      return
    }

    // Start polling every 1.5 seconds for RUNNING, every 3 seconds for PENDING
    const pollInterval = experiment.status === 'RUNNING' ? 1500 : 3000
    pollingIntervalRef.current = setInterval(pollLiveData, pollInterval)
    
    // Initial poll
    pollLiveData()

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current)
        pollingIntervalRef.current = null
      }
    }
  }, [experiment, pollLiveData])

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

  // Extract agents from latest generation for visualization
  // In a real implementation, this would come from match data or a separate endpoint
  const sampleAgents = latestGeneration ? Array.from({ length: Math.min(20, experiment.population_size) }, (_, i) => ({
    id: `agent-${i}`,
    x: Math.random() * 1000,
    y: Math.random() * 1000,
    angle: Math.random() * Math.PI * 2,
    energy: 50 + Math.random() * 50,
    vx: (Math.random() - 0.5) * 2,
    vy: (Math.random() - 0.5) * 2,
    elo: (latestGeneration.avg_elo || 1500) + (Math.random() - 0.5) * 200
  })) : []

  const sampleFood = Array.from({ length: 30 }, () => ({
    x: Math.random() * 1000,
    y: Math.random() * 1000,
    consumed: Math.random() > 0.7
  }))

  return (
    <main className="min-h-screen p-4 md:p-8 bg-gray-50 dark:bg-gray-900">
      <div className="max-w-[1920px] mx-auto">
        {/* Header */}
        <div className="mb-6">
          <Link 
            href="/experiments"
            className="text-blue-600 dark:text-blue-400 hover:underline mb-4 inline-block transition-colors"
          >
            ← Back to experiments
          </Link>
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mt-4">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-2">
                {experiment.experiment_name}
              </h1>
              <div className="flex flex-wrap gap-4 text-sm items-center">
                <span className="text-gray-600 dark:text-gray-400">
                  Group: <strong className="text-gray-900 dark:text-white">{experiment.experiment_group}</strong>
                </span>
                <span className="text-gray-600 dark:text-gray-400">
                  Mode: <strong className="text-gray-900 dark:text-white">{experiment.mutation_mode}</strong>
                </span>
                <StatusIndicator status={experiment.status} />
                {workerStatus && (
                  <div className="flex items-center gap-2 text-xs">
                    <div className={`w-2 h-2 rounded-full ${workerStatus.connected ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
                    <span className="text-gray-600 dark:text-gray-400">
                      Worker: {workerStatus.connected ? 'Connected' : 'Not Connected'}
                    </span>
                  </div>
                )}
              </div>
            </div>
            <div className="flex gap-3 items-center">
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
                      // Refresh after a short delay to show updated status
                      setTimeout(() => {
                        window.location.reload()
                      }, 1000)
                    } else {
                      const error = await response.json()
                      alert(`Failed to queue experiment: ${error.error || 'Unknown error'}`)
                    }
                  } catch (error) {
                    alert(`Failed to queue experiment: ${error instanceof Error ? error.message : 'Unknown error'}`)
                  }
                }}
                className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={experiment.status === 'RUNNING' || experiment.status === 'COMPLETED'}
                title={experiment.status === 'RUNNING' ? 'Experiment is already running' : experiment.status === 'COMPLETED' ? 'Experiment is completed' : 'Queue experiment for GPU worker'}
              >
                {experiment.status === 'RUNNING' ? 'Running...' : experiment.status === 'PENDING' ? 'Queued for Worker' : experiment.status === 'COMPLETED' ? 'Completed' : 'Start Experiment'}
              </button>
              {experiment.status === 'RUNNING' && (
                <button
                  onClick={async () => {
                    if (!confirm('Are you sure you want to stop this experiment? The worker will finish the current generation before stopping.')) {
                      return
                    }
                    try {
                      const response = await fetch(`/api/experiments/${experimentId}/stop`, { method: 'POST' })
                      if (response.ok) {
                        const data = await response.json()
                        setExperiment({ ...experiment, status: 'STOPPED' })
                        // Refresh the page after a short delay to show updated status
                        setTimeout(() => {
                          window.location.reload()
                        }, 500)
                      } else {
                        const error = await response.json()
                        alert(`Failed to stop experiment: ${error.error || 'Unknown error'}`)
                      }
                    } catch (error) {
                      alert(`Failed to stop experiment: ${error instanceof Error ? error.message : 'Unknown error'}`)
                    }
                  }}
                  className="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium"
                >
                  Stop Experiment
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Error Banner */}
        {pollingError && retryCount < 5 && (
          <div className="mb-4 p-4 bg-yellow-100 dark:bg-yellow-900/30 border border-yellow-400 dark:border-yellow-700 rounded-lg animate-fade-in">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-yellow-800 dark:text-yellow-200 text-sm">
                  ⚠️ {pollingError} (Retry {retryCount}/5)
                </span>
              </div>
              <button
                onClick={() => {
                  setPollingError(null)
                  setRetryCount(0)
                  pollLiveData()
                }}
                className="text-xs text-yellow-800 dark:text-yellow-200 hover:underline"
              >
                Retry Now
              </button>
            </div>
          </div>
        )}
        
        {pollingError && retryCount >= 5 && (
          <div className="mb-4 p-4 bg-red-100 dark:bg-red-900/30 border border-red-400 dark:border-red-700 rounded-lg animate-fade-in">
            <div className="flex items-center gap-2">
              <span className="text-red-800 dark:text-red-200 text-sm">
                ❌ Connection lost. Please refresh the page to resume live updates.
              </span>
            </div>
          </div>
        )}

        {/* Split View: Simulation and Metrics */}
        <div className="grid lg:grid-cols-[60%_40%] gap-6 mb-6">
          {/* Left: Petri Dish Visualization */}
          <div className="space-y-4">
            <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
              <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">
                Live Simulation View
              </h2>
              {experiment.status === 'RUNNING' && latestGeneration ? (
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
                <div className="flex items-center justify-center h-[600px] bg-slate-900 rounded-lg border border-gray-700">
                  <div className="text-center text-gray-400">
                    <p className="text-lg mb-2">
                      {experiment.status === 'RUNNING' ? 'Waiting for simulation data...' : 'Start experiment to view simulation'}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Match Replay Section */}
            {selectedMatch && (
              <MatchReplay match={selectedMatch} />
            )}
          </div>

          {/* Right: Metrics Panel */}
          <div className="space-y-4">
            <LiveMetrics generation={latestGeneration} />
            <GenerationProgress 
              experiment={experiment} 
              currentGeneration={latestGeneration}
              generations={generations}
            />
            
            {/* Worker Status Card */}
            {experiment.status === 'PENDING' && (
              <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg border border-yellow-200 dark:border-yellow-800">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse" />
                  <span className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                    Queued for GPU Worker - Waiting for worker to pick up...
                  </span>
                </div>
                <p className="text-xs text-yellow-700 dark:text-yellow-300 mt-1">
                  Worker polls every 30 seconds. Status will update to RUNNING when worker starts.
                </p>
              </div>
            )}
            
            {experiment.status === 'RUNNING' && latestGeneration && (
              <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg border border-green-200 dark:border-green-800">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                  <span className="text-sm font-medium text-green-800 dark:text-green-200">
                    ✓ GPU Worker is Processing
                  </span>
                </div>
                <p className="text-xs text-green-700 dark:text-green-300 mt-1">
                  Generation {latestGeneration.generation_number} completed. Worker is actively running on GPU.
                </p>
              </div>
            )}
            
            {experiment.status === 'RUNNING' && !latestGeneration && (
              <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                  <span className="text-sm font-medium text-blue-800 dark:text-blue-200">
                    GPU Worker Started - Waiting for first generation...
                  </span>
                </div>
                <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                  Worker has claimed the job and is initializing. First generation data will appear shortly.
                </p>
              </div>
            )}
            
            {/* Configuration Card */}
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700">
              <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">Configuration</h2>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-600 dark:text-gray-400">Population Size:</span>
                  <span className="ml-2 font-medium text-gray-900 dark:text-white">{experiment.population_size}</span>
                </div>
                <div>
                  <span className="text-gray-600 dark:text-gray-400">Max Generations:</span>
                  <span className="ml-2 font-medium text-gray-900 dark:text-white">{experiment.max_generations}</span>
                </div>
                <div>
                  <span className="text-gray-600 dark:text-gray-400">Random Seed:</span>
                  <span className="ml-2 font-medium text-gray-900 dark:text-white">{experiment.random_seed}</span>
                </div>
                <div>
                  <span className="text-gray-600 dark:text-gray-400">Selection Pressure:</span>
                  <span className="ml-2 font-medium text-gray-900 dark:text-white">{experiment.selection_pressure}</span>
                </div>
                {experiment.mutation_mode === 'STATIC' && experiment.mutation_rate && (
                  <div>
                    <span className="text-gray-600 dark:text-gray-400">Mutation Rate:</span>
                    <span className="ml-2 font-medium text-gray-900 dark:text-white">{experiment.mutation_rate}</span>
                  </div>
                )}
                {experiment.mutation_mode === 'ADAPTIVE' && experiment.mutation_base && (
                  <div>
                    <span className="text-gray-600 dark:text-gray-400">Mutation Base:</span>
                    <span className="ml-2 font-medium text-gray-900 dark:text-white">{experiment.mutation_base}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Recent Matches */}
            {matches.length > 0 && (
              <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700">
                <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">Recent Matches</h2>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {matches.slice(-10).reverse().map((match, idx) => (
                    <button
                      key={idx}
                      onClick={() => setSelectedMatch(match)}
                      className="w-full text-left p-3 bg-gray-50 dark:bg-gray-900 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                    >
                      <div className="text-sm">
                        <div className="font-medium text-gray-900 dark:text-white">
                          Match {matches.length - idx}
                        </div>
                        <div className="text-gray-600 dark:text-gray-400 text-xs mt-1">
                          {match.winner_id ? `Winner: ${match.winner_id.slice(0, 8)}...` : 'Draw'}
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
          <div className="space-y-6">
            <ExperimentChart 
              generations={generations} 
              experiment={experiment} 
              isLive={experiment.status === 'RUNNING'}
            />
            <EntropyChart 
              generations={generations} 
              experiment={experiment}
              isLive={experiment.status === 'RUNNING'}
            />
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
