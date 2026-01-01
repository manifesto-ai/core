/**
 * Effect Handler Tests
 * TDD: Tests first, implementation follows
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import type { Snapshot, Requirement } from "@manifesto-ai/core";
import type { EffectContext } from "@manifesto-ai/host";
import type {
  Token,
  GlossaryHit,
  NormalizationResult,
  FastPathResult,
  RetrievalResult,
  ProposalResult,
  AnchorCandidate,
  PatchFragment,
} from "../../types/index.js";

import {
  normalizeSchema,
  fastPathSchema,
  retrieveSchema,
  proposeSchema,
} from "../../effects/schemas.js";

import {
  createNormalizeHandler,
  createFastPathHandler,
  createRetrieveHandler,
  createProposeHandler,
} from "../../effects/handlers.js";

import type { LLMAdapter, SchemaRegistry } from "../../effects/types.js";

// =============================================================================
// Test Helpers
// =============================================================================

function createMockContext(overrides: Partial<EffectContext> = {}): EffectContext {
  const mockSnapshot: Snapshot = {
    data: {},
    computed: {},
    system: {
      status: "running",
      pendingRequirements: [],
      errors: [],
    },
    input: {},
    meta: {
      version: 1,
      timestamp: new Date().toISOString(),
      hash: "test-hash",
    },
  };

  const mockRequirement: Requirement = {
    id: "req-1",
    type: "llm.normalize",
    params: {},
  };

  return {
    snapshot: mockSnapshot,
    requirement: mockRequirement,
    ...overrides,
  };
}

function createMockLLMAdapter(responses: Map<string, unknown>): LLMAdapter {
  return {
    async call(protocol: string, input: unknown): Promise<unknown> {
      const key = `${protocol}`;
      const response = responses.get(key);
      if (response === undefined) {
        throw new Error(`No mock response for protocol: ${key}`);
      }
      return response;
    },
  };
}

function createMockSchemaRegistry(): SchemaRegistry {
  return {
    getSchema: vi.fn().mockReturnValue({
      id: "test-schema",
      state: {
        fields: {
          "User.age": {
            name: "age",
            type: { kind: "primitive", name: "number" },
          },
          "User.email": {
            name: "email",
            type: { kind: "primitive", name: "string" },
          },
        },
      },
    }),
    getTypeIndex: vi.fn().mockReturnValue({
      "User.age": { baseKind: "number", type: { kind: "primitive", name: "number" } },
      "User.email": { baseKind: "string", type: { kind: "primitive", name: "string" } },
    }),
  };
}

// =============================================================================
// Schema Tests
// =============================================================================

describe("Effect Schemas", () => {
  describe("normalizeSchema", () => {
    it("has correct type", () => {
      expect(normalizeSchema.type).toBe("llm.normalize");
    });

    it("validates valid input", () => {
      const input = { text: "User age must be at least 18", languageHint: "en" };
      const result = normalizeSchema.inputSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it("rejects empty text", () => {
      const input = { text: "", languageHint: "en" };
      const result = normalizeSchema.inputSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it("validates output structure", () => {
      const output: NormalizationResult = {
        canonical: "user age greater than or equal to 18",
        language: "en",
        tokens: [
          { original: "user", normalized: "user", pos: "NOUN", start: 0, end: 4 },
          { original: "age", normalized: "age", pos: "NOUN", start: 5, end: 8 },
        ],
        glossaryHits: [],
        protected: [],
      };
      const result = normalizeSchema.outputSchema.safeParse(output);
      expect(result.success).toBe(true);
    });
  });

  describe("fastPathSchema", () => {
    it("has correct type", () => {
      expect(fastPathSchema.type).toBe("translator.fastPath");
    });

    it("validates valid input", () => {
      const input = {
        canonical: "user age gte 18",
        tokens: [{ original: "age", normalized: "age", pos: "NOUN", start: 0, end: 3 }],
        glossaryHits: [],
        schemaId: "test-schema",
      };
      const result = fastPathSchema.inputSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it("validates output structure", () => {
      const output: FastPathResult = {
        matched: true,
        pattern: "comparator",
        fragment: {
          id: "fp-1",
          description: "User age constraint",
          changes: [
            {
              kind: "constraint",
              path: "User.age",
              expr: {
                kind: "call",
                fn: "gte",
                args: [
                  { kind: "get", path: { kind: "name", name: "User.age" } },
                  { kind: "lit", value: 18 },
                ],
              },
            },
          ],
        },
        confidence: 1.0,
      };
      const result = fastPathSchema.outputSchema.safeParse(output);
      expect(result.success).toBe(true);
    });
  });

  describe("retrieveSchema", () => {
    it("has correct type", () => {
      expect(retrieveSchema.type).toBe("translator.retrieve");
    });

    it("validates valid input", () => {
      const input = {
        terms: [{ original: "age", normalized: "age", pos: "NOUN", start: 0, end: 3 }],
        glossaryHits: [],
        schemaId: "test-schema",
        maxCandidates: 5,
      };
      const result = retrieveSchema.inputSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it("validates output structure", () => {
      const output: RetrievalResult = {
        tier: 0,
        candidates: [
          { path: "User.age", score: 0.9, matchType: "exact", typeHint: null },
        ],
        queryTerms: ["age"],
      };
      const result = retrieveSchema.outputSchema.safeParse(output);
      expect(result.success).toBe(true);
    });
  });

  describe("proposeSchema", () => {
    it("has correct type", () => {
      expect(proposeSchema.type).toBe("llm.propose");
    });

    it("validates valid input", () => {
      const input = {
        canonical: "user age must be at least 18",
        tokens: [{ original: "age", normalized: "age", pos: "NOUN", start: 0, end: 3 }],
        candidates: [{ path: "User.age", score: 0.9, matchType: "exact" as const }],
        schemaId: "test-schema",
        timeoutMs: 30000,
        fallbackBehavior: "guess" as const,
      };
      const result = proposeSchema.inputSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it("validates output with fragment", () => {
      const output: ProposalResult = {
        fragment: {
          id: "proposal-1",
          description: "User age constraint",
          changes: [],
        },
        ambiguity: null,
        confidence: 0.95,
        reasoning: "High confidence match",
      };
      const result = proposeSchema.outputSchema.safeParse(output);
      expect(result.success).toBe(true);
    });

    it("validates output with ambiguity", () => {
      const output: ProposalResult = {
        fragment: null,
        ambiguity: {
          kind: "anchor",
          question: "Which age field do you mean?",
          options: [
            {
              id: "opt-1",
              label: "User.age",
              fragment: { id: "f-1", description: "User age", changes: [] },
              confidence: 0.6,
            },
            {
              id: "opt-2",
              label: "Profile.age",
              fragment: { id: "f-2", description: "Profile age", changes: [] },
              confidence: 0.4,
            },
          ],
          fallbackBehavior: "guess",
          expiresAt: Date.now() + 300000,
        },
        confidence: 0.5,
        reasoning: "Multiple matching anchors",
      };
      const result = proposeSchema.outputSchema.safeParse(output);
      expect(result.success).toBe(true);
    });
  });
});

// =============================================================================
// Normalize Handler Tests
// =============================================================================

describe("Normalize Handler", () => {
  let mockAdapter: LLMAdapter;
  let handler: ReturnType<typeof createNormalizeHandler>;
  let context: EffectContext;

  beforeEach(() => {
    const responses = new Map<string, unknown>();
    responses.set("translator.normalize", {
      canonical: "user age greater than or equal to 18",
      language: "en",
      tokens: [
        { original: "user", normalized: "user", pos: "NOUN", start: 0, end: 4 },
        { original: "age", normalized: "age", pos: "NOUN", start: 5, end: 8 },
      ],
      glossaryHits: [],
      protected: [],
    });

    mockAdapter = createMockLLMAdapter(responses);
    handler = createNormalizeHandler(mockAdapter);
    context = createMockContext();
  });

  it("returns Patch[] for valid input", async () => {
    const params = { text: "사용자 나이가 18세 이상이어야 합니다", languageHint: "ko" };
    const patches = await handler("llm.normalize", params, context);

    expect(Array.isArray(patches)).toBe(true);
    expect(patches.length).toBeGreaterThan(0);
  });

  it("returns NormalizationResult in patch", async () => {
    const params = { text: "User age must be at least 18" };
    const patches = await handler("llm.normalize", params, context);

    const dataPatch = patches.find((p) => p.path === "data.normalization");
    expect(dataPatch).toBeDefined();
    expect(dataPatch?.value).toMatchObject({
      canonical: expect.any(String),
      language: expect.any(String),
      tokens: expect.any(Array),
    });
  });

  it("detects language from Korean input", async () => {
    const responses = new Map<string, unknown>();
    responses.set("translator.normalize", {
      canonical: "user age greater than or equal to 18",
      language: "ko",
      tokens: [],
      glossaryHits: [],
      protected: [],
    });

    const adapter = createMockLLMAdapter(responses);
    const handler = createNormalizeHandler(adapter);

    const params = { text: "나이가 18세 이상" };
    const patches = await handler("llm.normalize", params, context);

    const dataPatch = patches.find((p) => p.path === "data.normalization");
    expect(dataPatch?.value?.language).toBe("ko");
  });

  it("returns error patches on LLM failure (never throws)", async () => {
    const failingAdapter: LLMAdapter = {
      async call() {
        throw new Error("LLM API error");
      },
    };

    const handler = createNormalizeHandler(failingAdapter);
    const params = { text: "User age must be at least 18" };

    // Should NOT throw
    const patches = await handler("llm.normalize", params, context);

    expect(Array.isArray(patches)).toBe(true);
    // Should have error patch
    const hasErrorPatch = patches.some(
      (p) => p.path.includes("error") || p.path === "system.lastError"
    );
    expect(hasErrorPatch).toBe(true);
  });

  it("returns error patches for invalid input", async () => {
    const params = { text: "" }; // Empty text is invalid
    const patches = await handler("llm.normalize", params, context);

    expect(Array.isArray(patches)).toBe(true);
    const hasNullOutput = patches.some(
      (p) => p.path === "data.normalization" && p.value === null
    );
    expect(hasNullOutput).toBe(true);
  });
});

// =============================================================================
// FastPath Handler Tests
// =============================================================================

describe("FastPath Handler", () => {
  let registry: SchemaRegistry;
  let handler: ReturnType<typeof createFastPathHandler>;
  let context: EffectContext;

  beforeEach(() => {
    registry = createMockSchemaRegistry();
    handler = createFastPathHandler(registry);
    context = createMockContext();
  });

  it("returns matched=true for recognized pattern", async () => {
    const params = {
      canonical: "User.age gte 18",
      tokens: [
        { original: "User.age", normalized: "User.age", pos: "NOUN", start: 0, end: 8 },
        { original: "gte", normalized: "gte", pos: "VERB", start: 9, end: 12 },
        { original: "18", normalized: "18", pos: "NUM", start: 13, end: 15 },
      ],
      glossaryHits: [],
      schemaId: "test-schema",
    };

    const patches = await handler("translator.fastPath", params, context);

    const dataPatch = patches.find((p) => p.path === "data.fastPath");
    expect(dataPatch).toBeDefined();
    expect(dataPatch?.value?.matched).toBe(true);
    expect(dataPatch?.value?.pattern).toBe("comparator");
    expect(dataPatch?.value?.confidence).toBe(1.0);
  });

  it("returns matched=false for unrecognized pattern", async () => {
    const params = {
      canonical: "do something complex with user data",
      tokens: [
        { original: "do", normalized: "do", pos: "VERB", start: 0, end: 2 },
        { original: "something", normalized: "something", pos: "NOUN", start: 3, end: 12 },
      ],
      glossaryHits: [],
      schemaId: "test-schema",
    };

    const patches = await handler("translator.fastPath", params, context);

    const dataPatch = patches.find((p) => p.path === "data.fastPath");
    expect(dataPatch?.value?.matched).toBe(false);
    expect(dataPatch?.value?.fragment).toBeNull();
  });

  it("generates valid PatchFragment for constraint", async () => {
    const params = {
      canonical: "User.email required",
      tokens: [
        { original: "User.email", normalized: "User.email", pos: "NOUN", start: 0, end: 10 },
        { original: "required", normalized: "required", pos: "ADJ", start: 11, end: 19 },
      ],
      glossaryHits: [],
      schemaId: "test-schema",
    };

    const patches = await handler("translator.fastPath", params, context);

    const dataPatch = patches.find((p) => p.path === "data.fastPath");
    expect(dataPatch?.value?.matched).toBe(true);
    expect(dataPatch?.value?.fragment).toMatchObject({
      id: expect.any(String),
      description: expect.any(String),
      changes: expect.any(Array),
    });
  });

  it("never throws (returns error patches)", async () => {
    const badRegistry: SchemaRegistry = {
      getSchema: () => {
        throw new Error("Schema not found");
      },
      getTypeIndex: () => ({}),
    };

    const handler = createFastPathHandler(badRegistry);
    const params = {
      canonical: "User.age gte 18",
      tokens: [],
      glossaryHits: [],
      schemaId: "nonexistent",
    };

    const patches = await handler("translator.fastPath", params, context);
    expect(Array.isArray(patches)).toBe(true);
  });
});

// =============================================================================
// Retrieve Handler Tests
// =============================================================================

describe("Retrieve Handler", () => {
  let registry: SchemaRegistry;
  let handler: ReturnType<typeof createRetrieveHandler>;
  let context: EffectContext;

  beforeEach(() => {
    registry = createMockSchemaRegistry();
    handler = createRetrieveHandler(registry, []);
    context = createMockContext();
  });

  it("returns RetrievalResult with candidates", async () => {
    const params = {
      terms: [
        { original: "age", normalized: "age", pos: "NOUN", start: 0, end: 3 },
      ],
      glossaryHits: [],
      schemaId: "test-schema",
      maxCandidates: 5,
    };

    const patches = await handler("translator.retrieve", params, context);

    const dataPatch = patches.find((p) => p.path === "data.retrieval");
    expect(dataPatch).toBeDefined();
    expect(dataPatch?.value?.tier).toBe(0);
    expect(dataPatch?.value?.candidates).toBeInstanceOf(Array);
    expect(dataPatch?.value?.queryTerms).toBeInstanceOf(Array);
  });

  it("respects maxCandidates limit", async () => {
    const params = {
      terms: [
        { original: "age", normalized: "age", pos: "NOUN", start: 0, end: 3 },
      ],
      glossaryHits: [],
      schemaId: "test-schema",
      maxCandidates: 1,
    };

    const patches = await handler("translator.retrieve", params, context);

    const dataPatch = patches.find((p) => p.path === "data.retrieval");
    expect(dataPatch?.value?.candidates.length).toBeLessThanOrEqual(1);
  });

  it("returns tier 0 for lunr.js search", async () => {
    const params = {
      terms: [
        { original: "email", normalized: "email", pos: "NOUN", start: 0, end: 5 },
      ],
      glossaryHits: [],
      schemaId: "test-schema",
      maxCandidates: 5,
    };

    const patches = await handler("translator.retrieve", params, context);

    const dataPatch = patches.find((p) => p.path === "data.retrieval");
    expect(dataPatch?.value?.tier).toBe(0);
  });

  it("never throws (returns error patches)", async () => {
    const badRegistry: SchemaRegistry = {
      getSchema: () => {
        throw new Error("Schema not found");
      },
      getTypeIndex: () => ({}),
    };

    const handler = createRetrieveHandler(badRegistry, []);
    const params = {
      terms: [],
      glossaryHits: [],
      schemaId: "nonexistent",
      maxCandidates: 5,
    };

    const patches = await handler("translator.retrieve", params, context);
    expect(Array.isArray(patches)).toBe(true);
  });
});

// =============================================================================
// Propose Handler Tests
// =============================================================================

describe("Propose Handler", () => {
  let mockAdapter: LLMAdapter;
  let registry: SchemaRegistry;
  let handler: ReturnType<typeof createProposeHandler>;
  let context: EffectContext;

  beforeEach(() => {
    const responses = new Map<string, unknown>();
    responses.set("translator.propose", {
      fragment: {
        id: "proposal-1",
        description: "User age constraint",
        changes: [
          {
            kind: "constraint",
            path: "User.age",
            expr: {
              kind: "call",
              fn: "gte",
              args: [
                { kind: "get", path: { kind: "name", name: "User.age" } },
                { kind: "lit", value: 18 },
              ],
            },
          },
        ],
      },
      ambiguity: null,
      confidence: 0.95,
      reasoning: "Clear constraint pattern",
    });

    mockAdapter = createMockLLMAdapter(responses);
    registry = createMockSchemaRegistry();
    handler = createProposeHandler(mockAdapter, registry);
    context = createMockContext();
  });

  it("returns ProposalResult with fragment", async () => {
    const params = {
      canonical: "user age must be at least 18",
      tokens: [
        { original: "age", normalized: "age", pos: "NOUN", start: 0, end: 3 },
      ],
      candidates: [
        { path: "User.age", score: 0.9, matchType: "exact" as const },
      ],
      schemaId: "test-schema",
      timeoutMs: 30000,
      fallbackBehavior: "guess" as const,
    };

    const patches = await handler("llm.propose", params, context);

    const dataPatch = patches.find((p) => p.path === "data.proposal");
    expect(dataPatch).toBeDefined();
    expect(dataPatch?.value?.fragment).not.toBeNull();
    expect(dataPatch?.value?.confidence).toBeGreaterThan(0);
  });

  it("returns ambiguity when multiple candidates", async () => {
    const responses = new Map<string, unknown>();
    responses.set("translator.propose", {
      fragment: null,
      ambiguity: {
        kind: "anchor",
        question: "Which age field?",
        options: [
          {
            id: "opt-1",
            label: "User.age",
            fragment: { id: "f-1", description: "User age", changes: [] },
            confidence: 0.5,
          },
          {
            id: "opt-2",
            label: "Profile.age",
            fragment: { id: "f-2", description: "Profile age", changes: [] },
            confidence: 0.5,
          },
        ],
        fallbackBehavior: "guess",
        expiresAt: null,
      },
      confidence: 0.5,
      reasoning: "Ambiguous anchor",
    });

    const adapter = createMockLLMAdapter(responses);
    const handler = createProposeHandler(adapter, registry);

    const params = {
      canonical: "age must be 18",
      tokens: [],
      candidates: [
        { path: "User.age", score: 0.5, matchType: "fuzzy" as const },
        { path: "Profile.age", score: 0.5, matchType: "fuzzy" as const },
      ],
      schemaId: "test-schema",
      timeoutMs: 30000,
      fallbackBehavior: "guess" as const,
    };

    const patches = await handler("llm.propose", params, context);

    const dataPatch = patches.find((p) => p.path === "data.proposal");
    expect(dataPatch?.value?.fragment).toBeNull();
    expect(dataPatch?.value?.ambiguity).not.toBeNull();
    expect(dataPatch?.value?.ambiguity?.options.length).toBeGreaterThan(1);
  });

  it("escalates when confidence < 0.6", async () => {
    const responses = new Map<string, unknown>();
    responses.set("translator.propose", {
      fragment: null,
      ambiguity: {
        kind: "intent",
        question: "Could you clarify your intent?",
        options: [],
        fallbackBehavior: "discard",
        expiresAt: null,
      },
      confidence: 0.3,
      reasoning: "Low confidence - escalating",
    });

    const adapter = createMockLLMAdapter(responses);
    const handler = createProposeHandler(adapter, registry);

    const params = {
      canonical: "do something unclear",
      tokens: [],
      candidates: [],
      schemaId: "test-schema",
      timeoutMs: 30000,
      fallbackBehavior: "discard" as const,
    };

    const patches = await handler("llm.propose", params, context);

    const dataPatch = patches.find((p) => p.path === "data.proposal");
    expect(dataPatch?.value?.confidence).toBeLessThan(0.6);
    expect(dataPatch?.value?.ambiguity).not.toBeNull();
  });

  it("never throws (returns error patches)", async () => {
    const failingAdapter: LLMAdapter = {
      async call() {
        throw new Error("LLM API error");
      },
    };

    const handler = createProposeHandler(failingAdapter, registry);
    const params = {
      canonical: "test",
      tokens: [],
      candidates: [],
      schemaId: "test-schema",
      timeoutMs: 30000,
      fallbackBehavior: "guess" as const,
    };

    const patches = await handler("llm.propose", params, context);
    expect(Array.isArray(patches)).toBe(true);
  });
});
