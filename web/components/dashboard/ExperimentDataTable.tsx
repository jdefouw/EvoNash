'use client'

import { useState, useMemo } from 'react'
import { Generation, Experiment } from '@/types/protocol'

interface ExperimentDataTableProps {
  controlExperiments: Experiment[]
  experimentalExperiments: Experiment[]
  controlGenerations: Generation[]
  experimentalGenerations: Generation[]
}

type SortField = 'generation' | 'avg_fitness' | 'peak_fitness' | 'entropy' | 'variance' | 'diversity'
type SortDirection = 'asc' | 'desc'
type FilterGroup = 'all' | 'control' | 'experimental'

interface TableRow {
  group: 'control' | 'experimental'
  experimentName: string
  generation: number
  avg_fitness: number | null
  peak_fitness: number | null
  min_fitness: number | null
  std_fitness: number | null
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

    controlGenerations.forEach(gen => {
      const exp = controlExperiments.find(e => e.id === gen.experiment_id)
      rows.push({
        group: 'control',
        experimentName: exp?.experiment_name || 'Control',
        generation: gen.generation_number,
        avg_fitness: gen.avg_fitness ?? null,
        peak_fitness: gen.peak_fitness ?? null,
        min_fitness: gen.min_fitness ?? null,
        std_fitness: gen.std_fitness ?? null,
        entropy: gen.policy_entropy ?? null,
        variance: gen.entropy_variance ?? null,
        diversity: gen.population_diversity ?? null,
        mutation_rate: gen.mutation_rate ?? null,
      })
    })

    experimentalGenerations.forEach(gen => {
      const exp = experimentalExperiments.find(e => e.id === gen.experiment_id)
      rows.push({
        group: 'experimental',
        experimentName: exp?.experiment_name || 'Experimental',
        generation: gen.generation_number,
        avg_fitness: gen.avg_fitness ?? null,
        peak_fitness: gen.peak_fitness ?? null,
        min_fitness: gen.min_fitness ?? null,
        std_fitness: gen.std_fitness ?? null,
        entropy: gen.policy_entropy ?? null,
        variance: gen.entropy_variance ?? null,
        diversity: gen.population_diversity ?? null,
        mutation_rate: gen.mutation_rate ?? null,
      })
    })

