/**
 * @fileoverview Lexicon Validation Test Vectors (SPEC §15.4)
 *
 * Tests for Feature Checking (Intent IR v0.1 §14):
 * - EVENT_NOT_FOUND: Unknown lemma
 * - CLASS_MISMATCH: Event class doesn't match
 * - COMPLETENESS_VIOLATION: Missing required roles for Resolved node
 * - TYPE_MISMATCH: Wrong term kind or entity type
 */

import { describe, it, expect } from "vitest";
import { validate, createNodeId, type IntentGraph, type IntentNode } from "../../index.js";
import type { Lexicon, EventEntry, ThetaFrame, Role, EntitySpec } from "@manifesto-ai/intent-ir";

// =============================================================================
// Test Lexicon Factory
// =============================================================================

/**
 * Create a minimal test Lexicon.
 */
function createTestLexicon(): Lexicon {
  const events: Record<string, EventEntry> = {
    CREATE: {
      eventClass: "CREATE",
      thetaFrame: {
        required: ["THEME"] as Role[],
        optional: ["BENEFICIARY"] as Role[],
        restrictions: {
          THEME: {
            termKinds: ["entity"],
            entityTypes: ["Project", "Task", "Document"],
          },
          BENEFICIARY: {
            termKinds: ["entity"],
            entityTypes: ["User"],
          },
        },
      },
    },
    UPDATE: {
      eventClass: "TRANSFORM",
      thetaFrame: {
        required: ["TARGET"] as Role[],
        optional: ["THEME"] as Role[],
        restrictions: {
          TARGET: {
            termKinds: ["entity"],
            entityTypes: ["Task", "Project"],
          },
          THEME: {
            termKinds: ["value"],
            valueTypes: ["string", "number"],
          },
        },
      },
    },
    DELETE: {
      eventClass: "CONTROL",
      thetaFrame: {
        required: ["TARGET"] as Role[],
        optional: [],
        restrictions: {
          TARGET: {
            termKinds: ["entity", "path"],
            entityTypes: ["Task", "Project", "Document"],
          },
        },
      },
    },
  };

  const entities: Record<string, EntitySpec> = {
    Task: { fields: {} },
    Project: { fields: {} },
    Document: { fields: {} },
    User: { fields: {} },
  };

  return {
    resolveEvent(lemma: string): EventEntry | undefined {
      return events[lemma];
    },
    resolveEntity(entityType: string): EntitySpec | undefined {
      return entities[entityType];
    },
    resolveActionType(lemma: string): string | undefined {
      return events[lemma] ? `domain.${lemma.toLowerCase()}` : undefined;
    },
    mapArgsToInput(args: unknown): unknown {
      return args;
    },
  };
}

// =============================================================================
// EVENT_NOT_FOUND
// =============================================================================

describe("EVENT_NOT_FOUND: Unknown lemma", () => {
  it("fails when lemma is not in Lexicon", () => {
    const node: IntentNode = {
      id: createNodeId("n1"),
      ir: {
        v: "0.1",
        force: "DO",
        event: { lemma: "UNKNOWN_ACTION", class: "CONTROL" },
        args: {},
      },
      dependsOn: [],
      resolution: { status: "Resolved", ambiguityScore: 0 },
    };

    const graph: IntentGraph = { nodes: [node] };
    const result = validate(graph, { lexicon: createTestLexicon() });

    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.error).toBe("EVENT_NOT_FOUND");
      expect(result.nodeId).toBe("n1");
    }
  });

  it("passes when lemma exists in Lexicon", () => {
    const node: IntentNode = {
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
    };

    const graph: IntentGraph = { nodes: [node] };
    const result = validate(graph, { lexicon: createTestLexicon() });

    expect(result.valid).toBe(true);
  });
});

// =============================================================================
// CLASS_MISMATCH
// =============================================================================

