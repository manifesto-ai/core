/**
 * @fileoverview Structural Validation Test Vectors (SPEC §15.4)
 *
 * Tests for I1-I4 invariants:
 * - I1: Causal Integrity (Acyclicity)
 * - I2: Referential Identity (Edge integrity)
 * - I3: Conceptual Completeness
 * - I4: Intent Statefulness
 */

import { describe, it, expect } from "vitest";
import {
  validateStructural,
  checkCausalIntegrity,
  checkReferentialIdentity,
  checkCompleteness,
  checkStatefulness,
  createNodeId,
  type IntentGraph,
  type IntentNode,
} from "../../index.js";
import { createSimpleNode, createGraph } from "../helpers/fixtures.js";

// =============================================================================
// I1: Causal Integrity (Acyclicity)
// =============================================================================

describe("I1: Causal Integrity (Acyclicity)", () => {
  it("detects direct cycle (A -> B -> A)", () => {
    const graph: IntentGraph = {
      nodes: [
        createSimpleNode("A", ["B"]),
        createSimpleNode("B", ["A"]),
      ],
    };

    const result = checkCausalIntegrity(graph);
    expect(result.hasCycle).toBe(true);
  });

  it("detects indirect cycle (A -> B -> C -> A)", () => {
    const graph: IntentGraph = {
      nodes: [
        createSimpleNode("A", ["B"]),
        createSimpleNode("B", ["C"]),
        createSimpleNode("C", ["A"]),
      ],
    };

    const result = checkCausalIntegrity(graph);
    expect(result.hasCycle).toBe(true);
  });

  it("detects self-loop (A -> A)", () => {
    const graph: IntentGraph = {
      nodes: [createSimpleNode("A", ["A"])],
    };

    const result = checkCausalIntegrity(graph);
    expect(result.hasCycle).toBe(true);
  });

  it("passes for linear chain (A -> B -> C)", () => {
    const graph: IntentGraph = {
      nodes: [
        createSimpleNode("A", []),
        createSimpleNode("B", ["A"]),
        createSimpleNode("C", ["B"]),
      ],
    };

    const result = checkCausalIntegrity(graph);
    expect(result.hasCycle).toBe(false);
  });

  it("passes for diamond DAG (A -> B, A -> C, B -> D, C -> D)", () => {
    const graph: IntentGraph = {
      nodes: [
        createSimpleNode("A", []),
        createSimpleNode("B", ["A"]),
        createSimpleNode("C", ["A"]),
        createSimpleNode("D", ["B", "C"]),
      ],
    };

    const result = checkCausalIntegrity(graph);
    expect(result.hasCycle).toBe(false);
  });

  it("passes for empty graph", () => {
    const graph: IntentGraph = { nodes: [] };

    const result = checkCausalIntegrity(graph);
    expect(result.hasCycle).toBe(false);
  });

  it("passes for single node with no dependencies", () => {
    const graph: IntentGraph = {
      nodes: [createSimpleNode("A", [])],
    };

    const result = checkCausalIntegrity(graph);
    expect(result.hasCycle).toBe(false);
  });
});

// =============================================================================
// I2: Referential Identity (Edge Integrity)
// =============================================================================

describe("I2: Referential Identity (Edge Integrity)", () => {
  it("detects broken edge (dependency to non-existent node)", () => {
    const graph: IntentGraph = {
      nodes: [createSimpleNode("A", ["nonexistent"])],
    };

    const result = checkReferentialIdentity(graph);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.error).toBe("BROKEN_EDGE");
    }
  });

  it("passes when all edges reference existing nodes", () => {
    const graph: IntentGraph = {
      nodes: [
        createSimpleNode("A", []),
        createSimpleNode("B", ["A"]),
      ],
    };

    const result = checkReferentialIdentity(graph);
    expect(result.valid).toBe(true);
  });

  it("passes for empty graph", () => {
    const graph: IntentGraph = { nodes: [] };

    const result = checkReferentialIdentity(graph);
    expect(result.valid).toBe(true);
  });

  it("detects multiple broken edges", () => {
    const graph: IntentGraph = {
      nodes: [
        createSimpleNode("A", ["nonexistent1", "nonexistent2"]),
      ],
    };

    const result = checkReferentialIdentity(graph);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.error).toBe("BROKEN_EDGE");
    }
  });
});

// =============================================================================
// I3: Conceptual Completeness
// =============================================================================

describe("I3: Conceptual Completeness", () => {
  it("fails when Resolved node has missing roles", () => {
    const node: IntentNode = {
      id: createNodeId("A"),
      ir: {
        v: "0.1",
        force: "DO",
        event: { lemma: "CREATE", class: "CREATE" },
        args: {},
      },
      dependsOn: [],
      resolution: {
        status: "Resolved",
        ambiguityScore: 0,
        missing: ["TARGET"], // Resolved but has missing roles
      },
    };

    const graph: IntentGraph = { nodes: [node] };
    const result = checkCompleteness(graph);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.error).toBe("COMPLETENESS_VIOLATION");
    }
  });

  it("passes when Resolved node has no missing roles", () => {
    const node: IntentNode = {
      id: createNodeId("A"),
      ir: {
        v: "0.1",
        force: "DO",
        event: { lemma: "CREATE", class: "CREATE" },
        args: {
          THEME: { kind: "entity", entityType: "Project" },
        },
      },
      dependsOn: [],
      resolution: {
        status: "Resolved",
        ambiguityScore: 0,
      },
    };

    const graph: IntentGraph = { nodes: [node] };
    const result = checkCompleteness(graph);
    expect(result.valid).toBe(true);
  });

  it("passes when Ambiguous node has missing roles", () => {
    const node: IntentNode = {
      id: createNodeId("A"),
      ir: {
        v: "0.1",
        force: "DO",
        event: { lemma: "CREATE", class: "CREATE" },
        args: {},
      },
      dependsOn: [],
      resolution: {
        status: "Ambiguous",
        ambiguityScore: 0.5,
        missing: ["TARGET"],
      },
    };

    const graph: IntentGraph = { nodes: [node] };
    const result = checkCompleteness(graph);
    expect(result.valid).toBe(true);
  });

  it("passes when Abstract node has missing roles", () => {
    const node: IntentNode = {
      id: createNodeId("A"),
      ir: {
        v: "0.1",
        force: "DO",
        event: { lemma: "CREATE", class: "CREATE" },
        args: {},
      },
      dependsOn: [],
      resolution: {
        status: "Abstract",
        ambiguityScore: 1,
        missing: ["TARGET", "THEME"],
      },
    };

    const graph: IntentGraph = { nodes: [node] };
    const result = checkCompleteness(graph);
    expect(result.valid).toBe(true);
  });
});

