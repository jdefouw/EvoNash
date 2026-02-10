"use client";

import { useEffect, useState } from "react";
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
  BoxPlotChart,
  QQPlot,
  AssumptionChecksCard,
  PowerAnalysisCard,
  EffectSizeCard,
  VerificationCard
} from "@/components/dashboard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// Match the DashboardData interface from the API
interface DashboardData {
  controlExperiments: any[]
  experimentalExperiments: any[]
  controlGenerations: any[]
  experimentalGenerations: any[]
  statistics: {
    controlConvergenceGen: number | null
    experimentalConvergenceGen: number | null
    convergenceImprovement: number | null
    controlFinalFitness: number | null
    experimentalFinalFitness: number | null
    controlPeakFitness: number | null
    experimentalPeakFitness: number | null
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
    pValue: number | null
    tStatistic: number | null
    isSignificant: boolean
    degreesOfFreedom: number | null
    cohensD: number | null
    confidenceInterval: { lower: number; upper: number } | null
    controlMean: number | null
    experimentalMean: number | null
    controlStd: number | null
    experimentalStd: number | null
    meanDifference: number | null
    totalGenerationsControl: number
    totalGenerationsExperimental: number
    controlExperimentCount: number
    experimentalExperimentCount: number
    controlAvgGenerations: number
    experimentalAvgGenerations: number
    statisticalPowerLevel: 'insufficient' | 'minimum' | 'recommended' | 'robust'
    controlConvergedCount: number
    experimentalConvergedCount: number
  }
  assumptionChecks?: any
  nonParametricTest?: any
  effectSizes?: {
    hedgesG: any
    cles: any
  }
  powerAnalysis?: {
    achievedPower: any
    requiredFor80: any
    requiredFor90: any
    requiredFor95: any
  }
  bootstrapCI?: any
  distributionData?: {
    control: any
    experimental: any
  }
}

