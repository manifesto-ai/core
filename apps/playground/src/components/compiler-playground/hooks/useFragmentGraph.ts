'use client';

/**
 * useFragmentGraph Hook
 *
 * Converts Fragment arrays to React Flow nodes and edges for DAG visualization.
 */

import { useMemo, useCallback, useState, useEffect } from 'react';
import { useNodesState, useEdgesState } from '@xyflow/react';
import type { Node, Edge, OnNodesChange, OnEdgesChange } from '@xyflow/react';
import { applyDagreLayout, type LayoutOptions } from '../layout/dagre-layout';
import {
  type Fragment,
  type Issue,
  type Conflict,
  type FragmentNodeData,
  type DependencyEdgeData,
  getFragmentKind,
  getFragmentLabel,
  fragmentHasIssues,
  fragmentHasConflicts,
  countFragmentIssues,
  countFragmentConflicts,
} from '../types';

// ============================================================================
// Types
// ============================================================================

export interface UseFragmentGraphOptions {
  /** Selected fragment ID */
  selectedId?: string | null;
  /** Highlighted semantic paths */
  highlightedPaths?: string[];
  /** Layout direction */
  direction?: 'LR' | 'TB';
}

export interface UseFragmentGraphReturn {
  /** React Flow nodes */
  nodes: Node<FragmentNodeData>[];
  /** React Flow edges */
  edges: Edge<DependencyEdgeData>[];
  /** Node change handler */
  onNodesChange: OnNodesChange<Node<FragmentNodeData>>;
  /** Edge change handler */
  onEdgesChange: OnEdgesChange<Edge<DependencyEdgeData>>;
  /** Apply layout to nodes */
  applyLayout: (direction?: 'LR' | 'TB') => void;
  /** Current layout direction */
  layoutDirection: 'LR' | 'TB';
}

// ============================================================================
// Conversion Functions
// ============================================================================

/**
 * Convert a fragment to a React Flow node
 */
function fragmentToNode(
  fragment: Fragment,
  issues: Issue[],
  conflicts: Conflict[],
  selectedId: string | null,
  highlightedPaths: string[]
): Node<FragmentNodeData> {
  const hasIssues = fragmentHasIssues(fragment, issues);
  const hasConflicts = fragmentHasConflicts(fragment, conflicts);
  const isSelected = fragment.id === selectedId;
  const isHighlighted =
    highlightedPaths.length > 0 &&
    (fragment.provides.some((p) => highlightedPaths.includes(p)) ||
      fragment.requires.some((p) => highlightedPaths.includes(p)));

  const data: FragmentNodeData = {
    fragment,
    isSelected,
    isHighlighted,
    hasIssues,
    hasConflicts,
    issueCount: countFragmentIssues(fragment, issues),
    conflictCount: countFragmentConflicts(fragment, conflicts),
  };

  return {
    id: fragment.id,
    type: 'fragment',
    position: { x: 0, y: 0 }, // Will be set by layout
    data,
    selected: isSelected,
  };
}

/**
 * Build dependency edges between fragments
 */
function buildDependencyEdges(
  fragments: Fragment[],
  highlightedPaths: string[]
): Edge<DependencyEdgeData>[] {
  const edges: Edge<DependencyEdgeData>[] = [];

  // Create a map of path -> provider fragment ID
  const pathProviders = new Map<string, string>();
  for (const fragment of fragments) {
    for (const path of fragment.provides) {
      pathProviders.set(path, fragment.id);
    }
  }

  // Create edges from requires -> provides
  for (const fragment of fragments) {
    for (const depPath of fragment.requires) {
      const providerId = pathProviders.get(depPath);

      if (providerId && providerId !== fragment.id) {
        const isHighlighted = highlightedPaths.includes(depPath);

        const edgeData: DependencyEdgeData = {
          fromPath: depPath,
          toPath: depPath,
          isHighlighted,
          isAnimated: isHighlighted,
        };

        edges.push({
          id: `${providerId}->${fragment.id}:${depPath}`,
          source: providerId,
          target: fragment.id,
          type: 'dependency',
          animated: isHighlighted,
          data: edgeData,
        });
      }
    }
  }

  return edges;
}

// ============================================================================
// Hook Implementation
// ============================================================================

export function useFragmentGraph(
  fragments: Fragment[],
  issues: Issue[] = [],
  conflicts: Conflict[] = [],
  options: UseFragmentGraphOptions = {}
): UseFragmentGraphReturn {
  const {
    selectedId = null,
    highlightedPaths = [],
    direction: initialDirection = 'LR',
  } = options;

  const [layoutDirection, setLayoutDirection] = useState<'LR' | 'TB'>(
    initialDirection
  );

  // Convert fragments to initial nodes
  const initialNodes = useMemo(() => {
    return fragments.map((fragment) =>
      fragmentToNode(fragment, issues, conflicts, selectedId, highlightedPaths)
    );
  }, [fragments, issues, conflicts, selectedId, highlightedPaths]);

  // Build edges
  const initialEdges = useMemo(() => {
    return buildDependencyEdges(fragments, highlightedPaths);
  }, [fragments, highlightedPaths]);

  // Apply initial layout
  const { nodes: layoutedNodes, edges: layoutedEdges } = useMemo(() => {
    if (initialNodes.length === 0) {
      return { nodes: [] as Node<FragmentNodeData>[], edges: [] as Edge<DependencyEdgeData>[] };
    }

    const layoutOptions: LayoutOptions = {
      direction: layoutDirection,
      nodeWidth: 180,
      nodeHeight: 60,
      nodeSep: 50,
      rankSep: 80,
    };

    return applyDagreLayout(initialNodes, initialEdges, layoutOptions);
  }, [initialNodes, initialEdges, layoutDirection]);

  // Use React Flow's state management
  const [nodes, setNodes, onNodesChange] = useNodesState(layoutedNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(layoutedEdges);

  // Update nodes when fragments change
  useEffect(() => {
    setNodes(layoutedNodes);
    setEdges(layoutedEdges);
  }, [layoutedNodes, layoutedEdges, setNodes, setEdges]);

  // Apply layout action
  const applyLayout = useCallback(
    (direction?: 'LR' | 'TB') => {
      const dir = direction ?? layoutDirection;
      setLayoutDirection(dir);

      const layoutOptions: LayoutOptions = {
        direction: dir,
        nodeWidth: 180,
        nodeHeight: 60,
        nodeSep: 50,
        rankSep: 80,
      };

      const { nodes: newNodes, edges: newEdges } = applyDagreLayout(
        nodes as Node<FragmentNodeData>[],
        edges as Edge<DependencyEdgeData>[],
        layoutOptions
      );

      setNodes(newNodes);
      setEdges(newEdges);
    },
    [nodes, edges, layoutDirection, setNodes, setEdges]
  );

  return {
    nodes: nodes as Node<FragmentNodeData>[],
    edges: edges as Edge<DependencyEdgeData>[],
    onNodesChange: onNodesChange as OnNodesChange<Node<FragmentNodeData>>,
    onEdgesChange: onEdgesChange as OnEdgesChange<Edge<DependencyEdgeData>>,
    applyLayout,
    layoutDirection,
  };
}

export default useFragmentGraph;
