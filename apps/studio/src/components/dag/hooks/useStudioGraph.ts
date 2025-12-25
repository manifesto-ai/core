"use client";

/**
 * useStudioGraph Hook
 *
 * Converts Studio domain data to React Flow nodes and edges for DAG visualization.
 */

import { useMemo, useCallback, useState } from "react";
import type { Node, Edge, OnNodesChange, OnEdgesChange } from "@xyflow/react";
import { applyNodeChanges, applyEdgeChanges } from "@xyflow/react";
import {
  useSources,
  useDerivedBlocks,
  useActionBlocks,
  usePolicyBlocks,
  useSelectedBlockId,
  useValidationResult,
} from "@/runtime";
import { applyDagreLayout, type LayoutOptions } from "../layout/dagre-layout";
import {
  type StudioNodeData,
  type DependencyEdgeData,
  type StudioNodeKind,
  getLabelFromPath,
} from "../types";

// ============================================================================
// Types
// ============================================================================

export interface UseStudioGraphOptions {
  /** Layout direction */
  direction?: "LR" | "TB";
  /** Highlighted paths (for dependency tracking) */
  highlightedPaths?: string[];
}

export interface UseStudioGraphReturn {
  /** React Flow nodes */
  nodes: Node<StudioNodeData>[];
  /** React Flow edges */
  edges: Edge<DependencyEdgeData>[];
  /** Node change handler */
  onNodesChange: OnNodesChange<Node<StudioNodeData>>;
  /** Edge change handler */
  onEdgesChange: OnEdgesChange<Edge<DependencyEdgeData>>;
  /** Apply layout to nodes */
  applyLayout: (direction?: "LR" | "TB") => void;
  /** Current layout direction */
  layoutDirection: "LR" | "TB";
  /** Whether the graph is empty */
  isEmpty: boolean;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Count issues for a specific path
 */
function countIssuesForPath(
  path: string,
  issues: { path: string }[] | undefined
): number {
  if (!issues) return 0;
  return issues.filter((issue) => issue.path === path).length;
}

// ============================================================================
// Hook Implementation
// ============================================================================

export function useStudioGraph(
  options: UseStudioGraphOptions = {}
): UseStudioGraphReturn {
  const { direction: initialDirection = "TB", highlightedPaths = [] } = options;

  const [layoutDirection, setLayoutDirection] = useState<"LR" | "TB">(
    initialDirection
  );

  // Get domain data from runtime
  const { value: sources } = useSources();
  const { value: derivedBlocks } = useDerivedBlocks();
  const { value: actionBlocks } = useActionBlocks();
  const { value: policyBlocks } = usePolicyBlocks();
  const { value: selectedBlockId } = useSelectedBlockId();
  const { value: validationResult } = useValidationResult();

  // Build nodes and edges with layout applied - single useMemo
  const { nodes, edges, isEmpty } = useMemo(() => {
    const rawNodes: Node<StudioNodeData>[] = [];
    const issues = validationResult?.issues;

    // Add source nodes (data.*)
    if (sources) {
      for (const source of Object.values(sources)) {
        const path = source.path;
        if (!path) continue;

        const issueCount = countIssuesForPath(path, issues);
        rawNodes.push({
          id: path,
          type: "studio",
          position: { x: 0, y: 0 },
          data: {
            path,
            kind: "data" as StudioNodeKind,
            label: getLabelFromPath(path),
            isSelected: selectedBlockId === path,
            isHighlighted: highlightedPaths.includes(path),
            hasIssues: issueCount > 0,
            issueCount,
            description: source.description,
          },
        });
      }
    }

    // Add derived nodes (derived.*)
    if (derivedBlocks) {
      for (const derived of Object.values(derivedBlocks)) {
        const path = derived.path;
        if (!path) continue;

        const issueCount = countIssuesForPath(path, issues);
        rawNodes.push({
          id: path,
          type: "studio",
          position: { x: 0, y: 0 },
          data: {
            path,
            kind: "derived" as StudioNodeKind,
            label: getLabelFromPath(path),
            isSelected: selectedBlockId === path,
            isHighlighted: highlightedPaths.includes(path),
            hasIssues: issueCount > 0,
            issueCount,
            description: derived.description,
          },
        });
      }
    }

    // Add action nodes (action.*)
    if (actionBlocks) {
      for (const action of Object.values(actionBlocks)) {
        const path = action.path;
        if (!path) continue;

        const issueCount = countIssuesForPath(path, issues);
        rawNodes.push({
          id: path,
          type: "studio",
          position: { x: 0, y: 0 },
          data: {
            path,
            kind: "action" as StudioNodeKind,
            label: getLabelFromPath(path),
            isSelected: selectedBlockId === path,
            isHighlighted: highlightedPaths.includes(path),
            hasIssues: issueCount > 0,
            issueCount,
            description: action.description,
          },
        });
      }
    }

    // Add policy nodes (policy.*)
    if (policyBlocks) {
      for (const policy of Object.values(policyBlocks)) {
        const path = policy.path;
        if (!path) continue;

        const issueCount = countIssuesForPath(path, issues);
        rawNodes.push({
          id: path,
          type: "studio",
          position: { x: 0, y: 0 },
          data: {
            path,
            kind: "policy" as StudioNodeKind,
            label: getLabelFromPath(path),
            isSelected: selectedBlockId === path,
            isHighlighted: highlightedPaths.includes(path),
            hasIssues: issueCount > 0,
            issueCount,
            description: policy.description,
          },
        });
      }
    }

    // Build edges
    const rawEdges: Edge<DependencyEdgeData>[] = [];
    const nodeIds = new Set(rawNodes.map((n) => n.id));

    // Add edges from derived dependencies
    if (derivedBlocks) {
      for (const derived of Object.values(derivedBlocks)) {
        const targetPath = derived.path;
        if (!targetPath || !nodeIds.has(targetPath)) continue;

        for (const dep of derived.deps) {
          if (!nodeIds.has(dep)) continue;

          const isHighlighted =
            highlightedPaths.includes(dep) ||
            highlightedPaths.includes(targetPath);

          rawEdges.push({
            id: `${dep}->${targetPath}`,
            source: dep,
            target: targetPath,
            type: "dependency",
            animated: isHighlighted,
            data: {
              fromPath: dep,
              toPath: targetPath,
              isHighlighted,
              isAnimated: isHighlighted,
            },
          });
        }
      }
    }

    // Add edges from policy targetPath
    if (policyBlocks) {
      for (const policy of Object.values(policyBlocks)) {
        const policyPath = policy.path;
        const targetPath = policy.targetPath;
        if (!policyPath || !targetPath) continue;
        if (!nodeIds.has(policyPath) || !nodeIds.has(targetPath)) continue;

        const isHighlighted =
          highlightedPaths.includes(policyPath) ||
          highlightedPaths.includes(targetPath);

        rawEdges.push({
          id: `${targetPath}->${policyPath}`,
          source: targetPath,
          target: policyPath,
          type: "dependency",
          animated: isHighlighted,
          data: {
            fromPath: targetPath,
            toPath: policyPath,
            isHighlighted,
            isAnimated: isHighlighted,
          },
        });
      }
    }

    // Apply layout if we have nodes
    if (rawNodes.length === 0) {
      return {
        nodes: [] as Node<StudioNodeData>[],
        edges: [] as Edge<DependencyEdgeData>[],
        isEmpty: true,
      };
    }

    const layoutOptions: LayoutOptions = {
      direction: layoutDirection,
      nodeWidth: 160,
      nodeHeight: 50,
      nodeSep: 40,
      rankSep: 60,
    };

    const { nodes: layoutedNodes, edges: layoutedEdges } = applyDagreLayout(
      rawNodes,
      rawEdges,
      layoutOptions
    );

    return {
      nodes: layoutedNodes,
      edges: layoutedEdges,
      isEmpty: false,
    };
  }, [
    sources,
    derivedBlocks,
    actionBlocks,
    policyBlocks,
    selectedBlockId,
    highlightedPaths,
    validationResult,
    layoutDirection,
  ]);

  // Manual change handlers (for user interactions like dragging)
  const onNodesChange: OnNodesChange<Node<StudioNodeData>> = useCallback(
    (changes) => {
      // For now, we don't persist position changes since layout is recalculated
      // This could be enhanced to allow manual positioning
    },
    []
  );

  const onEdgesChange: OnEdgesChange<Edge<DependencyEdgeData>> = useCallback(
    (changes) => {
      // Edges are derived from data, no manual changes needed
    },
    []
  );

  // Apply layout action
  const applyLayout = useCallback((direction?: "LR" | "TB") => {
    if (direction) {
      setLayoutDirection(direction);
    }
  }, []);

  return {
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    applyLayout,
    layoutDirection,
    isEmpty,
  };
}

export default useStudioGraph;
