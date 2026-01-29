/**
 * @fileoverview G-INV Conformance Tests
 *
 * Tests for Graph Invariants per SPEC Section 11.2.
 *
 * G-INV-1: Node IDs are unique within graph
 * G-INV-2: All dependsOn IDs exist in graph
 * G-INV-3: Graph is a DAG (no cycles)
 * G-INV-4: Non-abstract nodes SHALL NOT depend on abstract nodes (C-ABS-1)
 */

import { describe, it, expect } from "vitest";
import {
  validateGraph,
  assertValidGraph,
  createNodeId,
  type IntentGraph,
  type IntentNode,
  ValidationException,
} from "../../index.js";

// Helper to create a valid IntentIR
function createIR(event: string = "CREATE") {
  return {
    v: "0.1" as const,
    force: "DO" as const,
    event: { lemma: event.toUpperCase(), class: "CREATE" as const },
    args: {},
  };
}

// Helper to create a resolved node
function createResolvedNode(id: string, dependsOn: string[] = []): IntentNode {
  return {
    id: createNodeId(id),
    ir: createIR(),
    resolution: { status: "Resolved", ambiguityScore: 0 },
    dependsOn: dependsOn.map(createNodeId),
  };
}

// Helper to create an abstract node
function createAbstractNode(id: string, dependsOn: string[] = []): IntentNode {
  return {
    id: createNodeId(id),
    ir: createIR(),
    resolution: { status: "Abstract", ambiguityScore: 1.0 },
    dependsOn: dependsOn.map(createNodeId),
  };
}

describe("G-INV Conformance", () => {
  describe("G-INV-1: Node IDs are unique within graph", () => {
    it("passes when all node IDs are unique", () => {
      const graph: IntentGraph = {
        nodes: [
          createResolvedNode("n1"),
          createResolvedNode("n2"),
          createResolvedNode("n3"),
        ],
      };

      const result = validateGraph(graph);
      expect(result.valid).toBe(true);
    });

    it("fails when duplicate node IDs exist", () => {
      const graph: IntentGraph = {
        nodes: [
          createResolvedNode("n1"),
          createResolvedNode("n1"), // Duplicate
        ],
      };

      const result = validateGraph(graph);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error.code).toBe("DUPLICATE_ID");
      }
    });
  });

  describe("G-INV-2: All dependsOn IDs exist in graph", () => {
    it("passes when all dependencies exist", () => {
      const graph: IntentGraph = {
        nodes: [
          createResolvedNode("n1"),
          createResolvedNode("n2", ["n1"]),
          createResolvedNode("n3", ["n1", "n2"]),
        ],
      };

      const result = validateGraph(graph);
      expect(result.valid).toBe(true);
    });

    it("fails when dependency does not exist", () => {
      const graph: IntentGraph = {
        nodes: [
          createResolvedNode("n1"),
          createResolvedNode("n2", ["n99"]), // n99 doesn't exist
        ],
      };

      const result = validateGraph(graph);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error.code).toBe("MISSING_DEPENDENCY");
      }
    });
  });

  describe("G-INV-3: Graph is a DAG (no cycles)", () => {
    it("passes for acyclic graph", () => {
      const graph: IntentGraph = {
        nodes: [
          createResolvedNode("n1"),
          createResolvedNode("n2", ["n1"]),
          createResolvedNode("n3", ["n2"]),
        ],
      };

      const result = validateGraph(graph);
      expect(result.valid).toBe(true);
    });

    it("fails for direct self-cycle", () => {
      const graph: IntentGraph = {
        nodes: [
          createResolvedNode("n1", ["n1"]), // Self-dependency
        ],
      };

      const result = validateGraph(graph);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error.code).toBe("CYCLE_DETECTED");
      }
    });

    it("fails for indirect cycle", () => {
      const graph: IntentGraph = {
        nodes: [
          createResolvedNode("n1", ["n3"]),
          createResolvedNode("n2", ["n1"]),
          createResolvedNode("n3", ["n2"]), // n3 -> n2 -> n1 -> n3
        ],
      };

      const result = validateGraph(graph);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error.code).toBe("CYCLE_DETECTED");
      }
    });

    it("passes for diamond dependency (not a cycle)", () => {
      const graph: IntentGraph = {
        nodes: [
          createResolvedNode("n1"),
          createResolvedNode("n2", ["n1"]),
          createResolvedNode("n3", ["n1"]),
          createResolvedNode("n4", ["n2", "n3"]), // Diamond shape
        ],
      };

      const result = validateGraph(graph);
      expect(result.valid).toBe(true);
    });
  });

  describe("G-INV-4: Non-abstract nodes SHALL NOT depend on abstract nodes (C-ABS-1)", () => {
    it("passes when non-abstract depends on non-abstract", () => {
      const graph: IntentGraph = {
        nodes: [
          createResolvedNode("n1"),
          createResolvedNode("n2", ["n1"]),
        ],
      };

      const result = validateGraph(graph);
      expect(result.valid).toBe(true);
    });

    it("passes when abstract depends on abstract", () => {
      const graph: IntentGraph = {
        nodes: [
          createAbstractNode("n1"),
          createAbstractNode("n2", ["n1"]),
        ],
      };

      const result = validateGraph(graph);
      expect(result.valid).toBe(true);
    });

    it("passes when abstract depends on non-abstract", () => {
      const graph: IntentGraph = {
        nodes: [
          createResolvedNode("n1"),
          createAbstractNode("n2", ["n1"]),
        ],
      };

      const result = validateGraph(graph);
      expect(result.valid).toBe(true);
    });

    it("fails when non-abstract depends on abstract", () => {
      const graph: IntentGraph = {
        nodes: [
          createAbstractNode("n1"),
          createResolvedNode("n2", ["n1"]), // Resolved depends on Abstract
        ],
      };

      const result = validateGraph(graph);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error.code).toBe("ABSTRACT_DEPENDENCY");
      }
    });

    it("fails when Ambiguous depends on Abstract", () => {
      const graph: IntentGraph = {
        nodes: [
          createAbstractNode("n1"),
          {
            id: createNodeId("n2"),
            ir: createIR(),
            resolution: { status: "Ambiguous", ambiguityScore: 0.5 },
            dependsOn: [createNodeId("n1")],
          },
        ],
      };

      const result = validateGraph(graph);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error.code).toBe("ABSTRACT_DEPENDENCY");
      }
    });
  });

  describe("V-1: validateGraph MUST NOT throw", () => {
    it("returns result for invalid graph", () => {
      const graph: IntentGraph = {
        nodes: [
          createResolvedNode("n1", ["n1"]), // Self-cycle
        ],
      };

      // Should not throw
      const result = validateGraph(graph);
      expect(result.valid).toBe(false);
    });

    it("handles empty graph", () => {
      const graph: IntentGraph = { nodes: [] };
      const result = validateGraph(graph);
      expect(result.valid).toBe(true);
    });
  });

  describe("V-3: assertValidGraph MAY throw", () => {
    it("throws ValidationException for invalid graph", () => {
      const graph: IntentGraph = {
        nodes: [
          createResolvedNode("n1"),
          createResolvedNode("n1"), // Duplicate
        ],
      };

      expect(() => assertValidGraph(graph)).toThrow(ValidationException);
    });

    it("does not throw for valid graph", () => {
      const graph: IntentGraph = {
        nodes: [
          createResolvedNode("n1"),
          createResolvedNode("n2", ["n1"]),
        ],
      };

      expect(() => assertValidGraph(graph)).not.toThrow();
    });
  });
});