describe("CLASS_MISMATCH: Event class doesn't match", () => {
  it("fails when IR event class differs from Lexicon", () => {
    const node: IntentNode = {
      id: createNodeId("n1"),
      ir: {
        v: "0.1",
        force: "DO",
        event: { lemma: "CREATE", class: "TRANSFORM" }, // Should be "CREATE"
        args: {
          THEME: { kind: "entity", entityType: "Project" },
        },
      },
      dependsOn: [],
      resolution: { status: "Resolved", ambiguityScore: 0 },
    };

    const graph: IntentGraph = { nodes: [node] };
    const result = validate(graph, { lexicon: createTestLexicon() });

    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.error).toBe("CLASS_MISMATCH");
      expect(result.nodeId).toBe("n1");
    }
  });

  it("passes when IR event class matches Lexicon", () => {
    const node: IntentNode = {
      id: createNodeId("n1"),
      ir: {
        v: "0.1",
        force: "DO",
        event: { lemma: "UPDATE", class: "TRANSFORM" },
        args: {
          TARGET: { kind: "entity", entityType: "Task" },
        },
      },
      dependsOn: [],
      resolution: { status: "Resolved", ambiguityScore: 0 },
    };

    const graph: IntentGraph = { nodes: [node] };
    const result = validate(graph, { lexicon: createTestLexicon() });

    expect(result.valid).toBe(true);
  });
});

// =============================================================================
// COMPLETENESS_VIOLATION
// =============================================================================

describe("COMPLETENESS_VIOLATION: Missing required roles", () => {
  it("fails when Resolved node is missing required role", () => {
    const node: IntentNode = {
      id: createNodeId("n1"),
      ir: {
        v: "0.1",
        force: "DO",
        event: { lemma: "CREATE", class: "CREATE" },
        args: {}, // Missing THEME (required)
      },
      dependsOn: [],
      resolution: { status: "Resolved", ambiguityScore: 0 },
    };

    const graph: IntentGraph = { nodes: [node] };
    const result = validate(graph, { lexicon: createTestLexicon() });

    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.error).toBe("COMPLETENESS_VIOLATION");
      expect(result.nodeId).toBe("n1");
    }
  });

  it("passes when Ambiguous node is missing required role (but recorded)", () => {
    const node: IntentNode = {
      id: createNodeId("n1"),
      ir: {
        v: "0.1",
        force: "DO",
        event: { lemma: "CREATE", class: "CREATE" },
        args: {}, // Missing THEME
      },
      dependsOn: [],
      resolution: {
        status: "Ambiguous",
        ambiguityScore: 0.5,
        missing: ["THEME"], // Properly recorded
      },
    };

    const graph: IntentGraph = { nodes: [node] };
    const result = validate(graph, { lexicon: createTestLexicon() });

    expect(result.valid).toBe(true);
  });

  it("fails when recorded missing roles don't match actual missing roles", () => {
    const node: IntentNode = {
      id: createNodeId("n1"),
      ir: {
        v: "0.1",
        force: "DO",
        event: { lemma: "CREATE", class: "CREATE" },
        args: {}, // Missing THEME
      },
      dependsOn: [],
      resolution: {
        status: "Ambiguous",
        ambiguityScore: 0.5,
        missing: ["TARGET"], // Recorded wrong role
      },
    };

    const graph: IntentGraph = { nodes: [node] };
    const result = validate(graph, { lexicon: createTestLexicon() });

    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.error).toBe("MISSING_MISMATCH");
    }
  });
});

// =============================================================================
// TYPE_MISMATCH
// =============================================================================