export default function DashboardPage() {
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch dashboard data from API
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const res = await fetch('/api/dashboard');
        if (!res.ok) {
          throw new Error(`Failed to fetch dashboard data: ${res.status}`);
        }
        const data = await res.json();
        if (data.error) {
          throw new Error(data.error);
        }
        setDashboardData(data);
        setError(null);
      } catch (err) {
        console.error('Dashboard fetch error:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // Data for VariablesTable
  const variablesData = {
    independent: [
      { name: "Mutation Strategy", description: "Control (Static) vs. Adaptive (Fitness-Scaled)", value: "Adaptive" },
      { name: "Generation Count", description: "Number of evolutionary generations", value: "Continuous" }
    ],
    dependent: [
      { name: "Convergence Velocity", description: "Generations to reach Nash Equilibrium (Policy Entropy < 0.001)" },
      { name: "Policy Entropy", description: "Measure of strategy randomness (Shannon Entropy)" },
      { name: "Entropy Variance", description: "Stability of population strategies" },
      { name: "Fitness Score", description: "Relative skill level (Self-play performance)" }
    ],
    controlled: [
      { name: "Population Size", description: "Fixed number of agents per generation", value: 100 },
      { name: "Selection Pressure", description: "Tournament size / truncation ratio", value: "Top 20%" },
      { name: "Network Architecture", description: "Input/Hidden/Output layers", value: "24-16-16-4" },
      { name: "Simulation Ticks", description: "Ticks per generation", value: 750 },
      { name: "Random Seed Pairings", description: "Identical seeds for Control/Experimental pairs", value: "Matched" }
    ]
  };

  // Data for MethodologyTimeline
  const methodologyData = {
    steps: [
      {
        phase: "Phase 1",
        title: "Baseline Establishment",
        description: "Run Control experiments with static mutation rate (ε=0.05) to establish baseline convergence speed.",
        status: "completed" as const
      },
      {
        phase: "Phase 2",
        title: "Adaptive Implementation",
        description: "Implement fitness-based adaptive mutation scaling. Mutation rate decreases as fitness increases.",
        status: "completed" as const
      },
      {
        phase: "Phase 3",
        title: "Comparative Data Collection",
        description: "Run 30 matched pairs of experiments (Control vs. Experimental) with identical seeds.",
        status: "in_progress" as const,
        details: ["Running batches on worker nodes", "Uploading telemetry to central database", "Monitoring for failures"]
      },
      {
        phase: "Phase 4",
        title: "Statistical Analysis",
        description: "Perform Welch's t-test on convergence generations and analyze effect sizes.",
        status: "pending" as const
      }
    ],
    materialsAndApparatus: {
      hardware: ["Distributed Worker Nodes (x4)", "Central Database Server", "GPU Acceleration (CUDA)"],
      software: ["Python 3.10", "PyTorch (Neural Networks)", "PostgreSQL (Data Storage)", "Next.js Dashboard"]
    }
  };

  // Extract values from API data (with safe defaults)
  const stats = dashboardData?.statistics;
  const controlExperiments = dashboardData?.controlExperiments ?? [];
  const experimentalExperiments = dashboardData?.experimentalExperiments ?? [];
  const controlGenerations = dashboardData?.controlGenerations ?? [];
  const experimentalGenerations = dashboardData?.experimentalGenerations ?? [];

  // Dynamically compute hypothesis supported from actual results
  const hypothesisSupported = stats
    ? (stats.convergenceIsSignificant &&
      stats.convergenceControlMean !== null &&
      stats.convergenceExperimentalMean !== null &&
      stats.convergenceExperimentalMean < stats.convergenceControlMean)
      ? true
      : (stats.controlConvergedCount >= 2 && stats.experimentalConvergedCount >= 2)
        ? false
        : null
    : null;

  // Dynamically generate key findings from actual data
  const keyFindings: string[] = [];
  if (stats) {
    const controlCount = stats.controlExperimentCount;
    const expCount = stats.experimentalExperimentCount;
    if (controlCount > 0 || expCount > 0) {
      keyFindings.push(
        `${controlCount} Control and ${expCount} Experimental experiments completed (${stats.controlConvergedCount} and ${stats.experimentalConvergedCount} converged to Nash Equilibrium, respectively).`
      );
    }
    if (stats.convergenceControlMean !== null && stats.convergenceExperimentalMean !== null) {
      keyFindings.push(
        `Mean convergence: Control = ${stats.convergenceControlMean.toFixed(1)} generations, Experimental = ${stats.convergenceExperimentalMean.toFixed(1)} generations.`
      );
    }
    if (stats.convergenceImprovement !== null) {
      const faster = stats.convergenceImprovement > 0;
      keyFindings.push(
        `Adaptive mutation is ${faster ? '' : 'not '}faster: ${Math.abs(stats.convergenceImprovement).toFixed(1)}% ${faster ? 'improvement' : 'slower'} in convergence speed.`
      );
    }
    if (stats.convergencePValue !== null) {
      const pStr = stats.convergencePValue < 0.0001
        ? '< 0.0001'
        : stats.convergencePValue.toFixed(4);
      keyFindings.push(
        `Welch's t-test: p = ${pStr} (${stats.convergenceIsSignificant ? 'statistically significant at α = 0.05' : 'not statistically significant'}).`
      );
    }
    if (stats.convergenceCohensD !== null) {
      const absD = Math.abs(stats.convergenceCohensD);
      const sizeLabel = absD >= 0.8 ? 'large' : absD >= 0.5 ? 'medium' : absD >= 0.2 ? 'small' : 'negligible';
      keyFindings.push(
        `Effect size: Cohen's d = ${stats.convergenceCohensD.toFixed(3)} (${sizeLabel}).`
      );
    }
    if (dashboardData?.powerAnalysis?.achievedPower?.power !== null && dashboardData?.powerAnalysis?.achievedPower?.power !== undefined) {
      const powerPct = (dashboardData.powerAnalysis.achievedPower.power * 100).toFixed(1);
      keyFindings.push(
        `Statistical power: ${powerPct}% (${dashboardData.powerAnalysis.achievedPower.isAdequate ? 'adequate' : 'below 80% threshold'}).`
      );
    }
  }

  // Dynamic summary for conclusion
  const conclusionSummary = stats
    ? hypothesisSupported === true
      ? `The experimental data supports the hypothesis. Adaptive mutation significantly accelerated convergence to Nash Equilibrium compared to static mutation (p = ${stats.convergencePValue !== null ? (stats.convergencePValue < 0.0001 ? '< 0.0001' : stats.convergencePValue.toFixed(4)) : 'N/A'}), with a ${Math.abs(stats.convergenceImprovement ?? 0).toFixed(1)}% improvement in convergence speed.`
      : hypothesisSupported === false
        ? `The experimental data does not support the hypothesis. While both groups converged to Nash Equilibrium, the difference in convergence speed between adaptive and static mutation was not statistically significant (p = ${stats.convergencePValue !== null ? stats.convergencePValue.toFixed(4) : 'N/A'}).`
        : `The experiment is still in progress. ${stats.controlExperimentCount + stats.experimentalExperimentCount} experiments have been completed so far (${stats.controlConvergedCount + stats.experimentalConvergedCount} converged). More data is needed for a definitive conclusion.`
    : 'Waiting for experiment data...';

  // Dynamic implications
  const implications = hypothesisSupported === true
    ? 'The adaptive mutation strategy could provide a computationally efficient method for training agents in competitive environments, reducing the number of generations needed to reach strategic equilibrium.'
    : hypothesisSupported === false
      ? 'The static mutation rate appears sufficient for this environment. Further investigation with different mutation scaling functions or more complex game environments may be warranted.'
      : 'If supported, this research could provide a computationally efficient method for training agents in competitive environments.';

  // Hero metric values
  const totalExperiments = (stats?.controlExperimentCount ?? 0) + (stats?.experimentalExperimentCount ?? 0);
  const totalConverged = (stats?.controlConvergedCount ?? 0) + (stats?.experimentalConvergedCount ?? 0);
  const convergenceRate = totalExperiments > 0 ? Math.round((totalConverged / totalExperiments) * 100) : 0;
  const powerLabel = stats?.statisticalPowerLevel
    ? ({ insufficient: 'Low', minimum: 'Minimum', recommended: 'Good', robust: 'Robust' } as Record<string, string>)[stats.statisticalPowerLevel]
    : '—';

  return (
    <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">
      {/* ── HERO BANNER ── */}
      <div className="hero-banner px-8 py-8 animate-fade-in">
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/15 backdrop-blur-sm rounded-full text-white/90 text-xs font-medium mb-3">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              CWSF 2026 Candidate
            </div>
            <h1 className="text-3xl md:text-4xl font-bold text-white tracking-tight">
              EvoNash Scientific Dashboard
            </h1>
            <p className="text-white/70 mt-1.5 text-sm max-w-xl">
              Investigating Adaptive Mutation Rates in Genetic Neural Networks
            </p>
          </div>
          <div className="flex items-center gap-2">
            {hypothesisSupported !== null && (
              <div className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium backdrop-blur-sm ${hypothesisSupported
                ? 'bg-green-500/20 text-green-100 border border-green-400/30'
                : 'bg-red-500/20 text-red-100 border border-red-400/30'
                }`}>
                <span>{hypothesisSupported ? '✓' : '✗'}</span>
                {hypothesisSupported ? 'Hypothesis Supported' : 'Hypothesis Not Supported'}
              </div>
            )}
          </div>
        </div>

        {/* Metrics bar */}
        <div className="relative z-10 metrics-bar">
          <div className="metric-item">
            <div className="metric-value">{loading ? '—' : totalExperiments}</div>
            <div className="metric-label">Experiments</div>
          </div>
          <div className="metric-item">
            <div className="metric-value">{loading ? '—' : `${convergenceRate}%`}</div>
            <div className="metric-label">Convergence Rate</div>
          </div>
          <div className="metric-item">
            <div className="metric-value">{loading ? '—' : (stats?.convergenceImprovement !== null ? `${stats?.convergenceImprovement?.toFixed(1)}%` : '—')}</div>
            <div className="metric-label">Speed Improvement</div>
          </div>
          <div className="metric-item">
            <div className="metric-value">{loading ? '—' : powerLabel}</div>
            <div className="metric-label">Statistical Power</div>
          </div>
          <div className="metric-item">
            <div className="metric-value">{loading ? '—' : (stats?.convergencePValue != null ? (stats.convergencePValue < 0.0001 ? '<.0001' : `p=${stats.convergencePValue.toFixed(3)}`) : '—')}</div>
            <div className="metric-label">Significance</div>
          </div>
        </div>
      </div>

      {/* ── TAB NAVIGATION ── */}
      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="sci-tabs">
          <TabsTrigger value="overview" className="sci-tab">Overview</TabsTrigger>
          <TabsTrigger value="methodology" className="sci-tab">Methodology</TabsTrigger>
          <TabsTrigger value="results" className="sci-tab">Results & Analysis</TabsTrigger>
          <TabsTrigger value="data" className="sci-tab">Raw Data</TabsTrigger>
          <TabsTrigger value="conclusion" className="sci-tab">Conclusion</TabsTrigger>
        </TabsList>

        {/* ── OVERVIEW TAB ── */}
        <TabsContent value="overview" className="space-y-6 animate-fade-in">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ScientificAbstract
              title="EvoNash: Accelerating Convergence to Nash Equilibrium"
              subtitle="Investigating Adaptive Mutation Rates in Genetic Neural Networks"
              studentName="Joel deFouw"
              division="Junior - Grade 8"
              category="Digital Technology / Computing & Information Systems"
              abstract="This experiment investigates the efficiency of evolutionary algorithms in finding Nash Equilibrium in a competitive multi-agent environment (Tag). We compare a standard static mutation rate against a novel adaptive mutation strategy where the mutation rate scales inversely with an agent's fitness score. The hypothesis is that adaptive mutation—mimicking biological 'stress-induced mutagenesis'—will allow low-fitness populations to explore the solution space aggressively while high-fitness populations exploit their successful strategies, resulting in significantly faster convergence to a stable strategy (Nash Equilibrium)."
            />
            <ProblemStatement
              problemStatement="Deep Reinforcement Learning (DRL) is computationally expensive and hyperparameter-sensitive. Simple evolutionary algorithms are robust but often slow to converge because a fixed mutation rate is inefficient: too high disrupts good policies, too low causes stagnation. finding the optimal balance is difficult."
              backgroundConcepts={[
                { term: "Nash Equilibrium", definition: "A stable state in a game where no player can improve their outcome by unilaterally changing their strategy." },
                { term: "Adaptive Mutation", definition: "Dynamically adjusting the rate of genetic change based on performance (fitness). High stress (low fitness) = High mutation." },
                { term: "Policy Entropy", definition: "A measure of the randomness of an agent's actions. High entropy = exploration; Low entropy = exploitation/convergence." }
              ]}
            />
          </div>
          <HypothesisCard
            ifStatement="the mutation rate of a neural network is dynamically scaled inversely to its fitness score,"
            thenStatement="the population will reach a state of Policy Entropy stability (Nash Equilibrium) in fewer generations than a control group with a static mutation rate,"
            becauseStatement="this mechanism mimics biological 'stress-induced mutagenesis,' allowing poor-performing agents to explore the solution space rapidly while high-performing agents preserve their successful traits, balancing exploration and exploitation more efficiently."
            isSupported={hypothesisSupported}
          />
          <VariablesTable
            independent={variablesData.independent}
            dependent={variablesData.dependent}
            controlled={variablesData.controlled}
          />
        </TabsContent>

        {/* ── METHODOLOGY TAB ── */}
        <TabsContent value="methodology" className="space-y-6 animate-fade-in">
          <MethodologyTimeline
            steps={methodologyData.steps}
            materialsAndApparatus={methodologyData.materialsAndApparatus}
          />
          {/* System Verification & Calibration – scientific integrity checks */}
          <VerificationCard />
        </TabsContent>

        {/* ── RESULTS & ANALYSIS TAB ── */}
        <TabsContent value="results" className="space-y-6 animate-fade-in">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="text-center space-y-3">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-2 border-indigo-200 border-t-indigo-600" />
                <p className="text-sm text-gray-500 dark:text-gray-400">Loading results data…</p>
              </div>
            </div>
          ) : error ? (
            <div className="sci-card p-8 text-center border-red-200 dark:border-red-800">
              <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <p className="text-red-600 dark:text-red-400 font-medium mb-1">Failed to load dashboard data</p>
              <p className="text-sm text-red-500 dark:text-red-400/70 mb-4">{error}</p>
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 text-sm font-medium text-red-600 hover:text-red-700 border border-red-300 dark:border-red-700 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
              >
                Retry
              </button>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="space-y-6">
                  <SampleSizeGuidance
                    controlExperimentCount={stats?.controlExperimentCount ?? 0}
                    experimentalExperimentCount={stats?.experimentalExperimentCount ?? 0}
                    controlAvgGenerations={stats?.controlAvgGenerations ?? 0}
                    experimentalAvgGenerations={stats?.experimentalAvgGenerations ?? 0}
                    statisticalPowerLevel={stats?.statisticalPowerLevel ?? 'insufficient'}
                    achievedPower={dashboardData?.powerAnalysis?.achievedPower?.power ?? null}
                  />
                  <StatsSummary
                    controlConvergenceGen={stats?.controlConvergenceGen ?? null}
                    experimentalConvergenceGen={stats?.experimentalConvergenceGen ?? null}
                    convergenceImprovement={stats?.convergenceImprovement ?? null}
                    controlFinalFitness={stats?.controlFinalFitness ?? null}
                    experimentalFinalFitness={stats?.experimentalFinalFitness ?? null}
                    controlPeakFitness={stats?.controlPeakFitness ?? null}
                    experimentalPeakFitness={stats?.experimentalPeakFitness ?? null}
                    totalGenerationsControl={stats?.totalGenerationsControl ?? 0}
                    totalGenerationsExperimental={stats?.totalGenerationsExperimental ?? 0}
                    convergencePValue={stats?.convergencePValue ?? null}
                    convergenceIsSignificant={stats?.convergenceIsSignificant ?? false}
                    convergenceTStatistic={stats?.convergenceTStatistic ?? null}
                    convergenceDegreesOfFreedom={stats?.convergenceDegreesOfFreedom ?? null}
                    convergenceCohensD={stats?.convergenceCohensD ?? null}
                    convergenceConfidenceInterval={stats?.convergenceConfidenceInterval ?? null}
                    convergenceControlMean={stats?.convergenceControlMean ?? null}
                    convergenceExperimentalMean={stats?.convergenceExperimentalMean ?? null}
                    convergenceControlStd={stats?.convergenceControlStd ?? null}
                    convergenceExperimentalStd={stats?.convergenceExperimentalStd ?? null}
                    convergenceMeanDifference={stats?.convergenceMeanDifference ?? null}
                    pValue={stats?.pValue ?? null}
                    isSignificant={stats?.isSignificant ?? false}
                    tStatistic={stats?.tStatistic ?? null}
                    degreesOfFreedom={stats?.degreesOfFreedom ?? null}
                    cohensD={stats?.cohensD ?? null}
                    confidenceInterval={stats?.confidenceInterval ?? null}
                    controlMean={stats?.controlMean ?? null}
                    experimentalMean={stats?.experimentalMean ?? null}
                    controlStd={stats?.controlStd ?? null}
                    experimentalStd={stats?.experimentalStd ?? null}
                    meanDifference={stats?.meanDifference ?? null}
                  />
                </div>
                <div className="space-y-6">
                  <ComparisonChart
                    controlGenerations={controlGenerations}
                    experimentalGenerations={experimentalGenerations}
                    metric="fitness"
                  />
                  <ComparisonChart
                    controlGenerations={controlGenerations}
                    experimentalGenerations={experimentalGenerations}
                    metric="entropy"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <BoxPlotChart
                  title="Convergence Speed Distribution"
                  controlData={dashboardData?.distributionData?.control ?? null}
                  experimentalData={dashboardData?.distributionData?.experimental ?? null}
                />
                <QQPlot
                  controlValues={dashboardData?.distributionData?.control?.values ?? []}
                  experimentalValues={dashboardData?.distributionData?.experimental?.values ?? []}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <AssumptionChecksCard
                  normalityControl={dashboardData?.assumptionChecks?.normalityControl ?? null}
                  normalityExperimental={dashboardData?.assumptionChecks?.normalityExperimental ?? null}
                  varianceEquality={dashboardData?.assumptionChecks?.varianceEquality ?? null}
                  outlierControl={dashboardData?.assumptionChecks?.outlierControl ?? null}
                  outlierExperimental={dashboardData?.assumptionChecks?.outlierExperimental ?? null}
                  bothNormal={dashboardData?.assumptionChecks?.bothNormal ?? false}
                  anyOutliers={dashboardData?.assumptionChecks?.anyOutliers ?? false}
                  recommendation={dashboardData?.assumptionChecks?.recommendation ?? 'non_parametric'}
                  recommendationText={dashboardData?.assumptionChecks?.recommendationText ?? 'Insufficient data'}
                />
                <PowerAnalysisCard
                  achievedPower={dashboardData?.powerAnalysis?.achievedPower ?? null}
                  requiredFor80={dashboardData?.powerAnalysis?.requiredFor80 ?? null}
                  requiredFor90={dashboardData?.powerAnalysis?.requiredFor90 ?? null}
                  requiredFor95={dashboardData?.powerAnalysis?.requiredFor95 ?? null}
                  currentControlN={stats?.controlConvergedCount ?? 0}
                  currentExperimentalN={stats?.experimentalConvergedCount ?? 0}
                  effectSize={dashboardData?.effectSizes?.hedgesG?.hedgesG ?? stats?.convergenceCohensD ?? null}
                />
              </div>

              <EffectSizeCard
                hedgesG={dashboardData?.effectSizes?.hedgesG ?? null}
                cles={dashboardData?.effectSizes?.cles ?? null}
                cohensD={dashboardData?.effectSizes?.hedgesG?.cohensD ?? stats?.convergenceCohensD ?? null}
              />
            </>
          )}
        </TabsContent>

        {/* ── RAW DATA TAB ── */}
        <TabsContent value="data" className="space-y-6 animate-fade-in">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="text-center space-y-3">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-2 border-indigo-200 border-t-indigo-600" />
                <p className="text-sm text-gray-500 dark:text-gray-400">Loading experiment data…</p>
              </div>
            </div>
          ) : (
            <ExperimentDataTable
              controlExperiments={controlExperiments}
              experimentalExperiments={experimentalExperiments}
              controlGenerations={controlGenerations}
              experimentalGenerations={experimentalGenerations}
            />
          )}
        </TabsContent>

        {/* ── CONCLUSION TAB ── */}
        <TabsContent value="conclusion" className="space-y-6 animate-fade-in">
          <ConclusionCard
            summary={conclusionSummary}
            hypothesisSupported={hypothesisSupported}
            keyFindings={keyFindings.length > 0 ? keyFindings : ['Experiment is in progress. No findings available yet.']}
            implications={implications}
            sourcesOfError={["Simulation randomization", "Network initialization variance", "Environmental noise across runs"]}
            futureWork="Testing on more complex games; analyzing different mutation scaling functions; investigating the effect of population size on convergence."
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
