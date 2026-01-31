'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  ScientificAbstract,
  ProblemStatement,
  HypothesisCard,
  VariablesTable,
  MethodologyTimeline,
  ComparisonChart,
  ExperimentDataTable,
  StatsSummary,
  ConclusionCard,
  SampleSizeGuidance,
  // Scientific Rigor Components
  BoxPlotChart,
  QQPlot,
  AssumptionChecksCard,
  PowerAnalysisCard,
  EffectSizeCard
} from '@/components/dashboard'
import { Experiment, Generation } from '@/types/protocol'
import WorkerList from '@/components/WorkerList'

type StatisticalPowerLevel = 'insufficient' | 'minimum' | 'recommended' | 'robust'

// Scientific Rigor Types
interface NormalityTestResult {
  statistic: number | null
  pValue: number | null
  isNormal: boolean | null
  interpretation: string
  sampleSize: number
  testName: string
}

interface LeveneTestResult {
  statistic: number | null
  pValue: number | null
  equalVariances: boolean | null
  interpretation: string
  sampleSizes: { control: number; experimental: number }
}

interface OutlierResult {
  outlierCount: number
  outlierIndices: number[]
  outlierValues: number[]
  lowerBound: number | null
  upperBound: number | null
  Q1: number | null
  Q3: number | null
  IQR: number | null
  outlierPercentage: number
}

interface MannWhitneyResult {
  U: number | null
  pValue: number | null
  isSignificant: boolean | null
  rankBiserialR: number | null
  interpretation: string
  sampleSizes: { control: number; experimental: number }
}

interface HedgesGResult {
  hedgesG: number | null
  cohensD: number | null
  correctionFactor: number | null
  ciLower: number | null
  ciUpper: number | null
  interpretation: string
  sampleSizes: { control: number; experimental: number }
}

interface CLESResult {
  cles: number | null
  clesPercentage: number | null
  interpretation: string
}

interface PowerAnalysisResult {
  power: number | null
  powerPercentage: number | null
  isAdequate: boolean | null
  interpretation: string
  recommendation: string
}

interface RequiredSampleSizeResult {
  nPerGroup: number | null
  totalN: number | null
  effectSizeUsed: number | null
  targetPower: number
  interpretation: string
}

interface DistributionStats {
  n: number
  mean: number | null
  median: number | null
  std: number | null
  min: number | null
  max: number | null
  Q1: number | null
  Q3: number | null
  IQR: number | null
  skewness: number | null
  kurtosis: number | null
  values: number[]
}

interface BootstrapCIResult {
  ciLower: number | null
  ciUpper: number | null
  pointEstimate: number | null
  bootstrapSE: number | null
  nBootstrap: number
  confidenceLevel: number
  interpretation: string
}

interface DashboardData {
  controlExperiments: Experiment[]
  experimentalExperiments: Experiment[]
  controlGenerations: Generation[]
  experimentalGenerations: Generation[]
  statistics: {
    controlConvergenceGen: number | null
    experimentalConvergenceGen: number | null
    convergenceImprovement: number | null
    controlFinalElo: number | null
    experimentalFinalElo: number | null
    controlPeakElo: number | null
    experimentalPeakElo: number | null
    // Primary: convergence-generation t-test
    convergencePValue: number | null
    convergenceTStatistic: number | null
    convergenceIsSignificant: boolean
    convergenceControlMean: number | null
    convergenceExperimentalMean: number | null
    convergenceCohensD: number | null
    convergenceConfidenceInterval: { lower: number; upper: number } | null
    convergenceDegreesOfFreedom: number | null
    convergenceControlStd: number | null
    convergenceExperimentalStd: number | null
    convergenceMeanDifference: number | null
    controlConvergedCount: number
    experimentalConvergedCount: number
    // Secondary: Elo t-test (descriptive only)
    pValue: number | null
    tStatistic: number | null
    isSignificant: boolean
    totalGenerationsControl: number
    totalGenerationsExperimental: number
    controlExperimentCount: number
    experimentalExperimentCount: number
    controlAvgGenerations: number
    experimentalAvgGenerations: number
    statisticalPowerLevel: StatisticalPowerLevel
    degreesOfFreedom: number | null
    cohensD: number | null
    confidenceInterval: { lower: number; upper: number } | null
    controlMean: number | null
    experimentalMean: number | null
    controlStd: number | null
    experimentalStd: number | null
    meanDifference: number | null
  }
  // Scientific Rigor - Assumption Checks
  assumptionChecks?: {
    normalityControl: NormalityTestResult
    normalityExperimental: NormalityTestResult
    varianceEquality: LeveneTestResult
    bothNormal: boolean
    outlierControl: OutlierResult
    outlierExperimental: OutlierResult
    anyOutliers: boolean
    recommendation: 'parametric' | 'parametric_with_caution' | 'non_parametric'
    recommendationText: string
  }
  // Scientific Rigor - Non-parametric Test
  nonParametricTest?: MannWhitneyResult
  // Scientific Rigor - Enhanced Effect Sizes
  effectSizes?: {
    hedgesG: HedgesGResult
    cles: CLESResult
  }
  // Scientific Rigor - Power Analysis
  powerAnalysis?: {
    achievedPower: PowerAnalysisResult
    requiredFor80: RequiredSampleSizeResult
    requiredFor90: RequiredSampleSizeResult
    requiredFor95: RequiredSampleSizeResult
  }
  // Scientific Rigor - Bootstrap CI
  bootstrapCI?: BootstrapCIResult
  // Scientific Rigor - Distribution Data
  distributionData?: {
    control: DistributionStats
    experimental: DistributionStats
  }
}

