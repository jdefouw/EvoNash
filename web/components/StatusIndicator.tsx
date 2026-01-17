'use client'

import { ExperimentStatus } from '@/types/protocol'

interface StatusIndicatorProps {
  status: ExperimentStatus
  className?: string
}

export default function StatusIndicator({ status, className = '' }: StatusIndicatorProps) {
  const getStatusConfig = () => {
    switch (status) {
      case 'PENDING':
        return {
          color: 'bg-gray-500',
          pulse: false,
          label: 'Pending'
        }
      case 'RUNNING':
        return {
          color: 'bg-green-500',
          pulse: true,
          label: 'Running'
        }
      case 'COMPLETED':
        return {
          color: 'bg-blue-500',
          pulse: false,
          label: 'Completed'
        }
      case 'FAILED':
        return {
          color: 'bg-red-500',
          pulse: false,
          label: 'Failed'
        }
      case 'STOPPED':
        return {
          color: 'bg-orange-500',
          pulse: false,
          label: 'Stopped'
        }
      default:
        return {
          color: 'bg-gray-500',
          pulse: false,
          label: status
        }
    }
  }

  const config = getStatusConfig()

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div
        className={`w-3 h-3 rounded-full ${config.color} ${
          config.pulse ? 'animate-pulse' : ''
        }`}
      />
      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
        {config.label}
      </span>
    </div>
  )
}
