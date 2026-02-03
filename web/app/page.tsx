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
import { Badge } from "@/components/ui/badge";
import { Generation, Experiment } from "@/types/protocol";

export default function DashboardPage() {
  // Data for VariablesTable
  const variablesData = {
    independent: [
      { name: "Mutation Strategy", description: "Control (Static) vs. Adaptive (Fitness-Scaled)", value: "Adaptive" },
      { name: "Generation Count", description: "Number of evolutionary generations", value: "Continuous" }
    ],
    dependent: [
      { name: "Convergence Velocity", description: "Generations to reach Nash Equilibrium (Policy Entropy < 0.01)" },
      { name: "Policy Entropy", description: "Measure of strategy randomness (Shannon Entropy)" },
      { name: "Entropy Variance", description: "Stability of population strategies" },
      { name: "Elo Rating", description: "Relative skill level (Self-play performance)" }
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
        description: "Implement Elo-based adaptive mutation scaling. Mutation rate decreases as fitness increases.",
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

  // Experiment Data (Placeholder until DB connection is live in component)
  const controlExperiments: Experiment[] = [];
  const experimentalExperiments: Experiment[] = [];
  const controlGenerations: Generation[] = [];
  const experimentalGenerations: Generation[] = [];

  return (
    <div className="container mx-auto py-8 px-4 space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-indigo-500 to-purple-600 bg-clip-text text-transparent">
            EvoNash Scientific Dashboard
          </h1>
          <p className="text-muted-foreground mt-2 text-lg">
            Investigating Adaptive Mutation Rates in Genetic Neural Networks
          </p>
        </div>
        <div className="flex gap-2 items-center">
          <Badge variant="outline" className="text-sm py-1 h-fit">
            CWSF 2026 Candidate
          </Badge>
          <VerificationCard />
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="grid w-full grid-cols-2 md:grid-cols-5 h-auto md:h-10">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="methodology">Methodology</TabsTrigger>
          <TabsTrigger value="results">Results & Analysis</TabsTrigger>
          <TabsTrigger value="data">Raw Data</TabsTrigger>
          <TabsTrigger value="conclusion">Conclusion</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <ScientificAbstract
              title="EvoNash: Accelerating Convergence to Nash Equilibrium"
              subtitle="Investigating Adaptive Mutation Rates in Genetic Neural Networks"
              studentName="Joel deFouw"
              division="Junior - Grade 8"
              category="Digital Technology / Computing & Information Systems"
              abstract="This experiment investigates the efficiency of evolutionary algorithms in finding Nash Equilibrium in a competitive multi-agent environment (Tag). We compare a standard static mutation rate against a novel adaptive mutation strategy where the mutation rate scales inversely with an agent's fitness (Elo rating). The hypothesis is that adaptive mutation—mimicking biological 'stress-induced mutagenesis'—will allow low-fitness populations to explore the solution space aggressively while high-fitness populations exploit their successful strategies, resulting in significantly faster convergence to a stable strategy (Nash Equilibrium)."
            />
            <div className="space-y-6">
              <ProblemStatement
                problemStatement="Deep Reinforcement Learning (DRL) is computationally expensive and hyperparameter-sensitive. Simple evolutionary algorithms are robust but often slow to converge because a fixed mutation rate is inefficient: too high disrupts good policies, too low causes stagnation. finding the optimal balance is difficult."
                backgroundConcepts={[
                  { term: "Nash Equilibrium", definition: "A stable state in a game where no player can improve their outcome by unilaterally changing their strategy." },
                  { term: "Adaptive Mutation", definition: "Dynamically adjusting the rate of genetic change based on performance (fitness). High stress (low fitness) = High mutation." },
                  { term: "Policy Entropy", definition: "A measure of the randomness of an agent's actions. High entropy = exploration; Low entropy = exploitation/convergence." }
                ]}
              />
              <HypothesisCard
                ifStatement="the mutation rate of a neural network is dynamically scaled inversely to its Elo rating (fitness),"
                thenStatement="the population will reach a state of Policy Entropy stability (Nash Equilibrium) in fewer generations than a control group with a static mutation rate,"
                becauseStatement="this mechanism mimics biological 'stress-induced mutagenesis,' allowing poor-performing agents to explore the solution space rapidly while high-performing agents preserve their successful traits, balancing exploration and exploitation more efficiently."
                isSupported={null}
              />
            </div>
          </div>
          <VariablesTable
            independent={variablesData.independent}
            dependent={variablesData.dependent}
            controlled={variablesData.controlled}
          />
        </TabsContent>

        <TabsContent value="methodology" className="space-y-6">
          <MethodologyTimeline
            steps={methodologyData.steps}
            materialsAndApparatus={methodologyData.materialsAndApparatus}
          />
        </TabsContent>

        <TabsContent value="results" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-6">
              <SampleSizeGuidance
                controlExperimentCount={0}
                experimentalExperimentCount={0}
                controlAvgGenerations={0}
                experimentalAvgGenerations={0}
                statisticalPowerLevel="insufficient"
              />
              <StatsSummary
                controlConvergenceGen={null}
                experimentalConvergenceGen={null}
                convergenceImprovement={null}
                controlFinalElo={null}
                experimentalFinalElo={null}
                controlPeakElo={null}
                experimentalPeakElo={null}
                totalGenerationsControl={0}
                totalGenerationsExperimental={0}
                convergencePValue={null}
                convergenceIsSignificant={false}
              />
            </div>
            <div className="space-y-6">
              <ComparisonChart
                controlGenerations={controlGenerations}
                experimentalGenerations={experimentalGenerations}
                metric="elo"
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
              controlData={null}
              experimentalData={null}
            />
            <QQPlot
              controlValues={[]}
              experimentalValues={[]}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <AssumptionChecksCard
              normalityControl={null}
              normalityExperimental={null}
              varianceEquality={null}
              outlierControl={null}
              outlierExperimental={null}
              bothNormal={false}
              anyOutliers={false}
              recommendation="non_parametric"
              recommendationText="Insufficient data"
            />
            <PowerAnalysisCard
              achievedPower={null}
              requiredFor80={null}
              requiredFor90={null}
              requiredFor95={null}
              currentControlN={0}
              currentExperimentalN={0}
              effectSize={null}
            />
          </div>

          <EffectSizeCard
            hedgesG={null}
            cles={null}
            cohensD={null}
          />
        </TabsContent>

        <TabsContent value="data" className="space-y-6">
          <ExperimentDataTable
            controlExperiments={controlExperiments}
            experimentalExperiments={experimentalExperiments}
            controlGenerations={controlGenerations}
            experimentalGenerations={experimentalGenerations}
          />
        </TabsContent>

        <TabsContent value="conclusion" className="space-y-6">
          <ConclusionCard
            summary="The experiment is currently in progress. Preliminary data suggests that..."
            hypothesisSupported={null}
            keyFindings={[]}
            implications="If supported, this research could provide a computationally efficient method for training agents in competitive environments."
            sourcesOfError={["Simulation randomization", "Network initialization variance"]}
            futureWork="Testing on more complex games; analyzing different mutation scaling functions."
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
