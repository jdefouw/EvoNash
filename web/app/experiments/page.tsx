'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface Experiment {
  id: string
  experiment_name: string
  experiment_group: 'CONTROL' | 'EXPERIMENTAL'
  mutation_mode: 'STATIC' | 'ADAPTIVE'
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED'
  created_at: string
}

export default function ExperimentsPage() {
  const [experiments, setExperiments] = useState<Experiment[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/experiments')
      .then(res => res.json())
      .then(data => {
        setExperiments(data)
        setLoading(false)
      })
      .catch(err => {
        console.error('Error fetching experiments:', err)
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

  if (loading) {
    return <div className="p-8">Loading experiments...</div>
  }

  return (
    <main className="min-h-screen p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-4xl font-bold">Experiments</h1>
          <Link
            href="/experiments/new"
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            New Experiment
          </Link>
        </div>

        <div className="grid gap-4">
          {experiments.length === 0 ? (
            <p className="text-gray-600">No experiments yet. Create one to get started.</p>
          ) : (
            experiments.map((exp) => (
              <Link
                key={exp.id}
                href={`/experiments/${exp.id}`}
                className="block p-6 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h2 className="text-2xl font-semibold mb-2">{exp.experiment_name}</h2>
                    <div className="flex gap-4 text-sm text-gray-600">
                      <span>Group: {exp.experiment_group}</span>
                      <span>Mode: {exp.mutation_mode}</span>
                      <span>Created: {new Date(exp.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <span className={`px-3 py-1 rounded text-white text-sm ${getStatusColor(exp.status)}`}>
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
