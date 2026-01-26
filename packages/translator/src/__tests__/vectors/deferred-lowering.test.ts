/**
 * @fileoverview Deferred Lowering Test Vectors (SPEC §15.4)
 *
 * Tests for deferred resolution:
 * - Discourse refs (that/this/last) cause status = "deferred"
 * - After resolver update, successful lowering is possible
 */

import { describe, it, expect } from "vitest";
import { emitForManifesto, createNodeId, type IntentGraph, type EmitContext } from "../../index.js";
import type { Lexicon, IntentIR, ResolvedIntentIR } from "@manifesto-ai/intent-ir";

// =============================================================================
// Test Fixtures
// =============================================================================

/**
 * Create a test Lexicon.
 */
function createTestLexicon(): Lexicon {
  return {
    resolveEvent(lemma: string) {
      return {
        lemma,
        eventClass: lemma === "CREATE" ? "CREATE" : "TRANSFORM",
        thetaFrame: {
          required: ["THEME"],
          optional: [],
          restrictions: {},
        },
      };
    },
    resolveEntity(entityType: string) {
      return { fields: {} };
    },
    resolveActionType(lemma: string): string | undefined {
      return `domain.${lemma.toLowerCase()}`;
    },
    mapArgsToInput(args: any): Record<string, unknown> | undefined {
      return Object.keys(args).length > 0 ? args : undefined;
    },
  } as Lexicon;
}

/**
 * Create a resolver that defers discourse refs.
 */
function createDeferringResolver(deferredLemmas?: string[]): EmitContext["resolver"] {
  const deferred = new Set(deferredLemmas ?? []);

  return {
    resolveReferences(ir: IntentIR) {
      // Check for discourse refs in args
      const hasDiscourseRef = Object.values(ir.args).some((term) => {
        if (term.kind === "entity" && "ref" in term && term.ref) {
          const ref = term.ref as { kind: string };
          return ref.kind === "that" || ref.kind === "this" || ref.kind === "last";
        }
        return false;
      });

      if (hasDiscourseRef || deferred.has(ir.event.lemma)) {
        return {
          deferred: true,
          reason: "Discourse reference requires runtime resolution",
        };
      }

      return ir as ResolvedIntentIR;
    },
  };
}

/**
 * Create a resolver that always resolves successfully.
 */
function createResolvingResolver(): EmitContext["resolver"] {
  return {
    resolveReferences(ir: IntentIR) {
      return ir as ResolvedIntentIR;
    },
  };
}

// =============================================================================
// Deferred Resolution
// =============================================================================

