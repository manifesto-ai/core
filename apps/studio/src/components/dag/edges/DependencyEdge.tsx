"use client";

/**
 * DependencyEdge Component
 *
 * Custom React Flow edge for displaying dependencies between nodes.
 * Features highlighted state with animation.
 */

import { memo } from "react";
import { BaseEdge, getBezierPath, type EdgeProps } from "@xyflow/react";

// ============================================================================
// Component
// ============================================================================

function DependencyEdgeComponent({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  selected,
}: EdgeProps) {
  const isHighlighted = (data as { isHighlighted?: boolean } | undefined)?.isHighlighted ?? false;

  const [edgePath] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  return (
    <BaseEdge
      id={id}
      path={edgePath}
      style={{
        stroke: isHighlighted ? "#3b82f6" : "#64748b",
        strokeWidth: isHighlighted || selected ? 2 : 1,
        transition: "stroke 0.2s, stroke-width 0.2s",
      }}
    />
  );
}

export const DependencyEdge = memo(DependencyEdgeComponent);
export default DependencyEdge;
