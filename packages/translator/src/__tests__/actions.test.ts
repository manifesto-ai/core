/**
 * @fileoverview Actions Module Tests
 *
 * Tests for translate, lower, resolve, and learn actions.
 */

import { describe, it, expect, beforeEach } from "vitest";
import type { IntentIR } from "@manifesto-ai/intent-ir";
import {
  translate,
  lower,
  resolve,
  learn,
  findLearnedEntry,
  findEntriesByTargetLemma,
  removeLearnedEntry,
  listLearnedEntries,
  findPendingMapping,
  listPendingMappings,
} from "../actions/index.js";
import { createMockLLMClient } from "../pipeline/index.js";
import {
  createInitialState,
  type TranslatorState,
  type TranslateInput,
  type LowerInput,
  type ResolveInput,
  type LearnInput,
  type LearnedEntry,
} from "../types/index.js";

// =============================================================================
// Mock App
// =============================================================================

const mockApp = {
  status: "ready" as const,
  hooks: {} as any,
  ready: async () => {},
  dispose: async () => {},
  getDomainSchema: () => ({
    id: "test-schema",
    version: "1.0.0",
    hash: "test-hash-123",
    types: {},
    state: { fields: {} },
    computed: { fields: {} },
    actions: {
      createUser: {
        flow: {},
        input: { type: "object", fields: { name: { type: "string" } } },
      },
    },
  }),
  currentBranch: () => ({ id: "main", head: "head-1", schemaHash: "test-hash-123" }),
  listBranches: () => [],
  switchBranch: async () => ({ id: "main", head: "head-1", schemaHash: "test-hash-123" }),
  fork: async () => ({ id: "fork", head: "head-2", schemaHash: "test-hash-123" }),
  act: () => ({} as any),
  getActionHandle: () => ({} as any),
  session: () => ({} as any),
  getState: () => ({ data: {}, computed: {}, system: {}, input: {}, meta: {} }),
  subscribe: () => () => {},
  system: {} as any,
  memory: {} as any,
  getMigrationLinks: () => [],
};

// =============================================================================
// Translate Action Tests
// =============================================================================

describe("translate action", () => {
  let state: TranslatorState;
  let llmClient: ReturnType<typeof createMockLLMClient>;

  beforeEach(() => {
    state = createInitialState();
    llmClient = createMockLLMClient();
  });

  it("should translate simple text to IntentBody", async () => {
    const input: TranslateInput = {
      text: "Define type User",
    };

    const result = await translate(input, {
      app: mockApp as any,
      llmClient,
      state,
    });

    expect(result.requestId).toBeDefined();
    expect(result.simKey).toBeDefined();
    // Result should be success or unresolved depending on lexicon
  });

  it("should generate unique request IDs", async () => {
    const input: TranslateInput = { text: "test" };

    const result1 = await translate(input, {
      app: mockApp as any,
      llmClient,
      state,
    });

    const result2 = await translate(input, {
      app: mockApp as any,
      llmClient,
      state,
    });

    expect(result1.requestId).not.toBe(result2.requestId);
  });

  it("should return error for empty text", async () => {
    const input: TranslateInput = { text: "" };

    const result = await translate(input, {
      app: mockApp as any,
      llmClient,
      state,
    });

    expect(result.result.kind).toBe("error");
    if (result.result.kind === "error") {
      expect(result.result.error.code).toBe("NORMALIZE_FAILED");
    }
  });

  it("should produce simKey for valid input", async () => {
    const input: TranslateInput = { text: "Add field name to User" };

    const result = await translate(input, {
      app: mockApp as any,
      llmClient,
      state,
    });

    expect(result.simKey).toMatch(/^[0-9a-f]{16}$/);
  });
});

// =============================================================================
// Lower Action Tests
// =============================================================================

