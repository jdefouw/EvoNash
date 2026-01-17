'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import ExperimentChart from '@/components/ExperimentChart'
import EntropyChart from '@/components/EntropyChart'

interface Experiment {
  id: string
  experiment_name: string
  experiment_group: string
  mutation_mode: string
  status: string
  population_size: number
  max_generations: number
}

interface Generation {
  id: string
  generation_number: number
  avg_elo: number
  peak_elo: number
  policy_entropy: number
  entropy_variance: number
  mutation_rate: number
  population_diversity: number
}

export default function ExperimentDetailPage() {
  const params = useParams()
  const experimentId = params.id as string
  const [experiment, setExperiment] = useState<Experiment | null>(null)
  const [generations, setGenerations] = useState<Generation[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Fetch experiment
    fetch(`/api/experiments/${experimentId}`)
      .then(res => res.json())
      .then(data => setExperiment(data))
      .catch(err => console.error('Error fetching experiment:', err))

    // Fetch generations
    fetch(`/api/generations?experiment_id=${experimentId}`)
      .then(res => res.json())
      .then(data => {
        setGenerations(data)
        setLoading(false)
      })
      .catch(err => {
        console.error('Error fetching generations:', err)
        setLoading(false)
      })
  }, [experimentId])

  if (loading) {
    return <div className="p-8">Loading experiment...</div>
  }

  if (!experiment) {
    return <div className="p-8">Experiment not found</div>
  }

  const latestGen = generations[generations.length - 1]

  return (
    <main className="min-h-screen p-8">
      <div className="max-w-6xl mx-auto">
        <Link href="/experiments" className="text-blue-600 hover:underline mb-4 inline-block">
          ← Back to Experiments
        </Link>

        <h1 className="text-4xl font-bold mb-4">{experiment.experiment_name}</h1>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="p-4 border rounded">
            <div className="text-sm text-gray-600">Status</div>
            <div className="text-xl font-semibold">{experiment.status}</div>
          </div>
          <div className="p-4 border rounded">
            <div className="text-sm text-gray-600">Group</div>
            <div className="text-xl font-semibold">{experiment.experiment_group}</div>
          </div>
          <div className="p-4 border rounded">
            <div className="text-sm text-gray-600">Current Generation</div>
            <div className="text-xl font-semibold">{latestGen?.generation_number || 0}</div>
          </div>
          <div className="p-4 border rounded">
            <div className="text-sm text-gray-600">Peak Elo</div>
            <div className="text-xl font-semibold">{latestGen?.peak_elo?.toFixed(1) || 'N/A'}</div>
          </div>
        </div>

        <div className="grid gap-6 mb-8">
          <ExperimentChart generations={generations} />
          <EntropyChart generations={generations} />
        </div>

        <div className="mt-8">
          <h2 className="text-2xl font-semibold mb-4">Generation Data</h2>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse border">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border p-2">Generation</th>
                  <th className="border p-2">Avg Elo</th>
                  <th className="border p-2">Peak Elo</th>
                  <th className="border p-2">Entropy</th>
                  <th className="border p-2">Entropy Variance</th>
                  <th className="border p-2">Mutation Rate</th>
                </tr>
              </thead>
              <tbody>
                {generations.slice(-20).map((gen) => (
                  <tr key={gen.id}>
                    <td className="border p-2">{gen.generation_number}</td>
                    <td className="border p-2">{gen.avg_elo?.toFixed(2)}</td>
                    <td className="border p-2">{gen.peak_elo?.toFixed(2)}</td>
                    <td className="border p-2">{gen.policy_entropy?.toFixed(4)}</td>
                    <td className="border p-2">{gen.entropy_variance?.toFixed(4)}</td>
                    <td className="border p-2">{gen.mutation_rate?.toFixed(4)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </main>
  )
}
