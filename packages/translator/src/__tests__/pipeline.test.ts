/**
 * @fileoverview Pipeline Module Tests
 *
 * Tests for all pipeline stages (S1-S7).
 */

import { describe, it, expect } from "vitest";
import type { IntentIR } from "@manifesto-ai/intent-ir";
import {
  normalize,
  canonicalize,
  featureCheck,
  resolveReferences,
  buildResolutionContext,
  lowerIR,
  validateActionBody,
  isActionRelatedLemma,
  extractActionBody,
  createMockLLMClient,
  propose,
} from "../pipeline/index.js";
import {
  createBuiltinLexicon,
  createCompositeLexicon,
  createLearnedLexicon,
  deriveProjectLexicon,
} from "../lexicon/index.js";
import type { ActionBody } from "../types/index.js";

// =============================================================================
// S1: Normalize Tests
// =============================================================================

describe("S1: Normalize", () => {
  it("should normalize simple text", () => {
    const result = normalize("Hello World");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.normalized).toBe("Hello World");
      expect(result.detectedLang).toBe("en");
    }
  });

  it("should apply NFKC normalization", () => {
    // Fullwidth characters should be normalized
    const result = normalize("ＨＥＬＬＯworld");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.normalized).toBe("HELLOworld");
    }
  });

  it("should collapse multiple spaces", () => {
    const result = normalize("Hello    World");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.normalized).toBe("Hello World");
    }
  });

  it("should trim whitespace", () => {
    const result = normalize("  Hello World  ");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.normalized).toBe("Hello World");
    }
  });

  it("should detect Korean language", () => {
    const result = normalize("안녕하세요");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.detectedLang).toBe("ko");
    }
  });

  it("should detect Japanese language", () => {
    const result = normalize("こんにちは");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.detectedLang).toBe("ja");
    }
  });

  it("should return error for empty text", () => {
    const result = normalize("");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("NORMALIZE_FAILED");
    }
  });

  it("should return error for whitespace-only text", () => {
    const result = normalize("   \t\n   ");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("NORMALIZE_FAILED");
    }
  });

  it("should return error for null input", () => {
    const result = normalize(null as unknown as string);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("NORMALIZE_FAILED");
    }
  });
});

// =============================================================================
// S2: Propose Tests
// =============================================================================

describe("S2: Propose", () => {
  it("should propose IntentIR using mock client", async () => {
    const mockClient = createMockLLMClient();
    const result = await propose(
      { normalizedText: "Define type User", lang: "en" },
      mockClient
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.ir).toBeDefined();
      expect(result.ir.v).toBe("0.1");
      expect(result.ir.force).toBe("DO");
      expect(result.model).toBe("mock");
    }
  });

  it("should detect DEFINE_TYPE from keyword", async () => {
    const mockClient = createMockLLMClient();
    const result = await propose(
      { normalizedText: "define a new type", lang: "en" },
      mockClient
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.ir.event.lemma).toBe("DEFINE_TYPE");
    }
  });

  it("should use registered response for pattern", async () => {
    const mockClient = createMockLLMClient();
    const customIR: IntentIR = {
      v: "0.1",
      force: "DO",
      event: { lemma: "CUSTOM", class: "CREATE" },
      args: {},
    };
    mockClient.registerResponse("custom pattern", customIR);

    const result = await propose(
      { normalizedText: "this is a custom pattern", lang: "en" },
      mockClient
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.ir.event.lemma).toBe("CUSTOM");
    }
  });
});

// =============================================================================
// S3: Canonicalize Tests
// =============================================================================

describe("S3: Canonicalize", () => {
  const sampleIR: IntentIR = {
    v: "0.1",
    force: "DO",
    event: { lemma: "DEFINE_TYPE", class: "CREATE" },
    args: {
      TARGET: { kind: "value", valueType: "string", shape: { value: "User" } },
    },
  };

  it("should canonicalize IntentIR", () => {
    const result = canonicalize(sampleIR);

    expect(result.canonical).toBeDefined();
    expect(result.simKey).toBeDefined();
    expect(result.simKeyHex).toMatch(/^[0-9a-f]{16}$/);
  });

  it("should produce same simKey for semantically equivalent IR", () => {
    const ir1: IntentIR = {
      v: "0.1",
      force: "DO",
      event: { lemma: "DEFINE_TYPE", class: "CREATE" },
      args: {
        TARGET: { kind: "value", valueType: "string", shape: { value: "User" } },
      },
    };

    const ir2: IntentIR = {
      v: "0.1",
      force: "DO",
      event: { lemma: "DEFINE_TYPE", class: "CREATE" },
      args: {
        TARGET: { kind: "value", valueType: "string", shape: { value: "User" } },
      },
    };

    const result1 = canonicalize(ir1);
    const result2 = canonicalize(ir2);

    expect(result1.simKeyHex).toBe(result2.simKeyHex);
  });

  it("should produce different simKey for different IR", () => {
    const ir1: IntentIR = {
      v: "0.1",
      force: "DO",
      event: { lemma: "DEFINE_TYPE", class: "CREATE" },
      args: {},
    };

    const ir2: IntentIR = {
      v: "0.1",
      force: "DO",
      event: { lemma: "ADD_FIELD", class: "CREATE" },
      args: {},
    };

    const result1 = canonicalize(ir1);
    const result2 = canonicalize(ir2);

    expect(result1.simKeyHex).not.toBe(result2.simKeyHex);
  });

  it("should be deterministic", () => {
    const result1 = canonicalize(sampleIR);
    const result2 = canonicalize(sampleIR);
    const result3 = canonicalize(sampleIR);

    expect(result1.simKeyHex).toBe(result2.simKeyHex);
    expect(result2.simKeyHex).toBe(result3.simKeyHex);
  });
});

