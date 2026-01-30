/**
 * @fileoverview R-INV Conformance Tests
 *
 * Tests for Resolution Invariants per SPEC Section 11.2a.
 *
 * R-INV-1: status === "Resolved" => missing is absent or length 0
 * R-INV-2: missing exists and length > 0 => status !== "Resolved"
 */

import { describe, it, expect } from "vitest";
import {
  validateGraph,
  assertValidGraph,
  createNodeId,
  type IntentGraph,
  type IntentNode,
  type Resolution,
  ValidationException,
} from "../../index.js";

// Helper to create a valid IntentIR
function createIR(event: string = "CREATE") {
  return {
    v: "0.2" as const,
    force: "DO" as const,
    event: { lemma: event.toUpperCase(), class: "CREATE" as const },
    args: {},
  };
}

// Helper to create a node with specific resolution
function createNode(
  id: string,
  resolution: Resolution,
  dependsOn: string[] = []
): IntentNode {
  return {
    id: createNodeId(id),
    ir: createIR(),
    resolution,
    dependsOn: dependsOn.map(createNodeId),
  };
}

describe("R-INV Conformance", () => {
  describe("R-INV-1: Resolved status implies missing is absent or empty", () => {
    it("passes when Resolved has no missing field", () => {
      const graph: IntentGraph = {
        nodes: [
          createNode("n1", {
            status: "Resolved",
            ambiguityScore: 0,
            // missing is absent
          }),
        ],
      };

      const result = validateGraph(graph);
      expect(result.valid).toBe(true);
    });

    it("passes when Resolved has empty missing array", () => {
      const graph: IntentGraph = {
        nodes: [
          createNode("n1", {
            status: "Resolved",
            ambiguityScore: 0,
            missing: [], // Empty array is OK
          }),
        ],
      };

      const result = validateGraph(graph);
      expect(result.valid).toBe(true);
    });

    it("fails when Resolved has non-empty missing array", () => {
      const graph: IntentGraph = {
        nodes: [
          createNode("n1", {
            status: "Resolved",
            ambiguityScore: 0,
            missing: ["TARGET"], // Violates R-INV-1
          }),
        ],
      };

      const result = validateGraph(graph);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error.code).toBe("INVALID_RESOLUTION");
        expect(result.error.message).toContain("R-INV-1");
      }
    });
  });

  describe("R-INV-2: Non-empty missing implies not Resolved", () => {
    it("passes when Ambiguous has missing roles", () => {
      const graph: IntentGraph = {
        nodes: [
          createNode("n1", {
            status: "Ambiguous",
            ambiguityScore: 0.5,
            missing: ["TARGET", "THEME"],
          }),
        ],
      };

      const result = validateGraph(graph);
      expect(result.valid).toBe(true);
    });

    it("passes when Abstract has missing roles", () => {
      const graph: IntentGraph = {
        nodes: [
          createNode("n1", {
            status: "Abstract",
            ambiguityScore: 1.0,
            missing: ["TARGET"],
          }),
        ],
      };

      const result = validateGraph(graph);
      expect(result.valid).toBe(true);
    });

    it("passes when Ambiguous has no missing roles", () => {
      const graph: IntentGraph = {
        nodes: [
          createNode("n1", {
            status: "Ambiguous",
            ambiguityScore: 0.3,
            // Can be ambiguous without missing roles (e.g., vague semantics)
          }),
        ],
      };

      const result = validateGraph(graph);
      expect(result.valid).toBe(true);
    });
  });

  describe("Resolution with questions", () => {
    it("passes when Ambiguous has clarifying questions", () => {
      const graph: IntentGraph = {
        nodes: [
          createNode("n1", {
            status: "Ambiguous",
            ambiguityScore: 0.5,
            missing: ["TARGET"],
            questions: ["What should be created?", "What is the target entity?"],
          }),
        ],
      };

      const result = validateGraph(graph);
      expect(result.valid).toBe(true);
    });

    it("passes when Resolved has no questions", () => {
      const graph: IntentGraph = {
        nodes: [
          createNode("n1", {
            status: "Resolved",
            ambiguityScore: 0,
            // No questions needed for resolved
          }),
        ],
      };

      const result = validateGraph(graph);
      expect(result.valid).toBe(true);
    });
  });

  describe("AmbiguityScore consistency", () => {
    it("allows Resolved with ambiguityScore 0", () => {
      const graph: IntentGraph = {
        nodes: [
          createNode("n1", {
            status: "Resolved",
            ambiguityScore: 0,
          }),
        ],
      };

      const result = validateGraph(graph);
      expect(result.valid).toBe(true);
    });

    it("allows Ambiguous with ambiguityScore > 0", () => {
      const graph: IntentGraph = {
        nodes: [
          createNode("n1", {
            status: "Ambiguous",
            ambiguityScore: 0.7,
          }),
        ],
      };

      const result = validateGraph(graph);
      expect(result.valid).toBe(true);
    });

    it("allows Abstract with ambiguityScore 1.0", () => {
      const graph: IntentGraph = {
        nodes: [
          createNode("n1", {
            status: "Abstract",
            ambiguityScore: 1.0,
          }),
        ],
      };

      const result = validateGraph(graph);
      expect(result.valid).toBe(true);
    });
  });

  describe("V-3: assertValidGraph throws for R-INV violations", () => {
    it("throws ValidationException for R-INV-1 violation", () => {
      const graph: IntentGraph = {
        nodes: [
          createNode("n1", {
            status: "Resolved",
            ambiguityScore: 0,
            missing: ["TARGET"], // Violates R-INV-1
          }),
        ],
      };

      expect(() => assertValidGraph(graph)).toThrow(ValidationException);
    });
  });
});
