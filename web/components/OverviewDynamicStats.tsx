'use client'

import { useEffect, useState } from 'react'

interface SensitivityRow {
  dropTop: number
  n: number
  meanDiff: number
  tStat: number
  pValueTwoTailed: number
}

interface PairedStats {
  nPairs: number
  adaptiveWins: number
  controlWins: number
  ties: number
  winRate: number
  meanDiff: number
  stdDiff: number
  seDiff: number
  tStatistic: number
  degreesOfFreedom: number
  pValueTwoTailed: number
  pValueOneTailed: number
  cohensDz: number | null
  ciLower: number | null
  ciUpper: number | null
  signTestPValueOneTailed: number
  signTestPValueTwoTailed: number
  wilsonCILower: number
  wilsonCIUpper: number
  bestWin: number
  worstLoss: number
  adaptiveCreditTotal: number
  controlCreditTotal: number
  magnitudeRatio: number | null
  controlMeanGens: number
  experimentalMeanGens: number
  speedupPercent: number
  sensitivity: SensitivityRow[]
}

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
  pairedStats: PairedStats | null
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

// ─── Components for the "Why adaptive wins overall" section ────────────────

function fmtPct(p: number, decimals = 1): string {
  return `${(p * 100).toFixed(decimals)}%`
}

function fmtSigned(n: number, decimals = 2): string {
  return `${n >= 0 ? '+' : '−'}${Math.abs(n).toFixed(decimals)}`
}

/**
 * Headline win/loss line: "X of Y paired seeds (Z%) went to adaptive".
 */
export function DynamicPairedWinHeadline() {
  const { stats, loading } = useStats()
  if (loading) return <Skeleton w="22em" />
  const p = stats?.pairedStats
  if (!p) return <strong>not enough paired data yet</strong>
  return (
    <strong>
      {fmt(p.adaptiveWins)} of {fmt(p.nPairs)} paired seeds ({fmtPct(p.winRate, 1)}) went to adaptive
      {p.controlWins > 0 ? ` — control was faster on the remaining ${fmt(p.controlWins)}` : ''}
    </strong>
  )
}

/**
 * Sign-test result with verdict.
 */
export function DynamicSignTest() {
  const { stats, loading } = useStats()
  if (loading) return <Skeleton w="14em" />
  const p = stats?.pairedStats
  if (!p) return <strong>—</strong>
  return (
    <>
      <strong>{fmt(p.adaptiveWins)} wins out of {fmt(p.adaptiveWins + p.controlWins)}</strong>
      {' '}gives a one-tailed sign-test p-value of <strong>{fmtPValue(p.signTestPValueOneTailed)}</strong>
    </>
  )
}

/**
 * Paired t-test summary line.
 */
export function DynamicPairedTTest() {
  const { stats, loading } = useStats()
  if (loading) return <Skeleton w="22em" />
  const p = stats?.pairedStats
  if (!p) return <strong>—</strong>
  return (
    <>
      <strong>t = {p.tStatistic.toFixed(2)}</strong>{' '}
      with df = {p.degreesOfFreedom}, two-tailed{' '}
      <strong>p = {fmtPValue(p.pValueTwoTailed)}</strong>,{' '}
      <strong>Cohen&apos;s d<sub>z</sub> = {p.cohensDz?.toFixed(2) ?? '—'}</strong>
    </>
  )
}

/**
 * 95% CI for the mean pair-wise difference.
 */
export function DynamicPairedCI() {
  const { stats, loading } = useStats()
  if (loading) return <Skeleton w="20em" />
  const p = stats?.pairedStats
  if (!p || p.ciLower === null || p.ciUpper === null) return <strong>—</strong>
  return (
    <>
      a 95% confidence interval for the mean per-pair gap of{' '}
      <strong>[+{p.ciLower.toFixed(1)} , +{p.ciUpper.toFixed(1)}] generations</strong>
    </>
  )
}

/**
 * Wilson 95% CI for the win-rate proportion.
 */
export function DynamicWilsonCI() {
  const { stats, loading } = useStats()
  if (loading) return <Skeleton w="14em" />
  const p = stats?.pairedStats
  if (!p) return <strong>—</strong>
  return (
    <>
      <strong>[{fmtPct(p.wilsonCILower, 1)} , {fmtPct(p.wilsonCIUpper, 1)}]</strong>
    </>
  )
}

