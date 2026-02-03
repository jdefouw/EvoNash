
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
            <ScientificAbstract />
            <div className="space-y-6">
              <ProblemStatement />
              <HypothesisCard />
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