describe("lower action", () => {
  let state: TranslatorState;

  beforeEach(() => {
    state = createInitialState();
  });

  it("should lower valid IntentIR", () => {
    const ir: IntentIR = {
      v: "0.1",
      force: "DO",
      event: { lemma: "DEFINE_TYPE", class: "CREATE" },
      args: {
        TARGET: { kind: "value", valueType: "string", shape: { name: "User" } },
      },
    };

    const input: LowerInput = { ir };

    const result = lower(input, {
      app: mockApp as any,
      state,
    });

    expect(result.requestId).toBeDefined();
    expect(result.simKey).toMatch(/^[0-9a-f]{16}$/);
    expect(result.result.kind).toBe("resolved");
  });

  it("should return unresolved for unknown lemma", () => {
    const ir: IntentIR = {
      v: "0.1",
      force: "DO",
      event: { lemma: "COMPLETELY_UNKNOWN_LEMMA", class: "CREATE" },
      args: {},
    };

    const input: LowerInput = { ir };

    const result = lower(input, {
      app: mockApp as any,
      state,
    });

    expect(result.result.kind).toBe("unresolved");
  });

  it("should use provided requestId", () => {
    const ir: IntentIR = {
      v: "0.1",
      force: "DO",
      event: { lemma: "DEFINE_TYPE", class: "CREATE" },
      args: {},
    };

    const input: LowerInput = { ir, requestId: "custom-req-id" };

    const result = lower(input, {
      app: mockApp as any,
      state,
    });

    expect(result.requestId).toBe("custom-req-id");
  });

  it("should be deterministic", () => {
    const ir: IntentIR = {
      v: "0.1",
      force: "DO",
      event: { lemma: "DEFINE_TYPE", class: "CREATE" },
      args: {},
    };

    const input: LowerInput = { ir };

    const result1 = lower(input, { app: mockApp as any, state });
    const result2 = lower(input, { app: mockApp as any, state });

    expect(result1.simKey).toBe(result2.simKey);
    expect(result1.intentKey).toBe(result2.intentKey);
  });
});

// =============================================================================
// Resolve Action Tests
// =============================================================================

describe("resolve action", () => {
  let state: TranslatorState;

  beforeEach(() => {
    state = createInitialState();
  });

  it("should return error for non-existent request", () => {
    const input: ResolveInput = {
      requestId: "non-existent",
      resolution: { kind: "select", index: 0 },
    };

    const result = resolve(input, { state });

    expect(result.kind).toBe("error");
    if (result.kind === "error") {
      expect(result.error.code).toBe("REFERENCE_UNRESOLVED");
    }
  });

  it("should return error for non-ambiguous request", () => {
    // Add a successful (non-ambiguous) request to state
    const stateWithRequest: TranslatorState = {
      ...state,
      requests: [
        {
          requestId: "req-1",
          input: { text: "test" },
          result: { kind: "success", body: { type: "test" } },
          intentIR: null,
          simKey: "0000000000000000",
          intentKey: "key-1",
          createdAt: new Date().toISOString(),
          completedAt: null,
        },
      ],
    };

    const input: ResolveInput = {
      requestId: "req-1",
      resolution: { kind: "select", index: 0 },
    };

    const result = resolve(input, { state: stateWithRequest });

    expect(result.kind).toBe("error");
  });

  it("should handle cancel resolution", () => {
    // Add an ambiguous request to state
    const stateWithAmbiguous: TranslatorState = {
      ...state,
      requests: [
        {
          requestId: "req-amb",
          input: { text: "test" },
          result: {
            kind: "ambiguous",
            candidates: [
              { index: 0, body: { type: "optionA" }, confidence: 0.8, reason: "test" },
              { index: 1, body: { type: "optionB" }, confidence: 0.6, reason: "test" },
            ],
          },
          intentIR: null,
          simKey: "0000000000000000",
          intentKey: null,
          createdAt: new Date().toISOString(),
          completedAt: null,
        },
      ],
    };

    const input: ResolveInput = {
      requestId: "req-amb",
      resolution: { kind: "cancel" },
    };

    const result = resolve(input, { state: stateWithAmbiguous });

    expect(result.kind).toBe("cancelled");
  });

  it("should select from candidates", () => {
    const stateWithAmbiguous: TranslatorState = {
      ...state,
      requests: [
        {
          requestId: "req-amb",
          input: { text: "test" },
          result: {
            kind: "ambiguous",
            candidates: [
              { index: 0, body: { type: "optionA" }, confidence: 0.8, reason: "test" },
              { index: 1, body: { type: "optionB" }, confidence: 0.6, reason: "test" },
            ],
          },
          intentIR: null,
          simKey: "0000000000000000",
          intentKey: null,
          createdAt: new Date().toISOString(),
          completedAt: null,
        },
      ],
    };

    const input: ResolveInput = {
      requestId: "req-amb",
      resolution: { kind: "select", index: 0 },
    };

    const result = resolve(input, { state: stateWithAmbiguous });

    expect(result.kind).toBe("success");
    if (result.kind === "success") {
      expect(result.body.type).toBe("optionA");
    }
  });

  it("should reject invalid selection index", () => {
    const stateWithAmbiguous: TranslatorState = {
      ...state,
      requests: [
        {
          requestId: "req-amb",
          input: { text: "test" },
          result: {
            kind: "ambiguous",
            candidates: [
              { index: 0, body: { type: "optionA" }, confidence: 0.8, reason: "test" },
            ],
          },
          intentIR: null,
          simKey: "0000000000000000",
          intentKey: null,
          createdAt: new Date().toISOString(),
          completedAt: null,
        },
      ],
    };

    const input: ResolveInput = {
      requestId: "req-amb",
      resolution: { kind: "select", index: 5 }, // Invalid index
    };

    const result = resolve(input, { state: stateWithAmbiguous });

    expect(result.kind).toBe("error");
    if (result.kind === "error") {
      expect(result.error.code).toBe("INVALID_SELECTION");
    }
  });
});

