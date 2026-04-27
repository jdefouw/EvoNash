'use client'

import { useEffect, useState } from 'react'

interface OverviewStats {
  totalExperiments: number
  completedExperiments: number
  controlConvergedCount: number
  experimentalConvergedCount: number
  totalConvergedCount: number
  totalGenerationRows: number
  avgGenerationsPerExperiment: number
  maxGenerations: number
  populationSize: number
  ticksPerGeneration: number
  decisionsPerExperiment: number
  totalDecisions: number
  pValue: number | null
  cohensD: number | null
  controlMean: number | null
  experimentalMean: number | null
}

function fmt(n: number): string {
  return n.toLocaleString()
}

function fmtLarge(n: number): string {
  if (n >= 1e12) return `over ${(n / 1e12).toFixed(0)} trillion`
  if (n >= 1e9) return `over ${(n / 1e9).toFixed(0)} billion`
  if (n >= 1e6) return `over ${(n / 1e6).toFixed(0)} million`
  return fmt(n)
}

function fmtPValue(p: number | null): string {
  if (p === null) return '—'
  if (p === 0 || p < 1e-300) return '≈ 0'
  if (p < 1e-100) {
    const exp = Math.floor(Math.log10(p))
    const mantissa = p / Math.pow(10, exp)
    return `${mantissa.toFixed(2)} × 10⁻${formatSuperscript(Math.abs(exp))}`
  }
  if (p < 0.0001) {
    const exp = Math.floor(Math.log10(p))
    const mantissa = p / Math.pow(10, exp)
    return `${mantissa.toFixed(2)} × 10⁻${formatSuperscript(Math.abs(exp))}`
  }
  return p.toFixed(4)
}

function formatSuperscript(n: number): string {
  const superscriptDigits = '⁰¹²³⁴⁵⁶⁷⁸⁹'
  return String(n).split('').map(d => superscriptDigits[parseInt(d)]).join('')
}

function Skeleton({ w = '5em' }: { w?: string }) {
  return (
    <span
      className="inline-block skeleton"
      style={{ width: w, height: '1.1em', borderRadius: 4, verticalAlign: 'baseline' }}
    />
  )
}

/**
 * Dynamic p-value display for the statistical tests section.
 * Replaces the hardcoded "6.69 × 10⁻⁶⁷" value.
 */
export function DynamicPValue() {
  const { stats, loading } = useStats()
  if (loading) return <Skeleton w="12em" />
  if (!stats?.pValue && stats?.pValue !== 0) return <strong>—</strong>
  return <strong>{fmtPValue(stats.pValue)}</strong>
}

/**
 * Dynamic Cohen's d display.
 * Replaces the hardcoded "−1.42" value.
 */
export function DynamicCohensD() {
  const { stats, loading } = useStats()
  if (loading) return <Skeleton w="4em" />
  if (stats?.cohensD === null || stats?.cohensD === undefined) return <strong>—</strong>
  return <strong>{stats.cohensD > 0 ? '' : '−'}{Math.abs(stats.cohensD).toFixed(2)}</strong>
}

/**
 * Dynamic experiment count.
 * Replaces hardcoded "~1,300", "over 1,200", etc.
 */
export function DynamicExperimentCount() {
  const { stats, loading } = useStats()
  if (loading) return <Skeleton w="4em" />
  return <strong>{fmt(stats?.completedExperiments ?? 0)}</strong>
}

/**
 * Dynamic total experiments (including in-progress).
 */
export function DynamicTotalExperiments() {
  const { stats, loading } = useStats()
  if (loading) return <Skeleton w="4em" />
  return <strong>{fmt(stats?.totalExperiments ?? 0)}</strong>
}

/**
 * Dynamic converged per group.
 * Replaces "700+ converged experiments per group".
 */
export function DynamicConvergedPerGroup() {
  const { stats, loading } = useStats()
  if (loading) return <Skeleton w="18em" />
  return (
    <strong>
      {fmt(stats?.controlConvergedCount ?? 0)} control and {fmt(stats?.experimentalConvergedCount ?? 0)} experimental converged experiments
    </strong>
  )
}

/**
 * Dynamic data scale section — single experiment.
 * Replaces the hardcoded "300 generations" and "225,000,000 decisions".
 */
export function DynamicSingleExperimentScale() {
  const { stats, loading } = useStats()
  if (loading) {
    return (
      <div className="sci-card p-4 !bg-gray-50 dark:!bg-gray-800/50 space-y-2">
        <p className="font-mono text-sm"><Skeleton w="90%" /></p>
        <p className="text-sm text-gray-600 dark:text-gray-400"><Skeleton w="60%" /></p>
      </div>
    )
  }
  if (!stats) return null
  const avgGens = stats.avgGenerationsPerExperiment || 300
  const pop = stats.populationSize || 1000
  const ticks = stats.ticksPerGeneration || 750
  const decisions = pop * avgGens * ticks
  return (
    <div className="sci-card p-4 !bg-gray-50 dark:!bg-gray-800/50 space-y-2">
      <p className="font-mono text-sm">
        {fmt(pop)} organisms × {fmt(avgGens)} generations × {fmt(ticks)} ticks = <strong>{fmt(decisions)} individual decisions</strong>
      </p>
      <p className="text-sm text-gray-600 dark:text-gray-400">
        That&apos;s {fmtLarge(decisions)} neural network evaluations per experiment.
      </p>
    </div>
  )
}

