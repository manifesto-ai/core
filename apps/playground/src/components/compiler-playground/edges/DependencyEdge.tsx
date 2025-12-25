'use client';

/**
 * DependencyEdge Component
 *
 * Custom React Flow edge for dependency relationships.
 * Features animations and highlighting.
 */

import { memo } from 'react';
import {
  BaseEdge,
  EdgeLabelRenderer,
  getSmoothStepPath,
  type EdgeProps,
} from '@xyflow/react';
import { cn } from '@/lib/utils';
import type { DependencyEdgeData } from '../types';

// ============================================================================
// Component
// ============================================================================

function DependencyEdgeComponent(props: EdgeProps) {
  const {
    id,
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    data,
    style,
    markerEnd,
  } = props;

  const edgeData = data as DependencyEdgeData | undefined;
  const isHighlighted = edgeData?.isHighlighted ?? false;
  const isAnimated = edgeData?.isAnimated ?? false;

  // Calculate path
  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    borderRadius: 8,
  });

  return (
    <>
      {/* Base edge */}
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          ...style,
          strokeWidth: isHighlighted ? 2 : 1,
          stroke: isHighlighted ? 'hsl(186, 100%, 50%)' : 'hsl(var(--muted-foreground))',
          strokeDasharray: isAnimated ? '5,5' : 'none',
        }}
        className={cn(isAnimated && 'animated')}
      />

      {/* Path label (if highlighted) */}
      {isHighlighted && edgeData?.fromPath && (
        <EdgeLabelRenderer>
          <div
            className={cn(
              'absolute rounded bg-card/90 px-2 py-0.5 text-xs',
              'border border-neon-cyan/50 text-neon-cyan',
              'pointer-events-none backdrop-blur-sm'
            )}
            style={{
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            }}
          >
            {edgeData.fromPath}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}

export const DependencyEdge = memo(DependencyEdgeComponent);
export default DependencyEdge;
