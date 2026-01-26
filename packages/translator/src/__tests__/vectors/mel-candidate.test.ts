/**
 * @fileoverview MelCandidate Test Vectors (SPEC §15.4)
 *
 * Tests for MEL generation:
 * - MelCandidate structure validation
 * - suggestedMel syntax check
 * - wouldEnable population
 */

import { describe, it, expect } from "vitest";
import {
  emitForManifesto,
  createNodeId,
  type IntentGraph,
  type EmitContext,
  type LoweringFailureReason,
} from "../../index.js";
import { generateMelCandidate } from "../../emit/mel-candidate.js";
import type { Lexicon, IntentIR, ResolvedIntentIR } from "@manifesto-ai/intent-ir";

// =============================================================================
// Test Fixtures
// =============================================================================

/**
 * Create a test Lexicon that only supports specific lemmas.
 */
function createTestLexicon(supportedLemmas: string[] = ["CREATE"]): Lexicon {
  const supported = new Set(supportedLemmas);

  return {
    resolveEvent(lemma: string) {
      if (supported.has(lemma)) {
        return {
          lemma,
          eventClass: "CREATE",
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
      if (supported.has(lemma)) {
        return `domain.${lemma.toLowerCase()}`;
      }
      return undefined;
    },
    mapArgsToInput(args: any) {
      return Object.keys(args).length > 0 ? args : undefined;
    },
  } as Lexicon;
}

/**
 * Create a test resolver.
 */
function createTestResolver(): EmitContext["resolver"] {
  return {
    resolveReferences(ir: IntentIR) {
      return ir as ResolvedIntentIR;
    },
  };
}

// =============================================================================
// MelCandidate Structure
// =============================================================================

describe("MelCandidate structure", () => {
  it("contains required fields: nodeId, ir, suggestedMel, reason", () => {
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
    const candidate = bundle.melCandidates[0];

    expect(candidate.nodeId).toBe(createNodeId("n1"));
    expect(candidate.ir).toBeDefined();
    expect(candidate.ir.event.lemma).toBe("ARCHIVE");
    expect(candidate.suggestedMel).toBeDefined();
    expect(typeof candidate.suggestedMel).toBe("string");
    expect(candidate.reason).toBeDefined();
    expect(candidate.reason.kind).toBe("action_not_found");
  });

  it("preserves original IR in candidate", () => {
    const originalIR = {
      v: "0.1" as const,
      force: "DO" as const,
      event: { lemma: "EXPORT", class: "OBSERVE" as const },
      args: {
        TARGET: { kind: "entity" as const, entityType: "Report" },
        DEST: { kind: "path" as const, path: "exports" },
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
      resolver: createTestResolver(),
      schemaHash: "test-hash",
    };

    const bundle = emitForManifesto(graph, ctx);
    const candidate = bundle.melCandidates[0];

    expect(candidate.ir.event.lemma).toBe("EXPORT");
    expect(candidate.ir.args.TARGET).toBeDefined();
    expect(candidate.ir.args.DEST).toBeDefined();
  });
});

// =============================================================================
// suggestedMel Syntax
// =============================================================================

describe("suggestedMel syntax", () => {
  it("generates valid action declaration", () => {
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
    const mel = bundle.melCandidates[0].suggestedMel;

    // Should start with "action <lemma>"
    expect(mel).toMatch(/^action archive/);
    // Should have argument list
    expect(mel).toContain("(");
    expect(mel).toContain(")");
    // Should have a body
    expect(mel).toContain("{");
    expect(mel).toContain("}");
  });

  it("includes arguments in action signature", () => {
    const graph: IntentGraph = {
      nodes: [
        {
          id: createNodeId("n1"),
          ir: {
            v: "0.1",
            force: "DO",
            event: { lemma: "TRANSFER", class: "TRANSFORM" },
            args: {
              SOURCE: { kind: "entity", entityType: "Account" },
              DEST: { kind: "entity", entityType: "Account" },
              THEME: { kind: "value", valueType: "number", shape: {}, raw: 100 },
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
    const mel = bundle.melCandidates[0].suggestedMel;

    // Should include argument declarations
    expect(mel).toContain("source:");
    expect(mel).toContain("dest:");
    expect(mel).toContain("theme:");
    expect(mel).toContain("Account");
    expect(mel).toContain("number");
  });

  it("generates body based on event class", () => {
    // OBSERVE class
    const observeGraph: IntentGraph = {
      nodes: [
        {
          id: createNodeId("n1"),
          ir: {
            v: "0.1",
            force: "DO",
            event: { lemma: "VIEW", class: "OBSERVE" },
            args: { TARGET: { kind: "entity", entityType: "Report" } },
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

    const bundle = emitForManifesto(observeGraph, ctx);
    const mel = bundle.melCandidates[0].suggestedMel;

    // OBSERVE should generate a read operation
    expect(mel).toContain("Read operation");
    expect(mel).toContain("get");
  });

  it("handles CREATE event class", () => {
    const graph: IntentGraph = {
      nodes: [
        {
          id: createNodeId("n1"),
          ir: {
            v: "0.1",
            force: "DO",
            event: { lemma: "BUILD", class: "CREATE" },
            args: { THEME: { kind: "entity", entityType: "Component" } },
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
    const mel = bundle.melCandidates[0].suggestedMel;

    expect(mel).toContain("Create operation");
    expect(mel).toContain("create");
  });
});

// =============================================================================
// wouldEnable Field
// =============================================================================

describe("wouldEnable field", () => {
  it("populates wouldEnable with dependent node IDs", () => {
    const graph: IntentGraph = {
      nodes: [
        {
          id: createNodeId("n1"),
          ir: {
            v: "0.1",
            force: "DO",
            event: { lemma: "CONNECT", class: "CONTROL" }, // Unknown action
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
            event: { lemma: "CREATE", class: "CREATE" }, // Known action
            args: { THEME: { kind: "entity", entityType: "Task" } },
          },
          dependsOn: [createNodeId("n1")], // Depends on n1
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

    // n2 depends on n1, so wouldEnable should include n2
    expect(candidate.wouldEnable).toBeDefined();
    expect(candidate.wouldEnable).toContain(createNodeId("n2"));
  });

  it("wouldEnable is undefined when no dependent nodes", () => {
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
          resolution: { status: "Resolved", ambiguityScore: 0 },
        },
        {
          id: createNodeId("n2"),
          ir: {
            v: "0.1",
            force: "DO",
            event: { lemma: "CREATE", class: "CREATE" },
            args: { THEME: { kind: "entity", entityType: "Task" } },
          },
          dependsOn: [], // No dependency on n1
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
    const candidate = bundle.melCandidates[0];

    expect(candidate.wouldEnable).toBeUndefined();
  });

  it("wouldEnable includes multiple dependent nodes", () => {
    const graph: IntentGraph = {
      nodes: [
        {
          id: createNodeId("n1"),
          ir: {
            v: "0.1",
            force: "DO",
            event: { lemma: "INITIALIZE", class: "CONTROL" }, // Unknown
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
            event: { lemma: "CREATE", class: "CREATE" },
            args: { THEME: { kind: "entity", entityType: "Task" } },
          },
          dependsOn: [createNodeId("n1")],
          resolution: { status: "Resolved", ambiguityScore: 0 },
        },
        {
          id: createNodeId("n3"),
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
    const candidate = bundle.melCandidates[0];

    expect(candidate.wouldEnable).toBeDefined();
    expect(candidate.wouldEnable).toContain(createNodeId("n2"));
    expect(candidate.wouldEnable).toContain(createNodeId("n3"));
    expect(candidate.wouldEnable?.length).toBe(2);
  });
});

// =============================================================================
// generateMelCandidate Unit Tests
// =============================================================================

describe("generateMelCandidate function", () => {
  it("creates candidate without graph (wouldEnable undefined)", () => {
    const ir: IntentIR = {
      v: "0.1",
      force: "DO",
      event: { lemma: "TEST", class: "CONTROL" },
      args: {},
    };

    const reason: LoweringFailureReason = {
      kind: "action_not_found",
      details: "TEST not found",
    };

    const candidate = generateMelCandidate(createNodeId("n1"), ir, reason);

    expect(candidate.nodeId).toBe(createNodeId("n1"));
    expect(candidate.ir).toBe(ir);
    expect(candidate.reason).toBe(reason);
    expect(candidate.wouldEnable).toBeUndefined();
  });

  it("creates candidate with graph (wouldEnable populated)", () => {
    const ir: IntentIR = {
      v: "0.1",
      force: "DO",
      event: { lemma: "TEST", class: "CONTROL" },
      args: {},
    };

    const reason: LoweringFailureReason = {
      kind: "action_not_found",
      details: "TEST not found",
    };

    const graph: IntentGraph = {
      nodes: [
        {
          id: createNodeId("n1"),
          ir,
          dependsOn: [],
          resolution: { status: "Resolved", ambiguityScore: 0 },
        },
        {
          id: createNodeId("n2"),
          ir: { ...ir, event: { lemma: "OTHER", class: "CONTROL" } },
          dependsOn: [createNodeId("n1")],
          resolution: { status: "Resolved", ambiguityScore: 0 },
        },
      ],
    };

    const candidate = generateMelCandidate(createNodeId("n1"), ir, reason, graph);

    expect(candidate.wouldEnable).toContain(createNodeId("n2"));
  });
});

// =============================================================================
// Multiple MelCandidates
// =============================================================================

describe("Multiple MelCandidates", () => {
  it("generates separate candidates for multiple failed nodes", () => {
    const graph: IntentGraph = {
      nodes: [
        {
          id: createNodeId("n1"),
          ir: {
            v: "0.1",
            force: "DO",
            event: { lemma: "UNKNOWN1", class: "CONTROL" },
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
            event: { lemma: "UNKNOWN2", class: "OBSERVE" },
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

    expect(bundle.melCandidates).toHaveLength(2);
    expect(bundle.melCandidates[0].ir.event.lemma).toBe("UNKNOWN1");
    expect(bundle.melCandidates[1].ir.event.lemma).toBe("UNKNOWN2");
  });
});
