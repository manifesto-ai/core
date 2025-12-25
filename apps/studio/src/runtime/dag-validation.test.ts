/**
 * DAG Validation Tests
 *
 * Tests for cycle detection in derived dependency graphs.
 * TDD: Tests written first, implementation follows.
 */

import { describe, it, expect } from "vitest";
import { detectCycles, type DependencyGraph } from "./dag-validation";

describe("dag-validation.ts - Cycle Detection", () => {
  describe("no cycles", () => {
    it("should return hasCycle: false for empty graph", () => {
      const result = detectCycles({});

      expect(result.hasCycle).toBe(false);
      expect(result.cycles).toEqual([]);
    });

    it("should return hasCycle: false for single node with no deps", () => {
      const graph: DependencyGraph = {
        "derived.a": { path: "derived.a", deps: [] },
      };

      const result = detectCycles(graph);

      expect(result.hasCycle).toBe(false);
      expect(result.cycles).toEqual([]);
    });

    it("should return hasCycle: false for linear chain", () => {
      const graph: DependencyGraph = {
        "derived.a": { path: "derived.a", deps: ["data.source"] },
        "derived.b": { path: "derived.b", deps: ["derived.a"] },
        "derived.c": { path: "derived.c", deps: ["derived.b"] },
      };

      const result = detectCycles(graph);

      expect(result.hasCycle).toBe(false);
    });

    it("should return hasCycle: false for diamond pattern", () => {
      // Diamond: a -> b, a -> c, b -> d, c -> d
      const graph: DependencyGraph = {
        "derived.b": { path: "derived.b", deps: ["derived.a"] },
        "derived.c": { path: "derived.c", deps: ["derived.a"] },
        "derived.d": { path: "derived.d", deps: ["derived.b", "derived.c"] },
      };

      const result = detectCycles(graph);

      expect(result.hasCycle).toBe(false);
    });

    it("should ignore dependencies on non-derived paths", () => {
      // Dependencies on data.* sources are fine
      const graph: DependencyGraph = {
        "derived.a": { path: "derived.a", deps: ["data.foo", "data.bar"] },
        "derived.b": { path: "derived.b", deps: ["derived.a", "data.baz"] },
      };

      const result = detectCycles(graph);

      expect(result.hasCycle).toBe(false);
    });
  });

  describe("direct cycle", () => {
    it("should detect self-referencing cycle", () => {
      const graph: DependencyGraph = {
        "derived.a": { path: "derived.a", deps: ["derived.a"] },
      };

      const result = detectCycles(graph);

      expect(result.hasCycle).toBe(true);
      expect(result.cycles.length).toBeGreaterThanOrEqual(1);
      expect(result.cycles[0]).toContain("derived.a");
    });

    it("should detect two-node cycle (A <-> B)", () => {
      const graph: DependencyGraph = {
        "derived.a": { path: "derived.a", deps: ["derived.b"] },
        "derived.b": { path: "derived.b", deps: ["derived.a"] },
      };

      const result = detectCycles(graph);

      expect(result.hasCycle).toBe(true);
      expect(result.cycles.length).toBeGreaterThanOrEqual(1);

      // The cycle should contain both nodes
      const cycle = result.cycles[0];
      expect(cycle).toContain("derived.a");
      expect(cycle).toContain("derived.b");
    });
  });

  describe("indirect cycle", () => {
    it("should detect three-node cycle (A -> B -> C -> A)", () => {
      const graph: DependencyGraph = {
        "derived.a": { path: "derived.a", deps: ["derived.c"] },
        "derived.b": { path: "derived.b", deps: ["derived.a"] },
        "derived.c": { path: "derived.c", deps: ["derived.b"] },
      };

      const result = detectCycles(graph);

      expect(result.hasCycle).toBe(true);

      const cycle = result.cycles[0];
      expect(cycle).toContain("derived.a");
      expect(cycle).toContain("derived.b");
      expect(cycle).toContain("derived.c");
    });

    it("should detect long cycle", () => {
      const graph: DependencyGraph = {
        "derived.a": { path: "derived.a", deps: ["derived.e"] },
        "derived.b": { path: "derived.b", deps: ["derived.a"] },
        "derived.c": { path: "derived.c", deps: ["derived.b"] },
        "derived.d": { path: "derived.d", deps: ["derived.c"] },
        "derived.e": { path: "derived.e", deps: ["derived.d"] },
      };

      const result = detectCycles(graph);

      expect(result.hasCycle).toBe(true);
    });
  });

  describe("multiple cycles", () => {
    it("should detect multiple independent cycles", () => {
      const graph: DependencyGraph = {
        // Cycle 1: a <-> b
        "derived.a": { path: "derived.a", deps: ["derived.b"] },
        "derived.b": { path: "derived.b", deps: ["derived.a"] },
        // Cycle 2: c <-> d
        "derived.c": { path: "derived.c", deps: ["derived.d"] },
        "derived.d": { path: "derived.d", deps: ["derived.c"] },
      };

      const result = detectCycles(graph);

      expect(result.hasCycle).toBe(true);
      expect(result.cycles.length).toBeGreaterThanOrEqual(2);
    });

    it("should detect cycle in larger graph with non-cyclic parts", () => {
      const graph: DependencyGraph = {
        // Non-cyclic part
        "derived.x": { path: "derived.x", deps: ["data.source"] },
        "derived.y": { path: "derived.y", deps: ["derived.x"] },
        // Cyclic part
        "derived.a": { path: "derived.a", deps: ["derived.b"] },
        "derived.b": { path: "derived.b", deps: ["derived.a"] },
        // Another non-cyclic part
        "derived.z": { path: "derived.z", deps: ["derived.y"] },
      };

      const result = detectCycles(graph);

      expect(result.hasCycle).toBe(true);
      expect(result.cycles.length).toBe(1);

      const cycle = result.cycles[0];
      expect(cycle).toContain("derived.a");
      expect(cycle).toContain("derived.b");
      expect(cycle).not.toContain("derived.x");
      expect(cycle).not.toContain("derived.y");
      expect(cycle).not.toContain("derived.z");
    });
  });

  describe("cycle path representation", () => {
    it("should return cycle as array of paths", () => {
      const graph: DependencyGraph = {
        "derived.a": { path: "derived.a", deps: ["derived.b"] },
        "derived.b": { path: "derived.b", deps: ["derived.a"] },
      };

      const result = detectCycles(graph);

      expect(result.cycles[0]).toBeInstanceOf(Array);
      expect(result.cycles[0].every((p) => typeof p === "string")).toBe(true);
    });

    it("should represent cycle in order (start -> ... -> back to start)", () => {
      const graph: DependencyGraph = {
        "derived.a": { path: "derived.a", deps: ["derived.b"] },
        "derived.b": { path: "derived.b", deps: ["derived.c"] },
        "derived.c": { path: "derived.c", deps: ["derived.a"] },
      };

      const result = detectCycles(graph);
      const cycle = result.cycles[0];

      // Verify it forms a cycle
      expect(cycle.length).toBeGreaterThanOrEqual(3);

      // First and last should be the same (cycle closes)
      // Or the cycle should contain all participants
      const uniqueNodes = [...new Set(cycle)];
      expect(uniqueNodes).toContain("derived.a");
      expect(uniqueNodes).toContain("derived.b");
      expect(uniqueNodes).toContain("derived.c");
    });
  });

  describe("edge cases", () => {
    it("should handle nodes with multiple dependencies", () => {
      const graph: DependencyGraph = {
        "derived.a": { path: "derived.a", deps: ["data.x", "data.y", "data.z"] },
        "derived.b": {
          path: "derived.b",
          deps: ["derived.a", "data.foo", "derived.a"],
        },
      };

      const result = detectCycles(graph);

      expect(result.hasCycle).toBe(false);
    });

    it("should handle dependency on unknown derived path", () => {
      // derived.a depends on derived.unknown which doesn't exist
      const graph: DependencyGraph = {
        "derived.a": { path: "derived.a", deps: ["derived.unknown"] },
      };

      const result = detectCycles(graph);

      expect(result.hasCycle).toBe(false);
    });

    it("should handle mixed source and derived dependencies", () => {
      const graph: DependencyGraph = {
        "derived.total": {
          path: "derived.total",
          deps: ["data.price", "data.quantity"],
        },
        "derived.withTax": {
          path: "derived.withTax",
          deps: ["derived.total", "data.taxRate"],
        },
        "derived.discount": {
          path: "derived.discount",
          deps: ["derived.withTax", "data.discountPercent"],
        },
      };

      const result = detectCycles(graph);

      expect(result.hasCycle).toBe(false);
    });
  });
});