// =============================================================================
// Learn Action Tests
// =============================================================================

describe("learn action", () => {
  let state: TranslatorState;

  beforeEach(() => {
    state = createInitialState();
  });

  describe("direct mapping", () => {
    it("should create new learned entry", () => {
      const input: LearnInput = {
        mapping: {
          kind: "direct",
          lemma: "MY_CUSTOM_LEMMA",
          targetLemma: "DEFINE_TYPE",
        },
      };

      const result = learn(input, { state });

      expect(result.output.kind).toBe("success");
      if (result.output.kind === "success") {
        expect(result.output.entry.lemma).toBe("MY_CUSTOM_LEMMA");
        expect((result.output.entry as any).targetLemma).toBe("DEFINE_TYPE");
      }
      expect(result.updatedState).toBeDefined();
    });

    it("should detect conflict with existing entry", () => {
      const existingEntry: LearnedEntry = {
        kind: "alias",
        lemma: "EXISTING",
        targetLemma: "DEFINE_TYPE",
        learnedAt: new Date().toISOString(),
        learnedFrom: "test",
      };

      const stateWithEntry: TranslatorState = {
        ...state,
        learnedEntries: { EXISTING: existingEntry },
      };

      const input: LearnInput = {
        mapping: {
          kind: "direct",
          lemma: "EXISTING",
          targetLemma: "ADD_FIELD",
        },
      };

      const result = learn(input, { state: stateWithEntry });

      expect(result.output.kind).toBe("conflict");
    });

    it("should validate required fields", () => {
      const input: LearnInput = {
        mapping: {
          kind: "direct",
          lemma: "",
          targetLemma: "DEFINE_TYPE",
        },
      };

      const result = learn(input, { state });

      expect(result.output.kind).toBe("error");
    });
  });

  describe("confirm mapping", () => {
    it("should confirm pending mapping", () => {
      const stateWithPending: TranslatorState = {
        ...state,
        pendingMappings: [
          {
            id: "pending-1",
            lemma: "NEW_LEMMA",
            candidateTargetLemma: "DEFINE_TYPE",
            confidence: 0.8,
            source: "llm",
            requestId: "req-1",
            createdAt: new Date().toISOString(),
          },
        ],
      };

      const input: LearnInput = {
        mapping: {
          kind: "confirm",
          pendingId: "pending-1",
        },
      };

      const result = learn(input, { state: stateWithPending });

      expect(result.output.kind).toBe("success");
      if (result.updatedState) {
        // Pending should be removed
        expect(result.updatedState.pendingMappings).toHaveLength(0);
        // Entry should be added
        expect(result.updatedState.learnedEntries["NEW_LEMMA"]).toBeDefined();
      }
    });

    it("should allow corrected target lemma", () => {
      const stateWithPending: TranslatorState = {
        ...state,
        pendingMappings: [
          {
            id: "pending-1",
            lemma: "NEW_LEMMA",
            candidateTargetLemma: "DEFINE_TYPE",
            confidence: 0.8,
            source: "llm",
            requestId: "req-1",
            createdAt: new Date().toISOString(),
          },
        ],
      };

      const input: LearnInput = {
        mapping: {
          kind: "confirm",
          pendingId: "pending-1",
          correctedTargetLemma: "ADD_FIELD", // Override
        },
      };

      const result = learn(input, { state: stateWithPending });

      expect(result.output.kind).toBe("success");
      if (result.output.kind === "success") {
        expect((result.output.entry as any).targetLemma).toBe("ADD_FIELD");
      }
    });

    it("should return error for non-existent pending", () => {
      const input: LearnInput = {
        mapping: {
          kind: "confirm",
          pendingId: "non-existent",
        },
      };

      const result = learn(input, { state });

      expect(result.output.kind).toBe("error");
    });
  });
});