// =============================================================================
// I4: Intent Statefulness
// =============================================================================

describe("I4: Intent Statefulness", () => {
  it("fails when ambiguityScore is out of range (> 1)", () => {
    const node: IntentNode = {
      id: createNodeId("A"),
      ir: {
        v: "0.1",
        force: "DO",
        event: { lemma: "CREATE", class: "CREATE" },
        args: {},
      },
      dependsOn: [],
      resolution: {
        status: "Resolved",
        ambiguityScore: 1.5, // Invalid: > 1
      },
    };

    const graph: IntentGraph = { nodes: [node] };
    const result = checkStatefulness(graph);
    expect(result.result.valid).toBe(false);
    if (!result.result.valid) {
      expect(result.result.error).toBe("INVALID_SCORE");
    }
  });

  it("fails when ambiguityScore is out of range (< 0)", () => {
    const node: IntentNode = {
      id: createNodeId("A"),
      ir: {
        v: "0.1",
        force: "DO",
        event: { lemma: "CREATE", class: "CREATE" },
        args: {},
      },
      dependsOn: [],
      resolution: {
        status: "Resolved",
        ambiguityScore: -0.1, // Invalid: < 0
      },
    };

    const graph: IntentGraph = { nodes: [node] };
    const result = checkStatefulness(graph);
    expect(result.result.valid).toBe(false);
    if (!result.result.valid) {
      expect(result.result.error).toBe("INVALID_SCORE");
    }
  });

  it("passes when ambiguityScore is in valid range [0, 1]", () => {
    const graph: IntentGraph = {
      nodes: [
        {
          id: createNodeId("A"),
          ir: {
            v: "0.1",
            force: "DO",
            event: { lemma: "CREATE", class: "CREATE" },
            args: {},
          },
          dependsOn: [],
          resolution: { status: "Resolved", ambiguityScore: 0 },
        },
        {
          id: createNodeId("B"),
          ir: {
            v: "0.1",
            force: "DO",
            event: { lemma: "UPDATE", class: "TRANSFORM" },
            args: {},
          },
          dependsOn: [],
          resolution: { status: "Ambiguous", ambiguityScore: 0.5 },
        },
        {
          id: createNodeId("C"),
          ir: {
            v: "0.1",
            force: "DO",
            event: { lemma: "DELETE", class: "CONTROL" },
            args: {},
          },
          dependsOn: [],
          resolution: { status: "Abstract", ambiguityScore: 1 },
        },
      ],
    };

    const result = checkStatefulness(graph);
    expect(result.result.valid).toBe(true);
  });

  it("emits warning when ambiguityScore=0 but status is not Resolved", () => {
    const node: IntentNode = {
      id: createNodeId("A"),
      ir: {
        v: "0.1",
        force: "DO",
        event: { lemma: "CREATE", class: "CREATE" },
        args: {},
      },
      dependsOn: [],
      resolution: {
        status: "Ambiguous", // Not Resolved
        ambiguityScore: 0, // But score is 0
      },
    };

    const graph: IntentGraph = { nodes: [node] };
    const result = checkStatefulness(graph);
    expect(result.result.valid).toBe(true); // Valid but with warning
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings[0].code).toBe("ZERO_SCORE_NOT_RESOLVED");
  });
});

// =============================================================================
// validateStructural Integration
// =============================================================================

describe("validateStructural() integration", () => {
  it("returns CYCLE_DETECTED for cyclic graph", () => {
    const graph: IntentGraph = {
      nodes: [
        createSimpleNode("A", ["B"]),
        createSimpleNode("B", ["A"]),
      ],
    };

    const result = validateStructural(graph);
    expect(result.result.valid).toBe(false);
    if (!result.result.valid) {
      expect(result.result.error).toBe("CYCLE_DETECTED");
    }
  });

  it("returns BROKEN_EDGE for graph with broken edges", () => {
    const graph: IntentGraph = {
      nodes: [createSimpleNode("A", ["nonexistent"])],
    };

    const result = validateStructural(graph);
    expect(result.result.valid).toBe(false);
    if (!result.result.valid) {
      expect(result.result.error).toBe("BROKEN_EDGE");
    }
  });

  it("returns valid for correct graph", () => {
    const graph: IntentGraph = {
      nodes: [
        createSimpleNode("A", []),
        createSimpleNode("B", ["A"]),
      ],
    };

    const result = validateStructural(graph);
    expect(result.result.valid).toBe(true);
  });
});
