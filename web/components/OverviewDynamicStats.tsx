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
  const d = stats.cohensD ?? 0
  const absD = Math.abs(d)
  const p = stats.pValue ?? 1
  const dStr = `${d < 0 ? '−' : d > 0 ? '+' : ''}${absD.toFixed(2)}`
  const pStr = fmtPValue(p)

  // Direction
  const direction =
    d < 0
      ? 'experimental converges in fewer generations (supports the hypothesis)'
      : d > 0
      ? 'experimental converges in MORE generations (counter to the hypothesis)'
      : 'the two groups are tied'

  // Significance verdict
  const sigVerdict =
    p < 0.001
      ? 'yes, the difference is very unlikely to be chance'
      : p < 0.05
      ? 'yes, the difference is unlikely to be chance'
      : p < 0.10
      ? 'maybe — the result is suggestive but not conclusive'
      : 'no — we cannot currently rule out chance'

  // Effect-size label
  const dLabel =
    absD < 0.2
      ? 'negligible'
      : absD < 0.5
      ? 'small'
      : absD < 0.8
      ? 'medium'
      : 'large'

  // Closing summary depends on whether the direction supports the hypothesis AND p is small
  const closing =
    d < 0 && p < 0.05
      ? 'Together, they give us strong scientific confidence that adaptive mutation genuinely speeds up convergence to Nash equilibrium — and by a meaningful amount.'
      : d > 0 && p < 0.05
      ? 'Together, the live data currently runs counter to the hypothesis. As more experiments accumulate, this paragraph will reflect any change.'
      : 'Together, the live data is currently inconclusive — we have a direction, but not enough evidence to call it. As more pairs come in, this updates automatically.'

  return (
    <>
      The t-test asks &quot;is the difference real?&quot; &mdash;{' '}
      <strong>{sigVerdict}</strong> (p {pStr === '≈ 0' ? '≈ 0' : `= ${pStr}`}). Cohen&apos;s d
      asks &quot;how big is it, and in which direction?&quot; &mdash;{' '}
      <strong>{dLabel}, with {direction}</strong> (d = {dStr}). {closing}
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

// ─── Dynamic narrative qualifiers ──────────────────────────────────────────
// These render a *phrase* whose wording depends on the live data, so the
// surrounding sentence stays accurate even if the data shifts direction.

/**
 * Describes the strength of a p-value in plain language.
 * Replaces phrases like "essentially no chance" / "result is absolutely real".
 */
export function DynamicPValueStrength() {
  const { stats, loading } = useStats()
  if (loading) return <Skeleton w="20em" />
  const p = stats?.pValue
  if (p === null || p === undefined) return <>insufficient data to assess</>
  if (p === 0 || p < 1e-50) return <>vanishingly small &mdash; the result is virtually certain not to be a fluke</>
  if (p < 1e-10) return <>extremely small &mdash; the result is virtually certain to be real</>
  if (p < 0.001) return <>well below 0.001 &mdash; very strong evidence the difference is real</>
  if (p < 0.01) return <>below 0.01 &mdash; strong evidence the difference is real</>
  if (p < 0.05) return <>below 0.05 &mdash; statistically significant, though not overwhelming</>
  if (p < 0.10) return <>marginally significant &mdash; the result is suggestive but not conclusive</>
  return <>not statistically significant &mdash; we cannot rule out chance from the current data</>
}

/**
 * Describes Cohen's d magnitude qualitatively. Always uses |d|.
 * Replaces phrases like "well past the large threshold".
 */
export function DynamicCohensDQualifier() {
  const { stats, loading } = useStats()
  if (loading) return <Skeleton w="14em" />
  const d = stats?.cohensD
  if (d === null || d === undefined) return <>insufficient data</>
  const a = Math.abs(d)
  if (a < 0.2) return <>in the &quot;negligible&quot; range (|d| &lt; 0.2)</>
  if (a < 0.5) return <>in the &quot;small&quot; range (0.2 &le; |d| &lt; 0.5)</>
  if (a < 0.8) return <>in the &quot;medium&quot; range (0.5 &le; |d| &lt; 0.8)</>
  if (a < 1.2) return <>in the &quot;large&quot; range (|d| &ge; 0.8)</>
  return <>well past the &quot;large&quot; threshold of |d| = 0.8</>
}

/**
 * Describes Cohen's d_z (paired) magnitude.
 */
export function DynamicCohensDzQualifier() {
  const { stats, loading } = useStats()
  if (loading) return <Skeleton w="14em" />
  const d = stats?.pairedStats?.cohensDz
  if (d === null || d === undefined) return <>insufficient data</>
  const a = Math.abs(d)
  if (a < 0.2) return <>in the &quot;negligible&quot; range (d<sub>z</sub> &lt; 0.2)</>
  if (a < 0.5) return <>in the &quot;small&quot; range</>
  if (a < 0.8) return <>in the &quot;medium&quot; range</>
  if (a < 1.2) return <>in the &quot;large&quot; range (d<sub>z</sub> &ge; 0.8)</>
  return <>well into the &quot;large&quot; territory (d<sub>z</sub> &ge; 0.8)</>
}

/**
 * Describes what the sign of Cohen's d means for the hypothesis.
 * If d &lt; 0 the experimental group has lower convergence gen (faster) → supports hypothesis.
 * If d &gt; 0 the experimental group has higher convergence gen (slower) → counter to hypothesis.
 */
export function DynamicCohensDDirection() {
  const { stats, loading } = useStats()
  if (loading) return <Skeleton w="22em" />
  const d = stats?.cohensD
  if (d === null || d === undefined) return <>The sign of d will tell us which group is faster.</>
  if (d < 0) {
    return <>The negative sign means the experimental group converges in <em>fewer</em> generations &mdash; supporting the hypothesis that adaptive mutation is faster.</>
  }
  if (d > 0) {
    return <>The positive sign means the experimental group is converging in <em>more</em> generations than the control &mdash; <strong>counter to the hypothesis</strong>. As the experiment continues, this is the most important number to watch.</>
  }
  return <>d is currently zero &mdash; the two groups are tied on average.</>
}

/**
 * Describes the sign-test direction in narrative terms.
 */
export function DynamicSignTestVerdict() {
  const { stats, loading } = useStats()
  if (loading) return <Skeleton w="20em" />
  const p = stats?.pairedStats
  if (!p) return <>not enough paired data yet to count</>
  const ctrl = p.controlWins
  const exp = p.adaptiveWins
  const total = ctrl + exp
  if (total === 0) return <>no decisive pairs yet</>
  const winRate = exp / total
  if (winRate >= 0.90) return <>overwhelmingly toward adaptive</>
  if (winRate >= 0.75) return <>strongly toward adaptive</>
  if (winRate >= 0.60) return <>leaning toward adaptive</>
  if (winRate > 0.50) return <>slightly toward adaptive</>
  if (winRate === 0.50) return <>evenly split &mdash; no direction</>
  if (winRate >= 0.40) return <>slightly toward control</>
  if (winRate >= 0.25) return <>leaning toward control</>
  return <>strongly toward control &mdash; counter to the hypothesis</>
}

/**
 * Describes how many generations above zero the lower bound of the paired-t CI is.
 * Replaces phrases like "many generations above zero" or "comfortably ahead".
 */
export function DynamicCILowerStrength() {
  const { stats, loading } = useStats()
  if (loading) return <Skeleton w="20em" />
  const p = stats?.pairedStats
  if (!p || p.ciLower === null) return <>(insufficient paired data for CI)</>
  const lo = p.ciLower
  if (lo > 20) return <>many generations above zero &mdash; even the most pessimistic estimate has adaptive faster by a wide margin</>
  if (lo > 10) return <>comfortably above zero &mdash; even the pessimistic estimate has adaptive faster by 10+ generations</>
  if (lo > 3) return <>above zero &mdash; the floor is positive but tighter</>
  if (lo > 0) return <>just above zero &mdash; the floor is positive but only marginally</>
  if (lo === 0) return <>exactly at zero &mdash; the lower bound just touches the no-difference line</>
  return <>below zero &mdash; we cannot rule out, with 95% confidence, that the true difference is zero or favors control</>
}

/**
 * Describes the Wilson 95% CI for the win-rate proportion vs the 50% coin-flip line.
 */
export function DynamicWilsonStrength() {
  const { stats, loading } = useStats()
  if (loading) return <Skeleton w="22em" />
  const p = stats?.pairedStats
  if (!p) return <>(insufficient paired data)</>
  const lo = p.wilsonCILower
  if (lo > 0.80) return <>far above the 50% coin-flip line</>
  if (lo > 0.65) return <>well above the 50% coin-flip line</>
  if (lo > 0.50) return <>above the 50% coin-flip line, though closer than at peak data</>
  if (lo === 0.50) return <>exactly at the 50% coin-flip line &mdash; we cannot rule out chance from the win-rate alone</>
  return <>below the 50% coin-flip line &mdash; the win-rate by itself does not currently support adaptive</>
}

/**
 * Describes the magnitude ratio (adaptive credit / control credit).
 */
export function DynamicMagnitudeVerdict() {
  const { stats, loading } = useStats()
  if (loading) return <Skeleton w="22em" />
  const p = stats?.pairedStats
  if (!p) return <>(insufficient paired data)</>
  if (p.controlCreditTotal === 0) {
    return <>adaptive contributed every generation of speedup; there are no losses to weigh against the wins</>
  }
  const r = p.magnitudeRatio
  if (r === null || r === undefined) return <>(magnitude ratio unavailable)</>
  if (r >= 10) return <>the wins dwarf the losses by roughly {r.toFixed(0)}&times; on raw magnitude</>
  if (r >= 3) return <>the wins outweigh the losses by about {r.toFixed(1)}&times;</>
  if (r > 1) return <>the wins exceed the losses by a factor of about {r.toFixed(1)}&times;, but the margin has tightened</>
  if (r === 1) return <>wins and losses currently balance exactly on raw magnitude</>
  return <>the losses currently exceed the wins on raw magnitude &mdash; counter to the hypothesis</>
}

/**
 * Compares experimental mean vs control mean among matched seeds.
 * Replaces "control side is taking longer than adaptive side" phrasing.
 */
export function DynamicMatchedDirection() {
  const { stats, loading } = useStats()
  if (loading) return <Skeleton w="22em" />
  const p = stats?.pairedStats
  if (!p) return null
  const c = p.controlMeanGens
  const e = p.experimentalMeanGens
  if (Math.abs(c - e) < 0.5) {
    return <>The two sides are converging at almost the same rate among matched seeds &mdash; no clear advantage in this slice of data.</>
  }
  if (e < c) {
    return <>The control side is taking longer to reach equilibrium, on average, than the adaptive side &mdash; that is the very thing the paired t-test is detecting.</>
  }
  return <>The control side is currently converging faster, on average, than the adaptive side among matched seeds &mdash; counter to the hypothesis.</>
}

/**
 * Compares best win vs worst loss in raw magnitude.
 */
export function DynamicExtremesComparison() {
  const { stats, loading } = useStats()
  if (loading) return <Skeleton w="22em" />
  const p = stats?.pairedStats
  if (!p) return null
  const bestWin = p.bestWin
  const worstLossMag = Math.abs(p.worstLoss)
  if (bestWin > worstLossMag) {
    return <>The biggest single adaptive win ({bestWin.toFixed(0)} gens) is larger in magnitude than the worst control win ({worstLossMag.toFixed(0)} gens).</>
  }
  if (bestWin < worstLossMag) {
    return <>The biggest single control win ({worstLossMag.toFixed(0)} gens) currently exceeds the biggest adaptive win ({bestWin.toFixed(0)} gens) in magnitude.</>
  }
  return <>The biggest adaptive win and biggest control win are equal in magnitude.</>
}

/**
 * Overall verdict box for section 18's "Putting it together" — picks the right
 * framing based on whether all four tests agree, agree partially, or contradict.
 */
export function DynamicHypothesisVerdict() {
  const { stats, loading } = useStats()
  if (loading) return <Skeleton w="100%" />
  const p = stats?.pairedStats
  if (!p) {
    return (
      <>
        Not enough paired data yet to deliver a full verdict. Watch the dashboard
        as more seeds accumulate.
      </>
    )
  }
  const winRate = (p.adaptiveWins) / Math.max(1, p.adaptiveWins + p.controlWins)
  const sigPaired = p.pValueTwoTailed < 0.05
  const sigSign = p.signTestPValueOneTailed < 0.05 && winRate > 0.5
  const ciAboveZero = p.ciLower !== null && p.ciLower > 0
  const meanFavorsAdaptive = p.meanDiff > 0
  const ratioFavorsAdaptive =
    p.controlCreditTotal === 0 || (p.magnitudeRatio !== null && p.magnitudeRatio > 1)
  const allAgree = sigPaired && sigSign && ciAboveZero && meanFavorsAdaptive && ratioFavorsAdaptive

  if (allAgree) {
    const strong = winRate >= 0.85 && (p.cohensDz ?? 0) > 0.8
    return (
      <>
        <strong>The verdict:</strong> the hypothesis &quot;adaptive mutation reaches Nash
        equilibrium faster than fixed mutation&quot; is{' '}
        {strong ? 'supported under every test we ran' : 'currently supported by every test we ran'}.
        The sign test rules out chance. The paired t-test rules out a small-effect-and-noise
        explanation. The sensitivity analysis rules out an outlier-driven illusion. The
        magnitude argument shows that even raw arithmetic agrees. And the lower bound of the
        95% confidence interval is{' '}
        {p.ciLower !== null && p.ciLower > 0 ? `${p.ciLower.toFixed(1)} generations above zero` : 'positive'}.
        The losses on individual seeds are real and reported honestly, but they don&apos;t
        change the conclusion &mdash; they make it more credible by showing that we are not
        cherry-picking a clean &quot;100%&quot; story.
      </>
    )
  }

  // Mixed-evidence framing
  const items: string[] = []
  if (sigPaired) items.push('the paired t-test is significant'); else items.push('the paired t-test is no longer significant')
  if (sigSign) items.push('the sign test points toward adaptive'); else items.push('the sign test no longer favors adaptive')
  if (ciAboveZero) items.push('the 95% CI is above zero'); else items.push('the 95% CI now includes (or crosses) zero')
  if (meanFavorsAdaptive) items.push('the mean per-pair gap favors adaptive'); else items.push('the mean per-pair gap no longer favors adaptive')

  return (
    <>
      <strong>Current verdict:</strong> the evidence is mixed in the live data.{' '}
      {items.join('; ')}.
      Watch the dashboard as more pairs accumulate &mdash; one of the strengths of this design
      is that the answer can shift in either direction as the sample grows, and the page will
      reflect that.
    </>
  )
}

/**
 * For the IQR/CI section's "CI does NOT include zero" box. The static text used to
 * assert that "in this experiment, the CI is entirely above zero". Replace with a
 * version that checks the live CI and reports it accurately.
 */
export function DynamicCIZeroAssertion() {
  const { stats, loading } = useStats()
  if (loading) return <Skeleton w="22em" />
  const p = stats?.pairedStats
  if (!p || p.ciLower === null || p.ciUpper === null) {
    return <>(CI not available yet.)</>
  }
  const lo = p.ciLower
  const hi = p.ciUpper
  if (lo > 0) {
    return <>In the live data, the CI is entirely above zero ([{lo.toFixed(1)}, {hi.toFixed(1)}] generations), meaning the experimental group is genuinely converging faster.</>
  }
  if (hi < 0) {
    return <>In the live data, the CI is entirely below zero ([{lo.toFixed(1)}, {hi.toFixed(1)}] generations) &mdash; counter to the hypothesis.</>
  }
  return <>In the live data, the CI currently spans zero ([{lo.toFixed(1)}, {hi.toFixed(1)}] generations), so we cannot yet rule out a no-difference scenario from this analysis alone.</>
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