// =============================================================================
// Helper Function Tests
// =============================================================================

describe("learn helper functions", () => {
  let state: TranslatorState;

  beforeEach(() => {
    state = {
      ...createInitialState(),
      learnedEntries: {
        LEMMA_A: {
          kind: "alias",
          lemma: "LEMMA_A",
          targetLemma: "DEFINE_TYPE",
          learnedAt: new Date().toISOString(),
          learnedFrom: "test",
        },
        LEMMA_B: {
          kind: "alias",
          lemma: "LEMMA_B",
          targetLemma: "DEFINE_TYPE",
          learnedAt: new Date().toISOString(),
          learnedFrom: "test",
        },
        LEMMA_C: {
          kind: "alias",
          lemma: "LEMMA_C",
          targetLemma: "ADD_FIELD",
          learnedAt: new Date().toISOString(),
          learnedFrom: "test",
        },
      },
      pendingMappings: [
        {
          id: "pending-1",
          lemma: "PENDING",
          candidateTargetLemma: "DEFINE_TYPE",
          confidence: 0.8,
          source: "llm",
          requestId: "req-1",
          createdAt: new Date().toISOString(),
        },
      ],
    };
  });

  describe("findLearnedEntry", () => {
    it("should find existing entry", () => {
      const entry = findLearnedEntry(state, "LEMMA_A");
      expect(entry).toBeDefined();
      expect(entry?.lemma).toBe("LEMMA_A");
    });

    it("should return undefined for non-existent entry", () => {
      const entry = findLearnedEntry(state, "NON_EXISTENT");
      expect(entry).toBeUndefined();
    });
  });

  describe("findEntriesByTargetLemma", () => {
    it("should find all entries with target lemma", () => {
      const entries = findEntriesByTargetLemma(state, "DEFINE_TYPE");
      expect(entries).toHaveLength(2);
    });

    it("should return empty array for no matches", () => {
      const entries = findEntriesByTargetLemma(state, "NON_EXISTENT");
      expect(entries).toHaveLength(0);
    });
  });

  describe("removeLearnedEntry", () => {
    it("should remove entry from state", () => {
      const newState = removeLearnedEntry(state, "LEMMA_A");

      expect(newState.learnedEntries["LEMMA_A"]).toBeUndefined();
      expect(newState.learnedEntries["LEMMA_B"]).toBeDefined();
    });

    it("should not modify original state", () => {
      removeLearnedEntry(state, "LEMMA_A");

      expect(state.learnedEntries["LEMMA_A"]).toBeDefined();
    });
  });

  describe("listLearnedEntries", () => {
    it("should return all entries", () => {
      const entries = listLearnedEntries(state);
      expect(entries).toHaveLength(3);
    });
  });

  describe("findPendingMapping", () => {
    it("should find pending by id", () => {
      const pending = findPendingMapping(state, "pending-1");
      expect(pending).toBeDefined();
      expect(pending?.lemma).toBe("PENDING");
    });

    it("should return undefined for non-existent id", () => {
      const pending = findPendingMapping(state, "non-existent");
      expect(pending).toBeUndefined();
    });
  });

  describe("listPendingMappings", () => {
    it("should return all pending mappings", () => {
      const pending = listPendingMappings(state);
      expect(pending).toHaveLength(1);
    });
  });
});
