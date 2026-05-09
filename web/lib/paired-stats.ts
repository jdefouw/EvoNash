// Paired-sample statistical helpers used by the /overview page API.
// All numbers here are independent of the dashboard route's internal copies
// so the overview can be evolved without risking the live dashboard.

export interface PairedStatsInput {
  // One row per converged experiment (already filtered to status='COMPLETED' + has convergence_generation)
  seed: number
  group: 'CONTROL' | 'EXPERIMENTAL'
  convergenceGeneration: number
}

export interface SensitivityRow {
  dropTop: number      // how many of the largest adaptive wins were removed
  n: number            // remaining pair count
  meanDiff: number
  tStat: number
  pValueTwoTailed: number
}

export interface PairedStats {
  nPairs: number
  adaptiveWins: number
  controlWins: number
  ties: number
  winRate: number                 // 0..1
  meanDiff: number                // control - experimental, positive = adaptive faster
  stdDiff: number
  seDiff: number
  tStatistic: number
  degreesOfFreedom: number
  pValueTwoTailed: number
  pValueOneTailed: number
  cohensDz: number | null
  ciLower: number | null
  ciUpper: number | null
  // Sign test (model-free direction-only test)
  signTestPValueOneTailed: number
  signTestPValueTwoTailed: number
  // Wilson 95% CI for win-rate proportion
  wilsonCILower: number
  wilsonCIUpper: number
  // Magnitudes
  bestWin: number                 // max positive diff
  worstLoss: number               // min negative diff (most negative)
  adaptiveCreditTotal: number     // sum of positive diffs
  controlCreditTotal: number      // sum of |negative diffs|
  magnitudeRatio: number | null   // adaptiveCreditTotal / controlCreditTotal
  controlMeanGens: number         // average control convergence among matched seeds
  experimentalMeanGens: number    // average experimental convergence among matched seeds
  speedupPercent: number          // (control - experimental) / control * 100
  sensitivity: SensitivityRow[]
}

// ──────────────────────────────────────────────────────────────────────────
// Numerical helpers (self-contained — duplicate of dashboard's, intentional)
// ──────────────────────────────────────────────────────────────────────────

function logGamma(z: number): number {
  if (z < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * z)) - logGamma(1 - z)
  z -= 1
  const c = [
    0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313,
    -176.61502916214059, 12.507343278686905, -0.13857109526572012,
    9.9843695780195716e-6, 1.5056327351493116e-7
  ]
  let x = c[0]
  for (let i = 1; i < 9; i++) x += c[i] / (z + i)
  const t = z + 7 + 0.5
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x)
}

function logBeta(a: number, b: number): number {
  return logGamma(a) + logGamma(b) - logGamma(a + b)
}

function incompleteBeta(x: number, a: number, b: number): number {
  if (x <= 0) return 0
  if (x >= 1) return 1
  if (x > (a + 1) / (a + b + 2)) return 1 - incompleteBeta(1 - x, b, a)
  const lnB = logBeta(a, b)
  const front = Math.exp(Math.log(x) * a + Math.log(1 - x) * b - lnB) / a
  let f = 1, c = 1, d = 0
  for (let m = 0; m <= 200; m++) {
    let num: number
    if (m === 0) num = 1
    else if (m % 2 === 0) {
      const k = m / 2
      num = (k * (b - k) * x) / ((a + 2 * k - 1) * (a + 2 * k))
    } else {
      const k = (m - 1) / 2
      num = -((a + k) * (a + b + k) * x) / ((a + 2 * k) * (a + 2 * k + 1))
    }
    d = 1 + num * d
    if (Math.abs(d) < 1e-30) d = 1e-30
    d = 1 / d
    c = 1 + num / c
    if (Math.abs(c) < 1e-30) c = 1e-30
    const delta = c * d
    f *= delta
    if (Math.abs(delta - 1) < 1e-14) break
  }
  return front * (f - 1)
}

function tDistributionCDF(t: number, df: number): number {
  if (df <= 0) return 0.5
  if (!isFinite(t)) return t > 0 ? 1 : 0
  const x = df / (df + t * t)
  const beta = incompleteBeta(x, df / 2, 0.5)
  return t >= 0 ? 1 - 0.5 * beta : 0.5 * beta
}