// Static project content (methodology, hypothesis, variables - these don't change based on data)
const PROJECT_CONTENT_STATIC = {
  title: 'EvoNash',
  subtitle: 'Accelerating Convergence to Nash Equilibrium in Genetic Neural Networks via Adaptive Mutation Rates',
  studentName: 'Joel deFouw',
  division: 'Junior - Grade 8',
  category: 'Digital Technology / Computing & Information Systems',

  problemStatement: `Deep Reinforcement Learning (DRL) is computationally expensive and often acts as a "black box," making it difficult to prove mathematical optimality. While Genetic Algorithms offer a gradient-free alternative, they struggle with the "Exploration vs. Exploitation" trade-off. A static mutation rate is either too high (destroying good traits) or too low (stagnating progress).`,

  backgroundConcepts: [
    {
      term: 'Nash Equilibrium',
      definition: 'A state in game theory where no player can increase their payoff by changing their strategy unilaterally. In this simulation, it represents the "perfect" unexploitable strategy.'
    },
    {
      term: 'The Genetic Algorithm (GA)',
      definition: 'An optimization search inspired by natural selection. It relies on Selection (survival of the fittest), Crossover (mating), and Mutation (random variation).'
    },
    {
      term: 'Evolutionary Stable Strategy (ESS)',
      definition: 'A strategy which, if adopted by a population, cannot be invaded by any alternative mutant strategy.'
    }
  ],

  hypothesis: {
    if: 'the mutation rate (ε) of a neural network is dynamically scaled inversely to its parent\'s fitness (i.e., low-performing parents produce highly mutated offspring, while high-performing parents produce stable offspring)',
    then: 'the population will reach a state of Policy Entropy stability (Nash Equilibrium) in fewer generations than a control group using a static mutation rate',
    because: 'this mechanism mimics biological "stress-induced mutagenesis," allowing the population to escape local optima rapidly while preserving the genetic structure of successful dominant strategies.'
  },

  variables: {
    independent: [
      {
        name: 'Experiment Group',
        description: 'Determines mutation strategy: Control uses Static mutation (fixed ε=0.05), Experimental uses Adaptive mutation (calibrated to start at ~5%, then scales by fitness)',
        value: 'Control (Static) vs Experimental (Adaptive)'
      }
    ],
    dependent: [
      {
        name: 'Convergence Velocity',
        description: 'Number of generations for Entropy Variance to stabilize below threshold (σ < 0.01) for 20+ consecutive generations after initial divergence'
      },
      {
        name: 'Peak Performance',
        description: 'Maximum Elo rating achieved after 1,500 generations'
      }
    ],
    controlled: [
      { name: 'Random Seed', description: 'Ensures identical starting populations', value: '42' },
      { name: 'Population Size', description: 'Number of agents per generation', value: 'N = 1000' },
      { name: 'Neural Architecture', description: 'Network structure for all agents', value: '24 → 64 → 4' },
      { name: 'Compute Environment', description: 'Hardware used for simulation', value: 'RTX 3090' },
      { name: 'Simulation Physics', description: 'Deterministic physics engine', value: 'Petri Dish' },
      { name: 'Selection Pressure', description: 'Top percentage selected for reproduction', value: '20%' }
    ]
  },

  methodology: {
    steps: [
      {
        phase: 'Validation',
        title: 'Software Validation',
        description: 'A unit test was run to confirm the simulation is deterministic.',
        details: ['Given inputs X and seed S, the output must always be Y']
      },
      {
        phase: 'Phase I',
        title: 'Control Group Runs',
        description: 'Multiple experiments created with Experiment Group: Control (which enforces Static mutation ε = 0.05).',
        details: [
          'Static mutation rate ε = 0.05 applied uniformly',
          '5 runs with different seeds (42, 43, 44, 45, 46) for statistical power',
          '1,500 generations per run (750 ticks each ≈ 12 sec simulated lifetime)'
        ]
      },
      {
        phase: 'Phase II',
        title: 'Experimental Group Runs',
        description: 'Multiple experiments created with Experiment Group: Experimental (which enforces Adaptive mutation).',
        details: [
          'Adaptive mutation rate: ε = Base × (1 - CurrentElo/MaxElo)',
          'Base rate (0.0615) calibrated so initial rate ≈ 5% (same as Control) for fair comparison',
          '5 runs with same seeds as Control for fair comparison',
          'Low-fitness agents mutate more (exploration), high-fitness agents mutate less (exploitation)'
        ]
      },
      {
        phase: 'Analysis',
        title: 'Statistical Analysis',
        description: 'Raw telemetry exported to CSV for analysis. Two-sample t-test performed to determine significance.',
        details: [
          'Nash Equilibrium detected when entropy variance drops below σ < 0.01 AFTER initial divergence',
          'Same threshold applied to both groups for fair scientific comparison',
          'Requires 20+ consecutive stable generations to confirm convergence',
          'Compare convergence speed and peak Elo ratings with p < 0.05 significance threshold'
        ]
      }
    ],
    materialsAndApparatus: {
      hardware: [
        'Desktop PC (Ryzen 9, 64GB RAM)',
        'NVIDIA RTX 3090 GPU',
        'Allocated CUDA Cores (Fixed)'
      ],
      software: [
        'Python 3.9 with PyTorch (CUDA)',
        'Next.js Web Experiment',
        'PostgreSQL/TimescaleDB'
      ]
    }
  },

  // Static content for conclusion that doesn't depend on data
  sourcesOfError: [
    'Floating Point Drift: Despite CUDA optimization, minor floating-point differences can occur over millions of calculations',
    'Simulation Simplification: The "Petri Dish" is a simplified model of reality with idealized physics'
  ],
  futureWork: 'Further research could explore applying this adaptive mutation strategy to more complex environments and larger neural network architectures, as well as investigating the optimal scaling function for mutation rates.'
}

