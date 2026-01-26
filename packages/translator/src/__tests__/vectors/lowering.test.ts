/**
 * @fileoverview Lowering Test Vectors (SPEC §15.4)
 *
 * Tests for lowering semantics:
 * - Successful lowering: status = "ready", intentBody present
 * - Failed lowering: status = "failed", MelCandidate generated
 * - Abstract nodes: Skipped (not in InvocationPlan)
 */

import { describe, it, expect } from "vitest";
import { emitForManifesto, createNodeId, type IntentGraph, type EmitContext } from "../../index.js";
import type { Lexicon, IntentBody, ResolvedIntentIR } from "@manifesto-ai/intent-ir";

// =============================================================================
// Test Fixtures
// =============================================================================

/**
 * Create a test Lexicon that supports CREATE and UPDATE actions.
 */
function createTestLexicon(config?: {
  supportedLemmas?: string[];
}): Lexicon {
  const supportedLemmas = config?.supportedLemmas ?? ["CREATE", "UPDATE"];

  return {
    resolveEvent(lemma: string) {
      if (supportedLemmas.includes(lemma)) {
        return {
          lemma,
          eventClass: lemma === "CREATE" ? "CREATE" : "TRANSFORM",
          thetaFrame: {
            required: ["THEME"],
            optional: [],
            restrictions: {},
          },
        };
      }
      return undefined;
    },
    resolveEntity(entityType: string) {
      return { fields: {} };
    },
    resolveActionType(lemma: string): string | undefined {
      if (supportedLemmas.includes(lemma)) {
        return `domain.${lemma.toLowerCase()}`;
      }
      return undefined;
    },
    mapArgsToInput(args: any): Record<string, unknown> | undefined {
      return Object.keys(args).length > 0 ? args : undefined;
    },
  } as Lexicon;
}

/**
 * Create a test Resolver that always resolves successfully.
 */
function createTestResolver(): EmitContext["resolver"] {
  return {
    resolveReferences(ir) {
      // Just return the IR as resolved (no discourse refs)
      return ir as ResolvedIntentIR;
    },
  };
}

// =============================================================================
// Successful Lowering
// =============================================================================

describe("Successful lowering", () => {
  it("produces status='ready' when action exists in Lexicon", () => {
    const graph: IntentGraph = {
      nodes: [
        {
          id: createNodeId("n1"),
          ir: {
            v: "0.1",
            force: "DO",
            event: { lemma: "CREATE", class: "CREATE" },
            args: {
              THEME: { kind: "entity", entityType: "Project" },
            },
          },
          dependsOn: [],
          resolution: { status: "Resolved", ambiguityScore: 0 },
        },
      ],
      meta: {
        sourceText: "Create a project",
        translatedAt: new Date().toISOString(),
      },
    };

    const ctx: EmitContext = {
      lexicon: createTestLexicon(),
      resolver: createTestResolver(),
      schemaHash: "test-hash",
    };

    const bundle = emitForManifesto(graph, ctx);

    expect(bundle.invocationPlan.steps).toHaveLength(1);
    expect(bundle.invocationPlan.steps[0].lowering.status).toBe("ready");
    expect(bundle.invocationPlan.steps[0].lowering).toHaveProperty("intentBody");
    expect(bundle.melCandidates).toHaveLength(0);
  });

  it("includes intentBody with correct action type", () => {
    const graph: IntentGraph = {
      nodes: [
        {
          id: createNodeId("n1"),
          ir: {
            v: "0.1",
            force: "DO",
            event: { lemma: "CREATE", class: "CREATE" },
            args: {
              THEME: { kind: "entity", entityType: "Task" },
            },
          },
          dependsOn: [],
          resolution: { status: "Resolved", ambiguityScore: 0 },
        },
      ],
    };

    const ctx: EmitContext = {
      lexicon: createTestLexicon(),
      resolver: createTestResolver(),
      schemaHash: "test-hash",
    };

    const bundle = emitForManifesto(graph, ctx);
    const step = bundle.invocationPlan.steps[0];

    expect(step.lowering.status).toBe("ready");
    if (step.lowering.status === "ready") {
      expect(step.lowering.intentBody.type).toBe("domain.create");
    }
  });

  it("includes resolvedIR in lowering result", () => {
    const graph: IntentGraph = {
      nodes: [
        {
          id: createNodeId("n1"),
          ir: {
            v: "0.1",
            force: "DO",
            event: { lemma: "UPDATE", class: "TRANSFORM" },
            args: {
              THEME: { kind: "value", valueType: "string", shape: {}, raw: "new value" },
            },
          },
          dependsOn: [],
          resolution: { status: "Resolved", ambiguityScore: 0.1 },
        },
      ],
    };

    const ctx: EmitContext = {
      lexicon: createTestLexicon(),
      resolver: createTestResolver(),
      schemaHash: "test-hash",
    };

    const bundle = emitForManifesto(graph, ctx);
    const step = bundle.invocationPlan.steps[0];

    expect(step.lowering.status).toBe("ready");
    if (step.lowering.status === "ready") {
      expect(step.lowering.resolvedIR).toBeDefined();
    }
  });
});