function normalQuantile(p: number): number {
  if (p <= 0) return -Infinity
  if (p >= 1) return Infinity
  if (p === 0.5) return 0
  const a = [-3.969683028665376e+01, 2.209460984245205e+02, -2.759285104469687e+02, 1.383577518672690e+02, -3.066479806614716e+01, 2.506628277459239e+00]
  const b = [-5.447609879822406e+01, 1.615858368580409e+02, -1.556989798598866e+02, 6.680131188771972e+01, -1.328068155288572e+01]
  const c = [-7.784894002430293e-03, -3.223964580411365e-01, -2.400758277161838e+00, -2.549732539343734e+00, 4.374664141464968e+00, 2.938163982698783e+00]
  const d = [7.784695709041462e-03, 3.224671290700398e-01, 2.445134137142996e+00, 3.754408661907416e+00]
  const pLow = 0.02425, pHigh = 1 - pLow
  let q: number
  if (p < pLow) {
    q = Math.sqrt(-2 * Math.log(p))
    return (((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5]) / ((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1)
  } else if (p <= pHigh) {
    q = p - 0.5
    const r = q*q
    return (((((a[0]*r+a[1])*r+a[2])*r+a[3])*r+a[4])*r+a[5])*q / (((((b[0]*r+b[1])*r+b[2])*r+b[3])*r+b[4])*r+1)
  } else {
    q = Math.sqrt(-2 * Math.log(1 - p))
    return -(((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5]) / ((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1)
  }
}

function tDistributionPDF(t: number, df: number): number {
  const lnCoeff = logGamma((df + 1) / 2) - logGamma(df / 2) - 0.5 * Math.log(df * Math.PI)
  return Math.exp(lnCoeff - ((df + 1) / 2) * Math.log(1 + (t * t) / df))
}

function tDistributionQuantile(p: number, df: number): number {
  if (p <= 0) return -Infinity
  if (p >= 1) return Infinity
  if (p === 0.5) return 0
  if (df <= 0) return NaN
  if (p < 0.5) return -tDistributionQuantile(1 - p, df)
  const z = normalQuantile(p)
  const g1 = (z**3 + z) / 4
  const g2 = (5*z**5 + 16*z**3 + 3*z) / 96
  let t = z + g1/df + g2/(df*df)
  for (let i = 0; i < 50; i++) {
    const error = tDistributionCDF(t, df) - p
    if (Math.abs(error) < 1e-12) break
    const pdf = tDistributionPDF(t, df)
    if (pdf === 0) break
    t -= error / pdf
  }
  return t
}

// Binomial sign-test: P(X >= k) when X ~ Binom(n, 0.5).
// Closed-form via cumulative regularized incomplete beta.
function binomialTailGE(k: number, n: number): number {
  // P(X >= k | n, p=0.5) = I_p(k, n - k + 1)
  if (k <= 0) return 1
  if (k > n) return 0
  return incompleteBeta(0.5, k, n - k + 1)
}

// Wilson 95% confidence interval for a binomial proportion.
function wilsonCI95(successes: number, n: number): [number, number] {
  if (n === 0) return [0, 0]
  const phat = successes / n
  const z = 1.959963984540054   // 97.5th percentile of standard normal
  const denom = 1 + (z*z) / n
  const center = (phat + (z*z)/(2*n)) / denom
  const half = z * Math.sqrt(phat*(1 - phat)/n + (z*z)/(4*n*n)) / denom
  return [Math.max(0, center - half), Math.min(1, center + half)]
}

// ──────────────────────────────────────────────────────────────────────────
// Public: compute the paired stats over a set of (seed, group, gen) rows.
// ──────────────────────────────────────────────────────────────────────────

export function computePairedStats(rows: PairedStatsInput[]): PairedStats | null {
  // Group convergence generations by (seed, group), then average each cell.
  const ctrlBySeed = new Map<number, number[]>()
  const expBySeed = new Map<number, number[]>()
  for (const r of rows) {
    if (r.seed == null || !Number.isFinite(r.convergenceGeneration)) continue
    const map = r.group === 'CONTROL' ? ctrlBySeed : expBySeed
    const list = map.get(r.seed) ?? []
    list.push(r.convergenceGeneration)
    map.set(r.seed, list)
  }

  // Build pairs only for seeds with both groups present.
  const diffs: number[] = []
  const ctrlMeans: number[] = []
  const expMeans: number[] = []
  for (const [seed, ctrlVals] of ctrlBySeed) {
    const expVals = expBySeed.get(seed)
    if (!expVals || expVals.length === 0) continue
    const cMean = ctrlVals.reduce((a, b) => a + b, 0) / ctrlVals.length
    const eMean = expVals.reduce((a, b) => a + b, 0) / expVals.length
    diffs.push(cMean - eMean)
    ctrlMeans.push(cMean)
    expMeans.push(eMean)
  }

  const n = diffs.length
  if (n < 2) return null

  const adaptiveWins = diffs.filter(d => d > 0).length
  const controlWins = diffs.filter(d => d < 0).length
  const ties = n - adaptiveWins - controlWins

  const meanDiff = diffs.reduce((a, b) => a + b, 0) / n
  const variance = diffs.reduce((s, d) => s + (d - meanDiff) ** 2, 0) / (n - 1)
  const stdDiff = Math.sqrt(variance)
  const seDiff = stdDiff / Math.sqrt(n)

  let tStat = 0, pTwo = 1, pOne = 0.5, df = n - 1
  let ciLower: number | null = null, ciUpper: number | null = null
  let cohensDz: number | null = null

  if (seDiff > 0) {
    tStat = meanDiff / seDiff
    pTwo = 2 * tDistributionCDF(-Math.abs(tStat), df)
    pOne = 1 - tDistributionCDF(tStat, df)
    const tCrit = tDistributionQuantile(0.975, df)
    ciLower = meanDiff - tCrit * seDiff
    ciUpper = meanDiff + tCrit * seDiff
  }
  if (stdDiff > 0) cohensDz = meanDiff / stdDiff

  // Sign test using a binomial tail (the more extreme of the two directions).
  const k = Math.max(adaptiveWins, controlWins)
  const signOne = binomialTailGE(k, adaptiveWins + controlWins)
  const signTwo = Math.min(1, 2 * signOne)

  const [wilsonLo, wilsonHi] = wilsonCI95(adaptiveWins, adaptiveWins + controlWins)

  const bestWin = Math.max(...diffs)
  const worstLoss = Math.min(...diffs)
  const adaptiveCredit = diffs.filter(d => d > 0).reduce((a, b) => a + b, 0)
  const controlCredit = -diffs.filter(d => d < 0).reduce((a, b) => a + b, 0)
  const magnitudeRatio = controlCredit > 0 ? adaptiveCredit / controlCredit : null

  const ctrlMeanAll = ctrlMeans.reduce((a, b) => a + b, 0) / n
  const expMeanAll = expMeans.reduce((a, b) => a + b, 0) / n
  const speedup = ctrlMeanAll > 0 ? ((ctrlMeanAll - expMeanAll) / ctrlMeanAll) * 100 : 0

  // Sensitivity: drop the top-K largest adaptive wins, see if result holds.
  const sortedAsc = [...diffs].sort((a, b) => a - b)
  const sensitivity: SensitivityRow[] = []
  for (const dropTop of [3, 5, 10]) {
    if (dropTop >= n) continue
    const trimmed = sortedAsc.slice(0, n - dropTop)
    const m = trimmed.reduce((a, b) => a + b, 0) / trimmed.length
    const v = trimmed.reduce((s, d) => s + (d - m) ** 2, 0) / (trimmed.length - 1)
    const sd = Math.sqrt(v)
    const se = sd / Math.sqrt(trimmed.length)
    if (se === 0) continue
    const t = m / se
    const p = 2 * tDistributionCDF(-Math.abs(t), trimmed.length - 1)
    sensitivity.push({
      dropTop,
      n: trimmed.length,
      meanDiff: m,
      tStat: t,
      pValueTwoTailed: p
    })
  }

  return {
    nPairs: n,
    adaptiveWins,
    controlWins,
    ties,
    winRate: adaptiveWins / (adaptiveWins + controlWins || 1),
    meanDiff,
    stdDiff,
    seDiff,
    tStatistic: tStat,
    degreesOfFreedom: df,
    pValueTwoTailed: pTwo,
    pValueOneTailed: pOne,
    cohensDz,
    ciLower,
    ciUpper,
    signTestPValueOneTailed: signOne,
    signTestPValueTwoTailed: signTwo,
    wilsonCILower: wilsonLo,
    wilsonCIUpper: wilsonHi,
    bestWin,
    worstLoss,
    adaptiveCreditTotal: adaptiveCredit,
    controlCreditTotal: controlCredit,
    magnitudeRatio,
    controlMeanGens: ctrlMeanAll,
    experimentalMeanGens: expMeanAll,
    speedupPercent: speedup,
    sensitivity
  }
}
