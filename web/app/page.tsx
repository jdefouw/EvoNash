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
  SampleSizeGuidance
} from '@/components/dashboard'
import { Experiment, Generation } from '@/types/protocol'

type StatisticalPowerLevel = 'insufficient' | 'minimum' | 'recommended' | 'robust'

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
  }
}

// Project content from CWSF_REPORT.md
const PROJECT_CONTENT = {
  title: 'EvoNash',
  subtitle: 'Accelerating Convergence to Nash Equilibrium in Genetic Neural Networks via Adaptive Mutation Rates',
  studentName: 'Joel deFouw',
  division: 'Junior - Grade 8',
  category: 'Digital Technology / Computing & Information Systems',
  
  abstract: `This experiment investigates the efficiency of evolutionary algorithms in high-dimensional decision spaces. Traditional Genetic Algorithms (GAs) typically utilize static mutation rates, which often results in premature convergence to local optima or inefficient random searching. This project hypothesizes that an Adaptive Mutation Strategy—where mutation magnitude is inversely proportional to an agent's fitness—will accelerate convergence to a Nash Equilibrium compared to a static control. To test this, a custom distributed computing platform ("EvoNash") was engineered to run on an NVIDIA RTX 3090, simulating a deterministic biological environment ("The Petri Dish"). Two populations of 1,000 Neural Networks were evolved over 1,500 generations (750 ticks each): Group A (Static ε=0.05) and Group B (Adaptive ε ∝ 1/Fitness). Telemetry demonstrates that the Adaptive group achieved stable Policy Entropy (Nash Equilibrium) 40% faster than the Control group, with a statistically significant higher peak Elo rating (p < 0.05). These findings suggest that mimicking biological stress-response mechanisms significantly improves AI training efficiency on consumer hardware.`,

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
        name: 'Mutation Strategy',
        description: 'The method used to apply genetic mutations during evolution',
        value: 'Static (ε=0.05) vs Adaptive (ε ∝ 1/Fitness)'
      }
    ],
    dependent: [
      {
        name: 'Convergence Velocity',
        description: 'Number of generations required for Policy Entropy variance to drop below σ < 0.01'
      },
      {
        name: 'Peak Performance',
        description: 'Maximum Elo rating achieved after 1,500 generations'
      }
    ],
    controlled: [
      { name: 'Random Seed', description: 'Ensures identical starting populations', value: '12345' },
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
        title: 'Control Run (Static)',
        description: 'The system was configured to Mode: STATIC and ran for 1,500 generations (750 ticks each).',
        details: [
          'Static mutation rate ε = 0.05',
          'Every 10 generations, Mean Elo and Policy Entropy were logged'
        ]
      },
      {
        phase: 'Phase II',
        title: 'Experimental Run (Adaptive)',
        description: 'The system was reset with the same seed and configured to Mode: ADAPTIVE.',
        details: [
          'Adaptive mutation rate: ε = Base × (1 - NormalizedElo)',
          'Ran for 1,500 generations (750 ticks each) with identical conditions'
        ]
      },
      {
        phase: 'Analysis',
        title: 'Data Extraction',
        description: 'Raw telemetry was exported to CSV format for statistical analysis using SciPy.',
        details: [
          'Two-sample t-test performed on final Elo ratings',
          'Convergence points identified from entropy variance data'
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
        'Next.js Web Dashboard',
        'PostgreSQL/TimescaleDB'
      ]
    }
  },

  conclusion: {
    summary: 'This project successfully demonstrated that biological principles—specifically stress-induced mutagenesis—can be applied to artificial neural networks to improve training efficiency. The EvoNash platform proved that an Adaptive Mutation strategy accelerates convergence to a Nash Equilibrium by approximately 40% compared to static methods. This has significant implications for training large AI models on consumer hardware, suggesting that "smarter" training algorithms can reduce the need for massive compute clusters.',
    keyFindings: [
      'The Adaptive group achieved stable Policy Entropy (Nash Equilibrium) 40% faster than the Control group',
      'The Experimental group achieved a statistically significant higher peak Elo rating (p < 0.05)',
      'The adaptive strategy successfully balanced Exploration (high mutation when losing) and Exploitation (low mutation when winning)',
      'In the simulation, this manifested as rapid discovery of Foraging strategy, followed by evolution of Evasive Maneuvers when Predators emerged'
    ],
    implications: 'These findings suggest that mimicking biological stress-response mechanisms significantly improves AI training efficiency on consumer hardware, potentially democratizing access to advanced AI training.',
    sourcesOfError: [
      'Floating Point Drift: Despite CUDA optimization, minor floating-point differences can occur over millions of calculations',
      'Simulation Simplification: The "Petri Dish" is a simplified model of reality with idealized physics'
    ],
    futureWork: 'Further research could explore applying this adaptive mutation strategy to more complex environments and larger neural network architectures, as well as investigating the optimal scaling function for mutation rates.'
  }
}

const NAV_SECTIONS = [
  { id: 'abstract', label: 'Abstract' },
  { id: 'problem', label: 'Problem' },
  { id: 'hypothesis', label: 'Hypothesis' },
  { id: 'variables', label: 'Variables' },
  { id: 'methodology', label: 'Methodology' },
  { id: 'results', label: 'Results' },
  { id: 'data', label: 'Data' },
  { id: 'conclusion', label: 'Conclusion' }
]

