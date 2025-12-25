/**
 * DAG Visualization Types
 *
 * Types for React Flow nodes and edges in the Studio DAG view.
 */

import type { Node, Edge } from "@xyflow/react";

// ============================================================================
// Node Kinds and Colors
// ============================================================================

/**
 * Node kind in the Studio DAG
 */
export type StudioNodeKind = "data" | "derived" | "action" | "policy";

/**
 * Colors for each node kind
 */
export const NODE_COLORS: Record<StudioNodeKind, string> = {
  data: "#3b82f6", // blue-500
  derived: "#22c55e", // green-500
  action: "#ef4444", // red-500
  policy: "#a855f7", // purple-500
};

/**
 * Icon names for each node kind (Lucide icon names)
 */
export const NODE_ICONS: Record<StudioNodeKind, string> = {
  data: "Database",
  derived: "Calculator",
  action: "Zap",
  policy: "Shield",
};

// ============================================================================
// Node Data Types
// ============================================================================

/**
 * Data for Studio nodes in React Flow
 */
export interface StudioNodeData extends Record<string, unknown> {
  /** Semantic path (e.g., data.price, derived.total) */
  path: string;
  /** Node kind */
  kind: StudioNodeKind;
  /** Display label (usually the path without prefix) */
  label: string;
  /** Whether this node is currently selected */
  isSelected: boolean;
  /** Whether this node is highlighted (e.g., during dependency tracking) */
  isHighlighted: boolean;
  /** Whether this node has validation issues */
  hasIssues: boolean;
  /** Number of validation issues */
  issueCount: number;
  /** Optional description */
  description?: string;
}

/**
 * React Flow node type for Studio
 */
export type StudioFlowNode = Node<StudioNodeData>;

// ============================================================================
// Edge Data Types
// ============================================================================

/**
 * Data for dependency edges in React Flow
 */
export interface DependencyEdgeData extends Record<string, unknown> {
  /** Source path (provides) */
  fromPath: string;
  /** Target path (requires) */
  toPath: string;
  /** Whether this edge is highlighted */
  isHighlighted: boolean;
  /** Whether this edge should be animated */
  isAnimated: boolean;
}

/**
 * React Flow edge type for Studio
 */
export type StudioFlowEdge = Edge<DependencyEdgeData>;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get the node kind from a semantic path
 */
export function getNodeKindFromPath(path: string): StudioNodeKind {
  if (path.startsWith("data.")) return "data";
  if (path.startsWith("derived.")) return "derived";
  if (path.startsWith("action.")) return "action";
  if (path.startsWith("policy.")) return "policy";
  // Default to data for unknown paths
  return "data";
}

/**
 * Get a display label from a semantic path
 */
export function getLabelFromPath(path: string): string {
  // Remove the prefix (data., derived., etc.)
  const parts = path.split(".");
  if (parts.length > 1) {
    return parts.slice(1).join(".");
  }
  return path;
}

/**
 * Get the color for a node kind
 */
export function getNodeColor(kind: StudioNodeKind): string {
  return NODE_COLORS[kind];
}
