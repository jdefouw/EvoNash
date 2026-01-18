'use client'

import { useEffect, useState } from 'react'

interface Worker {
  id: string
  worker_name: string | null
  gpu_type: string | null
  vram_gb: number
  max_parallel_jobs: number
  status: 'idle' | 'processing' | 'offline'
  active_jobs_count: number
  last_heartbeat: string
}

interface WorkerListProps {
  className?: string
}

export default function WorkerList({ className = '' }: WorkerListProps) {
  const [workers, setWorkers] = useState<Worker[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchWorkers = async () => {
      try {
        const response = await fetch('/api/workers')
        if (response.ok) {
          const data = await response.json()
          setWorkers(data.workers || [])
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
      </div>
    )
  }

  return (
    <div className={`${className} bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden`}>
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Workers</h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          {workers.filter(w => w.status !== 'offline').length} active, {workers.length} total
        </p>
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
                Jobs
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Status
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Last Heartbeat
              </th>
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
                <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{worker.active_jobs_count}</span>
                    <span className="text-gray-400">/</span>
                    <span className="text-gray-500 dark:text-gray-400">{worker.max_parallel_jobs}</span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5 mt-1">
                    <div
                      className="bg-blue-600 h-1.5 rounded-full"
                      style={{
                        width: `${(worker.active_jobs_count / worker.max_parallel_jobs) * 100}%`
                      }}
                    />
                  </div>
                </td>
                <td className="px-4 py-3 text-sm">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${getStatusColor(worker.status)} ${worker.status === 'processing' ? 'animate-pulse' : ''}`} />
                    <span className="text-gray-900 dark:text-white capitalize">{worker.status}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                  {formatLastHeartbeat(worker.last_heartbeat)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
