"use client";

import {
  useValidationResult,
  useIsValidating,
  useHasContent,
  useSetValue,
} from "@/runtime";
import type { ValidationIssue } from "@/domain";
import { IssueItem } from "./IssueItem";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Info,
  Loader2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

function groupIssuesBySeverity(issues: ValidationIssue[]) {
  return {
    errors: issues.filter((i) => i.severity === "error"),
    warnings: issues.filter((i) => i.severity === "warning"),
    info: issues.filter((i) => i.severity === "info"),
    suggestions: issues.filter((i) => i.severity === "suggestion"),
  };
}

type IssueGroupProps = {
  title: string;
  icon: React.ReactNode;
  issues: ValidationIssue[];
};

function IssueGroup({ title, icon, issues }: IssueGroupProps) {
  if (issues.length === 0) return null;

  return (
    <div className="py-2">
      <div className="flex items-center gap-2 px-3 py-1 text-sm font-medium">
        {icon}
        <span>{title}</span>
        <Badge variant="secondary" className="ml-auto text-xs">
          {issues.length}
        </Badge>
      </div>
      <div className="divide-y divide-border">
        {issues.map((issue, idx) => (
          <IssueItem key={`${issue.path}-${issue.code}-${idx}`} issue={issue} />
        ))}
      </div>
    </div>
  );
}

export function IssuesPanel() {
  const { value: validation } = useValidationResult();
  const { value: isValidating } = useIsValidating();
  const { value: hasContent } = useHasContent();

  if (!validation && !hasContent) {
    return (
      <div className="p-4 text-sm text-muted-foreground">
        <p>Add blocks to start editing your domain.</p>
        <p className="mt-2 text-xs">
          Use the toolbar buttons or keyboard shortcuts:
        </p>
        <ul className="mt-1 text-xs space-y-1">
          <li>
            <kbd className="px-1 py-0.5 bg-muted rounded">Cmd+Shift+S</kbd> -
            Schema block
          </li>
          <li>
            <kbd className="px-1 py-0.5 bg-muted rounded">Cmd+Shift+D</kbd> -
            Derived block
          </li>
        </ul>
      </div>
    );
  }

  const grouped = validation
    ? groupIssuesBySeverity(validation.issues)
    : { errors: [], warnings: [], info: [], suggestions: [] };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-3 border-b flex items-center justify-between">
        <h3 className="font-medium text-sm">Issues</h3>
        <div className="flex items-center gap-2">
          {isValidating && (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          )}
          {!isValidating && validation && (
            <>
              {validation.valid ? (
                <Badge
                  variant="outline"
                  className="text-neon-emerald border-neon-emerald/50"
                >
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  Valid
                </Badge>
              ) : (
                <Badge
                  variant="outline"
                  className="text-destructive border-destructive/50"
                >
                  <AlertCircle className="h-3 w-3 mr-1" />
                  {grouped.errors.length} error
                  {grouped.errors.length !== 1 ? "s" : ""}
                </Badge>
              )}
            </>
          )}
        </div>
      </div>

      {/* Issues list */}
      <div className="flex-1 overflow-auto divide-y divide-border">
        <IssueGroup
          title="Errors"
          icon={<AlertCircle className="h-4 w-4 text-destructive" />}
          issues={grouped.errors}
        />
        <IssueGroup
          title="Warnings"
          icon={<AlertTriangle className="h-4 w-4 text-neon-amber" />}
          issues={grouped.warnings}
        />
        <IssueGroup
          title="Info"
          icon={<Info className="h-4 w-4 text-neon-blue" />}
          issues={grouped.info}
        />
        <IssueGroup
          title="Suggestions"
          icon={<Info className="h-4 w-4 text-neon-cyan" />}
          issues={grouped.suggestions}
        />

        {validation && validation.issues.length === 0 && (
          <div className="p-4 text-sm text-muted-foreground text-center">
            <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-neon-emerald" />
            <p>No issues found</p>
          </div>
        )}
      </div>
    </div>
  );
}
