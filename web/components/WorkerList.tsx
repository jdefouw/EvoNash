'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

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
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchWorkers = async () => {
      try {
        const response = await fetch('/api/workers')
        if (response.ok) {
          const data = await response.json()
          setWorkers(data.workers || [])
          setActiveCount(data.active_workers_count || 0)
          setProcessingCount(data.processing_workers_count || 0)
        }
      } catch (error) {
        console.error('Error fetching workers:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchWorkers()
    
    // Refresh every 10 seconds
    const interval = setInterval(fetchWorkers, 10000)
    return () => clearInterval(interval)
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

  if (workers.length === 0) {
    return (
      <div className={`${className} p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700`}>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Workers</h3>
        <p className="text-sm text-gray-600 dark:text-gray-400">No workers registered</p>
        <p className="text-xs text-gray-500 dark:text-gray-500 mt-2">
          Download and run the worker on a machine with a GPU to get started.
        </p>
      </div>
    )
  }

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
          </div>
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
