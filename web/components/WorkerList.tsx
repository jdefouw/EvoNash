'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase/client'

interface CurrentExperiment {
  experiment_id: string
  experiment_name: string
  generation_start: number
  generation_end: number
  status: string
}

interface Worker {
  id: string
  worker_name: string | null
  gpu_type: string | null
  vram_gb: number
  max_parallel_jobs: number
  status: 'idle' | 'processing' | 'offline'
  active_jobs_count: number
  last_heartbeat: string
  current_experiment: CurrentExperiment | null
}

interface WorkerListProps {
  className?: string
  compact?: boolean
}

export default function WorkerList({ className = '', compact = false }: WorkerListProps) {
  const [workers, setWorkers] = useState<Worker[]>([])
  const [activeCount, setActiveCount] = useState(0)
  const [processingCount, setProcessingCount] = useState(0)
  const [totalCapacity, setTotalCapacity] = useState(0)
  const [utilizedCapacity, setUtilizedCapacity] = useState(0)
  const [pendingJobsCount, setPendingJobsCount] = useState(0)
  const [processingJobsCount, setProcessingJobsCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [clearing, setClearing] = useState(false)

  const fetchWorkers = async () => {
    try {
      const response = await fetch('/api/workers')
      if (response.ok) {
        const data = await response.json()
        setWorkers(data.workers || [])
        setActiveCount(data.active_workers_count || 0)
        setProcessingCount(data.processing_workers_count || 0)
        setTotalCapacity(data.total_capacity || 0)
        setUtilizedCapacity(data.utilized_capacity || 0)
        setPendingJobsCount(data.pending_jobs_count || 0)
        setProcessingJobsCount(data.processing_jobs_count || 0)
        setError(null)  // Clear any previous error
        setLastUpdated(new Date())
      } else {
        const errorData = await response.json().catch(() => ({}))
        setError(errorData.error || `Failed to fetch workers (${response.status})`)
      }
    } catch (err) {
      console.error('Error fetching workers:', err)
      setError('Network error - unable to reach server')
    } finally {
      setLoading(false)
    }
  }

  const clearAllWorkers = async () => {
    if (!confirm('Remove all workers from the dashboard? Offline workers will be removed. Job assignments for those workers are also removed.')) {
      return
    }
    setClearing(true)
    try {
      const res = await fetch('/api/workers/clear', { method: 'POST' })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        await fetchWorkers()
      } else {
        setError(data.error || 'Failed to clear workers')
      }
    } catch (err) {
      setError('Failed to clear workers')
    } finally {
      setClearing(false)
    }
  }

  useEffect(() => {
    // Initial fetch
    fetchWorkers()
    
    // Set up Supabase Realtime subscription for instant updates
    const channel = supabase
      .channel('workers-realtime')
      .on(
        'postgres_changes',
        {
          event: '*', // Listen to INSERT, UPDATE, DELETE
          schema: 'public',
          table: 'workers'
        },
        (payload) => {
          console.log('[WorkerList] Realtime event:', payload.eventType, payload)
          // Re-fetch to get complete data including job assignments
          // This ensures we have current_experiment info which requires a join
          fetchWorkers()
        }
      )
      .subscribe((status) => {
        console.log('[WorkerList] Realtime subscription status:', status)
        if (status === 'SUBSCRIBED') {
          console.log('[WorkerList] Successfully subscribed to workers table')
        } else if (status === 'CHANNEL_ERROR') {
          console.error('[WorkerList] Realtime subscription error - falling back to polling')
        }
      })
    
    // Fallback polling every 5 seconds to ensure updates even if realtime fails
    const fallbackInterval = setInterval(() => {
      fetchWorkers()
    }, 5000)
    
    return () => {
      channel.unsubscribe()
      clearInterval(fallbackInterval)
    }
  }, [])

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'idle':
        return 'bg-green-500'
      case 'processing':
        return 'bg-blue-500'
      case 'offline':
        return 'bg-gray-500'
      default:
        return 'bg-gray-500'
    }
  }

  const formatLastHeartbeat = (timestamp: string) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffSecs = Math.floor(diffMs / 1000)
    
    if (diffSecs < 60) {
      return `${diffSecs}s ago`
    } else if (diffSecs < 3600) {
      return `${Math.floor(diffSecs / 60)}m ago`
    } else {
      return date.toLocaleTimeString()
    }
  }

  if (loading) {
    return (
      <div className={`${className} p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700`}>
        <div className="text-center py-4">
          <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">Loading workers...</p>
        </div>
      </div>
    )
  }

  if (error && workers.length === 0) {
    return (
      <div className={`${className} p-4 bg-white dark:bg-gray-800 rounded-lg border border-red-200 dark:border-red-700`}>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Workers</h3>
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-md p-3">
          <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
          <button 
            onClick={() => { setLoading(true); fetchWorkers(); }}
            className="mt-2 text-xs text-red-600 dark:text-red-400 hover:underline"
          >
            Retry now
          </button>
        </div>
      </div>
    )
  }

  if (workers.length === 0) {
    return (
      <div className={`${className} p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700`}>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Workers</h3>
        <p className="text-sm text-gray-600 dark:text-gray-400">No workers registered</p>
        <p className="text-xs text-gray-500 dark:text-gray-500 mt-2">
          Download and run the worker on a machine with a GPU to get started.
        </p>
        {lastUpdated && (
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
            Last checked: {lastUpdated.toLocaleTimeString()}
          </p>
        )}
      </div>
    )
  }

  // Calculate capacity percentage
  const capacityPercentage = totalCapacity > 0 ? Math.round((utilizedCapacity / totalCapacity) * 100) : 0

  return (
    <div className={`${className} bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden`}>
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Workers</h3>
          <div className="flex items-center gap-2">
            <span className="px-2 py-1 text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full">
              {activeCount} connected
            </span>
            {processingCount > 0 && (
              <span className="px-2 py-1 text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-full">
                {processingCount} processing
              </span>
            )}
            <button
              type="button"
              onClick={clearAllWorkers}
              disabled={clearing || workers.length === 0}
              className="px-2 py-1 text-xs font-medium text-amber-700 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/30 rounded-full border border-amber-300 dark:border-amber-700 disabled:opacity-50 disabled:cursor-not-allowed"
              title="Remove all workers from the database (cleans up offline/stale entries)"
            >
              {clearing ? 'Clearing…' : 'Clear all'}
            </button>
          </div>
        </div>
        
        {/* Error Banner - shown when fetch fails but we have cached data */}
        {error && workers.length > 0 && (
          <div className="mt-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-md p-2 flex items-center justify-between">
            <p className="text-xs text-amber-700 dark:text-amber-400">
              Update failed: {error}
              {lastUpdated && ` (showing data from ${lastUpdated.toLocaleTimeString()})`}
            </p>
            <button 
              onClick={() => fetchWorkers()}
              className="text-xs text-amber-600 dark:text-amber-400 hover:underline ml-2"
            >
              Retry
            </button>
          </div>
        )}
        
        {/* Queue Status Section */}
        <div className="mt-3 flex flex-wrap items-center gap-4 text-sm">
          {/* Capacity Bar */}
          <div className="flex items-center gap-2">
            <span className="text-gray-600 dark:text-gray-400">Capacity:</span>
            <span className="font-medium text-gray-900 dark:text-white">{utilizedCapacity}/{totalCapacity}</span>
            <div className="w-24 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div 
                className={`h-full rounded-full transition-all ${
                  capacityPercentage >= 90 ? 'bg-red-500' : 
                  capacityPercentage >= 70 ? 'bg-amber-500' : 'bg-blue-500'
                }`}
                style={{ width: `${capacityPercentage}%` }}
              />
            </div>
          </div>
          
          {/* Processing Jobs */}
          {processingJobsCount > 0 && (
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
              <span className="text-blue-600 dark:text-blue-400 font-medium">
                {processingJobsCount} job{processingJobsCount !== 1 ? 's' : ''} running
              </span>
            </div>
          )}
          
          {/* Pending Jobs */}
          {pendingJobsCount > 0 && (
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 bg-amber-500 rounded-full" />
              <span className="text-amber-600 dark:text-amber-400 font-medium">
                {pendingJobsCount} job{pendingJobsCount !== 1 ? 's' : ''} queued
              </span>
            </div>
          )}
          
          {/* All Clear */}
          {processingJobsCount === 0 && pendingJobsCount === 0 && activeCount > 0 && (
            <span className="text-gray-500 dark:text-gray-400 italic">
              No active jobs - workers idle
            </span>
          )}
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-gray-900">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Worker
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                GPU
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Current Experiment
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Status
              </th>
              {!compact && (
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Last Seen
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {workers.map((worker) => (
              <tr key={worker.id} className="hover:bg-gray-50 dark:hover:bg-gray-900">
                <td className="px-4 py-3 text-sm">
                  <div className="font-medium text-gray-900 dark:text-white">
                    {worker.worker_name || 'Unnamed Worker'}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {worker.id.substring(0, 8)}...
                  </div>
                </td>
                <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                  <div>{worker.gpu_type || 'CPU'}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {worker.vram_gb}GB VRAM
                  </div>
                </td>
                <td className="px-4 py-3 text-sm">
                  {worker.current_experiment ? (
                    <div>
                      <Link 
                        href={`/experiments/${worker.current_experiment.experiment_id}`}
                        className="font-medium text-blue-600 dark:text-blue-400 hover:underline"
                      >
                        {worker.current_experiment.experiment_name}
                      </Link>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        Gens {worker.current_experiment.generation_start}-{worker.current_experiment.generation_end}
                      </div>
                    </div>
                  ) : (
                    <span className="text-gray-400 dark:text-gray-500">
                      {worker.status === 'offline' ? '—' : 'Idle'}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-sm">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${getStatusColor(worker.status)} ${worker.status === 'processing' ? 'animate-pulse' : ''}`} />
                    <span className="text-gray-900 dark:text-white capitalize">{worker.status}</span>
                  </div>
                </td>
                {!compact && (
                  <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                    {formatLastHeartbeat(worker.last_heartbeat)}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
