/**
 * @fileoverview Test Fixtures
 *
 * Sample Intent Graphs and nodes for testing.
 */

import type { IntentIR } from "@manifesto-ai/intent-ir";
import type {
  IntentGraph,
  IntentNode,
  IntentNodeId,
  Resolution,
} from "../../types/index.js";
import { createNodeId } from "../../types/node.js";

// =============================================================================
// Sample IntentIR instances
// =============================================================================

/**
 * Simple CREATE intent - "Create a project"
 */
export const createProjectIR: IntentIR = {
  v: "0.1",
  force: "DO",
  event: { lemma: "CREATE", class: "CREATE" },
  args: {
    THEME: { kind: "entity", entityType: "Project" },
  },
};

/**
 * Simple CANCEL intent - "Cancel the order"
 */
export const cancelOrderIR: IntentIR = {
  v: "0.1",
  force: "DO",
  event: { lemma: "CANCEL", class: "CONTROL" },
  args: {
    TARGET: {
      kind: "entity",
      entityType: "Order",
      ref: { kind: "that" },
    },
  },
};

/**
 * ADD intent with discourse reference - "Add tasks to it"
 */
export const addTasksIR: IntentIR = {
  v: "0.1",
  force: "DO",
  event: { lemma: "ADD", class: "TRANSFORM" },
  args: {
    THEME: {
      kind: "value",
      valueType: "number",
      shape: { count: 3, entityType: "Task" },
      raw: 3,
    },
    DEST: {
      kind: "entity",
      entityType: "Project",
      ref: { kind: "that" },
    },
  },
};

// =============================================================================
// Sample IntentNodes
// =============================================================================

/**
 * Node for CREATE project - resolved
 */
export const createProjectNode: IntentNode = {
  id: createNodeId("n1"),
  ir: createProjectIR,
  dependsOn: [],
  resolution: {
    status: "Resolved",
    ambiguityScore: 0.1,
  },
};

/**
 * Node for CANCEL order - ambiguous (discourse ref)
 */
export const cancelOrderNode: IntentNode = {
  id: createNodeId("n2"),
  ir: cancelOrderIR,
  dependsOn: [],
  resolution: {
    status: "Ambiguous",
    ambiguityScore: 0.3,
    questions: ["Which order would you like to cancel?"],
  },
};

/**
 * Node for ADD tasks - depends on n1
 */
export const addTasksNode: IntentNode = {
  id: createNodeId("n2"),
  ir: addTasksIR,
  dependsOn: [createNodeId("n1")],
  resolution: {
    status: "Resolved",
    ambiguityScore: 0.15,
  },
};

// =============================================================================
// Sample IntentGraphs
// =============================================================================

/**
 * Simple single-node graph
 */
export const singleNodeGraph: IntentGraph = {
  nodes: [createProjectNode],
  meta: {
    sourceText: "Create a project",
    translatedAt: new Date().toISOString(),
  },
};

/**
 * Two-node graph with dependency
 */
export const twoNodeGraph: IntentGraph = {
  nodes: [
    createProjectNode,
    {
      ...addTasksNode,
      id: createNodeId("n2"),
      dependsOn: [createNodeId("n1")],
    },
  ],
  meta: {
    sourceText: "Create a new project and add three tasks to it",
    translatedAt: new Date().toISOString(),
  },
};

/**
 * Graph with cycle (invalid)
 */
export const cyclicGraph: IntentGraph = {
  nodes: [
    {
      ...createProjectNode,
      id: createNodeId("n1"),
      dependsOn: [createNodeId("n2")],
    },
    {
      ...addTasksNode,
      id: createNodeId("n2"),
      dependsOn: [createNodeId("n1")],
    },
  ],
  meta: {
    sourceText: "Invalid cyclic graph",
    translatedAt: new Date().toISOString(),
  },
};

/**
 * Graph with broken edge (invalid)
 */
export const brokenEdgeGraph: IntentGraph = {
  nodes: [
    {
      ...addTasksNode,
      id: createNodeId("n1"),
      dependsOn: [createNodeId("nonexistent")],
    },
  ],
  meta: {
    sourceText: "Invalid broken edge graph",
    translatedAt: new Date().toISOString(),
  },
};

/**
 * Empty graph (valid)
 */
export const emptyGraph: IntentGraph = {
  nodes: [],
  meta: {
    sourceText: "",
    translatedAt: new Date().toISOString(),
  },
};

// =============================================================================
// Helper functions
// =============================================================================

/**
 * Create a simple node with given ID and dependencies.
 */
export function createSimpleNode(
  id: string,
  dependsOn: string[] = [],
  resolution: Partial<Resolution> = {}
): IntentNode {
  return {
    id: createNodeId(id),
    ir: createProjectIR,
    dependsOn: dependsOn.map(createNodeId),
    resolution: {
      status: "Resolved",
      ambiguityScore: 0,
      ...resolution,
    },
  };
}

/**
 * Create a graph from node definitions.
 */
export function createGraph(
  nodeDefinitions: Array<{ id: string; dependsOn?: string[] }>
): IntentGraph {
  return {
    nodes: nodeDefinitions.map((def) =>
      createSimpleNode(def.id, def.dependsOn)
    ),
  };
}