    return rows
  }, [controlGenerations, experimentalGenerations, controlExperiments, experimentalExperiments])

  // Dataset size calculations
  const totalRows = tableData.length
  const controlRows = tableData.filter(r => r.group === 'control').length
  const experimentalRows = tableData.filter(r => r.group === 'experimental').length
  const columnsPerRow = 8 // fields displayed
  const totalDataPoints = totalRows * columnsPerRow
  const estimatedSizeMB = ((totalRows * 120) / (1024 * 1024)).toFixed(1) // ~120 bytes per row estimate

  // Filter and sort data
  const filteredAndSortedData = useMemo(() => {
    let data = [...tableData]

    if (filterGroup !== 'all') {
      data = data.filter(row => row.group === filterGroup)
    }

    data.sort((a, b) => {
      const aVal = a[sortField]
      const bVal = b[sortField]
      const aNum = aVal ?? -Infinity
      const bNum = bVal ?? -Infinity
      return sortDirection === 'asc' ? aNum - bNum : bNum - aNum
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
    <section id="data" className="scroll-mt-20 space-y-6">
      {/* Dataset Size Info Card */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
          Raw Generation Data
        </h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 leading-relaxed">
          Every generation from every experiment — this is the full telemetry dataset. Each row represents
          one generation of one experiment, with fitness, entropy, variance, diversity, and mutation rate
          recorded per generation.
        </p>

        {/* Dataset Size Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <div className="bg-gray-50 dark:bg-gray-900/30 rounded-lg p-3 text-center border border-gray-200 dark:border-gray-700">
            <div className="text-xl font-bold text-gray-900 dark:text-white">{totalRows.toLocaleString()}</div>
            <div className="text-[11px] text-gray-500 dark:text-gray-400">Total rows</div>
          </div>
          <div className="bg-blue-50 dark:bg-blue-900/15 rounded-lg p-3 text-center border border-blue-100 dark:border-blue-800/40">
            <div className="text-xl font-bold text-blue-600 dark:text-blue-400">{controlRows.toLocaleString()}</div>
            <div className="text-[11px] text-gray-500 dark:text-gray-400">Control generations</div>
          </div>
          <div className="bg-purple-50 dark:bg-purple-900/15 rounded-lg p-3 text-center border border-purple-100 dark:border-purple-800/40">
            <div className="text-xl font-bold text-purple-600 dark:text-purple-400">{experimentalRows.toLocaleString()}</div>
            <div className="text-[11px] text-gray-500 dark:text-gray-400">Experimental generations</div>
          </div>
          <div className="bg-gray-50 dark:bg-gray-900/30 rounded-lg p-3 text-center border border-gray-200 dark:border-gray-700">
            <div className="text-xl font-bold text-gray-900 dark:text-white">{totalDataPoints.toLocaleString()}</div>
            <div className="text-[11px] text-gray-500 dark:text-gray-400">Data points</div>
          </div>
        </div>

        <div className="p-3 bg-amber-50 dark:bg-amber-900/15 rounded-lg border border-amber-100 dark:border-amber-800/40">
          <p className="text-xs text-amber-700 dark:text-amber-400 leading-relaxed">
            <strong>⚠ Large dataset:</strong> This table contains {totalRows.toLocaleString()} rows (~{estimatedSizeMB} MB).
            Each of the {controlExperiments.length + experimentalExperiments.length} experiments contributes
            ~{totalRows > 0 ? Math.round(totalRows / Math.max(controlExperiments.length + experimentalExperiments.length, 1)) : 0} generations
            of telemetry data. The table is paginated to {rowsPerPage} rows per page for performance.
          </p>
        </div>
      </div>

      {/* Data Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex flex-wrap justify-between items-center gap-4 mb-4">
          <div className="text-sm text-gray-600 dark:text-gray-400">
            Showing {((currentPage - 1) * rowsPerPage) + 1}–{Math.min(currentPage * rowsPerPage, filteredAndSortedData.length)} of {filteredAndSortedData.length.toLocaleString()} rows
          </div>

          {/* Filter Buttons */}
          <div className="flex gap-1 bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
            {(['all', 'control', 'experimental'] as FilterGroup[]).map(group => (
              <button
                key={group}
                onClick={() => { setFilterGroup(group); setCurrentPage(1); }}
                className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${filterGroup === group
                  ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                  }`}
              >
                {group === 'all' ? 'All' : group === 'control' ? 'Control' : 'Experimental'}
              </button>
            ))}
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
                  className="text-left py-3 px-2 font-semibold text-gray-900 dark:text-white cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 select-none"
                  onClick={() => handleSort('generation')}
                >
                  <div className="flex items-center gap-1">
                    Gen <SortIcon field="generation" />
                  </div>
                </th>
                <th
                  className="text-right py-3 px-2 font-semibold text-gray-900 dark:text-white cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 select-none"
                  onClick={() => handleSort('avg_fitness')}
                >
                  <div className="flex items-center justify-end gap-1">
                    Avg Fitness <SortIcon field="avg_fitness" />
                  </div>
                </th>
                <th
                  className="text-right py-3 px-2 font-semibold text-gray-900 dark:text-white cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 select-none"
                  onClick={() => handleSort('peak_fitness')}
                >
                  <div className="flex items-center justify-end gap-1">
                    Peak Fitness <SortIcon field="peak_fitness" />
                  </div>
                </th>
                <th
                  className="text-right py-3 px-2 font-semibold text-gray-900 dark:text-white cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 select-none"
                  onClick={() => handleSort('entropy')}
                >
                  <div className="flex items-center justify-end gap-1">
                    Entropy <SortIcon field="entropy" />
                  </div>
                </th>
                <th
                  className="text-right py-3 px-2 font-semibold text-gray-900 dark:text-white cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 select-none"
                  onClick={() => handleSort('variance')}
                >
                  <div className="flex items-center justify-end gap-1">
                    Variance <SortIcon field="variance" />
                  </div>
                </th>
                <th
                  className="text-right py-3 px-2 font-semibold text-gray-900 dark:text-white cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 select-none"
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
                    className={`border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 ${idx % 2 === 0 ? 'bg-white dark:bg-gray-800' : 'bg-gray-50/50 dark:bg-gray-800/50'
                      }`}
                  >
                    <td className="py-2 px-2">
                      <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${row.group === 'control'
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
                      {formatNumber(row.avg_fitness)}
                    </td>
                    <td className="py-2 px-2 text-right font-mono text-gray-700 dark:text-gray-300">
                      {formatNumber(row.peak_fitness)}
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
              Page {currentPage} of {totalPages.toLocaleString()}
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