// Format p-value: scientific notation when very small (exact value), fixed decimals otherwise
function formatPValue(p: number, decimals = 4): string {
  return p < 0.0001 ? p.toExponential(2) : p.toFixed(decimals)
}

// Generate dynamic abstract based on actual statistics
function generateAbstract(stats: DashboardData['statistics'] | null): string {
  const baseAbstract = `This experiment investigates the efficiency of evolutionary algorithms in high-dimensional decision spaces. Traditional Genetic Algorithms (GAs) typically utilize static mutation rates, which often results in premature convergence to local optima or inefficient random searching. This project hypothesizes that an Adaptive Mutation Strategy—where mutation magnitude is inversely proportional to an agent's fitness—will accelerate convergence to a Nash Equilibrium compared to a static control. To test this, a custom distributed computing platform ("EvoNash") was engineered to run on an NVIDIA RTX 3090, simulating a deterministic biological environment ("The Petri Dish"). Two experiment groups of 1,000 Neural Networks each are evolved over multiple generations: the Control Group (Static mutation ε=0.05) and the Experimental Group (Adaptive mutation ε ∝ 1/Fitness).`

  if (!stats || stats.totalGenerationsControl === 0 || stats.totalGenerationsExperimental === 0) {
    return baseAbstract + ` Experiments are currently in progress—results will be displayed once sufficient data has been collected.`
  }

  // Build results sentence based on actual data
  const resultParts: string[] = []
  
  if (stats.convergenceImprovement !== null && stats.convergenceImprovement > 0) {
    resultParts.push(`the Experimental group achieved stable Policy Entropy (Nash Equilibrium) ${Math.round(stats.convergenceImprovement)}% faster than the Control group`)
  }

  if (stats.convergencePValue != null && stats.convergenceIsSignificant) {
    resultParts.push(`with a statistically significant difference in generations to Nash equilibrium (p = ${formatPValue(stats.convergencePValue, 3)})`)
  } else if (stats.convergencePValue != null) {
    resultParts.push(`though the difference in generations to Nash did not reach statistical significance (p = ${formatPValue(stats.convergencePValue, 3)})`)
  }

  if (resultParts.length > 0) {
    return baseAbstract + ` Telemetry demonstrates that ${resultParts.join(', ')}. These findings suggest that mimicking biological stress-response mechanisms may improve AI training efficiency on consumer hardware.`
  }

  return baseAbstract + ` Data collection is ongoing—preliminary results are being analyzed.`
}

// Generate dynamic key findings based on actual statistics
function generateKeyFindings(stats: DashboardData['statistics'] | null): string[] {
  const findings: string[] = []

  if (!stats || (stats.totalGenerationsControl === 0 && stats.totalGenerationsExperimental === 0)) {
    return ['Experiments are in progress—key findings will be generated from actual data once available']
  }

  // Finding 1: Convergence speed (only if data supports it)
  if (stats.convergenceImprovement !== null && stats.convergenceImprovement > 0 && 
      stats.controlConvergenceGen !== null && stats.experimentalConvergenceGen !== null) {
    findings.push(
      `The Adaptive group achieved stable Policy Entropy (Nash Equilibrium) ${Math.round(stats.convergenceImprovement)}% faster than the Control group (Generation ${stats.experimentalConvergenceGen} vs ${stats.controlConvergenceGen})`
    )
  } else if (stats.controlConvergenceGen === null && stats.experimentalConvergenceGen === null) {
    findings.push('Neither group has reached Nash Equilibrium convergence yet (entropy variance has not stabilized below 0.01)')
  } else if (stats.convergenceImprovement !== null && stats.convergenceImprovement <= 0) {
    findings.push(`The Control group converged ${Math.abs(Math.round(stats.convergenceImprovement))}% faster than the Adaptive group, contrary to the hypothesis`)
  }

  // Finding 2: Statistical significance (generations to Nash equilibrium)
  if (stats.convergencePValue != null) {
    if (stats.convergenceIsSignificant) {
      findings.push(
        `The Experimental group reached Nash equilibrium in significantly fewer generations (p = ${formatPValue(stats.convergencePValue)})`
      )
    } else {
      findings.push(
        `The difference in generations to Nash did not reach statistical significance (p = ${formatPValue(stats.convergencePValue)}, threshold: p < 0.05)`
      )
    }
  }

  // Finding 3: Adaptive strategy behavior (this is a design feature, not a data finding)
  findings.push(
    'The adaptive strategy is designed to balance Exploration (high mutation when losing) and Exploitation (low mutation when winning)'
  )

  // Finding 4: Data quantity note
  const totalGens = stats.totalGenerationsControl + stats.totalGenerationsExperimental
  const totalExperiments = stats.controlExperimentCount + stats.experimentalExperimentCount
  findings.push(
    `Analysis based on ${totalGens.toLocaleString()} generations across ${totalExperiments} experiments (${stats.controlExperimentCount} Control, ${stats.experimentalExperimentCount} Experimental)`
  )

  return findings
}

