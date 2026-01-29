/**
 * @fileoverview E-INV Conformance Tests
 *
 * Tests for ExecutionPlan Invariants per SPEC Section 11.4.
 *
 * E-INV-1: steps contains no abstract nodes
 * E-INV-2: dependencyEdges references only nodes in steps
 * E-INV-3: from is dependency (executes first), to is dependent (executes after)
 */

import { describe, it, expect } from "vitest";
import {
  buildExecutionPlan,
  createNodeId,
  type IntentGraph,
  type IntentNode,
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

// Helper to create an ambiguous node
function createAmbiguousNode(id: string, dependsOn: string[] = []): IntentNode {
  return {
    id: createNodeId(id),
    ir: createIR(),
    resolution: { status: "Ambiguous", ambiguityScore: 0.5 },
    dependsOn: dependsOn.map(createNodeId),
  };
}

describe("E-INV Conformance", () => {
  describe("E-INV-1: steps contains no abstract nodes", () => {
    it("excludes abstract nodes from steps", () => {
      const graph: IntentGraph = {
        nodes: [
          createResolvedNode("n1"),
          createAbstractNode("n2"), // Abstract - should be excluded
          createResolvedNode("n3"),
        ],
      };

      const plan = buildExecutionPlan(graph);

      // Steps should not contain abstract node
      const stepNodeIds = plan.steps.map((s) => s.nodeId);
      expect(stepNodeIds).not.toContain(createNodeId("n2"));
      expect(stepNodeIds).toContain(createNodeId("n1"));
      expect(stepNodeIds).toContain(createNodeId("n3"));
    });

    it("includes abstract nodes in abstractNodes array", () => {
      const graph: IntentGraph = {
        nodes: [
          createResolvedNode("n1"),
          createAbstractNode("n2"),
          createAbstractNode("n3"),
        ],
      };

      const plan = buildExecutionPlan(graph);

      expect(plan.abstractNodes).toContain(createNodeId("n2"));
      expect(plan.abstractNodes).toContain(createNodeId("n3"));
      expect(plan.abstractNodes).toHaveLength(2);
    });

    it("includes Resolved and Ambiguous nodes in steps", () => {
      const graph: IntentGraph = {
        nodes: [
          createResolvedNode("n1"),
          createAmbiguousNode("n2"),
          createAbstractNode("n3"), // Excluded
        ],
      };

      const plan = buildExecutionPlan(graph);

      const stepNodeIds = plan.steps.map((s) => s.nodeId);
      expect(stepNodeIds).toContain(createNodeId("n1"));
      expect(stepNodeIds).toContain(createNodeId("n2"));
      expect(stepNodeIds).not.toContain(createNodeId("n3"));
    });
  });

  describe("E-INV-2: dependencyEdges references only nodes in steps", () => {
    it("excludes edges involving abstract nodes", () => {
      const graph: IntentGraph = {
        nodes: [
          createResolvedNode("n1"),
          createAbstractNode("n2"), // Abstract
          createResolvedNode("n3", ["n1"]), // Depends on n1 only
        ],
      };

      const plan = buildExecutionPlan(graph);

      // Edges should only reference n1 and n3
      for (const edge of plan.dependencyEdges) {
        expect([createNodeId("n1"), createNodeId("n3")]).toContain(edge.from);
        expect([createNodeId("n1"), createNodeId("n3")]).toContain(edge.to);
      }
    });

    it("preserves edges between non-abstract nodes", () => {
      const graph: IntentGraph = {
        nodes: [
          createResolvedNode("n1"),
          createResolvedNode("n2", ["n1"]),
          createResolvedNode("n3", ["n2"]),
        ],
      };

      const plan = buildExecutionPlan(graph);

      // Should have edges: n1 -> n2, n2 -> n3
      expect(plan.dependencyEdges).toHaveLength(2);
      expect(plan.dependencyEdges).toContainEqual({
        from: createNodeId("n1"),
        to: createNodeId("n2"),
      });
      expect(plan.dependencyEdges).toContainEqual({
        from: createNodeId("n2"),
        to: createNodeId("n3"),
      });
    });
  });

  describe("E-INV-3: from is dependency (executes first), to is dependent (executes after)", () => {
    it("edge direction is from dependency to dependent", () => {
      const graph: IntentGraph = {
        nodes: [
          createResolvedNode("n1"),
          createResolvedNode("n2", ["n1"]), // n2 depends on n1
        ],
      };

      const plan = buildExecutionPlan(graph);

      // n1 -> n2 (n1 executes first, n2 executes after)
      expect(plan.dependencyEdges).toHaveLength(1);
      expect(plan.dependencyEdges[0]).toEqual({
        from: createNodeId("n1"), // Dependency (executes first)
        to: createNodeId("n2"), // Dependent (executes after)
      });
    });

    it("steps are topologically sorted (dependencies first)", () => {
      const graph: IntentGraph = {
        nodes: [
          createResolvedNode("n3", ["n2"]),
          createResolvedNode("n2", ["n1"]),
          createResolvedNode("n1"),
        ],
      };

      const plan = buildExecutionPlan(graph);

      // Steps should be in order: n1, n2, n3
      const stepOrder = plan.steps.map((s) => s.nodeId);
      const n1Index = stepOrder.indexOf(createNodeId("n1"));
      const n2Index = stepOrder.indexOf(createNodeId("n2"));
      const n3Index = stepOrder.indexOf(createNodeId("n3"));

      expect(n1Index).toBeLessThan(n2Index);
      expect(n2Index).toBeLessThan(n3Index);
    });
  });

  describe("Complex dependency graphs", () => {
    it("handles diamond dependencies correctly", () => {
      // Diamond: n1 -> n2, n1 -> n3, n2 -> n4, n3 -> n4
      const graph: IntentGraph = {
        nodes: [
          createResolvedNode("n1"),
          createResolvedNode("n2", ["n1"]),
          createResolvedNode("n3", ["n1"]),
          createResolvedNode("n4", ["n2", "n3"]),
        ],
      };

      const plan = buildExecutionPlan(graph);

      // All 4 nodes should be in steps
      expect(plan.steps).toHaveLength(4);

      // Should have 4 edges
      expect(plan.dependencyEdges).toHaveLength(4);

      // n1 should come before n2 and n3
      const stepOrder = plan.steps.map((s) => s.nodeId);
      const n1Index = stepOrder.indexOf(createNodeId("n1"));
      const n2Index = stepOrder.indexOf(createNodeId("n2"));
      const n3Index = stepOrder.indexOf(createNodeId("n3"));
      const n4Index = stepOrder.indexOf(createNodeId("n4"));

      expect(n1Index).toBeLessThan(n2Index);
      expect(n1Index).toBeLessThan(n3Index);
      expect(n2Index).toBeLessThan(n4Index);
      expect(n3Index).toBeLessThan(n4Index);
    });

    it("handles multiple independent chains", () => {
      const graph: IntentGraph = {
        nodes: [
          // Chain 1: a1 -> a2
          createResolvedNode("a1"),
          createResolvedNode("a2", ["a1"]),
          // Chain 2: b1 -> b2
          createResolvedNode("b1"),
          createResolvedNode("b2", ["b1"]),
        ],
      };

      const plan = buildExecutionPlan(graph);

      expect(plan.steps).toHaveLength(4);
      expect(plan.dependencyEdges).toHaveLength(2);

      // Each chain should maintain its order
      const stepOrder = plan.steps.map((s) => s.nodeId);
      expect(stepOrder.indexOf(createNodeId("a1"))).toBeLessThan(
        stepOrder.indexOf(createNodeId("a2"))
      );
      expect(stepOrder.indexOf(createNodeId("b1"))).toBeLessThan(
        stepOrder.indexOf(createNodeId("b2"))
      );
    });

    it("handles graph with only abstract nodes", () => {
      const graph: IntentGraph = {
        nodes: [createAbstractNode("n1"), createAbstractNode("n2")],
      };

      const plan = buildExecutionPlan(graph);

      expect(plan.steps).toHaveLength(0);
      expect(plan.dependencyEdges).toHaveLength(0);
      expect(plan.abstractNodes).toHaveLength(2);
    });

    it("handles empty graph", () => {
      const graph: IntentGraph = { nodes: [] };

      const plan = buildExecutionPlan(graph);

      expect(plan.steps).toHaveLength(0);
      expect(plan.dependencyEdges).toHaveLength(0);
      expect(plan.abstractNodes).toHaveLength(0);
    });
  });

  describe("Cycle detection", () => {
    it("throws error for cyclic graph", () => {
      const graph: IntentGraph = {
        nodes: [
          createResolvedNode("n1", ["n3"]),
          createResolvedNode("n2", ["n1"]),
          createResolvedNode("n3", ["n2"]), // Cycle: n1 -> n2 -> n3 -> n1
        ],
      };

      expect(() => buildExecutionPlan(graph)).toThrow(/[Cc]ycle/);
    });

    it("throws error for self-dependency", () => {
      const graph: IntentGraph = {
        nodes: [
          createResolvedNode("n1", ["n1"]), // Self-cycle
        ],
      };

      expect(() => buildExecutionPlan(graph)).toThrow(/[Cc]ycle/);
    });
  });
});
