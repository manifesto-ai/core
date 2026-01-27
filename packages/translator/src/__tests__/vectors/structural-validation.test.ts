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
  checkAbstractDependency,
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
  it("detects self-dependency (SELF_DEPENDENCY)", () => {
    const graph: IntentGraph = {
      nodes: [createSimpleNode("A", ["A"])],
    };

    const result = checkReferentialIdentity(graph);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.error).toBe("SELF_DEPENDENCY");
    }
  });

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

  it("returns ABSTRACT_DEPENDENCY for non-Abstract node depending on Abstract", () => {
    const graph: IntentGraph = {
      nodes: [
        {
          id: createNodeId("abstract-goal"),
          ir: {
            v: "0.1",
            force: "DO",
            event: { lemma: "IMPROVE", class: "TRANSFORM" },
            args: {},
          },
          dependsOn: [],
          resolution: { status: "Abstract", ambiguityScore: 1 },
        },
        {
          id: createNodeId("concrete-task"),
          ir: {
            v: "0.1",
            force: "DO",
            event: { lemma: "CREATE", class: "CREATE" },
            args: {},
          },
          dependsOn: [createNodeId("abstract-goal")], // C-ABS-1 violation!
          resolution: { status: "Resolved", ambiguityScore: 0 },
        },
      ],
    };

    const result = validateStructural(graph);
    expect(result.result.valid).toBe(false);
    if (!result.result.valid) {
      expect(result.result.error).toBe("ABSTRACT_DEPENDENCY");
    }
  });
});

// =============================================================================
// C-ABS-1: Abstract Dependency Constraint
// =============================================================================

describe("C-ABS-1: Abstract Dependency Constraint", () => {
  it("fails when Resolved node depends on Abstract node", () => {
    const graph: IntentGraph = {
      nodes: [
        {
          id: createNodeId("abstract"),
          ir: {
            v: "0.1",
            force: "DO",
            event: { lemma: "IMPROVE", class: "TRANSFORM" },
            args: {},
          },
          dependsOn: [],
          resolution: { status: "Abstract", ambiguityScore: 1 },
        },
        {
          id: createNodeId("resolved"),
          ir: {
            v: "0.1",
            force: "DO",
            event: { lemma: "CREATE", class: "CREATE" },
            args: {},
          },
          dependsOn: [createNodeId("abstract")],
          resolution: { status: "Resolved", ambiguityScore: 0 },
        },
      ],
    };

    const result = checkAbstractDependency(graph);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.error).toBe("ABSTRACT_DEPENDENCY");
      expect(result.nodeId).toBe("resolved");
    }
  });

  it("fails when Ambiguous node depends on Abstract node", () => {
    const graph: IntentGraph = {
      nodes: [
        {
          id: createNodeId("abstract"),
          ir: {
            v: "0.1",
            force: "DO",
            event: { lemma: "IMPROVE", class: "TRANSFORM" },
            args: {},
          },
          dependsOn: [],
          resolution: { status: "Abstract", ambiguityScore: 1 },
        },
        {
          id: createNodeId("ambiguous"),
          ir: {
            v: "0.1",
            force: "DO",
            event: { lemma: "UPDATE", class: "TRANSFORM" },
            args: {},
          },
          dependsOn: [createNodeId("abstract")],
          resolution: { status: "Ambiguous", ambiguityScore: 0.5 },
        },
      ],
    };

    const result = checkAbstractDependency(graph);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.error).toBe("ABSTRACT_DEPENDENCY");
      expect(result.nodeId).toBe("ambiguous");
    }
  });

  it("passes when Abstract node depends on Abstract node", () => {
    const graph: IntentGraph = {
      nodes: [
        {
          id: createNodeId("abstract1"),
          ir: {
            v: "0.1",
            force: "DO",
            event: { lemma: "IMPROVE", class: "TRANSFORM" },
            args: {},
          },
          dependsOn: [],
          resolution: { status: "Abstract", ambiguityScore: 1 },
        },
        {
          id: createNodeId("abstract2"),
          ir: {
            v: "0.1",
            force: "DO",
            event: { lemma: "OPTIMIZE", class: "TRANSFORM" },
            args: {},
          },
          dependsOn: [createNodeId("abstract1")],
          resolution: { status: "Abstract", ambiguityScore: 1 },
        },
      ],
    };

    const result = checkAbstractDependency(graph);
    expect(result.valid).toBe(true);
  });

  it("passes when Abstract node depends on Resolved node", () => {
    const graph: IntentGraph = {
      nodes: [
        {
          id: createNodeId("resolved"),
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
          id: createNodeId("abstract"),
          ir: {
            v: "0.1",
            force: "DO",
            event: { lemma: "IMPROVE", class: "TRANSFORM" },
            args: {},
          },
          dependsOn: [createNodeId("resolved")],
          resolution: { status: "Abstract", ambiguityScore: 1 },
        },
      ],
    };

    const result = checkAbstractDependency(graph);
    expect(result.valid).toBe(true);
  });

  it("passes when Resolved node depends on Resolved node", () => {
    const graph: IntentGraph = {
      nodes: [
        createSimpleNode("A", []),
        createSimpleNode("B", ["A"]),
      ],
    };

    const result = checkAbstractDependency(graph);
    expect(result.valid).toBe(true);
  });

  it("passes for empty graph", () => {
    const graph: IntentGraph = { nodes: [] };

    const result = checkAbstractDependency(graph);
    expect(result.valid).toBe(true);
  });
});

