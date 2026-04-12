'use client'

import { useState, useMemo } from 'react'

interface ConvergenceDataPoint {
  experimentId: string
  group: string
  seed: number
  convergenceGeneration: number
}

interface ConvergenceDataTableProps {
  data: ConvergenceDataPoint[]
  controlMean: number | null
  experimentalMean: number | null
  controlStd: number | null
  experimentalStd: number | null
  cohensD: number | null
  pValue: number | null
}

type SortField = 'seed' | 'convergenceGeneration' | 'group'
type SortDirection = 'asc' | 'desc'
type FilterGroup = 'all' | 'CONTROL' | 'EXPERIMENTAL'

export default function ConvergenceDataTable({
  data,
  controlMean,
  experimentalMean,
  controlStd,
  experimentalStd,
  cohensD,
  pValue,
}: ConvergenceDataTableProps) {
  const [sortField, setSortField] = useState<SortField>('seed')
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')
  const [filterGroup, setFilterGroup] = useState<FilterGroup>('all')
  const [currentPage, setCurrentPage] = useState(1)
  const rowsPerPage = 25

  const controlCount = data.filter(d => d.group === 'CONTROL').length
  const experimentalCount = data.filter(d => d.group === 'EXPERIMENTAL').length

  const filteredAndSorted = useMemo(() => {
    let filtered = [...data]
    if (filterGroup !== 'all') {
      filtered = filtered.filter(d => d.group === filterGroup)
    }
    filtered.sort((a, b) => {
      let aVal: number | string = a[sortField]
      let bVal: number | string = b[sortField]
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortDirection === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal)
      }
      return sortDirection === 'asc' ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number)
    })
    return filtered
  }, [data, filterGroup, sortField, sortDirection])

  const totalPages = Math.ceil(filteredAndSorted.length / rowsPerPage)
  const paginatedData = filteredAndSorted.slice(
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
    setCurrentPage(1)
  }

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <span className="text-gray-300 dark:text-gray-600">↕</span>
    return <span className="text-blue-500">{sortDirection === 'asc' ? '↑' : '↓'}</span>
  }

  const formatP = (p: number | null) => {
    if (p === null) return '—'
    return p < 0.0001 ? p.toExponential(2) : p.toFixed(4)
  }

  return (
    <section className="scroll-mt-20 space-y-6">
      {/* Explanation Card */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
          Convergence Data — Statistical Test Input
        </h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 leading-relaxed">
          This table shows <strong>one row per converged experiment</strong> — the single data point
          from each experiment that was used to calculate the t-test statistic, Cohen&apos;s d, and
          all related statistical measures. Each value represents the <strong>generation number at which
          that experiment first reached Nash equilibrium</strong> (entropy variance σ &lt; 0.001 sustained
          for 20+ consecutive generations).
        </p>

        {/* Summary stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <div className="bg-blue-50 dark:bg-blue-900/15 rounded-lg p-3 text-center border border-blue-100 dark:border-blue-800/40">
            <div className="text-xl font-bold text-blue-600 dark:text-blue-400">{controlCount}</div>
            <div className="text-[11px] text-gray-600 dark:text-gray-400">Control converged</div>
            <div className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">
              μ = {controlMean?.toFixed(1) ?? '—'} ± {controlStd?.toFixed(1) ?? '—'}
            </div>
          </div>
          <div className="bg-purple-50 dark:bg-purple-900/15 rounded-lg p-3 text-center border border-purple-100 dark:border-purple-800/40">
            <div className="text-xl font-bold text-purple-600 dark:text-purple-400">{experimentalCount}</div>
            <div className="text-[11px] text-gray-600 dark:text-gray-400">Experimental converged</div>
            <div className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">
              μ = {experimentalMean?.toFixed(1) ?? '—'} ± {experimentalStd?.toFixed(1) ?? '—'}
            </div>
          </div>
          <div className="bg-gray-50 dark:bg-gray-900/30 rounded-lg p-3 text-center border border-gray-200 dark:border-gray-700">
            <div className="text-xl font-bold text-gray-900 dark:text-white">
              {cohensD !== null ? cohensD.toFixed(3) : '—'}
            </div>
            <div className="text-[11px] text-gray-600 dark:text-gray-400">Cohen&apos;s d</div>
          </div>
          <div className="bg-gray-50 dark:bg-gray-900/30 rounded-lg p-3 text-center border border-gray-200 dark:border-gray-700">
            <div className="text-xl font-bold text-gray-900 dark:text-white">
              {formatP(pValue)}
            </div>
            <div className="text-[11px] text-gray-600 dark:text-gray-400">p-value</div>
          </div>
        </div>

        <div className="p-3 bg-indigo-50 dark:bg-indigo-900/15 rounded-lg border border-indigo-100 dark:border-indigo-800/40">
          <p className="text-xs text-indigo-700 dark:text-indigo-400 leading-relaxed">
            <strong>How to read this table:</strong> Each row is one independent experiment.
            The &quot;Convergence Gen&quot; column shows when that experiment achieved Nash equilibrium.
            The t-test compares these values between the Control and Experimental columns to determine
            if adaptive mutation significantly affects convergence speed. Lower generation = faster convergence.
          </p>
        </div>
      </div>

      {/* Data Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex flex-wrap justify-between items-center gap-4 mb-4">
          <div className="text-sm text-gray-600 dark:text-gray-400">
            {filteredAndSorted.length} experiments shown
          </div>
          <div className="flex gap-1 bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
            {([['all', 'All'], ['CONTROL', 'Control'], ['EXPERIMENTAL', 'Experimental']] as [FilterGroup, string][]).map(([value, label]) => (
              <button
                key={value}
                onClick={() => { setFilterGroup(value); setCurrentPage(1); }}
                className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${filterGroup === value
                  ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                  }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700">
                <th className="text-left py-3 px-3 font-semibold text-gray-900 dark:text-white">Group</th>
                <th
                  className="text-left py-3 px-3 font-semibold text-gray-900 dark:text-white cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 select-none"
                  onClick={() => handleSort('seed')}
                >
                  <div className="flex items-center gap-1">Seed <SortIcon field="seed" /></div>
                </th>
                <th
                  className="text-right py-3 px-3 font-semibold text-gray-900 dark:text-white cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 select-none"
                  onClick={() => handleSort('convergenceGeneration')}
                >
                  <div className="flex items-center justify-end gap-1">Convergence Gen <SortIcon field="convergenceGeneration" /></div>
                </th>
                <th className="text-right py-3 px-3 font-semibold text-gray-900 dark:text-white">
                  vs. Group Mean
                </th>
              </tr>
            </thead>
            <tbody>
              {paginatedData.length > 0 ? (
                paginatedData.map((row, idx) => {
                  const mean = row.group === 'CONTROL' ? controlMean : experimentalMean
                  const diff = mean !== null ? row.convergenceGeneration - mean : null
                  return (
                    <tr
                      key={`${row.experimentId}-${idx}`}
                      className={`border-b border-gray-100 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/30 ${idx % 2 === 0 ? '' : 'bg-gray-50/50 dark:bg-gray-800/50'}`}
                    >
                      <td className="py-2 px-3">
                        <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${row.group === 'CONTROL'
                          ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                          : 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400'
                          }`}>
                          {row.group === 'CONTROL' ? 'CTRL' : 'EXP'}
                        </span>
                      </td>
                      <td className="py-2 px-3 font-mono text-gray-700 dark:text-gray-300">{row.seed}</td>
                      <td className="py-2 px-3 text-right font-mono font-semibold text-gray-900 dark:text-white">{row.convergenceGeneration}</td>
                      <td className="py-2 px-3 text-right font-mono text-xs">
                        {diff !== null && (
                          <span className={diff > 0 ? 'text-red-500 dark:text-red-400' : diff < 0 ? 'text-emerald-500 dark:text-emerald-400' : 'text-gray-400'}>
                            {diff > 0 ? '+' : ''}{diff.toFixed(0)}
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })
              ) : (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-gray-500 dark:text-gray-400">
                    No convergence data available.
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