export default function ScienceFairDashboard() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeSection, setActiveSection] = useState('abstract')

  useEffect(() => {
    fetch('/api/dashboard')
      .then(res => res.json())
      .then(dashboardData => {
        setData(dashboardData)
        setLoading(false)
      })
      .catch(err => {
        console.error('Error fetching dashboard data:', err)
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
  const isHypothesisSupported: boolean = Boolean(
    data?.statistics?.isSignificant && (data?.statistics?.convergenceImprovement ?? 0) > 0
  )

  const supportingEvidence = data?.statistics ? 
    `The Experimental group converged ${data.statistics.convergenceImprovement?.toFixed(0) ?? '?'}% faster (Generation ${data.statistics.experimentalConvergenceGen ?? '?'} vs ${data.statistics.controlConvergenceGen ?? '?'}). T-test p-value: ${data.statistics.pValue?.toFixed(4) ?? 'N/A'}` : 
    undefined

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Hero Section */}
      <div className="bg-gradient-to-br from-blue-600 via-purple-600 to-indigo-700 text-white">
        <div className="max-w-7xl mx-auto px-4 py-12">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            <div>
              <h1 className="text-4xl md:text-5xl font-bold mb-2">
                {PROJECT_CONTENT.title}
              </h1>
              <p className="text-lg md:text-xl text-white/90 mb-4 max-w-3xl">
                {PROJECT_CONTENT.subtitle}
              </p>
              <div className="flex flex-wrap gap-4 text-sm">
                <span className="px-3 py-1 bg-white/20 rounded-full">
                  {PROJECT_CONTENT.studentName}
                </span>
                <span className="px-3 py-1 bg-white/20 rounded-full">
                  {PROJECT_CONTENT.division}
                </span>
                <span className="px-3 py-1 bg-white/20 rounded-full">
                  {PROJECT_CONTENT.category}
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
              <p className="text-gray-600 dark:text-gray-400">Loading dashboard data...</p>
            </div>
          </div>
        ) : (
          <div className="space-y-8">
            {/* 1. Abstract */}
            <ScientificAbstract
              title={PROJECT_CONTENT.title}
              subtitle={PROJECT_CONTENT.subtitle}
              studentName={PROJECT_CONTENT.studentName}
              division={PROJECT_CONTENT.division}
              category={PROJECT_CONTENT.category}
              abstract={PROJECT_CONTENT.abstract}
            />

            {/* 2. Problem Statement */}
            <ProblemStatement
              problemStatement={PROJECT_CONTENT.problemStatement}
              backgroundConcepts={PROJECT_CONTENT.backgroundConcepts}
            />

            {/* 3. Hypothesis */}
            <HypothesisCard
              ifStatement={PROJECT_CONTENT.hypothesis.if}
              thenStatement={PROJECT_CONTENT.hypothesis.then}
              becauseStatement={PROJECT_CONTENT.hypothesis.because}
              isSupported={data?.statistics?.totalGenerationsControl && data?.statistics?.totalGenerationsExperimental ? isHypothesisSupported : null}
              supportingEvidence={supportingEvidence}
            />

            {/* 4. Variables */}
            <VariablesTable
              independent={PROJECT_CONTENT.variables.independent}
              dependent={PROJECT_CONTENT.variables.dependent}
              controlled={PROJECT_CONTENT.variables.controlled}
            />

            {/* 5. Methodology */}
            <MethodologyTimeline
              steps={PROJECT_CONTENT.methodology.steps}
              materialsAndApparatus={PROJECT_CONTENT.methodology.materialsAndApparatus}
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
                        {data.statistics.isSignificant ? 'Yes' : 'Pending'}
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">Significant Result</div>
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

              {/* Sample Size Guidance */}
              <SampleSizeGuidance
                controlExperimentCount={data?.statistics?.controlExperimentCount ?? 0}
                experimentalExperimentCount={data?.statistics?.experimentalExperimentCount ?? 0}
                controlAvgGenerations={data?.statistics?.controlAvgGenerations ?? 0}
                experimentalAvgGenerations={data?.statistics?.experimentalAvgGenerations ?? 0}
                statisticalPowerLevel={data?.statistics?.statisticalPowerLevel ?? 'insufficient'}
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
                pValue={data?.statistics?.pValue ?? null}
                isSignificant={data?.statistics?.isSignificant ?? false}
                totalGenerationsControl={data?.statistics?.totalGenerationsControl ?? 0}
                totalGenerationsExperimental={data?.statistics?.totalGenerationsExperimental ?? 0}
                controlExperimentCount={data?.statistics?.controlExperimentCount ?? 0}
                experimentalExperimentCount={data?.statistics?.experimentalExperimentCount ?? 0}
                statisticalPowerLevel={data?.statistics?.statisticalPowerLevel ?? 'insufficient'}
              />
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
              summary={PROJECT_CONTENT.conclusion.summary}
              hypothesisSupported={data?.statistics?.totalGenerationsControl && data?.statistics?.totalGenerationsExperimental ? isHypothesisSupported : null}
              keyFindings={PROJECT_CONTENT.conclusion.keyFindings}
              implications={PROJECT_CONTENT.conclusion.implications}
              sourcesOfError={PROJECT_CONTENT.conclusion.sourcesOfError}
              futureWork={PROJECT_CONTENT.conclusion.futureWork}
            />

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
              Science Fair Project by {PROJECT_CONTENT.studentName}
            </div>
          </div>
        </div>
      </footer>
    </main>
  )
}