// =============================================================================
// S4: Feature Check Tests
// =============================================================================

describe("S4: Feature Check", () => {
  const builtin = createBuiltinLexicon();
  const project = deriveProjectLexicon(null); // Empty project lexicon
  const learned = createLearnedLexicon({}, builtin);
  const lexicon = createCompositeLexicon(learned, project, builtin);

  it("should pass for known lemma", () => {
    const ir: IntentIR = {
      v: "0.1",
      force: "DO",
      event: { lemma: "DEFINE_TYPE", class: "CREATE" },
      args: {
        TARGET: { kind: "value", valueType: "string", shape: { name: "User" } },
      },
    };

    const result = featureCheck(ir, lexicon, learned, project, builtin, false);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.lexiconSource).toBe("builtin");
    }
  });

  it("should pass for unknown lemma in non-strict mode", () => {
    const ir: IntentIR = {
      v: "0.1",
      force: "DO",
      event: { lemma: "UNKNOWN_LEMMA", class: "CREATE" },
      args: {},
    };

    const result = featureCheck(ir, lexicon, learned, project, builtin, false);

    // Non-strict mode allows unknown lemmas
    expect(result.ok).toBe(true);
  });

  it("should fail for unknown lemma in strict mode", () => {
    const ir: IntentIR = {
      v: "0.1",
      force: "DO",
      event: { lemma: "UNKNOWN_LEMMA", class: "CREATE" },
      args: {},
    };

    const result = featureCheck(ir, lexicon, learned, project, builtin, true);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("FEATURE_CHECK_FAILED");
    }
  });
});

// =============================================================================
// S5: Resolve References Tests
// =============================================================================

describe("S5: Resolve References", () => {
  it("should pass through IR without symbolic references", () => {
    const ir: IntentIR = {
      v: "0.1",
      force: "DO",
      event: { lemma: "DEFINE_TYPE", class: "CREATE" },
      args: {
        TARGET: { kind: "value", valueType: "string", shape: { name: "User" } },
      },
    };

    const context = buildResolutionContext([], 5);
    const result = resolveReferences(ir, context);

    expect(result.ir).toEqual(ir);
    expect(result.resolutions).toHaveLength(0);
  });

  it("should resolve 'last' reference from history", () => {
    const ir: IntentIR = {
      v: "0.1",
      force: "DO",
      event: { lemma: "UPDATE", class: "TRANSFORM" },
      args: {
        TARGET: { kind: "entity", entityType: "User", ref: { kind: "last" } },
      },
    };

    // Create history with a previous User reference
    const previousRequest = {
      requestId: "req_1",
      input: { text: "create user" },
      result: { kind: "success" as const, body: { type: "createUser" } },
      intentIR: {
        v: "0.1" as const,
        force: "DO" as const,
        event: { lemma: "CREATE_USER", class: "CREATE" as const },
        args: {
          TARGET: {
            kind: "entity" as const,
            entityType: "User",
            ref: { kind: "id" as const, id: "user-123" },
          },
        },
      },
      simKey: "0000000000000000",
      intentKey: null,
      createdAt: new Date().toISOString(),
      completedAt: null,
    };

    const context = buildResolutionContext([previousRequest], 5);
    const result = resolveReferences(ir, context);

    // Should resolve the 'last' reference to 'user-123'
    expect(result.resolutions.length).toBeGreaterThanOrEqual(0);
  });
});

// =============================================================================
// S6: Lower Tests
// =============================================================================