describe("Deferred resolution", () => {
  it("produces status='deferred' for 'that' discourse ref", () => {
    const graph: IntentGraph = {
      nodes: [
        {
          id: createNodeId("n1"),
          ir: {
            v: "0.1",
            force: "DO",
            event: { lemma: "UPDATE", class: "TRANSFORM" },
            args: {
              TARGET: {
                kind: "entity",
                entityType: "Task",
                ref: { kind: "that" }, // Discourse ref
              },
            },
          },
          dependsOn: [],
          resolution: { status: "Resolved", ambiguityScore: 0.2 },
        },
      ],
    };

    const ctx: EmitContext = {
      lexicon: createTestLexicon(),
      resolver: createDeferringResolver(),
      schemaHash: "test-hash",
    };

    const bundle = emitForManifesto(graph, ctx);

    expect(bundle.invocationPlan.steps).toHaveLength(1);
    expect(bundle.invocationPlan.steps[0].lowering.status).toBe("deferred");
    expect(bundle.meta.deferredCount).toBe(1);
  });

  it("produces status='deferred' for 'this' discourse ref", () => {
    const graph: IntentGraph = {
      nodes: [
        {
          id: createNodeId("n1"),
          ir: {
            v: "0.1",
            force: "DO",
            event: { lemma: "DELETE", class: "CONTROL" },
            args: {
              TARGET: {
                kind: "entity",
                entityType: "Document",
                ref: { kind: "this" }, // Discourse ref
              },
            },
          },
          dependsOn: [],
          resolution: { status: "Resolved", ambiguityScore: 0.1 },
        },
      ],
    };

    const ctx: EmitContext = {
      lexicon: createTestLexicon(),
      resolver: createDeferringResolver(),
      schemaHash: "test-hash",
    };

    const bundle = emitForManifesto(graph, ctx);

    expect(bundle.invocationPlan.steps[0].lowering.status).toBe("deferred");
  });

  it("produces status='deferred' for 'last' discourse ref", () => {
    const graph: IntentGraph = {
      nodes: [
        {
          id: createNodeId("n1"),
          ir: {
            v: "0.1",
            force: "DO",
            event: { lemma: "COMPLETE", class: "CONTROL" },
            args: {
              TARGET: {
                kind: "entity",
                entityType: "Task",
                ref: { kind: "last" }, // Discourse ref
              },
            },
          },
          dependsOn: [],
          resolution: { status: "Resolved", ambiguityScore: 0.15 },
        },
      ],
    };

    const ctx: EmitContext = {
      lexicon: createTestLexicon(),
      resolver: createDeferringResolver(),
      schemaHash: "test-hash",
    };

    const bundle = emitForManifesto(graph, ctx);

    expect(bundle.invocationPlan.steps[0].lowering.status).toBe("deferred");
  });

  it("includes reason in deferred lowering", () => {
    const graph: IntentGraph = {
      nodes: [
        {
          id: createNodeId("n1"),
          ir: {
            v: "0.1",
            force: "DO",
            event: { lemma: "UPDATE", class: "TRANSFORM" },
            args: {
              TARGET: {
                kind: "entity",
                entityType: "Task",
                ref: { kind: "that" },
              },
            },
          },
          dependsOn: [],
          resolution: { status: "Resolved", ambiguityScore: 0 },
        },
      ],
    };

    const ctx: EmitContext = {
      lexicon: createTestLexicon(),
      resolver: createDeferringResolver(),
      schemaHash: "test-hash",
    };

    const bundle = emitForManifesto(graph, ctx);
    const step = bundle.invocationPlan.steps[0];

    expect(step.lowering.status).toBe("deferred");
    if (step.lowering.status === "deferred") {
      expect(step.lowering.reason).toContain("runtime");
    }
  });

  it("does not generate MelCandidate for deferred lowering", () => {
    const graph: IntentGraph = {
      nodes: [
        {
          id: createNodeId("n1"),
          ir: {
            v: "0.1",
            force: "DO",
            event: { lemma: "UPDATE", class: "TRANSFORM" },
            args: {
              TARGET: {
                kind: "entity",
                entityType: "Task",
                ref: { kind: "that" },
              },
            },
          },
          dependsOn: [],
          resolution: { status: "Resolved", ambiguityScore: 0 },
        },
      ],
    };

    const ctx: EmitContext = {
      lexicon: createTestLexicon(),
      resolver: createDeferringResolver(),
      schemaHash: "test-hash",
    };

    const bundle = emitForManifesto(graph, ctx);

    expect(bundle.melCandidates).toHaveLength(0);
  });
});

// =============================================================================
// Successful Lowering After Resolution
// =============================================================================

