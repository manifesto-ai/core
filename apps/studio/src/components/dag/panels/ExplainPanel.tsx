"use client";

/**
 * ExplainPanel Component
 *
 * Shows explanation of a selected node:
 * - Dependencies (what it depends on)
 * - Expression (if derived)
 * - Description
 */

import { useMemo } from "react";
import { ArrowRight, Code, Info, Link } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useSources, useDerivedBlocks, useActionBlocks, usePolicyBlocks } from "@/runtime";
import { getDependencies } from "@/runtime/impact-analysis";
import type { StudioNodeKind } from "../types";
import { getNodeKindFromPath, getLabelFromPath, NODE_COLORS } from "../types";

// ============================================================================
// Types
// ============================================================================

interface ExplainPanelProps {
  path: string;
}

interface BlockInfo {
  kind: StudioNodeKind;
  description: string;
  schemaType?: string;
  effectType?: string;
  targetPath?: string;
  policyType?: string;
  expr?: unknown;
}

// ============================================================================
// Component
// ============================================================================

export function ExplainPanel({ path }: ExplainPanelProps) {
  const { value: sources } = useSources();
  const { value: derivedBlocks } = useDerivedBlocks();
  const { value: actionBlocks } = useActionBlocks();
  const { value: policyBlocks } = usePolicyBlocks();

  // Find the block data for this path
  const blockData = useMemo((): BlockInfo | null => {
    const kind = getNodeKindFromPath(path);

    if (kind === "data" && sources) {
      const source = Object.values(sources).find((s) => s.path === path);
      if (source) {
        return {
          kind,
          description: source.description,
          schemaType: source.schemaType,
        };
      }
    }

    if (kind === "derived" && derivedBlocks) {
      const derived = Object.values(derivedBlocks).find((d) => d.path === path);
      if (derived) {
        return {
          kind,
          description: derived.description,
          expr: derived.expr,
        };
      }
    }

    if (kind === "action" && actionBlocks) {
      const action = Object.values(actionBlocks).find((a) => a.path === path);
      if (action) {
        return {
          kind,
          description: action.description,
          effectType: action.effectType,
        };
      }
    }

    if (kind === "policy" && policyBlocks) {
      const policy = Object.values(policyBlocks).find((p) => p.path === path);
      if (policy) {
        return {
          kind,
          description: policy.description,
          targetPath: policy.targetPath,
          policyType: policy.policyType,
        };
      }
    }

    return null;
  }, [path, sources, derivedBlocks, actionBlocks, policyBlocks]);

  // Get dependencies
  const deps = useMemo(() => {
    return getDependencies(path, derivedBlocks ?? undefined);
  }, [path, derivedBlocks]);

  const kind = getNodeKindFromPath(path);
  const color = NODE_COLORS[kind];

  if (!blockData) {
    return (
      <div className="text-sm text-muted-foreground">
        No data found for path: {path}
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
      </div>

      {/* Description */}
      {blockData.description && (
        <div className="flex items-start gap-2 text-sm">
          <Info className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
          <span className="text-muted-foreground">{blockData.description}</span>
        </div>
      )}

      {/* Dependencies (for derived) */}
      {deps.length > 0 && (
        <div className="space-y-1">
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Link className="h-3 w-3" />
            <span>Dependencies</span>
          </div>
          <div className="flex flex-wrap gap-1">
            {deps.map((dep) => {
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

      {/* Expression (for derived) */}
      {blockData.expr !== undefined && blockData.expr !== null && (
        <div className="space-y-1">
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Code className="h-3 w-3" />
            <span>Expression</span>
          </div>
          <pre className="text-xs bg-muted p-2 rounded overflow-x-auto">
            {JSON.stringify(blockData.expr, null, 2)}
          </pre>
        </div>
      )}

      {/* Schema type (for data) */}
      {blockData.schemaType && (
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Type:</span>
          <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
            {blockData.schemaType}
          </code>
        </div>
      )}

      {/* Effect type (for action) */}
      {blockData.effectType && (
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Effect:</span>
          <Badge variant="secondary" className="text-xs">
            {blockData.effectType}
          </Badge>
        </div>
      )}

      {/* Target path (for policy) */}
      {blockData.targetPath && (
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Governs:</span>
          <ArrowRight className="h-3 w-3 text-muted-foreground" />
          <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">
            {blockData.targetPath}
          </code>
        </div>
      )}

      {/* Policy type */}
      {blockData.policyType && (
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Policy:</span>
          <Badge
            variant={blockData.policyType === "allow" ? "default" : "destructive"}
            className="text-xs"
          >
            {blockData.policyType}
          </Badge>
        </div>
      )}
    </div>
  );
}

export default ExplainPanel;
