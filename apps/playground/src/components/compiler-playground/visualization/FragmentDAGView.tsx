'use client';

/**
 * FragmentDAGView Component
 *
 * React Flow visualization of Fragment dependency graph.
 */

import { useCallback } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Panel,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { LayoutGrid, LayoutList } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

import { nodeTypes } from '../nodes';
import { edgeTypes } from '../edges';
import { useFragmentGraph } from '../hooks/useFragmentGraph';
import {
  type Fragment,
  type Issue,
  type Conflict,
  type FragmentNodeData,
  FRAGMENT_COLORS,
  getFragmentKind,
} from '../types';

// ============================================================================
// Types
// ============================================================================

export interface FragmentDAGViewProps {
  /** Fragments to visualize */
  fragments: Fragment[];
  /** Issues for badge display */
  issues?: Issue[];
  /** Conflicts for badge display */
  conflicts?: Conflict[];
  /** Currently selected fragment ID */
  selectedId?: string | null;
  /** Highlighted paths */
  highlightedPaths?: string[];
  /** Selection handler */
  onSelectFragment?: (fragmentId: string) => void;
  /** Node mouse enter handler (for hover highlight) */
  onNodeMouseEnter?: (fragmentId: string) => void;
  /** Node mouse leave handler (for hover highlight) */
  onNodeMouseLeave?: () => void;
  /** Additional class names */
  className?: string;
}

// ============================================================================
// Component
// ============================================================================

export function FragmentDAGView({
  fragments,
  issues = [],
  conflicts = [],
  selectedId = null,
  highlightedPaths = [],
  onSelectFragment,
  onNodeMouseEnter,
  onNodeMouseLeave,
  className,
}: FragmentDAGViewProps) {
  const {
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    applyLayout,
    layoutDirection,
  } = useFragmentGraph(fragments, issues, conflicts, {
    selectedId,
    highlightedPaths,
  });

  // Handle node click
  const handleNodeClick = useCallback(
    (_event: React.MouseEvent, node: { id: string; data?: FragmentNodeData }) => {
      if (onSelectFragment) {
        onSelectFragment(node.id);
      }
    },
    [onSelectFragment]
  );

  // Handle node hover
  const handleNodeMouseEnter = useCallback(
    (_event: React.MouseEvent, node: { id: string }) => {
      onNodeMouseEnter?.(node.id);
    },
    [onNodeMouseEnter]
  );

  const handleNodeMouseLeave = useCallback(() => {
    onNodeMouseLeave?.();
  }, [onNodeMouseLeave]);

  // Toggle layout direction
  const toggleLayout = useCallback(() => {
    applyLayout(layoutDirection === 'LR' ? 'TB' : 'LR');
  }, [applyLayout, layoutDirection]);

  // MiniMap node color function
  const getNodeColor = useCallback((node: { data?: Record<string, unknown> }) => {
    const data = node.data as FragmentNodeData | undefined;
    if (data?.fragment) {
      const kind = getFragmentKind(data.fragment);
      return FRAGMENT_COLORS[kind];
    }
    return '#6b7280';
  }, []);

  // Show empty state if no fragments
  if (fragments.length === 0) {
    return (
      <div
        className={cn(
          'flex h-full items-center justify-center',
          'rounded-lg border border-dashed border-border bg-card/30',
          className
        )}
      >
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <LayoutGrid className="h-6 w-6 text-muted-foreground" />
          </div>
          <p className="text-sm text-muted-foreground">
            No fragments to display
          </p>
          <p className="text-xs text-muted-foreground/70">
            Compile some code or natural language to see the DAG
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
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={handleNodeClick}
        onNodeMouseEnter={handleNodeMouseEnter}
        onNodeMouseLeave={handleNodeMouseLeave}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        fitViewOptions={{
          padding: 0.2,
          maxZoom: 1.5,
        }}
        minZoom={0.1}
        maxZoom={2}
        className="bg-background"
        proOptions={{ hideAttribution: true }}
      >
        {/* Background */}
        <Background color="#1e293b" gap={20} size={1} />

        {/* Controls */}
        <Controls
          showInteractive={false}
          className="!rounded-lg !border !border-border !bg-card !shadow-lg"
        />

        {/* MiniMap */}
        <MiniMap
          nodeColor={getNodeColor}
          maskColor="rgba(0, 0, 0, 0.7)"
          className="!rounded-lg !border !border-border !bg-card"
          style={{ height: 100, width: 150 }}
        />

        {/* Layout Toggle Panel */}
        <Panel position="top-right" className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={toggleLayout}
            className="gap-2 bg-card"
          >
            {layoutDirection === 'LR' ? (
              <>
                <LayoutList className="h-4 w-4" />
                Vertical
              </>
            ) : (
              <>
                <LayoutGrid className="h-4 w-4" />
                Horizontal
              </>
            )}
          </Button>
        </Panel>

        {/* Stats Panel */}
        <Panel position="top-left" className="rounded-lg bg-card/90 p-2 text-xs">
          <div className="flex items-center gap-3">
            <span className="text-muted-foreground">
              {fragments.length} fragments
            </span>
            <span className="text-muted-foreground">
              {edges.length} dependencies
            </span>
          </div>
        </Panel>
      </ReactFlow>
    </div>
  );
}

export default FragmentDAGView;
