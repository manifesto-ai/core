"use client";

import type { ValidationIssue } from "@/domain";
import { useSources, useDerivedBlocks, useActionBlocks, usePolicyBlocks, useSetValue } from "@/runtime";
import { Button } from "@/components/ui/button";
import { Wand2 } from "lucide-react";
import { useCallback } from "react";

type IssueItemProps = {
  issue: ValidationIssue;
};

export function IssueItem({ issue }: IssueItemProps) {
  const { value: sources } = useSources();
  const { value: derivedBlocks } = useDerivedBlocks();
  const { value: actionBlocks } = useActionBlocks();
  const { value: policyBlocks } = usePolicyBlocks();
  const { setValue } = useSetValue();

  const handleClick = useCallback(() => {
    // Try to select the block with this path
    setValue("state.selectedBlockId", issue.path);
  }, [issue.path, setValue]);

  const handleApplyFix = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!issue.suggestedFix) return;

      const fixValue = issue.suggestedFix.value;

      // Find and update the source with this path
      if (sources) {
        for (const source of Object.values(sources)) {
          if (source.path === issue.path || source.id === issue.path) {
            if (typeof fixValue === "string" && fixValue.startsWith("data.")) {
              const updatedSource = { ...source, path: fixValue };
              setValue("data.sources", { ...sources, [source.id]: updatedSource });
              return;
            }
          }
        }
      }

      // Find and update the derived with this path
      if (derivedBlocks) {
        for (const derived of Object.values(derivedBlocks)) {
          if (derived.path === issue.path || derived.id === issue.path) {
            if (typeof fixValue === "string" && fixValue.startsWith("derived.")) {
              const updatedDerived = { ...derived, path: fixValue };
              setValue("data.derived", {
                ...derivedBlocks,
                [derived.id]: updatedDerived,
              });
            } else {
              const updatedDerived = { ...derived, expr: fixValue };
              setValue("data.derived", {
                ...derivedBlocks,
                [derived.id]: updatedDerived,
              });
            }
            return;
          }
        }
      }

      // Find and update the action with this path
      if (actionBlocks) {
        for (const action of Object.values(actionBlocks)) {
          if (action.path === issue.path || action.id === issue.path) {
            if (typeof fixValue === "string" && fixValue.startsWith("action.")) {
              const updatedAction = { ...action, path: fixValue };
              setValue("data.actions", {
                ...actionBlocks,
                [action.id]: updatedAction,
              });
              return;
            }
          }
        }
      }

      // Find and update the policy with this path
      if (policyBlocks) {
        for (const policy of Object.values(policyBlocks)) {
          if (policy.path === issue.path || policy.id === issue.path) {
            if (typeof fixValue === "string" && fixValue.startsWith("policy.")) {
              const updatedPolicy = { ...policy, path: fixValue };
              setValue("data.policies", {
                ...policyBlocks,
                [policy.id]: updatedPolicy,
              });
              return;
            }
          }
        }
      }
    },
    [issue, sources, derivedBlocks, actionBlocks, policyBlocks, setValue]
  );

  return (
    <div
      className="p-3 hover:bg-muted/50 cursor-pointer transition-colors"
      onClick={handleClick}
    >
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-sm">{issue.message}</p>
          <div className="flex items-center gap-2 mt-1">
            <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">
              {issue.path}
            </code>
            <span className="text-xs text-muted-foreground">{issue.code}</span>
          </div>
        </div>
      </div>

      {issue.suggestedFix && (
        <div className="mt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleApplyFix}
            className="h-7 text-xs"
          >
            <Wand2 className="h-3 w-3 mr-1" />
            {issue.suggestedFix.description}
          </Button>
        </div>
      )}
    </div>
  );
}