/**
 * Mean per-pair difference + speedup percentage.
 */
export function DynamicPairedMeanDiff() {
  const { stats, loading } = useStats()
  if (loading) return <Skeleton w="18em" />
  const p = stats?.pairedStats
  if (!p) return <strong>—</strong>
  return (
    <>
      <strong>{p.meanDiff.toFixed(1)} generations faster on average</strong>
      {p.speedupPercent > 0 ? <> (<strong>~{p.speedupPercent.toFixed(1)}% speedup</strong>)</> : null}
    </>
  )
}

/**
 * Magnitude argument: total adaptive credit vs total control credit.
 */
export function DynamicMagnitudeRatio() {
  const { stats, loading } = useStats()
  if (loading) return <Skeleton w="22em" />
  const p = stats?.pairedStats
  if (!p) return <strong>—</strong>
  if (p.controlCreditTotal === 0) {
    return (
      <>
        adaptive contributed <strong>+{p.adaptiveCreditTotal.toFixed(0)} generations</strong> of
        cumulative speedup, with <strong>zero generations</strong> of cumulative slowdown — every
        loss column is empty
      </>
    )
  }
  const ratio = p.magnitudeRatio
  return (
    <>
      adaptive contributed <strong>+{p.adaptiveCreditTotal.toFixed(0)} generations</strong> of
      cumulative speedup vs. <strong>{p.controlCreditTotal.toFixed(0)} generations</strong> of
      cumulative slowdown — adaptive wins by <strong>{ratio !== null ? `${ratio.toFixed(1)}×` : 'a wide margin'}</strong> on raw magnitude
    </>
  )
}

/**
 * Best win and worst loss in raw generations.
 */
export function DynamicExtremes() {
  const { stats, loading } = useStats()
  if (loading) return <Skeleton w="22em" />
  const p = stats?.pairedStats
  if (!p) return <strong>—</strong>
  return (
    <>
      worst loss <strong>{fmtSigned(p.worstLoss, 0)} generations</strong>,
      best win <strong>{fmtSigned(p.bestWin, 0)} generations</strong>
    </>
  )
}

/**
 * Full sensitivity table: drop-top-N adaptive wins, recompute.
 */
