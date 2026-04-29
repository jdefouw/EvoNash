'use client'

interface ConvergenceEntry {
  experimentId: string
  group: string
  seed: number
  convergenceGeneration: number
}

interface ActiveSeedWorker {
  seed: number
  group: string
  runningCount: number
}

interface SeedPairsCardProps {
  convergenceData: ConvergenceEntry[]
  activeSeedWorkers?: ActiveSeedWorker[]
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
  controlRunning: number
  experimentalRunning: number
}

export default function SeedPairsCard({ convergenceData, activeSeedWorkers = [], totalSeeds }: SeedPairsCardProps) {
  // Build running counts lookup
  const runningMap = new Map<string, number>()
  for (const w of activeSeedWorkers) {
    runningMap.set(`${w.seed}_${w.group}`, w.runningCount)
  }

  // Collect all seeds that have any activity (converged OR running)
  const allSeeds = new Set<number>()
  for (const entry of convergenceData) allSeeds.add(entry.seed)
  for (const w of activeSeedWorkers) allSeeds.add(w.seed)

  // Build per-seed stats from convergence data
  const seedMap = new Map<number, { ctrl: number[]; exp: number[] }>()
  for (const seed of allSeeds) {
    seedMap.set(seed, { ctrl: [], exp: [] })
  }
  
  for (const entry of convergenceData) {
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
        controlRunning: runningMap.get(`${seed}_CONTROL`) || 0,
        experimentalRunning: runningMap.get(`${seed}_EXPERIMENTAL`) || 0,
      }
    })
    .sort((a, b) => {
      // Sort: actively running first, then by strength
      const aActive = a.controlRunning + a.experimentalRunning > 0 ? 0 : 1
      const bActive = b.controlRunning + b.experimentalRunning > 0 ? 0 : 1
      if (aActive !== bActive) return aActive - bActive
      const strengthOrder = { strong: 0, moderate: 1, weak: 2, none: 3 }
      return strengthOrder[a.pairStrength] - strengthOrder[b.pairStrength]
    })

  const pairedCount = rows.filter(r => r.isPaired).length
  const strongCount = rows.filter(r => r.pairStrength === 'strong').length
  const moderateCount = rows.filter(r => r.pairStrength === 'moderate').length
  const weakCount = rows.filter(r => r.pairStrength === 'weak').length
  const unpairedCount = rows.filter(r => !r.isPaired).length
  const totalSeedsInSystem = totalSeeds ?? seedMap.size
  const activeSeeds = rows.filter(r => r.controlRunning + r.experimentalRunning > 0).length

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

  const LiveDot = ({ running }: { running: number }) => (
    running > 0 ? (
      <span className="relative inline-flex items-center gap-0.5" title={`${running} experiment(s) running`}>
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
        </span>
      </span>
    ) : (
      <span className="relative inline-flex items-center" title="Idle">
        <span className="inline-flex rounded-full h-2 w-2 bg-gray-400/40" />
      </span>
    )
  )

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700/50 bg-white dark:bg-gray-800/60 backdrop-blur-sm p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            🧬 Seed Pair Progress
            {activeSeeds > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-green-500/15 text-green-400 border border-green-500/30">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-500" />
                </span>
                {activeSeeds} active
              </span>
            )}
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
              <th className="py-2 px-2 font-medium w-6"></th>
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
              const isActive = row.controlRunning + row.experimentalRunning > 0
              return (
                <tr key={row.seed} className={`transition-colors ${isActive ? 'bg-green-500/5 hover:bg-green-500/10' : 'hover:bg-gray-50/50 dark:hover:bg-gray-700/30'}`}>
                  <td className="py-1.5 px-2">
                    <LiveDot running={row.controlRunning + row.experimentalRunning} />
                  </td>
                  <td className="py-1.5 px-2 font-mono text-gray-700 dark:text-gray-300">{row.seed}</td>
                  <td className="py-1.5 px-2 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <span className={row.controlConverged >= 10 ? 'text-emerald-500 font-semibold' : row.controlConverged > 0 ? 'text-amber-400' : 'text-red-400'}>
                        {row.controlConverged}
                      </span>
                      {row.controlRunning > 0 && (
                        <span className="text-[9px] text-green-400 font-medium">+{row.controlRunning}⏳</span>
                      )}
                    </div>
                  </td>
                  <td className="py-1.5 px-2 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <span className={row.experimentalConverged >= 10 ? 'text-emerald-500 font-semibold' : row.experimentalConverged > 0 ? 'text-amber-400' : 'text-red-400'}>
                        {row.experimentalConverged}
                      </span>
                      {row.experimentalRunning > 0 && (
                        <span className="text-[9px] text-green-400 font-medium">+{row.experimentalRunning}⏳</span>
                      )}
                    </div>
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
                <td colSpan={8} className="py-8 text-center text-gray-400">
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
        <span className="ml-1 inline-flex items-center gap-0.5"><span className="inline-flex rounded-full h-1.5 w-1.5 bg-green-500" /> = worker actively processing</span>
      </div>
    </div>
  )
}
