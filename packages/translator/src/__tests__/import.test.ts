/**
 * @fileoverview Import Test
 *
 * Verify that all public exports are accessible.
 */

import { describe, it, expect } from "vitest";
import {
  // Version
  TRANSLATOR_VERSION,
  TRANSLATOR_SPEC_VERSION,
  // Public API
  translate,
  validate,
  emitForManifesto,
  // Types
  type IntentGraph,
  type IntentNode,
  type IntentNodeId,
  type Resolution,
  type ResolutionStatus,
  type LoweringStatus,
  type LoweringResult,
  type InvocationStep,
  type InvocationPlan,
  type ManifestoBundle,
  type MelCandidate,
  type TranslateOptions,
  type TranslateResult,
  type EmitContext,
  type ValidationResult,
  TranslatorError,
  // Invariants
  checkCausalIntegrity,
  hasCycle,
  checkReferentialIdentity,
  checkCompleteness,
  checkStatefulness,
  // Utilities
  validateStructural,
  topologicalSort,
  createNodeId,
} from "../index.js";

describe("@manifesto-ai/translator exports", () => {
  it("exports version constants", () => {
    expect(TRANSLATOR_VERSION).toBe("0.1.0");
    expect(TRANSLATOR_SPEC_VERSION).toBe("0.1");
  });

  it("exports public API functions", () => {
    expect(typeof translate).toBe("function");
    expect(typeof validate).toBe("function");
    expect(typeof emitForManifesto).toBe("function");
  });

  it("exports TranslatorError class", () => {
    const error = new TranslatorError("Test error", { code: "CYCLE_DETECTED" });
    expect(error.code).toBe("CYCLE_DETECTED");
    expect(error.message).toBe("Test error");
  });

  it("exports invariant check functions", () => {
    expect(typeof checkCausalIntegrity).toBe("function");
    expect(typeof hasCycle).toBe("function");
    expect(typeof checkReferentialIdentity).toBe("function");
    expect(typeof checkCompleteness).toBe("function");
    expect(typeof checkStatefulness).toBe("function");
  });

  it("exports validation utilities", () => {
    expect(typeof validateStructural).toBe("function");
    expect(typeof topologicalSort).toBe("function");
  });

  it("exports createNodeId helper", () => {
    const id = createNodeId("test-id");
    expect(id).toBe("test-id");
  });
});

describe("translate()", () => {
  it("returns empty graph in deterministic mode", async () => {
    const result = await translate("Create a project", { mode: "deterministic" });

    expect(result.graph.nodes).toHaveLength(0);
    expect(result.graph.meta?.sourceText).toBe("Create a project");
    expect(
      result.warnings.some((w: { code: string }) => w.code === "DETERMINISTIC_MODE")
    ).toBe(true);
  });

  it("throws CONFIGURATION_ERROR in llm mode without provider", async () => {
    // Default mode is "llm"
    await expect(translate("Create a project")).rejects.toThrow(TranslatorError);
    await expect(translate("Create a project")).rejects.toMatchObject({
      code: "CONFIGURATION_ERROR",
    });
  });
});

describe("invariant checks", () => {
  it("detects cycles", () => {
    const cyclicGraph: IntentGraph = {
      nodes: [
        {
          id: createNodeId("n1"),
          ir: {
            v: "0.1",
            force: "DO",
            event: { lemma: "CREATE", class: "CREATE" },
            args: {},
          },
          dependsOn: [createNodeId("n2")],
          resolution: { status: "Resolved", ambiguityScore: 0 },
        },
        {
          id: createNodeId("n2"),
          ir: {
            v: "0.1",
            force: "DO",
            event: { lemma: "CREATE", class: "CREATE" },
            args: {},
          },
          dependsOn: [createNodeId("n1")],
          resolution: { status: "Resolved", ambiguityScore: 0 },
        },
      ],
    };

    expect(hasCycle(cyclicGraph)).toBe(true);
  });

  it("passes for acyclic graph", () => {
    const acyclicGraph: IntentGraph = {
      nodes: [
        {
          id: createNodeId("n1"),
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
          id: createNodeId("n2"),
          ir: {
            v: "0.1",
            force: "DO",
            event: { lemma: "ADD", class: "TRANSFORM" },
            args: {},
          },
          dependsOn: [createNodeId("n1")],
          resolution: { status: "Resolved", ambiguityScore: 0 },
        },
      ],
    };

    expect(hasCycle(acyclicGraph)).toBe(false);
  });
});

describe("topologicalSort()", () => {
  it("sorts nodes in dependency order", () => {
    const graph: IntentGraph = {
      nodes: [
        {
          id: createNodeId("n3"),
          ir: {
            v: "0.1",
            force: "DO",
            event: { lemma: "FINISH", class: "CONTROL" },
            args: {},
          },
          dependsOn: [createNodeId("n1"), createNodeId("n2")],
          resolution: { status: "Resolved", ambiguityScore: 0 },
        },
        {
          id: createNodeId("n1"),
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
          id: createNodeId("n2"),
          ir: {
            v: "0.1",
            force: "DO",
            event: { lemma: "ADD", class: "TRANSFORM" },
            args: {},
          },
          dependsOn: [createNodeId("n1")],
          resolution: { status: "Resolved", ambiguityScore: 0 },
        },
      ],
    };

    const result = topologicalSort(graph);
    expect(result.ok).toBe(true);
    if (result.ok) {
      const ids = result.sorted.map((n) => n.id);
      // n1 must come before n2 and n3
      expect(ids.indexOf(createNodeId("n1"))).toBeLessThan(
        ids.indexOf(createNodeId("n2"))
      );
      expect(ids.indexOf(createNodeId("n1"))).toBeLessThan(
        ids.indexOf(createNodeId("n3"))
      );
      // n2 must come before n3
      expect(ids.indexOf(createNodeId("n2"))).toBeLessThan(
        ids.indexOf(createNodeId("n3"))
      );
    }
  });
});
