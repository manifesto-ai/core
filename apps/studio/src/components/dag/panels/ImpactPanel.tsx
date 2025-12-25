"use client";

/**
 * ImpactPanel Component
 *
 * Shows the impact of changing a selected node:
 * - Direct dependents
 * - Transitive dependents
 * - Related actions
 * - Related policies
 */

import { useMemo } from "react";
import { ArrowDown, GitBranch, Shield, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useDerivedBlocks, useActionBlocks, usePolicyBlocks } from "@/runtime";
import {
  getDirectDependents,
  getAllDependents,
  getRelatedActions,
  getRelatedPolicies,
} from "@/runtime/impact-analysis";
import { getNodeKindFromPath, getLabelFromPath, NODE_COLORS } from "../types";

// ============================================================================
// Types
// ============================================================================

interface ImpactPanelProps {
  path: string;
}

// ============================================================================
// Component
// ============================================================================

export function ImpactPanel({ path }: ImpactPanelProps) {
  const { value: derivedBlocks } = useDerivedBlocks();
  const { value: actionBlocks } = useActionBlocks();
  const { value: policyBlocks } = usePolicyBlocks();

  // Calculate impact
  const impact = useMemo(() => {
    const directDeps = getDirectDependents(path, derivedBlocks ?? undefined);
    const allDeps = getAllDependents(path, derivedBlocks ?? undefined);
    const indirectDeps = allDeps.filter((d) => !directDeps.includes(d));
    const actions = getRelatedActions(path, actionBlocks ?? undefined);
    const policies = getRelatedPolicies(path, policyBlocks ?? undefined);

    return {
      directDeps,
      indirectDeps,
      actions,
      policies,
      totalImpact: allDeps.length + actions.length + policies.length,
    };
  }, [path, derivedBlocks, actionBlocks, policyBlocks]);

  const kind = getNodeKindFromPath(path);
  const color = NODE_COLORS[kind];

  // No impact
  if (impact.totalImpact === 0) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
        <div className="text-center">
          <ArrowDown className="h-6 w-6 mx-auto mb-2 opacity-50" />
          <p>No downstream dependencies</p>
          <p className="text-xs">Changing this value won't affect other paths</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Badge
          variant="outline"
          style={{ borderColor: color, color }}
          className="capitalize"
        >
          {kind}
        </Badge>
        <code className="text-sm font-mono">{getLabelFromPath(path)}</code>
        <Badge variant="secondary" className="text-xs">
          {impact.totalImpact} affected
        </Badge>
      </div>

      {/* Direct Dependents */}
      {impact.directDeps.length > 0 && (
        <div className="space-y-1">
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <GitBranch className="h-3 w-3" />
            <span>Direct dependents ({impact.directDeps.length})</span>
          </div>
          <div className="flex flex-wrap gap-1">
            {impact.directDeps.map((dep) => {
              const depKind = getNodeKindFromPath(dep);
              const depColor = NODE_COLORS[depKind];
              return (
                <Badge
                  key={dep}
                  variant="secondary"
                  className="text-xs font-mono"
                  style={{ borderColor: depColor }}
                >
                  {getLabelFromPath(dep)}
                </Badge>
              );
            })}
          </div>
        </div>
      )}

      {/* Indirect Dependents */}
      {impact.indirectDeps.length > 0 && (
        <div className="space-y-1">
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <ArrowDown className="h-3 w-3" />
            <span>Indirect dependents ({impact.indirectDeps.length})</span>
          </div>
          <div className="flex flex-wrap gap-1">
            {impact.indirectDeps.map((dep) => {
              const depKind = getNodeKindFromPath(dep);
              const depColor = NODE_COLORS[depKind];
              return (
                <Badge
                  key={dep}
                  variant="outline"
                  className="text-xs font-mono opacity-70"
                  style={{ borderColor: depColor }}
                >
                  {getLabelFromPath(dep)}
                </Badge>
              );
            })}
          </div>
        </div>
      )}

      {/* Related Actions */}
      {impact.actions.length > 0 && (
        <div className="space-y-1">
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Zap className="h-3 w-3" />
            <span>Related actions ({impact.actions.length})</span>
          </div>
          <div className="flex flex-wrap gap-1">
            {impact.actions.map((action) => (
              <Badge
                key={action}
                variant="secondary"
                className="text-xs font-mono"
                style={{ borderColor: NODE_COLORS.action }}
              >
                {getLabelFromPath(action)}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Related Policies */}
      {impact.policies.length > 0 && (
        <div className="space-y-1">
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Shield className="h-3 w-3" />
            <span>Related policies ({impact.policies.length})</span>
          </div>
          <div className="flex flex-wrap gap-1">
            {impact.policies.map((policy) => (
              <Badge
                key={policy}
                variant="secondary"
                className="text-xs font-mono"
                style={{ borderColor: NODE_COLORS.policy }}
              >
                {getLabelFromPath(policy)}
              </Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default ImpactPanel;