describe("Successful lowering after resolution", () => {
  it("produces status='ready' when resolver succeeds", () => {
    const graph: IntentGraph = {
      nodes: [
        {
          id: createNodeId("n1"),
          ir: {
            v: "0.1",
            force: "DO",
            event: { lemma: "UPDATE", class: "TRANSFORM" },
            args: {
              TARGET: {
                kind: "entity",
                entityType: "Task",
                ref: { kind: "that" }, // Still has discourse ref
              },
            },
          },
          dependsOn: [],
          resolution: { status: "Resolved", ambiguityScore: 0 },
        },
      ],
    };

    // Use a resolver that resolves successfully
    const ctx: EmitContext = {
      lexicon: createTestLexicon(),
      resolver: createResolvingResolver(), // Always resolves
      schemaHash: "test-hash",
    };

    const bundle = emitForManifesto(graph, ctx);

    expect(bundle.invocationPlan.steps[0].lowering.status).toBe("ready");
    expect(bundle.meta.deferredCount).toBe(0);
  });

  it("same graph produces 'deferred' or 'ready' depending on resolver state", () => {
    const graph: IntentGraph = {
      nodes: [
        {
          id: createNodeId("n1"),
          ir: {
            v: "0.1",
            force: "DO",
            event: { lemma: "UPDATE", class: "TRANSFORM" },
            args: {
              TARGET: {
                kind: "entity",
                entityType: "Task",
                ref: { kind: "that" },
              },
            },
          },
          dependsOn: [],
          resolution: { status: "Resolved", ambiguityScore: 0 },
        },
      ],
    };

    // First emission with deferring resolver
    const ctx1: EmitContext = {
      lexicon: createTestLexicon(),
      resolver: createDeferringResolver(),
      schemaHash: "test-hash",
    };
    const bundle1 = emitForManifesto(graph, ctx1);
    expect(bundle1.invocationPlan.steps[0].lowering.status).toBe("deferred");

    // Second emission with resolving resolver
    const ctx2: EmitContext = {
      lexicon: createTestLexicon(),
      resolver: createResolvingResolver(),
      schemaHash: "test-hash",
    };
    const bundle2 = emitForManifesto(graph, ctx2);
    expect(bundle2.invocationPlan.steps[0].lowering.status).toBe("ready");
  });
});

// =============================================================================
// Mixed Deferred and Ready
// =============================================================================

describe("Mixed deferred and ready nodes", () => {
  it("handles graph with both deferred and ready nodes", () => {
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
            event: { lemma: "UPDATE", class: "TRANSFORM" },
            args: {
              TARGET: {
                kind: "entity",
                entityType: "Task",
                ref: { kind: "that" }, // Deferred
              },
            },
          },
          dependsOn: [createNodeId("n1")],
          resolution: { status: "Resolved", ambiguityScore: 0.1 },
        },
      ],
    };

    const ctx: EmitContext = {
      lexicon: createTestLexicon(),
      resolver: createDeferringResolver(),
      schemaHash: "test-hash",
    };

    const bundle = emitForManifesto(graph, ctx);

    expect(bundle.invocationPlan.steps).toHaveLength(2);
    expect(bundle.invocationPlan.steps[0].lowering.status).toBe("ready");
    expect(bundle.invocationPlan.steps[1].lowering.status).toBe("deferred");
    expect(bundle.meta.deferredCount).toBe(1);
  });
});

// =============================================================================
// Original IR Preserved
// =============================================================================

describe("Original IR preservation", () => {
  it("step includes original IR even when deferred", () => {
    const originalIR = {
      v: "0.1" as const,
      force: "DO" as const,
      event: { lemma: "UPDATE", class: "TRANSFORM" as const },
      args: {
        TARGET: {
          kind: "entity" as const,
          entityType: "Task",
          ref: { kind: "that" as const },
        },
      },
    };

    const graph: IntentGraph = {
      nodes: [
        {
          id: createNodeId("n1"),
          ir: originalIR,
          dependsOn: [],
          resolution: { status: "Resolved", ambiguityScore: 0 },
        },
      ],
    };

    const ctx: EmitContext = {
      lexicon: createTestLexicon(),
      resolver: createDeferringResolver(),
      schemaHash: "test-hash",
    };

    const bundle = emitForManifesto(graph, ctx);
    const step = bundle.invocationPlan.steps[0];

    // IR should be preserved for re-lowering
    expect(step.ir.event.lemma).toBe("UPDATE");
    expect(step.ir.args.TARGET).toBeDefined();
  });
});
