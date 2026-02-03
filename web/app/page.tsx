
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
  VerificationCard // New component
} from "@/components/dashboard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Beaker, BarChart3, Settings, BookOpen, FlaskConical } from "lucide-react";

export default function DashboardPage() {
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
        <div className="flex gap-2">
          <Badge variant="outline" className="text-sm py-1">
            CWSF 2026 Candidate
          </Badge>
        </div>
      </div>

      <VerificationCard />

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4 lg:w-[600px]">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="methodology">Methodology</TabsTrigger>
          <TabsTrigger value="results">Results & Analysis</TabsTrigger>
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
              abstract="This experiment investigates the efficiency of evolutionary algorithms in high-dimensional decision spaces. Traditional Genetic Algorithms (GAs) typically utilize static mutation rates, which often results in premature convergence to local optima or inefficient random searching. This project hypothesizes that an **Adaptive Mutation Strategy**—where mutation magnitude is inversely proportional to an agent's fitness—will accelerate convergence to a Nash Equilibrium compared to a static control. To test this, a custom distributed computing platform ('EvoNash') was engineered to run on an NVIDIA RTX 3090, simulating a deterministic biological environment ('The Petri Dish'). Two experiment groups of 1,000 Neural Networks each were evolved over 1,500 generations: the **Control Group** (Static mutation) and the **Experimental Group** (Adaptive mutation). Telemetry demonstrates that the Experimental group achieved stable Policy Entropy (Nash Equilibrium) significantly faster than the Control group."
            />
            <div className="space-y-6">
              <ProblemStatement
                problemStatement="Deep Reinforcement Learning (DRL) is computationally expensive and often acts as a 'black box,' making it difficult to prove mathematical optimality. While Genetic Algorithms offer a gradient-free alternative, they struggle with the 'Exploration vs. Exploitation' trade-off. A static mutation rate is either too high (destroying good traits) or too low (stagnating progress)."
                backgroundConcepts={[
                  { term: "Nash Equilibrium", definition: "A state in game theory where no player can increase their payoff by changing their strategy unilaterally. In this simulation, it represents the 'perfect' unexploitable strategy." },
                  { term: "Genetic Algorithm", definition: "An optimization search inspired by natural selection. It relies on Selection (survival of the fittest), Crossover (mating), and Mutation (random variation)." },
                  { term: "Evolutionary Stable Strategy", definition: "A strategy which, if adopted by a population, cannot be invaded by any alternative mutant strategy." }
                ]}
              />
              <HypothesisCard
                ifStatement="the mutation rate of a neural network is dynamically scaled inversely to its parent's fitness (i.e., low-performing parents produce highly mutated offspring, while high-performing parents produce stable offspring),"
                thenStatement="the population will reach a state of Policy Entropy stability (Nash Equilibrium) in fewer generations than a control group using a static mutation rate,"
                becauseStatement="this mechanism mimics biological 'stress-induced mutagenesis,' allowing the population to escape local optima rapidly while preserving the genetic structure of successful dominant strategies."
                isSupported={null}
              />
            </div>
          </div>
          <VariablesTable />
        </TabsContent>

        <TabsContent value="methodology" className="space-y-6">
          <MethodologyTimeline />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <SampleSizeGuidance />
            <PowerAnalysisCard />
          </div>
        </TabsContent>

        <TabsContent value="results" className="space-y-6">
          <StatsSummary />
          <ComparisonChart />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <BoxPlotChart />
            <QQPlot />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <AssumptionChecksCard />
            <EffectSizeCard />
          </div>
          <ExperimentDataTable />
        </TabsContent>

        <TabsContent value="conclusion" className="space-y-6">
          <ConclusionCard />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Badge({ children, variant, className }: any) {
  return <div className={`border rounded-full px-3 py-1 text-xs font-semibold ${className}`}>{children}</div>
}