// =============================================================================
// Failed Lowering
// =============================================================================

describe("Failed lowering", () => {
  it("produces status='failed' when action not in Lexicon", () => {
    const graph: IntentGraph = {
      nodes: [
        {
          id: createNodeId("n1"),
          ir: {
            v: "0.1",
            force: "DO",
            event: { lemma: "UNKNOWN_ACTION", class: "CONTROL" },
            args: {},
          },
          dependsOn: [],
          resolution: { status: "Resolved", ambiguityScore: 0 },
        },
      ],
    };

    const ctx: EmitContext = {
      lexicon: createTestLexicon(),
      resolver: createTestResolver(),
      schemaHash: "test-hash",
    };

    const bundle = emitForManifesto(graph, ctx);

    expect(bundle.invocationPlan.steps).toHaveLength(1);
    expect(bundle.invocationPlan.steps[0].lowering.status).toBe("failed");
  });

  it("generates MelCandidate for failed lowering", () => {
    const graph: IntentGraph = {
      nodes: [
        {
          id: createNodeId("n1"),
          ir: {
            v: "0.1",
            force: "DO",
            event: { lemma: "ARCHIVE", class: "CONTROL" },
            args: {
              TARGET: { kind: "entity", entityType: "Project" },
            },
          },
          dependsOn: [],
          resolution: { status: "Resolved", ambiguityScore: 0 },
        },
      ],
    };

    const ctx: EmitContext = {
      lexicon: createTestLexicon(),
      resolver: createTestResolver(),
      schemaHash: "test-hash",
    };

    const bundle = emitForManifesto(graph, ctx);

    expect(bundle.melCandidates).toHaveLength(1);
    expect(bundle.melCandidates[0].nodeId).toBe(createNodeId("n1"));
    expect(bundle.melCandidates[0].reason.kind).toBe("action_not_found");
    expect(bundle.melCandidates[0].suggestedMel).toContain("action archive");
  });

  it("MelCandidate includes failure reason", () => {
    const graph: IntentGraph = {
      nodes: [
        {
          id: createNodeId("n1"),
          ir: {
            v: "0.1",
            force: "DO",
            event: { lemma: "EXPORT", class: "OBSERVE" },
            args: {},
          },
          dependsOn: [],
          resolution: { status: "Resolved", ambiguityScore: 0 },
        },
      ],
    };

    const ctx: EmitContext = {
      lexicon: createTestLexicon(),
      resolver: createTestResolver(),
      schemaHash: "test-hash",
    };

    const bundle = emitForManifesto(graph, ctx);

    expect(bundle.melCandidates).toHaveLength(1);
    const candidate = bundle.melCandidates[0];
    expect(candidate.reason.kind).toBe("action_not_found");
    expect(candidate.reason.details).toContain("EXPORT");
  });
});

// =============================================================================
// Abstract Nodes
// =============================================================================

describe("Abstract nodes", () => {
  it("skips Abstract nodes in InvocationPlan", () => {
    const graph: IntentGraph = {
      nodes: [
        {
          id: createNodeId("n1"),
          ir: {
            v: "0.1",
            force: "DO",
            event: { lemma: "CREATE", class: "CREATE" },
            args: {
              THEME: { kind: "entity", entityType: "Task" },
            },
          },
          dependsOn: [],
          resolution: { status: "Resolved", ambiguityScore: 0 },
        },
        {
          id: createNodeId("n2"),
          ir: {
            v: "0.1",
            force: "DO",
            event: { lemma: "PROCESS", class: "CONTROL" },
            args: {},
          },
          dependsOn: [],
          resolution: { status: "Abstract", ambiguityScore: 1 }, // Abstract
        },
      ],
    };

    const ctx: EmitContext = {
      lexicon: createTestLexicon(),
      resolver: createTestResolver(),
      schemaHash: "test-hash",
    };

    const bundle = emitForManifesto(graph, ctx);

    // Only n1 should be in steps (n2 is Abstract)
    expect(bundle.invocationPlan.steps).toHaveLength(1);
    expect(bundle.invocationPlan.steps[0].nodeId).toBe(createNodeId("n1"));
    expect(bundle.meta.abstractCount).toBe(1);
  });

  it("does not generate MelCandidate for Abstract nodes", () => {
    const graph: IntentGraph = {
      nodes: [
        {
          id: createNodeId("n1"),
          ir: {
            v: "0.1",
            force: "DO",
            event: { lemma: "UNKNOWN", class: "CONTROL" },
            args: {},
          },
          dependsOn: [],
          resolution: { status: "Abstract", ambiguityScore: 1 },
        },
      ],
    };

    const ctx: EmitContext = {
      lexicon: createTestLexicon(),
      resolver: createTestResolver(),
      schemaHash: "test-hash",
    };

    const bundle = emitForManifesto(graph, ctx);

    expect(bundle.invocationPlan.steps).toHaveLength(0);
    expect(bundle.melCandidates).toHaveLength(0);
  });
});

