"use client";

import type { Scenario, ScenarioResult } from "@/runtime/scenario-types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Check, X, Play, Clock, ChevronDown, ChevronRight } from "lucide-react";
import { useState } from "react";

interface ScenarioResultViewProps {
  scenario: Scenario;
  result: ScenarioResult;
  onRerun: () => void;
}

function StepResultItem({
  step,
  index,
}: {
  step: ScenarioResult["steps"][number];
  index: number;
}) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="border-b border-border last:border-b-0">
      <div
        className="flex items-center gap-2 py-1.5 px-2 cursor-pointer hover:bg-accent/25"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <button className="p-0.5">
          {isExpanded ? (
            <ChevronDown className="h-3 w-3" />
          ) : (
            <ChevronRight className="h-3 w-3" />
          )}
        </button>
        {step.success ? (
          <Check className="h-3 w-3 text-neon-emerald" />
        ) : (
          <X className="h-3 w-3 text-destructive" />
        )}
        <span className="text-xs font-mono flex-1">{step.action}</span>
        {!step.success && step.error && (
          <span className="text-xs text-destructive truncate max-w-[150px]">
            {step.error}
          </span>
        )}
      </div>

      {isExpanded && (
        <div className="pl-8 pr-2 pb-2 text-xs">
          {step.error && (
            <div className="text-destructive mb-2">
              Error: {step.error}
            </div>
          )}
          {step.stateChanges && Object.keys(step.stateChanges).length > 0 && (
            <div className="space-y-1">
              <span className="text-muted-foreground">State changes:</span>
              <div className="bg-muted p-2 rounded text-[10px] overflow-x-auto max-h-32 overflow-y-auto space-y-1">
                {Object.entries(step.stateChanges).map(([path, { before, after }]) => (
                  <div key={path} className="flex gap-2">
                    <span className="text-neon-cyan font-mono">{path}:</span>
                    <span className="text-muted-foreground">{JSON.stringify(before)}</span>
                    <span className="text-muted-foreground">→</span>
                    <span className="text-neon-emerald">{JSON.stringify(after)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function AssertionResultItem({
  assertion,
}: {
  assertion: ScenarioResult["assertions"][number];
}) {
  const [isExpanded, setIsExpanded] = useState(!assertion.passed);

  const getOperatorDisplay = (op: string) => {
    const opMap: Record<string, string> = {
      eq: "==",
      neq: "!=",
      gt: ">",
      gte: ">=",
      lt: "<",
      lte: "<=",
      contains: "contains",
      length: "length ==",
      truthy: "is truthy",
      falsy: "is falsy",
    };
    return opMap[op] || op;
  };

  return (
    <div className="border-b border-border last:border-b-0">
      <div
        className="flex items-center gap-2 py-1.5 px-2 cursor-pointer hover:bg-accent/25"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <button className="p-0.5">
          {isExpanded ? (
            <ChevronDown className="h-3 w-3" />
          ) : (
            <ChevronRight className="h-3 w-3" />
          )}
        </button>
        {assertion.passed ? (
          <Check className="h-3 w-3 text-neon-emerald" />
        ) : (
          <X className="h-3 w-3 text-destructive" />
        )}
        <span className="text-xs font-mono">
          {assertion.path}{" "}
          <span className="text-muted-foreground">
            {getOperatorDisplay(assertion.operator)}
          </span>{" "}
          {!["truthy", "falsy"].includes(assertion.operator) && (
            <span className="text-neon-cyan">
              {JSON.stringify(assertion.expected)}
            </span>
          )}
        </span>
      </div>

      {isExpanded && (
        <div className="pl-8 pr-2 pb-2 text-xs space-y-1">
          <div className="flex gap-2">
            <span className="text-muted-foreground w-16">Expected:</span>
            <span className="font-mono text-neon-cyan">
              {JSON.stringify(assertion.expected)}
            </span>
          </div>
          <div className="flex gap-2">
            <span className="text-muted-foreground w-16">Actual:</span>
            <span
              className={`font-mono ${
                assertion.passed ? "text-neon-emerald" : "text-destructive"
              }`}
            >
              {JSON.stringify(assertion.actual)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

export function ScenarioResultView({
  scenario,
  result,
  onRerun,
}: ScenarioResultViewProps) {
  const passedSteps = result.steps.filter((s) => s.success).length;
  const passedAssertions = result.assertions.filter((a) => a.passed).length;

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-2 border-b flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium truncate max-w-[200px]">
            {scenario.name}
          </span>
          {result.passed ? (
            <Badge
              variant="outline"
              className="text-neon-emerald border-neon-emerald/50 text-xs"
            >
              <Check className="h-3 w-3 mr-1" />
              Pass
            </Badge>
          ) : (
            <Badge
              variant="outline"
              className="text-destructive border-destructive/50 text-xs"
            >
              <X className="h-3 w-3 mr-1" />
              Fail
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {result.duration.toFixed(0)}ms
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 text-xs"
            onClick={onRerun}
          >
            <Play className="h-3 w-3 mr-1" />
            Rerun
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {/* Steps */}
        {result.steps.length > 0 && (
          <div>
            <div className="px-2 py-1.5 bg-muted/50 text-xs font-medium flex items-center justify-between">
              <span>Steps</span>
              <span className="text-muted-foreground">
                {passedSteps}/{result.steps.length}
              </span>
            </div>
            <div>
              {result.steps.map((step, i) => (
                <StepResultItem key={i} step={step} index={i} />
              ))}
            </div>
          </div>
        )}

        {/* Assertions */}
        <div>
          <div className="px-2 py-1.5 bg-muted/50 text-xs font-medium flex items-center justify-between">
            <span>Assertions</span>
            <span className="text-muted-foreground">
              {passedAssertions}/{result.assertions.length}
            </span>
          </div>
          <div>
            {result.assertions.map((assertion, i) => (
              <AssertionResultItem key={i} assertion={assertion} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
