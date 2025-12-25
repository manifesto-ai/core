"use client";

import { ReactNode } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useValidationResult, useScenarios, useScenarioResults } from "@/runtime";
import { DAGView } from "@/components/dag/DAGView";
import { ScenarioPanel } from "@/components/scenario";

type EditorLayoutProps = {
  editor: ReactNode;
  issues: ReactNode;
  toolbar?: ReactNode;
};

export function EditorLayout({ editor, issues, toolbar }: EditorLayoutProps) {
  const { value: validationResult } = useValidationResult();
  const { value: scenarios } = useScenarios();
  const { value: scenarioResults } = useScenarioResults();

  const issueCount = validationResult?.issues.filter(i => i.severity === "error").length ?? 0;
  const scenarioList = Object.values(scenarios ?? {});
  const scenarioCount = scenarioList.length;
  const passedCount = scenarioList.filter(s => scenarioResults?.[s.id]?.passed).length;

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Toolbar */}
      {toolbar && (
        <div className="border-b px-4 py-2 flex items-center gap-4">
          {toolbar}
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Editor Panel */}
        <div className="flex-[6] overflow-auto p-4">{editor}</div>

        {/* Right Panel: DAG / Issues Tabs */}
        <div className="flex-[4] border-l bg-card flex flex-col">
          <Tabs defaultValue="dag" className="flex-1 flex flex-col">
            <TabsList className="w-full justify-start rounded-none border-b bg-transparent h-10 px-2">
              <TabsTrigger
                value="dag"
                className="data-[state=active]:bg-background rounded-b-none"
              >
                DAG
              </TabsTrigger>
              <TabsTrigger
                value="issues"
                className="data-[state=active]:bg-background rounded-b-none gap-2"
              >
                Issues
                {issueCount > 0 && (
                  <Badge variant="destructive" className="h-5 px-1.5 text-xs">
                    {issueCount}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger
                value="scenarios"
                className="data-[state=active]:bg-background rounded-b-none gap-2"
              >
                Scenarios
                {scenarioCount > 0 && (
                  <Badge
                    variant="secondary"
                    className={`h-5 px-1.5 text-xs ${
                      passedCount === scenarioCount
                        ? "bg-neon-emerald/20 text-neon-emerald"
                        : ""
                    }`}
                  >
                    {passedCount}/{scenarioCount}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>
            <TabsContent value="dag" className="flex-1 m-0 overflow-hidden">
              <DAGView />
            </TabsContent>
            <TabsContent value="issues" className="flex-1 m-0 overflow-auto">
              {issues}
            </TabsContent>
            <TabsContent value="scenarios" className="flex-1 m-0 overflow-auto">
              <ScenarioPanel />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