// =============================================================================
// Ambiguous Nodes
// =============================================================================

describe("Ambiguous nodes", () => {
  it("includes Ambiguous nodes in InvocationPlan", () => {
    const graph: IntentGraph = {
      nodes: [
        {
          id: createNodeId("n1"),
          ir: {
            v: "0.1",
            force: "DO",
            event: { lemma: "CREATE", class: "CREATE" },
            args: {
              THEME: { kind: "entity", entityType: "Task" },
            },
          },
          dependsOn: [],
          resolution: {
            status: "Ambiguous",
            ambiguityScore: 0.5,
            questions: ["Which project should this task belong to?"],
          },
        },
      ],
    };

    const ctx: EmitContext = {
      lexicon: createTestLexicon(),
      resolver: createTestResolver(),
      schemaHash: "test-hash",
    };

    const bundle = emitForManifesto(graph, ctx);

    expect(bundle.invocationPlan.steps).toHaveLength(1);
    expect(bundle.invocationPlan.steps[0].resolution.status).toBe("Ambiguous");
    expect(bundle.meta.ambiguousCount).toBe(1);
  });
});

// =============================================================================
// Topological Ordering
// =============================================================================

describe("Topological ordering", () => {
  it("steps are in dependency order", () => {
    const graph: IntentGraph = {
      nodes: [
        {
          id: createNodeId("n3"),
          ir: {
            v: "0.1",
            force: "DO",
            event: { lemma: "UPDATE", class: "TRANSFORM" },
            args: { THEME: { kind: "value", valueType: "string", shape: {}, raw: "x" } },
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
            args: { THEME: { kind: "entity", entityType: "Task" } },
          },
          dependsOn: [],
          resolution: { status: "Resolved", ambiguityScore: 0 },
        },
        {
          id: createNodeId("n2"),
          ir: {
            v: "0.1",
            force: "DO",
            event: { lemma: "CREATE", class: "CREATE" },
            args: { THEME: { kind: "entity", entityType: "Project" } },
          },
          dependsOn: [createNodeId("n1")],
          resolution: { status: "Resolved", ambiguityScore: 0 },
        },
      ],
    };

    const ctx: EmitContext = {
      lexicon: createTestLexicon(),
      resolver: createTestResolver(),
      schemaHash: "test-hash",
    };

    const bundle = emitForManifesto(graph, ctx);
    const stepIds = bundle.invocationPlan.steps.map((s) => s.nodeId);

    // n1 must come before n2 and n3
    expect(stepIds.indexOf(createNodeId("n1"))).toBeLessThan(
      stepIds.indexOf(createNodeId("n2"))
    );
    expect(stepIds.indexOf(createNodeId("n1"))).toBeLessThan(
      stepIds.indexOf(createNodeId("n3"))
    );
    // n2 must come before n3
    expect(stepIds.indexOf(createNodeId("n2"))).toBeLessThan(
      stepIds.indexOf(createNodeId("n3"))
    );
  });
});

// =============================================================================
// Bundle Metadata
// =============================================================================

describe("Bundle metadata", () => {
  it("includes correct counts", () => {
    const graph: IntentGraph = {
      nodes: [
        {
          id: createNodeId("n1"),
          ir: {
            v: "0.1",
            force: "DO",
            event: { lemma: "CREATE", class: "CREATE" },
            args: { THEME: { kind: "entity", entityType: "Task" } },
          },
          dependsOn: [],
          resolution: { status: "Resolved", ambiguityScore: 0 },
        },
        {
          id: createNodeId("n2"),
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
          id: createNodeId("n3"),
          ir: {
            v: "0.1",
            force: "DO",
            event: { lemma: "PROCESS", class: "CONTROL" },
            args: {},
          },
          dependsOn: [],
          resolution: { status: "Abstract", ambiguityScore: 1 },
        },
      ],
      meta: {
        sourceText: "Test input",
        translatedAt: "2024-01-01T00:00:00Z",
      },
    };

    const ctx: EmitContext = {
      lexicon: createTestLexicon(),
      resolver: createTestResolver(),
      schemaHash: "test-hash",
    };

    const bundle = emitForManifesto(graph, ctx);

    expect(bundle.meta.graphNodeCount).toBe(3);
    expect(bundle.meta.resolvedCount).toBe(1);
    expect(bundle.meta.ambiguousCount).toBe(1);
    expect(bundle.meta.abstractCount).toBe(1);
    expect(bundle.meta.sourceText).toBe("Test input");
  });
});
