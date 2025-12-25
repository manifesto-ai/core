/**
 * Dagre Layout Utility
 *
 * Provides automatic layout for React Flow graphs using the dagre library.
 * Used for both Fragment DAG and Pipeline visualizations.
 */

import dagre from '@dagrejs/dagre';
import type { Node, Edge } from '@xyflow/react';

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_NODE_WIDTH = 180;
const DEFAULT_NODE_HEIGHT = 60;
const DEFAULT_NODE_SEP = 50;
const DEFAULT_RANK_SEP = 80;
const DEFAULT_MARGIN = 20;

// ============================================================================
// Types
// ============================================================================

export interface LayoutOptions {
  /** Layout direction: 'LR' (left-to-right) or 'TB' (top-to-bottom) */
  direction?: 'LR' | 'TB';
  /** Node width */
  nodeWidth?: number;
  /** Node height */
  nodeHeight?: number;
  /** Separation between nodes */
  nodeSep?: number;
  /** Separation between ranks (levels) */
  rankSep?: number;
  /** Margin around the graph */
  margin?: number;
}

export interface LayoutResult<N extends Node, E extends Edge> {
  nodes: N[];
  edges: E[];
}

// ============================================================================
// Layout Function
// ============================================================================

/**
 * Apply dagre layout to React Flow nodes and edges
 *
 * @param nodes - React Flow nodes
 * @param edges - React Flow edges
 * @param options - Layout options
 * @returns Nodes and edges with updated positions
 */
export function applyDagreLayout<N extends Node, E extends Edge>(
  nodes: N[],
  edges: E[],
  options: LayoutOptions = {}
): LayoutResult<N, E> {
  const {
    direction = 'LR',
    nodeWidth = DEFAULT_NODE_WIDTH,
    nodeHeight = DEFAULT_NODE_HEIGHT,
    nodeSep = DEFAULT_NODE_SEP,
    rankSep = DEFAULT_RANK_SEP,
    margin = DEFAULT_MARGIN,
  } = options;

  // Create a new dagre graph
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));

  // Configure the graph
  dagreGraph.setGraph({
    rankdir: direction,
    nodesep: nodeSep,
    ranksep: rankSep,
    marginx: margin,
    marginy: margin,
  });

  // Add nodes to the graph
  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, {
      width: nodeWidth,
      height: nodeHeight,
    });
  });

  // Add edges to the graph
  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  // Calculate the layout
  dagre.layout(dagreGraph);

  // Apply positions to nodes
  const layoutedNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);

    // Determine handle positions based on direction
    const targetPosition = direction === 'LR' ? 'left' : 'top';
    const sourcePosition = direction === 'LR' ? 'right' : 'bottom';

    return {
      ...node,
      targetPosition,
      sourcePosition,
      position: {
        x: nodeWithPosition.x - nodeWidth / 2,
        y: nodeWithPosition.y - nodeHeight / 2,
      },
    };
  }) as N[];

  return {
    nodes: layoutedNodes,
    edges,
  };
}

/**
 * Apply horizontal pipeline layout
 *
 * Special layout for pipeline phases - simple horizontal arrangement
 *
 * @param nodes - Pipeline phase nodes
 * @param edges - Pipeline edges
 * @returns Nodes and edges with positions
 */
export function applyPipelineLayout<N extends Node, E extends Edge>(
  nodes: N[],
  edges: E[]
): LayoutResult<N, E> {
  const nodeWidth = 140;
  const nodeHeight = 80;
  const gap = 100;
  const startX = 50;
  const centerY = 150;

  const layoutedNodes = nodes.map((node, index) => ({
    ...node,
    targetPosition: 'left' as const,
    sourcePosition: 'right' as const,
    position: {
      x: startX + index * (nodeWidth + gap),
      y: centerY,
    },
  })) as N[];

  return {
    nodes: layoutedNodes,
    edges,
  };
}

/**
 * Calculate the bounding box of laid out nodes
 */
export function calculateBounds(nodes: Node[]): {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
} {
  if (nodes.length === 0) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0 };
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  nodes.forEach((node) => {
    const x = node.position?.x ?? 0;
    const y = node.position?.y ?? 0;
    const width = (node.measured?.width ?? 180);
    const height = (node.measured?.height ?? 60);

    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x + width);
    maxY = Math.max(maxY, y + height);
  });

  return {
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX,
    height: maxY - minY,
  };
}
