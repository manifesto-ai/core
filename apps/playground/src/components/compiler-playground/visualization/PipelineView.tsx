'use client';

/**
 * PipelineView Component
 *
 * Horizontal pipeline visualization of compiler phases.
 */

import { useMemo } from 'react';
import { ReactFlow, Background, type Node, type Edge } from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { cn } from '@/lib/utils';
import { PhaseNode } from '../nodes/PhaseNode';
import {
  type CompilerPhase,
  type CompilerSessionSnapshot,
  type PhaseNodeData,
  PHASE_COLORS,
} from '../types';
import { applyPipelineLayout } from '../layout/dagre-layout';

// ============================================================================
// Types
// ============================================================================

export interface PipelineViewProps {
  /** Current compiler snapshot */
  snapshot: CompilerSessionSnapshot | null;
  /** Additional class names */
  className?: string;
}

// ============================================================================
// Constants
// ============================================================================

const PIPELINE_PHASES: CompilerPhase[] = [
  'parsing',
  'extracting',
  'lowering',
  'linking',
  'verifying',
  'done',
];

// ============================================================================
// Node Types
// ============================================================================

const nodeTypes = {
  phase: PhaseNode,
};

// ============================================================================
// Component
// ============================================================================

export function PipelineView({ snapshot, className }: PipelineViewProps) {
  // Build nodes and edges
  const { nodes, edges } = useMemo(() => {
    const currentPhase = snapshot?.phase ?? 'idle';
    const currentPhaseIndex = PIPELINE_PHASES.indexOf(currentPhase);

    // Create nodes for each phase
    const phaseNodes: Node<PhaseNodeData>[] = PIPELINE_PHASES.map((phase, index) => {
      let status: PhaseNodeData['status'] = 'pending';

      if (currentPhase === 'error') {
        // If we're in error state, mark phases up to error point
        if (index < currentPhaseIndex) {
          status = 'completed';
        } else if (index === currentPhaseIndex) {
          status = 'error';
        }
      } else if (currentPhase === 'done') {
        // All phases completed
        status = 'completed';
      } else if (index < currentPhaseIndex) {
        status = 'completed';
      } else if (index === currentPhaseIndex) {
        status = 'active';
      }

      const data: PhaseNodeData = {
        phase,
        status,
        progress: status === 'active' ? snapshot?.progress : undefined,
        issueCount: status === 'completed' || status === 'active'
          ? (snapshot?.issues?.length ?? 0)
          : 0,
        conflictCount: status === 'completed' || status === 'active'
          ? (snapshot?.conflicts?.length ?? 0)
          : 0,
      };

      return {
        id: phase,
        type: 'phase',
        position: { x: 0, y: 0 },
        data,
      };
    });

    // Create edges between consecutive phases
    const phaseEdges: Edge[] = PIPELINE_PHASES.slice(0, -1).map((phase, index) => {
      const nextPhase = PIPELINE_PHASES[index + 1];
      const isCompleted = index < currentPhaseIndex;
      const isActive = index === currentPhaseIndex - 1;

      // Determine edge style based on status
      let stroke = 'hsl(var(--muted-foreground))';
      let strokeDasharray = '4,4'; // Pending: dotted

      if (isCompleted) {
        stroke = '#10b981'; // emerald-500 (green for completed)
        strokeDasharray = 'none'; // Solid line
      } else if (isActive) {
        stroke = 'hsl(186, 100%, 50%)'; // Neon cyan
        strokeDasharray = '5,5'; // Animated dotted
      }

      return {
        id: `${phase}->${nextPhase}`,
        source: phase,
        target: nextPhase,
        type: 'smoothstep',
        animated: isActive,
        style: {
          stroke,
          strokeWidth: isCompleted || isActive ? 2 : 1,
          strokeDasharray,
        },
      };
    });

    // Apply layout
    return applyPipelineLayout(phaseNodes, phaseEdges);
  }, [snapshot]);

  // Show idle state if no snapshot
  if (!snapshot || snapshot.phase === 'idle') {
    return (
      <div
        className={cn(
          'flex h-full items-center justify-center',
          'rounded-lg border border-dashed border-border bg-card/30',
          className
        )}
      >
        <div className="text-center">
          <p className="text-sm text-muted-foreground">
            Waiting for compilation...
          </p>
          <p className="text-xs text-muted-foreground/70">
            Enter some text and click Compile to see the pipeline
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('h-full w-full', className)}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{
          padding: 0.3,
          maxZoom: 1,
        }}
        panOnDrag={false}
        zoomOnScroll={false}
        zoomOnPinch={false}
        zoomOnDoubleClick={false}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        className="bg-background"
        proOptions={{ hideAttribution: true }}
      >
        <Background color="#1e293b" gap={20} size={1} />
      </ReactFlow>
    </div>
  );
}

export default PipelineView;
