"use client";

/**
 * StudioNode Component
 *
 * Custom React Flow node for displaying domain block information.
 * Features colored borders, icons, and issue badges.
 */

import { memo } from "react";
import { Handle, Position } from "@xyflow/react";
import { Database, Calculator, Zap, Shield, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { type StudioNodeData, type StudioNodeKind, NODE_COLORS } from "../types";

// ============================================================================
// Icon Map
// ============================================================================

const NODE_ICON_MAP: Record<StudioNodeKind, React.ElementType> = {
  data: Database,
  derived: Calculator,
  action: Zap,
  policy: Shield,
};

// ============================================================================
// Types
// ============================================================================

interface StudioNodeProps {
  data: StudioNodeData;
  selected?: boolean;
}

// ============================================================================
// Component
// ============================================================================

function StudioNodeComponent({ data, selected }: StudioNodeProps) {
  const { kind, label, isSelected, isHighlighted, hasIssues, issueCount, description } = data;

  const color = NODE_COLORS[kind];
  const Icon = NODE_ICON_MAP[kind];

  // Determine visual state
  const isActive = selected || isSelected || isHighlighted;
  const showGlow = isActive;

  return (
    <div
      className={cn(
        "studio-node relative min-w-[140px] max-w-[200px]",
        "rounded-lg border-2 bg-card/90 backdrop-blur-sm",
        "px-3 py-2 transition-all duration-200",
        isActive && "ring-2 ring-offset-2 ring-offset-background"
      )}
      style={{
        borderColor: color,
        boxShadow: showGlow ? `0 0 16px ${color}40` : "none",
        ["--ring-color" as string]: color,
      }}
    >
      {/* Target Handle (incoming edges) */}
      <Handle
        type="target"
        position={Position.Top}
        className="!h-2 !w-2 !border-2 !border-border !bg-muted"
      />

      {/* Content */}
      <div className="flex items-start gap-2">
        {/* Icon */}
        <div
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded"
          style={{ backgroundColor: `${color}20` }}
        >
          <Icon className="h-3.5 w-3.5" style={{ color }} />
        </div>

        {/* Label and Kind */}
        <div className="min-w-0 flex-1">
          <p
            className="truncate text-sm font-medium text-foreground"
            title={label}
          >
            {label}
          </p>
          <p className="text-xs text-muted-foreground capitalize">{kind}</p>
        </div>
      </div>

      {/* Description (if available) */}
      {description && (
        <p className="mt-1 text-xs text-muted-foreground truncate" title={description}>
          {description}
        </p>
      )}

      {/* Issue Badge */}
      {hasIssues && (
        <div
          className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-amber-500"
          title={`${issueCount} issue${issueCount !== 1 ? "s" : ""}`}
        >
          <AlertCircle className="h-3 w-3 text-white" />
        </div>
      )}

      {/* Source Handle (outgoing edges) */}
      <Handle
        type="source"
        position={Position.Bottom}
        className="!h-2 !w-2 !border-2 !border-border !bg-muted"
      />
    </div>
  );
}

export const StudioNode = memo(StudioNodeComponent);
export default StudioNode;