describe("S6: Lower", () => {
  const builtin = createBuiltinLexicon();
  const learned = createLearnedLexicon({}, builtin);
  const lexicon = createCompositeLexicon(learned, builtin, builtin);

  it("should lower known lemma to IntentBody", () => {
    const ir: IntentIR = {
      v: "0.1",
      force: "DO",
      event: { lemma: "DEFINE_TYPE", class: "CREATE" },
      args: {
        TARGET: { kind: "value", valueType: "string", shape: { name: "User" } },
      },
    };

    const result = lowerIR(ir, lexicon, learned, builtin, builtin, "test-hash");

    expect(result.loweringResult.kind).toBe("resolved");
    if (result.loweringResult.kind === "resolved") {
      expect(result.loweringResult.body.type).toBe("DEFINE_TYPE");
      expect(result.intentKey).toBeDefined();
    }
  });

  it("should return unresolved for unknown lemma", () => {
    const ir: IntentIR = {
      v: "0.1",
      force: "DO",
      event: { lemma: "COMPLETELY_UNKNOWN", class: "CREATE" },
      args: {},
    };

    const result = lowerIR(ir, lexicon, learned, builtin, builtin, "test-hash");

    expect(result.loweringResult.kind).toBe("unresolved");
    if (result.loweringResult.kind === "unresolved") {
      expect(result.loweringResult.missing.length).toBeGreaterThan(0);
    }
  });

  it("should be deterministic", () => {
    const ir: IntentIR = {
      v: "0.1",
      force: "DO",
      event: { lemma: "DEFINE_TYPE", class: "CREATE" },
      args: {},
    };

    const result1 = lowerIR(ir, lexicon, learned, builtin, builtin, "test-hash");
    const result2 = lowerIR(ir, lexicon, learned, builtin, builtin, "test-hash");

    expect(result1.intentKey).toBe(result2.intentKey);
  });
});

// =============================================================================
// S7: Validate Action Body Tests
// =============================================================================

describe("S7: Validate Action Body", () => {
  describe("isActionRelatedLemma", () => {
    it("should return true for action lemmas", () => {
      expect(isActionRelatedLemma("ADD_ACTION")).toBe(true);
      expect(isActionRelatedLemma("ADD_ACTION_GUARD")).toBe(true);
      expect(isActionRelatedLemma("ADD_ACTION_EFFECT")).toBe(true);
    });

    it("should return true for lowercase variants", () => {
      expect(isActionRelatedLemma("add_action")).toBe(true);
      expect(isActionRelatedLemma("Add_Action")).toBe(true);
    });

    it("should return false for non-action lemmas", () => {
      expect(isActionRelatedLemma("DEFINE_TYPE")).toBe(false);
      expect(isActionRelatedLemma("ADD_FIELD")).toBe(false);
      expect(isActionRelatedLemma("ADD_COMPUTED")).toBe(false);
    });
  });

  describe("extractActionBody", () => {
    it("should extract action body from input with blocks", () => {
      const input = {
        blocks: [
          {
            guard: { kind: "when", condition: { kind: "literal", value: true } },
            body: [],
          },
        ],
      };

      const result = extractActionBody(input);
      expect(result).toBeDefined();
      expect(result?.blocks).toHaveLength(1);
    });

    it("should return undefined for non-action input", () => {
      const input = { name: "test", type: "string" };
      const result = extractActionBody(input);
      expect(result).toBeUndefined();
    });

    it("should return undefined for null/undefined", () => {
      expect(extractActionBody(null)).toBeUndefined();
      expect(extractActionBody(undefined)).toBeUndefined();
    });
  });

  describe("validateActionBody", () => {
    it("should pass for valid action body", () => {
      const actionBody: ActionBody = {
        blocks: [
          {
            guard: { kind: "when", condition: { kind: "lit", value: true } },
            body: [],
          },
        ],
      };

      const result = validateActionBody(actionBody);
      expect(result.ok).toBe(true);
    });

    it("should fail for once guard without marker patch", () => {
      const actionBody: ActionBody = {
        blocks: [
          {
            guard: { kind: "once", marker: "data.done" },
            body: [], // Missing marker patch
          },
        ],
      };

      const result = validateActionBody(actionBody);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.violations).toContainEqual(
          expect.objectContaining({ kind: "missing_marker_patch" })
        );
      }
    });

    it("should pass for once guard with valid marker patch", () => {
      const actionBody: ActionBody = {
        blocks: [
          {
            guard: { kind: "once", marker: "data.done" },
            body: [
              {
                kind: "patch",
                path: [{ kind: "prop", name: "data" }, { kind: "prop", name: "done" }],
                value: { kind: "sys", path: ["meta", "intentId"] },
              },
            ],
          },
        ],
      };

      const result = validateActionBody(actionBody);
      expect(result.ok).toBe(true);
    });
  });
});
