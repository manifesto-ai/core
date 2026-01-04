/**
 * Pipeline Tests
 */

import { describe, it, expect } from "vitest";
import {
  executeChunking,
  executeNormalization,
  executeFastPath,
  createPatternRegistry,
  createPipeline,
} from "../pipeline/index.js";
import type { PipelineState } from "../pipeline/types.js";
import type { TranslationContext, DomainSchema } from "../domain/index.js";
import { createConfig } from "../domain/config.js";
import { deriveTypeIndex, generateIntentId } from "../utils/index.js";

// Helper to create a minimal pipeline state
function createTestState(input: string): PipelineState {
  const schema: DomainSchema = {
    id: "test-world",
    version: "1.0.0",
    hash: "test-hash",
    state: {},
    computed: {},
    actions: {},
    types: {},
  };

  const context: TranslationContext = {
    atWorldId: "test-world",
    schema,
    typeIndex: deriveTypeIndex(schema),
    intentId: generateIntentId(),
  };

  return {
    input,
    context,
    currentStage: "idle",
    traces: {},
    startedAt: new Date(),
  };
}

describe("Stage 0: Chunking", () => {
  it("should chunk short input into single section", async () => {
    const state = createTestState("Add email field to user");
    const result = await executeChunking(state.input, state);

    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    expect(result.data!.length).toBe(1);
    expect(result.data![0].text).toBe("Add email field to user");
  });

  it("should handle empty input", async () => {
    const state = createTestState("");
    const result = await executeChunking(state.input, state);

    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
  });

  it("should handle multi-paragraph input", async () => {
    const input = `Add email field to user

This is the second paragraph with more details.

And a third paragraph as well.`;
    const state = createTestState(input);
    const result = await executeChunking(state.input, state);

    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    // Either single section or multiple, depends on chunking strategy
    expect(result.data!.length).toBeGreaterThanOrEqual(1);
  });
});

describe("Stage 1: Normalization", () => {
  it("should normalize input", async () => {
    const state = createTestState("Add email field to user");
    const result = await executeNormalization("Add email field to user", state);

    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    expect(result.data!.canonical).toBeDefined();
  });

  it("should detect Korean language", async () => {
    const state = createTestState("사용자에게 이메일 필드 추가");
    const result = await executeNormalization("사용자에게 이메일 필드 추가", state);

    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    expect(result.data!.language).toBe("ko");
  });

  it("should detect English language", async () => {
    const state = createTestState("Add email field to user");
    const result = await executeNormalization("Add email field to user", state);

    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    // Should detect English (or default to en)
    expect(["en", "unknown"]).toContain(result.data!.language);
  });

  it("should produce canonical output", async () => {
    const input = "Add email field";
    const state = createTestState(input);
    const result = await executeNormalization(input, state);

    expect(result.success).toBe(true);
    expect(result.data!.canonical).toBeDefined();
    expect(typeof result.data!.canonical).toBe("string");
  });
});

describe("Stage 2: Fast Path", () => {
  it("should return a result", async () => {
    const state = createTestState("Add email field to user");
    state.normalization = {
      canonical: "add email field to user",
      language: "en",
      glossaryHits: [],
      tokens: [],
    };

    const result = await executeFastPath(state.normalization, state);

    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    expect(typeof result.data!.matched).toBe("boolean");
  });

  it("should return candidates array", async () => {
    const state = createTestState("add email field to user");
    state.normalization = {
      canonical: "add email field to user",
      language: "en",
      glossaryHits: [],
      tokens: [],
    };

    const result = await executeFastPath(state.normalization, state);

    expect(result.success).toBe(true);
    expect(result.data!.candidates).toBeDefined();
    expect(Array.isArray(result.data!.candidates)).toBe(true);
  });
});

describe("Pattern Registry", () => {
  it("should create pattern registry", () => {
    const registry = createPatternRegistry();
    expect(registry).toBeDefined();
    expect(registry.patterns).toBeDefined();
    expect(registry.register).toBeDefined();
    expect(registry.unregister).toBeDefined();
  });

  it("should have built-in patterns", () => {
    const registry = createPatternRegistry();
    expect(registry.patterns.length).toBeGreaterThan(0);
  });

  it("should allow registering custom patterns", () => {
    const registry = createPatternRegistry();
    const initialCount = registry.patterns.length;

    registry.register({
      patternId: "custom-test",
      pattern: /test pattern/i,
      minConfidence: 0.8,
      generate: () => null,
    });

    expect(registry.patterns.length).toBe(initialCount + 1);
  });

  it("should allow unregistering patterns", () => {
    const registry = createPatternRegistry();
    const initialCount = registry.patterns.length;

    registry.register({
      patternId: "custom-test",
      pattern: /test pattern/i,
      minConfidence: 0.8,
      generate: () => null,
    });

    registry.unregister("custom-test");
    expect(registry.patterns.length).toBe(initialCount);
  });
});

describe("Pipeline", () => {
  it("should create pipeline from config", () => {
    const pipeline = createPipeline(createConfig({
      retrievalTier: 0,
      slmModel: "gpt-4o-mini",
      escalationThreshold: 0.5,
      fastPathEnabled: true,
      fastPathOnly: true,
    }));

    expect(pipeline).toBeDefined();
    expect(pipeline.translate).toBeDefined();
    expect(pipeline.resolve).toBeDefined();
  });

  it("should run translation in fast-path-only mode", async () => {
    const pipeline = createPipeline(createConfig({
      retrievalTier: 0,
      slmModel: "gpt-4o-mini",
      escalationThreshold: 0.5,
      fastPathEnabled: true,
      fastPathOnly: true,
    }));

    const schema: DomainSchema = {
      id: "test-world",
      version: "1.0.0",
      hash: "test-hash",
      state: {},
      computed: {},
      actions: {},
      types: {},
    };

    const context: TranslationContext = {
      atWorldId: "test-world",
      schema,
      typeIndex: deriveTypeIndex(schema),
      intentId: generateIntentId(),
    };

    const result = await pipeline.translate("add email field to user", context);

    expect(result).toBeDefined();
    expect(result.kind).toBeDefined();
    // In fast-path-only mode with no schema, expect error or fragment
    expect(["fragment", "error"]).toContain(result.kind);
  });
});