// Generate dynamic conclusion summary based on actual statistics
function generateConclusionSummary(stats: DashboardData['statistics'] | null, isHypothesisSupported: boolean | null): string {
  const baseSummary = 'This project investigates whether biological principles—specifically stress-induced mutagenesis—can be applied to artificial neural networks to improve training efficiency.'

  if (!stats || (stats.totalGenerationsControl === 0 && stats.totalGenerationsExperimental === 0)) {
    return baseSummary + ' Experiments are currently in progress, and conclusions will be drawn once sufficient data has been collected.'
  }

  if (isHypothesisSupported === null) {
    return baseSummary + ' Data collection is ongoing, but insufficient data exists to draw definitive conclusions about the hypothesis.'
  }

  if (isHypothesisSupported) {
    const improvementText = stats.convergenceImprovement !== null
      ? `approximately ${Math.round(stats.convergenceImprovement)}%`
      : 'measurably'

    const pStr = stats.convergencePValue != null ? formatPValue(stats.convergencePValue) : 'N/A'
    if (stats.convergenceIsSignificant) {
      return baseSummary + ` The experimental data demonstrates that an Adaptive Mutation strategy accelerates convergence to a Nash Equilibrium by ${improvementText} compared to static methods, with statistical significance (p = ${pStr}). This supports the hypothesis that biologically-inspired mutation strategies can improve AI training efficiency.`
    } else {
      return baseSummary + ` The experimental data shows that the Adaptive Mutation strategy converges ${improvementText} faster than the Control group (p = ${pStr}). While this result has not yet reached statistical significance (p < 0.05), the data trends in the expected direction, supporting the hypothesis. Additional experiments may strengthen this conclusion.`
    }
  } else {
    return baseSummary + ` However, the current experimental data does not support the hypothesis that adaptive mutation accelerates convergence. The Control group converged faster than or equal to the Experimental group. Further investigation may be needed to understand why the expected improvement was not observed.`
  }
}

// Generate dynamic implications based on whether hypothesis is supported
function generateImplications(stats: DashboardData['statistics'] | null, isHypothesisSupported: boolean | null): string {
  if (isHypothesisSupported === null) {
    return 'Implications will be determined once sufficient experimental data has been collected and analyzed.'
  }
  
  if (isHypothesisSupported) {
    if (stats?.convergenceIsSignificant) {
      return 'These findings demonstrate that mimicking biological stress-response mechanisms significantly improves AI training efficiency on consumer hardware, potentially democratizing access to advanced AI training.'
    }
    return 'These preliminary findings suggest that biologically-inspired adaptive mutation strategies may improve AI training efficiency. Continued data collection will help confirm whether this improvement is statistically robust.'
  }
  
  return 'While the current data does not support the hypothesis, this negative result provides valuable information about the conditions under which adaptive mutation strategies may or may not be effective.'
}

const NAV_SECTIONS = [
  { id: 'abstract', label: 'Abstract' },
  { id: 'problem', label: 'Problem' },
  { id: 'hypothesis', label: 'Hypothesis' },
  { id: 'variables', label: 'Variables' },
  { id: 'methodology', label: 'Methodology' },
  { id: 'results', label: 'Results' },
  { id: 'rigor', label: 'Statistical Rigor' },
  { id: 'data', label: 'Data' },
  { id: 'conclusion', label: 'Conclusion' },
  { id: 'workers', label: 'Workers' }
]

