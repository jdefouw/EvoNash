'use client'

import { useState, useMemo } from 'react'
import { Generation, Experiment } from '@/types/protocol'

interface ExperimentDataTableProps {
  controlExperiments: Experiment[]
  experimentalExperiments: Experiment[]
  controlGenerations: Generation[]
  experimentalGenerations: Generation[]
}

type SortField = 'generation' | 'avg_elo' | 'peak_elo' | 'entropy' | 'variance' | 'diversity'
type SortDirection = 'asc' | 'desc'
type FilterGroup = 'all' | 'control' | 'experimental'

interface TableRow {
  group: 'control' | 'experimental'
  experimentName: string
  generation: number
  avg_elo: number | null
  peak_elo: number | null
  min_elo: number | null
  std_elo: number | null
  entropy: number | null
  variance: number | null
  diversity: number | null
  mutation_rate: number | null
}

export default function ExperimentDataTable({
  controlExperiments,
  experimentalExperiments,
  controlGenerations,
  experimentalGenerations
}: ExperimentDataTableProps) {
  const [sortField, setSortField] = useState<SortField>('generation')
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')
  const [filterGroup, setFilterGroup] = useState<FilterGroup>('all')
  const [currentPage, setCurrentPage] = useState(1)
  const rowsPerPage = 20

  // Build table data
  const tableData = useMemo(() => {
    const rows: TableRow[] = []

    // Add control generations
    controlGenerations.forEach(gen => {
      const exp = controlExperiments.find(e => e.id === gen.experiment_id)
      rows.push({
        group: 'control',
        experimentName: exp?.experiment_name || 'Control',
        generation: gen.generation_number,
        avg_elo: gen.avg_elo ?? null,
        peak_elo: gen.peak_elo ?? null,
        min_elo: gen.min_elo ?? null,
        std_elo: gen.std_elo ?? null,
        entropy: gen.policy_entropy ?? null,
        variance: gen.entropy_variance ?? null,
        diversity: gen.population_diversity ?? null,
        mutation_rate: gen.mutation_rate ?? null,
      })
    })

    // Add experimental generations
    experimentalGenerations.forEach(gen => {
      const exp = experimentalExperiments.find(e => e.id === gen.experiment_id)
      rows.push({
        group: 'experimental',
        experimentName: exp?.experiment_name || 'Experimental',
        generation: gen.generation_number,
        avg_elo: gen.avg_elo ?? null,
        peak_elo: gen.peak_elo ?? null,
        min_elo: gen.min_elo ?? null,
        std_elo: gen.std_elo ?? null,
        entropy: gen.policy_entropy ?? null,
        variance: gen.entropy_variance ?? null,
        diversity: gen.population_diversity ?? null,
        mutation_rate: gen.mutation_rate ?? null,
      })
    })

    return rows
  }, [controlGenerations, experimentalGenerations, controlExperiments, experimentalExperiments])

  // Filter and sort data
  const filteredAndSortedData = useMemo(() => {
    let data = [...tableData]

    // Filter by group
    if (filterGroup !== 'all') {
      data = data.filter(row => row.group === filterGroup)
    }

    // Sort
    data.sort((a, b) => {
      const aVal = a[sortField]
      const bVal = b[sortField]

      // Handle null values
      const aNum = aVal === null ? -Infinity : aVal
      const bNum = bVal === null ? -Infinity : bVal

      if (typeof aNum === 'string' && typeof bNum === 'string') {
        return sortDirection === 'asc' 
          ? aNum.localeCompare(bNum)
          : bNum.localeCompare(aNum)
      }

      // Treat as numbers
      const aNumeric = typeof aNum === 'number' ? aNum : -Infinity
      const bNumeric = typeof bNum === 'number' ? bNum : -Infinity

      return sortDirection === 'asc' 
        ? aNumeric - bNumeric
        : bNumeric - aNumeric
    })

    return data
  }, [tableData, filterGroup, sortField, sortDirection])

  // Pagination
  const totalPages = Math.ceil(filteredAndSortedData.length / rowsPerPage)
  const paginatedData = filteredAndSortedData.slice(
    (currentPage - 1) * rowsPerPage,
    currentPage * rowsPerPage
  )

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('asc')
    }
  }

  const exportToCSV = () => {
    const headers = ['Group', 'Experiment', 'Generation', 'Avg Elo', 'Peak Elo', 'Min Elo', 'Std Elo', 'Entropy', 'Variance', 'Diversity', 'Mutation Rate']
    const csvContent = [
      headers.join(','),
      ...filteredAndSortedData.map(row => [
        row.group,
        `"${row.experimentName}"`,
        row.generation,
        row.avg_elo?.toFixed(4) ?? '',
        row.peak_elo?.toFixed(4) ?? '',
        row.min_elo?.toFixed(4) ?? '',
        row.std_elo?.toFixed(4) ?? '',
        row.entropy?.toFixed(6) ?? '',
        row.variance?.toFixed(6) ?? '',
        row.diversity?.toFixed(6) ?? '',
        row.mutation_rate?.toFixed(4) ?? ''
      ].join(','))
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', `evonash_experiment_data_${new Date().toISOString().split('T')[0]}.csv`)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) {
      return <span className="text-gray-300 dark:text-gray-600">↕</span>
    }
    return <span className="text-blue-500">{sortDirection === 'asc' ? '↑' : '↓'}</span>
  }

  const formatNumber = (value: number | null, decimals: number = 2) => {
    if (value === null) return '-'
    return value.toFixed(decimals)
  }

  return (
    <section id="data" className="scroll-mt-20">
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex flex-wrap justify-between items-center gap-4 mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              7. Data Tables
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Raw generation data from all experiments ({filteredAndSortedData.length} records)
            </p>
          </div>
          
          <div className="flex flex-wrap gap-3">
            {/* Filter Buttons */}
            <div className="flex gap-1 bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
              {(['all', 'control', 'experimental'] as FilterGroup[]).map(group => (
                <button
                  key={group}
                  onClick={() => { setFilterGroup(group); setCurrentPage(1); }}
                  className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                    filterGroup === group
                      ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  {group === 'all' ? 'All' : group === 'control' ? 'Control' : 'Experimental'}
                </button>
              ))}
            </div>

            {/* Export Button */}
            <button
              onClick={exportToCSV}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Export CSV
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700">
                <th className="text-left py-3 px-2 font-semibold text-gray-900 dark:text-white">
                  Group
                </th>
                <th 
                  className="text-left py-3 px-2 font-semibold text-gray-900 dark:text-white cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700"
                  onClick={() => handleSort('generation')}
                >
                  <div className="flex items-center gap-1">
                    Gen <SortIcon field="generation" />
                  </div>
                </th>
                <th 
                  className="text-right py-3 px-2 font-semibold text-gray-900 dark:text-white cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700"
                  onClick={() => handleSort('avg_elo')}
                >
                  <div className="flex items-center justify-end gap-1">
                    Avg Elo <SortIcon field="avg_elo" />
                  </div>
                </th>
                <th 
                  className="text-right py-3 px-2 font-semibold text-gray-900 dark:text-white cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700"
                  onClick={() => handleSort('peak_elo')}
                >
                  <div className="flex items-center justify-end gap-1">
                    Peak Elo <SortIcon field="peak_elo" />
                  </div>
                </th>
                <th 
                  className="text-right py-3 px-2 font-semibold text-gray-900 dark:text-white cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700"
                  onClick={() => handleSort('entropy')}
                >
                  <div className="flex items-center justify-end gap-1">
                    Entropy <SortIcon field="entropy" />
                  </div>
                </th>
                <th 
                  className="text-right py-3 px-2 font-semibold text-gray-900 dark:text-white cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700"
                  onClick={() => handleSort('variance')}
                >
                  <div className="flex items-center justify-end gap-1">
                    Variance <SortIcon field="variance" />
                  </div>
                </th>
                <th 
                  className="text-right py-3 px-2 font-semibold text-gray-900 dark:text-white cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700"
                  onClick={() => handleSort('diversity')}
                >
                  <div className="flex items-center justify-end gap-1">
                    Diversity <SortIcon field="diversity" />
                  </div>
                </th>
                <th className="text-right py-3 px-2 font-semibold text-gray-900 dark:text-white">
                  Mutation
                </th>
              </tr>
            </thead>
            <tbody>
              {paginatedData.length > 0 ? (
                paginatedData.map((row, idx) => (
                  <tr 
                    key={`${row.group}-${row.generation}-${idx}`}
                    className={`border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 ${
                      idx % 2 === 0 ? 'bg-white dark:bg-gray-800' : 'bg-gray-50/50 dark:bg-gray-800/50'
                    }`}
                  >
                    <td className="py-2 px-2">
                      <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                        row.group === 'control'
                          ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                          : 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400'
                      }`}>
                        {row.group === 'control' ? 'CTRL' : 'EXP'}
                      </span>
                    </td>
                    <td className="py-2 px-2 font-mono text-gray-900 dark:text-white">
                      {row.generation}
                    </td>
                    <td className="py-2 px-2 text-right font-mono text-gray-700 dark:text-gray-300">
                      {formatNumber(row.avg_elo)}
                    </td>
                    <td className="py-2 px-2 text-right font-mono text-gray-700 dark:text-gray-300">
                      {formatNumber(row.peak_elo)}
                    </td>
                    <td className="py-2 px-2 text-right font-mono text-gray-700 dark:text-gray-300">
                      {formatNumber(row.entropy, 4)}
                    </td>
                    <td className="py-2 px-2 text-right font-mono text-gray-700 dark:text-gray-300">
                      {formatNumber(row.variance, 6)}
                    </td>
                    <td className="py-2 px-2 text-right font-mono text-gray-700 dark:text-gray-300">
                      {formatNumber(row.diversity, 4)}
                    </td>
                    <td className="py-2 px-2 text-right font-mono text-gray-700 dark:text-gray-300">
                      {formatNumber(row.mutation_rate, 4)}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-gray-500 dark:text-gray-400">
                    No experiment data available. Run experiments to populate this table.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <div className="text-sm text-gray-600 dark:text-gray-400">
              Page {currentPage} of {totalPages}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1 text-sm rounded border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <button
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-1 text-sm rounded border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