// =============================================================================
// DUPLICATE_NODE_ID Detection
// =============================================================================

describe("DUPLICATE_NODE_ID Detection", () => {
  it("detects duplicate node IDs in graph", () => {
    const graph: IntentGraph = {
      nodes: [
        {
          id: createNodeId("duplicate"),
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
          id: createNodeId("duplicate"), // Same ID - VIOLATION
          ir: {
            v: "0.1",
            force: "DO",
            event: { lemma: "UPDATE", class: "TRANSFORM" },
            args: {},
          },
          dependsOn: [],
          resolution: { status: "Resolved", ambiguityScore: 0 },
        },
      ],
    };

    const result = validateStructural(graph);
    expect(result.result.valid).toBe(false);
    if (!result.result.valid) {
      expect(result.result.error).toBe("DUPLICATE_NODE_ID");
    }
  });

  it("passes when all node IDs are unique", () => {
    const graph: IntentGraph = {
      nodes: [
        createSimpleNode("A", []),
        createSimpleNode("B", []),
        createSimpleNode("C", []),
      ],
    };

    const result = validateStructural(graph);
    expect(result.result.valid).toBe(true);
  });
});

// =============================================================================
// INVALID_ROLE Detection
// =============================================================================

describe("INVALID_ROLE Detection", () => {
  it("detects invalid role in missing[]", () => {
    const graph: IntentGraph = {
      nodes: [
        {
          id: createNodeId("node1"),
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
            missing: ["INVALID_ROLE_NAME" as any], // Invalid role
          },
        },
      ],
    };

    const result = validateStructural(graph);
    expect(result.result.valid).toBe(false);
    if (!result.result.valid) {
      expect(result.result.error).toBe("INVALID_ROLE");
    }
  });

  it("passes when all missing[] roles are valid", () => {
    const graph: IntentGraph = {
      nodes: [
        {
          id: createNodeId("node1"),
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
            missing: ["TARGET", "THEME"], // Valid roles
          },
        },
      ],
    };

    const result = validateStructural(graph);
    expect(result.result.valid).toBe(true);
  });
});

// =============================================================================
// ENTITY_TYPE_CONFLICT Detection (I2-S)
// =============================================================================

describe("ENTITY_TYPE_CONFLICT Detection (I2-S)", () => {
  it("detects conflicting entity types for same entityId", () => {
    // Use type assertion for entityId which is checked at runtime
    const graph: IntentGraph = {
      nodes: [
        {
          id: createNodeId("node1"),
          ir: {
            v: "0.1",
            force: "DO",
            event: { lemma: "CREATE", class: "CREATE" },
            args: {
              THEME: {
                kind: "entity",
                entityType: "Project",
                entityId: "entity-123",
              } as any,
            },
          },
          dependsOn: [],
          resolution: { status: "Resolved", ambiguityScore: 0 },
        },
        {
          id: createNodeId("node2"),
          ir: {
            v: "0.1",
            force: "DO",
            event: { lemma: "UPDATE", class: "TRANSFORM" },
            args: {
              TARGET: {
                kind: "entity",
                entityType: "Task", // Different type, same entityId - CONFLICT
                entityId: "entity-123",
              } as any,
            },
          },
          dependsOn: [],
          resolution: { status: "Resolved", ambiguityScore: 0 },
        },
      ],
    };

    const result = validateStructural(graph);
    expect(result.result.valid).toBe(false);
    if (!result.result.valid) {
      expect(result.result.error).toBe("ENTITY_TYPE_CONFLICT");
    }
  });

  it("passes when same entityId has same entityType", () => {
    // Use type assertion for entityId which is checked at runtime
    const graph: IntentGraph = {
      nodes: [
        {
          id: createNodeId("node1"),
          ir: {
            v: "0.1",
            force: "DO",
            event: { lemma: "CREATE", class: "CREATE" },
            args: {
              THEME: {
                kind: "entity",
                entityType: "Project",
                entityId: "entity-123",
              } as any,
            },
          },
          dependsOn: [],
          resolution: { status: "Resolved", ambiguityScore: 0 },
        },
        {
          id: createNodeId("node2"),
          ir: {
            v: "0.1",
            force: "DO",
            event: { lemma: "UPDATE", class: "TRANSFORM" },
            args: {
              TARGET: {
                kind: "entity",
                entityType: "Project", // Same type, same entityId - OK
                entityId: "entity-123",
              } as any,
            },
          },
          dependsOn: [createNodeId("node1")],
          resolution: { status: "Resolved", ambiguityScore: 0 },
        },
      ],
    };

    const result = validateStructural(graph);
    expect(result.result.valid).toBe(true);
  });
});