describe("TYPE_MISMATCH: Wrong term kind or entity type", () => {
  it("fails when term kind is not allowed for role", () => {
    const node: IntentNode = {
      id: createNodeId("n1"),
      ir: {
        v: "0.1",
        force: "DO",
        event: { lemma: "CREATE", class: "CREATE" },
        args: {
          THEME: { kind: "value", valueType: "string", shape: {}, raw: "test" }, // Should be "entity"
        },
      },
      dependsOn: [],
      resolution: { status: "Resolved", ambiguityScore: 0 },
    };

    const graph: IntentGraph = { nodes: [node] };
    const result = validate(graph, { lexicon: createTestLexicon() });

    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.error).toBe("TYPE_MISMATCH");
      expect(result.nodeId).toBe("n1");
      expect(result.details).toContain("term kind");
    }
  });

  it("fails when entity type is not in allowed list", () => {
    const node: IntentNode = {
      id: createNodeId("n1"),
      ir: {
        v: "0.1",
        force: "DO",
        event: { lemma: "CREATE", class: "CREATE" },
        args: {
          THEME: { kind: "entity", entityType: "UnknownType" }, // Not in allowed list
        },
      },
      dependsOn: [],
      resolution: { status: "Resolved", ambiguityScore: 0 },
    };

    const graph: IntentGraph = { nodes: [node] };
    const result = validate(graph, { lexicon: createTestLexicon() });

    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.error).toBe("TYPE_MISMATCH");
      expect(result.nodeId).toBe("n1");
      expect(result.details).toContain("entity type");
    }
  });

  it("passes when term kind and entity type are correct", () => {
    const node: IntentNode = {
      id: createNodeId("n1"),
      ir: {
        v: "0.1",
        force: "DO",
        event: { lemma: "CREATE", class: "CREATE" },
        args: {
          THEME: { kind: "entity", entityType: "Task" },
          BENEFICIARY: { kind: "entity", entityType: "User" },
        },
      },
      dependsOn: [],
      resolution: { status: "Resolved", ambiguityScore: 0 },
    };

    const graph: IntentGraph = { nodes: [node] };
    const result = validate(graph, { lexicon: createTestLexicon() });

    expect(result.valid).toBe(true);
  });

  it("allows path term when restrictions include path", () => {
    const node: IntentNode = {
      id: createNodeId("n1"),
      ir: {
        v: "0.1",
        force: "DO",
        event: { lemma: "DELETE", class: "CONTROL" },
        args: {
          TARGET: { kind: "path", path: "tasks" },
        },
      },
      dependsOn: [],
      resolution: { status: "Resolved", ambiguityScore: 0 },
    };

    const graph: IntentGraph = { nodes: [node] };
    const result = validate(graph, { lexicon: createTestLexicon() });

    expect(result.valid).toBe(true);
  });
});

// =============================================================================
// Multiple Nodes Validation
// =============================================================================

describe("Multi-node graph validation", () => {
  it("validates all nodes and reports first error", () => {
    const graph: IntentGraph = {
      nodes: [
        {
          id: createNodeId("n1"),
          ir: {
            v: "0.1",
            force: "DO",
            event: { lemma: "CREATE", class: "CREATE" },
            args: { THEME: { kind: "entity", entityType: "Project" } },
          },
          dependsOn: [],
          resolution: { status: "Resolved", ambiguityScore: 0 },
        },
        {
          id: createNodeId("n2"),
          ir: {
            v: "0.1",
            force: "DO",
            event: { lemma: "UNKNOWN", class: "CONTROL" }, // This one fails
            args: {},
          },
          dependsOn: [createNodeId("n1")],
          resolution: { status: "Resolved", ambiguityScore: 0 },
        },
      ],
    };

    const result = validate(graph, { lexicon: createTestLexicon() });

    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.error).toBe("EVENT_NOT_FOUND");
      expect(result.nodeId).toBe("n2");
    }
  });

  it("passes when all nodes are valid", () => {
    const graph: IntentGraph = {
      nodes: [
        {
          id: createNodeId("n1"),
          ir: {
            v: "0.1",
            force: "DO",
            event: { lemma: "CREATE", class: "CREATE" },
            args: { THEME: { kind: "entity", entityType: "Project" } },
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
            args: { TARGET: { kind: "entity", entityType: "Task" } },
          },
          dependsOn: [createNodeId("n1")],
          resolution: { status: "Resolved", ambiguityScore: 0 },
        },
      ],
    };

    const result = validate(graph, { lexicon: createTestLexicon() });

    expect(result.valid).toBe(true);
  });
});
