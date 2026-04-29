'use client'

interface ConvergenceEntry {
  experimentId: string
  group: string
  seed: number
  convergenceGeneration: number
}

interface SeedPairsCardProps {
  convergenceData: ConvergenceEntry[]
  totalSeeds?: number
}

interface SeedRow {
  seed: number
  controlConverged: number
  experimentalConverged: number
  controlMeanGen: number | null
  experimentalMeanGen: number | null
  isPaired: boolean
  pairStrength: 'none' | 'weak' | 'moderate' | 'strong'
}

export default function SeedPairsCard({ convergenceData, totalSeeds }: SeedPairsCardProps) {
  // Build per-seed stats from convergence data
  const seedMap = new Map<number, { ctrl: number[]; exp: number[] }>()
  
  for (const entry of convergenceData) {
    if (!seedMap.has(entry.seed)) {
      seedMap.set(entry.seed, { ctrl: [], exp: [] })
    }
    const bucket = seedMap.get(entry.seed)!
    if (entry.group === 'CONTROL') {
      bucket.ctrl.push(entry.convergenceGeneration)
    } else {
      bucket.exp.push(entry.convergenceGeneration)
    }
  }

  // Convert to sorted rows
  const rows: SeedRow[] = Array.from(seedMap.entries())
    .map(([seed, data]) => {
      const ctrlMean = data.ctrl.length > 0 
        ? data.ctrl.reduce((a, b) => a + b, 0) / data.ctrl.length 
        : null
      const expMean = data.exp.length > 0 
        ? data.exp.reduce((a, b) => a + b, 0) / data.exp.length 
        : null
      const isPaired = data.ctrl.length > 0 && data.exp.length > 0
      const minCount = Math.min(data.ctrl.length, data.exp.length)
      const pairStrength: SeedRow['pairStrength'] = 
        minCount === 0 ? 'none' :
        minCount < 10 ? 'weak' :
        minCount < 30 ? 'moderate' : 'strong'

      return {
        seed,
        controlConverged: data.ctrl.length,
        experimentalConverged: data.exp.length,
        controlMeanGen: ctrlMean,
        experimentalMeanGen: expMean,
        isPaired,
        pairStrength,
      }
    })
    .sort((a, b) => {
      // Sort: paired first (by strength desc), then unpaired
      const strengthOrder = { strong: 0, moderate: 1, weak: 2, none: 3 }
      return strengthOrder[a.pairStrength] - strengthOrder[b.pairStrength]
    })

  const pairedCount = rows.filter(r => r.isPaired).length
  const strongCount = rows.filter(r => r.pairStrength === 'strong').length
  const moderateCount = rows.filter(r => r.pairStrength === 'moderate').length
  const weakCount = rows.filter(r => r.pairStrength === 'weak').length
  const unpairedCount = rows.filter(r => !r.isPaired).length
  const totalSeedsInSystem = totalSeeds ?? seedMap.size

  const strengthColor = (s: SeedRow['pairStrength']) => {
    switch (s) {
      case 'strong': return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
      case 'moderate': return 'bg-amber-500/20 text-amber-400 border-amber-500/30'
      case 'weak': return 'bg-orange-500/20 text-orange-400 border-orange-500/30'
      case 'none': return 'bg-red-500/20 text-red-400 border-red-500/30'
    }
  }

  const strengthLabel = (s: SeedRow['pairStrength']) => {
    switch (s) {
      case 'strong': return '≥30 each'
      case 'moderate': return '10–29'
      case 'weak': return '1–9'
      case 'none': return 'Missing'
    }
  }

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700/50 bg-white dark:bg-gray-800/60 backdrop-blur-sm p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            🧬 Seed Pair Progress
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Each seed needs ≥10 converged CTRL + ≥10 converged EXP to be a viable pair
          </p>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-indigo-500">{pairedCount}<span className="text-sm text-gray-400">/{totalSeedsInSystem}</span></div>
          <div className="text-[10px] text-gray-500 dark:text-gray-400 uppercase tracking-wider">Paired Seeds</div>
        </div>
      </div>

      {/* Summary badges */}
      <div className="flex flex-wrap gap-2">
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${strengthColor('strong')}`}>
          ● {strongCount} Strong
          <span className="opacity-60">({strengthLabel('strong')})</span>
        </span>
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${strengthColor('moderate')}`}>
          ● {moderateCount} Moderate
          <span className="opacity-60">({strengthLabel('moderate')})</span>
        </span>
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${strengthColor('weak')}`}>
          ● {weakCount} Weak
          <span className="opacity-60">({strengthLabel('weak')})</span>
        </span>
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${strengthColor('none')}`}>
          ● {unpairedCount} Unpaired
          <span className="opacity-60">({strengthLabel('none')})</span>
        </span>
      </div>

      {/* Progress bar */}
      <div className="space-y-1">
        <div className="flex justify-between text-[10px] text-gray-500 dark:text-gray-400">
          <span>Pair completion (≥10 each)</span>
          <span>{rows.filter(r => r.pairStrength !== 'none' && r.pairStrength !== 'weak').length}/{totalSeedsInSystem} seeds at ≥10</span>
        </div>
        <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden flex">
          <div 
            className="bg-emerald-500 transition-all duration-500" 
            style={{ width: `${(strongCount / Math.max(totalSeedsInSystem, 1)) * 100}%` }} 
          />
          <div 
            className="bg-amber-500 transition-all duration-500" 
            style={{ width: `${(moderateCount / Math.max(totalSeedsInSystem, 1)) * 100}%` }} 
          />
          <div 
            className="bg-orange-500 transition-all duration-500" 
            style={{ width: `${(weakCount / Math.max(totalSeedsInSystem, 1)) * 100}%` }} 
          />
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-gray-50 dark:bg-gray-800 z-10">
            <tr className="text-left text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
              <th className="py-2 px-2 font-medium">Seed</th>
              <th className="py-2 px-2 font-medium text-center">CTRL ✓</th>
              <th className="py-2 px-2 font-medium text-center">EXP ✓</th>
              <th className="py-2 px-2 font-medium text-center">CTRL μ Gen</th>
              <th className="py-2 px-2 font-medium text-center">EXP μ Gen</th>
              <th className="py-2 px-2 font-medium text-center">Δ Gen</th>
              <th className="py-2 px-2 font-medium text-center">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
            {rows.map((row) => {
              const diff = (row.controlMeanGen !== null && row.experimentalMeanGen !== null)
                ? row.controlMeanGen - row.experimentalMeanGen
                : null
              return (
                <tr key={row.seed} className="hover:bg-gray-50/50 dark:hover:bg-gray-700/30 transition-colors">
                  <td className="py-1.5 px-2 font-mono text-gray-700 dark:text-gray-300">{row.seed}</td>
                  <td className="py-1.5 px-2 text-center">
                    <span className={row.controlConverged >= 10 ? 'text-emerald-500 font-semibold' : row.controlConverged > 0 ? 'text-amber-400' : 'text-red-400'}>
                      {row.controlConverged}
                    </span>
                  </td>
                  <td className="py-1.5 px-2 text-center">
                    <span className={row.experimentalConverged >= 10 ? 'text-emerald-500 font-semibold' : row.experimentalConverged > 0 ? 'text-amber-400' : 'text-red-400'}>
                      {row.experimentalConverged}
                    </span>
                  </td>
                  <td className="py-1.5 px-2 text-center text-gray-500 dark:text-gray-400">
                    {row.controlMeanGen !== null ? row.controlMeanGen.toFixed(1) : '—'}
                  </td>
                  <td className="py-1.5 px-2 text-center text-gray-500 dark:text-gray-400">
                    {row.experimentalMeanGen !== null ? row.experimentalMeanGen.toFixed(1) : '—'}
                  </td>
                  <td className="py-1.5 px-2 text-center">
                    {diff !== null ? (
                      <span className={diff > 0 ? 'text-emerald-400 font-semibold' : diff < 0 ? 'text-red-400' : 'text-gray-400'}>
                        {diff > 0 ? '+' : ''}{diff.toFixed(1)}
                      </span>
                    ) : '—'}
                  </td>
                  <td className="py-1.5 px-2 text-center">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium border ${strengthColor(row.pairStrength)}`}>
                      {row.pairStrength === 'none' ? 'Unpaired' :
                       row.pairStrength === 'weak' ? 'Weak' :
                       row.pairStrength === 'moderate' ? 'Building' : 'Ready'}
                    </span>
                  </td>
                </tr>
              )
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="py-8 text-center text-gray-400">
                  No convergence data yet — experiments are still running
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Footer note */}
      <div className="text-[10px] text-gray-400 dark:text-gray-500 pt-1 border-t border-gray-100 dark:border-gray-700/50">
        <strong>Δ Gen</strong> = Control mean − Experimental mean. Positive = adaptive mutation converges faster.
        Queue prioritizes seeds with {'<'}10 converged per group (Tier 1), then {'<'}30 (Tier 2).
      </div>
    </div>
  )
}