export function DynamicSensitivityTable() {
  const { stats, loading } = useStats()
  if (loading) {
    return (
      <div className="sci-card p-4 !bg-gray-50 dark:!bg-gray-800/50">
        <Skeleton w="100%" />
      </div>
    )
  }
  const p = stats?.pairedStats
  if (!p || p.sensitivity.length === 0) return null

  return (
    <div className="overflow-x-auto sci-card p-3 !bg-gray-50 dark:!bg-gray-800/50">
      <table className="w-full text-sm font-mono">
        <thead>
          <tr className="border-b border-gray-300 dark:border-gray-600">
            <th className="text-left py-2 pr-4">Drop top wins</th>
            <th className="text-right py-2 pr-4">Pairs left</th>
            <th className="text-right py-2 pr-4">Mean Δ (gens)</th>
            <th className="text-right py-2 pr-4">t</th>
            <th className="text-right py-2">p (two-tailed)</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="py-1.5 pr-4">0 (raw)</td>
            <td className="text-right py-1.5 pr-4">{fmt(p.nPairs)}</td>
            <td className="text-right py-1.5 pr-4">{fmtSigned(p.meanDiff, 2)}</td>
            <td className="text-right py-1.5 pr-4">{p.tStatistic.toFixed(2)}</td>
            <td className="text-right py-1.5">{fmtPValue(p.pValueTwoTailed)}</td>
          </tr>
          {p.sensitivity.map(s => (
            <tr key={s.dropTop}>
              <td className="py-1.5 pr-4">−{s.dropTop}</td>
              <td className="text-right py-1.5 pr-4">{fmt(s.n)}</td>
              <td className="text-right py-1.5 pr-4">{fmtSigned(s.meanDiff, 2)}</td>
              <td className="text-right py-1.5 pr-4">{s.tStat.toFixed(2)}</td>
              <td className="text-right py-1.5">{fmtPValue(s.pValueTwoTailed)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/**
 * Convergence-rate disparity line: "1180 control vs 1060 experimental converged."
 */
export function DynamicConvergenceDisparity() {
  const { stats, loading } = useStats()
  if (loading) return <Skeleton w="24em" />
  if (!stats) return null
  const c = stats.controlConvergedCount
  const e = stats.experimentalConvergedCount
  const diff = c - e
  if (diff <= 0) {
    return (
      <>
        adaptive currently has <strong>{fmt(e)}</strong> converged runs vs.{' '}
        <strong>{fmt(c)}</strong> for control — adaptive is keeping up or ahead
      </>
    )
  }
  return (
    <>
      <strong>{fmt(c)}</strong> control runs have hit Nash equilibrium so far vs.{' '}
      <strong>{fmt(e)}</strong> experimental runs — a gap of {fmt(diff)} ({((diff/c)*100).toFixed(1)}%) more on the control side
    </>
  )
}

/**
 * Just the adaptive win-rate as a percentage (e.g. "94%").
 */
export function DynamicAdaptiveWinPct({ decimals = 0 }: { decimals?: number } = {}) {
  const { stats, loading } = useStats()
  if (loading) return <Skeleton w="3em" />
  const p = stats?.pairedStats
  if (!p) return <strong>—</strong>
  return <strong>{(p.winRate * 100).toFixed(decimals)}%</strong>
}

/**
 * Just the control win-rate as a percentage (e.g. "6%").
 */
export function DynamicControlWinPct({ decimals = 0 }: { decimals?: number } = {}) {
  const { stats, loading } = useStats()
  if (loading) return <Skeleton w="3em" />
  const p = stats?.pairedStats
  if (!p) return <strong>—</strong>
  const ctrlRate = (p.controlWins / Math.max(1, p.adaptiveWins + p.controlWins)) * 100
  return <strong>{ctrlRate.toFixed(decimals)}%</strong>
}

/**
 * Just the rounded mean per-pair difference in generations (e.g. "27").
 */
export function DynamicMeanDiffGens({ decimals = 0 }: { decimals?: number } = {}) {
  const { stats, loading } = useStats()
  if (loading) return <Skeleton w="3em" />
  const p = stats?.pairedStats
  if (!p) return <strong>—</strong>
  return <strong>{p.meanDiff.toFixed(decimals)}</strong>
}

/**
 * 95% CI for mean diff as a bare bracket (e.g. "[21, 33]"), no surrounding text.
 */
export function DynamicCIBracket({ decimals = 0 }: { decimals?: number } = {}) {
  const { stats, loading } = useStats()
  if (loading) return <Skeleton w="6em" />
  const p = stats?.pairedStats
  if (!p || p.ciLower === null || p.ciUpper === null) return <strong>—</strong>
  return <strong>[{p.ciLower.toFixed(decimals)}, {p.ciUpper.toFixed(decimals)}]</strong>
}

/**
 * Lower and upper of CI as bare numbers (for prose: "between X and Y generations").
 */
export function DynamicCILower({ decimals = 0 }: { decimals?: number } = {}) {
  const { stats, loading } = useStats()
  if (loading) return <Skeleton w="2em" />
  const p = stats?.pairedStats
  if (!p || p.ciLower === null) return <strong>—</strong>
  return <strong>{p.ciLower.toFixed(decimals)}</strong>
}

export function DynamicCIUpper({ decimals = 0 }: { decimals?: number } = {}) {
  const { stats, loading } = useStats()
  if (loading) return <Skeleton w="2em" />
  const p = stats?.pairedStats
  if (!p || p.ciUpper === null) return <strong>—</strong>
  return <strong>{p.ciUpper.toFixed(decimals)}</strong>
}

/**
 * Mean control vs experimental gens among matched seeds.
 */
export function DynamicMatchedMeans() {
  const { stats, loading } = useStats()
  if (loading) return <Skeleton w="20em" />
  const p = stats?.pairedStats
  if (!p) return null
  return (
    <>
      across the {fmt(p.nPairs)} matched seeds the average control run took{' '}
      <strong>{p.controlMeanGens.toFixed(0)} generations</strong> to converge while the average
      adaptive run took <strong>{p.experimentalMeanGens.toFixed(0)} generations</strong>
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