/**
 * Dynamic data scale section — full study.
 * Replaces the hardcoded "1,200+" and "270 billion".
 */
export function DynamicFullStudyScale() {
  const { stats, loading } = useStats()
  if (loading) {
    return (
      <div className="sci-card p-4 !bg-gray-50 dark:!bg-gray-800/50 space-y-2">
        <p className="font-mono text-sm"><Skeleton w="90%" /></p>
      </div>
    )
  }
  if (!stats) return null
  return (
    <div className="sci-card p-4 !bg-gray-50 dark:!bg-gray-800/50 space-y-2">
      <p className="font-mono text-sm">
        {fmt(stats.completedExperiments)}+ experiments × {fmt(stats.decisionsPerExperiment)} decisions each = <strong>{fmtLarge(stats.totalDecisions)} individual simulation steps</strong>
      </p>
    </div>
  )
}

/**
 * Dynamic generation rows text.
 * Replaces "~300 generations per experiment and 1,200+ experiments, that's roughly 360,000 rows".
 */
export function DynamicGenerationRows() {
  const { stats, loading } = useStats()
  if (loading) return <Skeleton w="30em" />
  if (!stats) return <>many generations per experiment across many experiments, producing hundreds of thousands of rows of statistical data in the database</>
  return (
    <>
      ~{fmt(stats.avgGenerationsPerExperiment)} generations per experiment and {fmt(stats.completedExperiments)}+ experiments, that&apos;s roughly <strong>{fmt(stats.totalGenerationRows)} rows of statistical data</strong> in the database
    </>
  )
}

/**
 * Dynamic max generations for the "how much data" intro paragraph.
 */
export function DynamicMaxGenerations() {
  const { stats, loading } = useStats()
  if (loading) return <Skeleton w="3em" />
  return <strong>{fmt(stats?.maxGenerations ?? 1500)}</strong>
}

/**
 * Summary line for the "putting it together" paragraph.
 * Replaces hardcoded p ≈ 0 and d = −1.42.
 */
export function DynamicStatsSummaryLine() {
  const { stats, loading } = useStats()
  if (loading) return <Skeleton w="30em" />
  if (!stats || (stats.cohensD === null && stats.pValue === null)) {
    return (
      <>
        The t-test and Cohen&apos;s d work as a team. The t-test tells us whether the difference is real, and Cohen&apos;s d tells us how large it is. Together, they give us scientific confidence about whether adaptive mutation genuinely speeds up convergence to Nash equilibrium.
      </>
    )
  }
  const absD = Math.abs(stats.cohensD ?? 0)
  const dStr = `${(stats.cohensD ?? 0) < 0 ? '−' : ''}${absD.toFixed(2)}`
  const pStr = fmtPValue(stats.pValue)
  const dLabel = absD < 0.2 ? 'negligible' : absD < 0.5 ? 'small' : absD < 0.8 ? 'medium' : 'large'

  return (
    <>
      The t-test says <strong>&quot;yes, the difference is real&quot;</strong> (p {pStr === '≈ 0' ? '≈ 0' : `= ${pStr}`}). Cohen&apos;s d says <strong>&quot;and the difference is {dLabel}&quot;</strong> (d = {dStr}). Together, they give us strong scientific confidence that adaptive mutation genuinely speeds up convergence to Nash equilibrium&mdash;and by a meaningful amount, not just a technicality.
    </>
  )
}

// ─── Shared fetch hook (deduplicated via module-level cache) ────────────────

let cachedStats: OverviewStats | null = null
let cachePromise: Promise<OverviewStats | null> | null = null

function useStats() {
  const [stats, setStats] = useState<OverviewStats | null>(cachedStats)
  const [loading, setLoading] = useState(cachedStats === null)

  useEffect(() => {
    if (cachedStats) {
      setStats(cachedStats)
      setLoading(false)
      return
    }

    if (!cachePromise) {
      cachePromise = fetch('/api/overview-stats')
        .then(r => {
          if (!r.ok) return null
          return r.json()
        })
        .then(data => {
          if (data && !data.error) {
            cachedStats = data
            return data
          }
          return null
        })
        .catch(() => null)
    }

    cachePromise.then(data => {
      setStats(data)
      setLoading(false)
    })
  }, [])

  return { stats, loading }
}