export default function ScienceFairDashboard() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeSection, setActiveSection] = useState('abstract')

  useEffect(() => {
    // Cache-bust so CDN/browser never serve stale data (unique URL per request)
    fetch(`/api/dashboard?_=${Date.now()}`, { cache: 'no-store' })
      .then(res => {
        if (!res.ok) {
          throw new Error(`API error: ${res.status}`)
        }
        return res.json()
      })
      .then(dashboardData => {
        // Validate that we got actual dashboard data, not an error response
        if (dashboardData.error || !dashboardData.controlExperiments) {
          throw new Error(dashboardData.error || 'Invalid response from server')
        }
        setData(dashboardData)
        setError(null)
        setLoading(false)
      })
      .catch(err => {
        console.error('Error fetching dashboard data:', err)
        setError(err.message || 'Failed to load experiment data')
        setLoading(false)
      })
  }, [])

  // Track active section on scroll
  useEffect(() => {
    const handleScroll = () => {
      const sections = NAV_SECTIONS.map(s => document.getElementById(s.id))
      const scrollPos = window.scrollY + 150

      for (let i = sections.length - 1; i >= 0; i--) {
        const section = sections[i]
        if (section && section.offsetTop <= scrollPos) {
          setActiveSection(NAV_SECTIONS[i].id)
          break
        }
      }
    }

    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id)
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' })
    }
  }

  // Determine if hypothesis is supported based on data
  // Supported = experimental group converges faster (positive improvement)
  // Statistical significance is reported separately in findings
  const hasEnoughData = Boolean(
    data?.statistics?.totalGenerationsControl && data?.statistics?.totalGenerationsExperimental
  )
  const isHypothesisSupported: boolean | null = hasEnoughData
    ? (data?.statistics?.convergenceImprovement ?? 0) > 0
    : null

  const pValStr = data?.statistics?.convergencePValue != null
    ? formatPValue(data.statistics.convergencePValue)
    : 'N/A'
  const supportingEvidence = data?.statistics
    ? `The Experimental group converged ${data.statistics.convergenceImprovement?.toFixed(0) ?? '?'}% faster (Generation ${data.statistics.experimentalConvergenceGen ?? '?'} vs ${data.statistics.controlConvergenceGen ?? '?'}). T-test on generations to Nash: p = ${pValStr}`
    : undefined

  // Generate dynamic content based on actual statistics
  const dynamicAbstract = generateAbstract(data?.statistics ?? null)
  const dynamicKeyFindings = generateKeyFindings(data?.statistics ?? null)
  const dynamicConclusionSummary = generateConclusionSummary(data?.statistics ?? null, isHypothesisSupported)
  const dynamicImplications = generateImplications(data?.statistics ?? null, isHypothesisSupported)

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Hero Section */}
      <div className="bg-gradient-to-br from-blue-600 via-purple-600 to-indigo-700 text-white">
        <div className="max-w-7xl mx-auto px-4 py-12">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            <div>
              <h1 className="text-4xl md:text-5xl font-bold mb-2">
                {PROJECT_CONTENT_STATIC.title}
              </h1>
              <p className="text-lg md:text-xl text-white/90 mb-4 max-w-3xl">
                {PROJECT_CONTENT_STATIC.subtitle}
              </p>
              <div className="flex flex-wrap gap-4 text-sm">
                <span className="px-3 py-1 bg-white/20 rounded-full">
                  {PROJECT_CONTENT_STATIC.studentName}
                </span>
                <span className="px-3 py-1 bg-white/20 rounded-full">
                  {PROJECT_CONTENT_STATIC.division}
                </span>
                <span className="px-3 py-1 bg-white/20 rounded-full">
                  {PROJECT_CONTENT_STATIC.category}
                </span>
              </div>
            </div>
            <Link
              href="/experiments"
              className="px-6 py-3 bg-white text-blue-600 rounded-lg font-semibold hover:bg-blue-50 transition-colors shadow-lg"
            >
              Manage Experiments
            </Link>
          </div>
        </div>
      </div>

      {/* Navigation Anchors */}
      <div className="sticky top-0 z-40 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shadow-sm">
        <div className="max-w-7xl mx-auto px-4">
          <nav className="flex gap-1 overflow-x-auto py-2">
            {NAV_SECTIONS.map(section => (
              <button
                key={section.id}
                onClick={() => scrollToSection(section.id)}
                className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                  activeSection === section.id
                    ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                {section.label}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
              <p className="text-gray-600 dark:text-gray-400">Loading experiment data...</p>
            </div>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-center max-w-md">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/30 mb-4">
                <svg className="w-8 h-8 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                Failed to Load Experiment
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-4">{error}</p>
              <p className="text-sm text-gray-500 dark:text-gray-500 mb-4">
                This may be a database connection issue. Please check that the server is properly configured.
              </p>
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Retry
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-8">
            {/* 1. Abstract */}
            <ScientificAbstract
              title={PROJECT_CONTENT_STATIC.title}
              subtitle={PROJECT_CONTENT_STATIC.subtitle}
              studentName={PROJECT_CONTENT_STATIC.studentName}
              division={PROJECT_CONTENT_STATIC.division}
              category={PROJECT_CONTENT_STATIC.category}
              abstract={dynamicAbstract}
              statistics={data?.statistics ?? null}
            />

            {/* 2. Problem Statement */}
            <ProblemStatement
              problemStatement={PROJECT_CONTENT_STATIC.problemStatement}
              backgroundConcepts={PROJECT_CONTENT_STATIC.backgroundConcepts}
            />

            {/* 3. Hypothesis */}
            <HypothesisCard
              ifStatement={PROJECT_CONTENT_STATIC.hypothesis.if}
              thenStatement={PROJECT_CONTENT_STATIC.hypothesis.then}
              becauseStatement={PROJECT_CONTENT_STATIC.hypothesis.because}
              isSupported={isHypothesisSupported}
              supportingEvidence={supportingEvidence}
            />

            {/* 4. Variables */}
            <VariablesTable
              independent={PROJECT_CONTENT_STATIC.variables.independent}
              dependent={PROJECT_CONTENT_STATIC.variables.dependent}
              controlled={PROJECT_CONTENT_STATIC.variables.controlled}
            />

            {/* 5. Methodology */}
            <MethodologyTimeline
              steps={PROJECT_CONTENT_STATIC.methodology.steps}
              materialsAndApparatus={PROJECT_CONTENT_STATIC.methodology.materialsAndApparatus}
            />

            {/* 6. Results Section */}
            <section id="results" className="scroll-mt-20 space-y-6">
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-8">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                  6. Results & Analysis
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
                  Interactive comparison of Control vs Experimental groups
                </p>

                {/* Summary Stats */}
                {data && (
                  <div className="grid md:grid-cols-4 gap-4 mb-6">
                    <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 text-center">
                      <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                        {data.controlExperiments.length}
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">Control Experiments</div>
                    </div>
                    <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4 text-center">
                      <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                        {data.experimentalExperiments.length}
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">Experimental</div>
                    </div>
                    <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4 text-center">
                      <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                        {data.statistics.totalGenerationsControl + data.statistics.totalGenerationsExperimental}
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">Total Generations</div>
                    </div>
                    <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-4 text-center">
                      <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                        {data.statistics.convergenceIsSignificant ? 'Yes' : 'Pending'}
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">Significant Result (generations to Nash)</div>
                    </div>
                  </div>
                )}
              </div>

              {/* Convergence Velocity Chart */}
              <ComparisonChart
                controlGenerations={data?.controlGenerations || []}
                experimentalGenerations={data?.experimentalGenerations || []}
                metric="elo"
                title="Convergence Velocity: Elo Rating Comparison"
                showConvergenceMarker={true}
                controlConvergenceGen={data?.statistics?.controlConvergenceGen}
                experimentalConvergenceGen={data?.statistics?.experimentalConvergenceGen}
              />

              {/* Entropy Collapse Chart */}
              <ComparisonChart
                controlGenerations={data?.controlGenerations || []}
                experimentalGenerations={data?.experimentalGenerations || []}
                metric="entropy"
                title="Entropy Collapse: Policy Entropy Comparison"
                showConvergenceMarker={true}
                controlConvergenceGen={data?.statistics?.controlConvergenceGen}
                experimentalConvergenceGen={data?.statistics?.experimentalConvergenceGen}
              />

              {/* Sample Size Guidance - Now uses actual calculated power */}
              <SampleSizeGuidance
                controlExperimentCount={data?.statistics?.controlExperimentCount ?? 0}
                experimentalExperimentCount={data?.statistics?.experimentalExperimentCount ?? 0}
                controlAvgGenerations={data?.statistics?.controlAvgGenerations ?? 0}
                experimentalAvgGenerations={data?.statistics?.experimentalAvgGenerations ?? 0}
                statisticalPowerLevel={data?.statistics?.statisticalPowerLevel ?? 'insufficient'}
                achievedPower={data?.powerAnalysis?.achievedPower?.power ?? null}
              />

              {/* Statistical Significance */}
              <StatsSummary
                controlConvergenceGen={data?.statistics?.controlConvergenceGen ?? null}
                experimentalConvergenceGen={data?.statistics?.experimentalConvergenceGen ?? null}
                convergenceImprovement={data?.statistics?.convergenceImprovement ?? null}
                controlFinalElo={data?.statistics?.controlFinalElo ?? null}
                experimentalFinalElo={data?.statistics?.experimentalFinalElo ?? null}
                controlPeakElo={data?.statistics?.controlPeakElo ?? null}
                experimentalPeakElo={data?.statistics?.experimentalPeakElo ?? null}
                convergencePValue={data?.statistics?.convergencePValue ?? null}
                convergenceIsSignificant={data?.statistics?.convergenceIsSignificant ?? false}
                convergenceTStatistic={data?.statistics?.convergenceTStatistic ?? null}
                convergenceDegreesOfFreedom={data?.statistics?.convergenceDegreesOfFreedom ?? null}
                convergenceCohensD={data?.statistics?.convergenceCohensD ?? null}
                convergenceConfidenceInterval={data?.statistics?.convergenceConfidenceInterval ?? null}
                convergenceControlMean={data?.statistics?.convergenceControlMean ?? null}
                convergenceExperimentalMean={data?.statistics?.convergenceExperimentalMean ?? null}
                convergenceControlStd={data?.statistics?.convergenceControlStd ?? null}
                convergenceExperimentalStd={data?.statistics?.convergenceExperimentalStd ?? null}
                convergenceMeanDifference={data?.statistics?.convergenceMeanDifference ?? null}
                controlConvergedCount={data?.statistics?.controlConvergedCount}
                experimentalConvergedCount={data?.statistics?.experimentalConvergedCount}
                totalGenerationsControl={data?.statistics?.totalGenerationsControl ?? 0}
                totalGenerationsExperimental={data?.statistics?.totalGenerationsExperimental ?? 0}
                controlExperimentCount={data?.statistics?.controlExperimentCount ?? 0}
                experimentalExperimentCount={data?.statistics?.experimentalExperimentCount ?? 0}
                statisticalPowerLevel={data?.statistics?.statisticalPowerLevel ?? 'insufficient'}
                pValue={data?.statistics?.pValue ?? null}
                isSignificant={data?.statistics?.isSignificant ?? false}
                tStatistic={data?.statistics?.tStatistic ?? null}
                degreesOfFreedom={data?.statistics?.degreesOfFreedom ?? null}
                cohensD={data?.statistics?.cohensD ?? null}
                confidenceInterval={data?.statistics?.confidenceInterval ?? null}
                controlMean={data?.statistics?.controlMean ?? null}
                experimentalMean={data?.statistics?.experimentalMean ?? null}
                controlStd={data?.statistics?.controlStd ?? null}
                experimentalStd={data?.statistics?.experimentalStd ?? null}
                meanDifference={data?.statistics?.meanDifference ?? null}
              />
            </section>

            {/* 6.5 Statistical Rigor Section */}
            <section id="rigor" className="scroll-mt-20 space-y-6">
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-8">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                  Statistical Rigor Analysis
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
                  Comprehensive statistical validation including assumption checks, non-parametric alternatives, 
                  enhanced effect sizes, and power analysis to ensure publication-quality scientific rigor.
                </p>

                {data?.assumptionChecks || data?.effectSizes || data?.powerAnalysis ? (
                  <div className="space-y-6">
                    {/* Row 1: Assumption Checks and Effect Sizes */}
                    <div className="grid lg:grid-cols-2 gap-6">
                      {/* Assumption Checks */}
                      {data?.assumptionChecks && (
                        <AssumptionChecksCard
                          normalityControl={data.assumptionChecks.normalityControl}
                          normalityExperimental={data.assumptionChecks.normalityExperimental}
                          varianceEquality={data.assumptionChecks.varianceEquality}
                          outlierControl={data.assumptionChecks.outlierControl}
                          outlierExperimental={data.assumptionChecks.outlierExperimental}
                          bothNormal={data.assumptionChecks.bothNormal}
                          anyOutliers={data.assumptionChecks.anyOutliers}
                          recommendation={data.assumptionChecks.recommendation}
                          recommendationText={data.assumptionChecks.recommendationText}
                        />
                      )}

                      {/* Effect Sizes */}
                      {data?.effectSizes && (
                        <EffectSizeCard
                          hedgesG={data.effectSizes.hedgesG}
                          cles={data.effectSizes.cles}
                          cohensD={data?.statistics?.convergenceCohensD ?? data?.statistics?.cohensD ?? null}
                        />
                      )}
                    </div>

                    {/* Row 2: Power Analysis and Distribution */}
                    <div className="grid lg:grid-cols-2 gap-6">
                      {/* Power Analysis */}
                      {data?.powerAnalysis && (
                        <PowerAnalysisCard
                          achievedPower={data.powerAnalysis.achievedPower}
                          requiredFor80={data.powerAnalysis.requiredFor80}
                          requiredFor90={data.powerAnalysis.requiredFor90}
                          requiredFor95={data.powerAnalysis.requiredFor95}
                          currentControlN={data?.statistics?.controlConvergedCount ?? data?.statistics?.controlExperimentCount ?? 0}
                          currentExperimentalN={data?.statistics?.experimentalConvergedCount ?? data?.statistics?.experimentalExperimentCount ?? 0}
                          effectSize={data?.effectSizes?.hedgesG?.hedgesG ?? data?.statistics?.convergenceCohensD ?? data?.statistics?.cohensD ?? null}
                        />
                      )}

                      {/* Box Plot */}
                      {data?.distributionData && (
                        <BoxPlotChart
                          controlData={data.distributionData.control}
                          experimentalData={data.distributionData.experimental}
                          title="Distribution Comparison (Box Plot) — Generations to Nash"
                        />
                      )}
                    </div>

                    {/* Row 3: Q-Q Plot */}
                    {data?.distributionData && (
                      <QQPlot
                        controlValues={data.distributionData.control?.values ?? []}
                        experimentalValues={data.distributionData.experimental?.values ?? []}
                        title="Q-Q Plots (Normality Assessment) — Generations to Nash"
                      />
                    )}

                    {/* Non-Parametric Test Results */}
                    {data?.nonParametricTest && (
                      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
                        <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
                          Non-Parametric Test (Mann-Whitney U)
                        </h4>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
                          Generations to Nash equilibrium. Distribution-free alternative to the t-test; does not assume normality.
                        </p>
                        <div className="grid md:grid-cols-4 gap-4">
                          <div className="p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
                            <div className="text-xs text-gray-500 dark:text-gray-400">U Statistic</div>
                            <div className="text-lg font-bold text-gray-900 dark:text-white">
                              {data.nonParametricTest.U?.toFixed(2) ?? 'N/A'}
                            </div>
                          </div>
                          <div className="p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
                            <div className="text-xs text-gray-500 dark:text-gray-400">p-Value</div>
                            <div className="text-lg font-bold text-gray-900 dark:text-white">
                              {data.nonParametricTest.pValue !== null 
                                ? (data.nonParametricTest.pValue < 0.0001 ? '< 0.0001' : data.nonParametricTest.pValue.toFixed(4))
                                : 'N/A'}
                            </div>
                          </div>
                          <div className="p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
                            <div className="text-xs text-gray-500 dark:text-gray-400">Rank-Biserial r</div>
                            <div className="text-lg font-bold text-gray-900 dark:text-white">
                              {data.nonParametricTest.rankBiserialR?.toFixed(3) ?? 'N/A'}
                            </div>
                          </div>
                          <div className="p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
                            <div className="text-xs text-gray-500 dark:text-gray-400">Result</div>
                            <div className={`text-lg font-bold ${
                              data.nonParametricTest.isSignificant 
                                ? 'text-green-600 dark:text-green-400' 
                                : 'text-gray-600 dark:text-gray-400'
                            }`}>
                              {data.nonParametricTest.isSignificant ? 'Significant' : 'Not Significant'}
                            </div>
                          </div>
                        </div>
                        <div className="mt-3 text-sm text-gray-600 dark:text-gray-400">
                          {data.nonParametricTest.interpretation}
                        </div>
                      </div>
                    )}

                    {/* Bootstrap CI */}
                    {data?.bootstrapCI && (
                      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
                        <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                          Bootstrap Confidence Interval
                        </h4>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
                          Distribution-free CI using {data.bootstrapCI.nBootstrap.toLocaleString()} bootstrap resamples.
                        </p>
                        <div className="grid md:grid-cols-3 gap-4">
                          <div className="p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
                            <div className="text-xs text-gray-500 dark:text-gray-400">Point Estimate</div>
                            <div className="text-lg font-bold text-gray-900 dark:text-white">
                              {data.bootstrapCI.pointEstimate?.toFixed(3) ?? 'N/A'}
                            </div>
                          </div>
                          <div className="p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                            <div className="text-xs text-purple-600 dark:text-purple-400">
                              {(data.bootstrapCI.confidenceLevel * 100).toFixed(0)}% CI
                            </div>
                            <div className="text-lg font-bold text-gray-900 dark:text-white">
                              [{data.bootstrapCI.ciLower?.toFixed(3) ?? '?'}, {data.bootstrapCI.ciUpper?.toFixed(3) ?? '?'}]
                            </div>
                          </div>
                          <div className="p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
                            <div className="text-xs text-gray-500 dark:text-gray-400">Bootstrap SE</div>
                            <div className="text-lg font-bold text-gray-900 dark:text-white">
                              {data.bootstrapCI.bootstrapSE?.toFixed(4) ?? 'N/A'}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                    <svg className="w-12 h-12 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                    <p>Run experiments in both Control and Experimental groups to see statistical rigor analysis.</p>
                    <p className="text-sm mt-2">Need at least 1 experiment per group for basic analysis, 2+ for t-tests.</p>
                  </div>
                )}
              </div>
            </section>

            {/* 7. Data Tables */}
            <ExperimentDataTable
              controlExperiments={data?.controlExperiments || []}
              experimentalExperiments={data?.experimentalExperiments || []}
              controlGenerations={data?.controlGenerations || []}
              experimentalGenerations={data?.experimentalGenerations || []}
            />

            {/* 8. Conclusion */}
            <ConclusionCard
              summary={dynamicConclusionSummary}
              hypothesisSupported={isHypothesisSupported}
              keyFindings={dynamicKeyFindings}
              implications={dynamicImplications}
              sourcesOfError={PROJECT_CONTENT_STATIC.sourcesOfError}
              futureWork={PROJECT_CONTENT_STATIC.futureWork}
            />

            {/* Workers Section */}
            <section id="workers" className="scroll-mt-20">
              <div className="mb-4">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                  GPU Workers
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Connected workers processing experiments on distributed GPUs
                </p>
              </div>
              <WorkerList />
            </section>

            {/* Quick Links Footer */}
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-8">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Quick Links
              </h3>
              <div className="grid md:grid-cols-3 gap-4">
                <Link
                  href="/experiments"
                  className="flex items-center gap-3 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                  </svg>
                  <div>
                    <div className="font-medium text-gray-900 dark:text-white">View All Experiments</div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">Manage and monitor experiments</div>
                  </div>
                </Link>
                <Link
                  href="/experiments/new"
                  className="flex items-center gap-3 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  <div>
                    <div className="font-medium text-gray-900 dark:text-white">New Experiment</div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">Create a new test run</div>
                  </div>
                </Link>
                <a
                  href="/api/worker/download"
                  download="evonash-worker-windows.zip"
                  className="flex items-center gap-3 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  <div>
                    <div className="font-medium text-gray-900 dark:text-white">Download Worker</div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">GPU worker for Windows</div>
                  </div>
                </a>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="bg-gray-100 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 mt-12">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="text-sm text-gray-600 dark:text-gray-400">
              EvoNash - Evolutionary Nash Equilibrium Analyzer
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-500">
              Science Fair Project by {PROJECT_CONTENT_STATIC.studentName}
            </div>
          </div>
        </div>
      </footer>
    </main>
  )
}
