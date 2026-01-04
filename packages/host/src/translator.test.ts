/**
 * Translator Integration Tests
 *
 * Tests for processTranslatorOutput() and related utilities.
 *
 * @see Host SPEC v1.1 §4.3
 */

import { describe, it, expect } from "vitest";
import { createSnapshot } from "@manifesto-ai/core";
import type { MelPatchFragment } from "@manifesto-ai/compiler";
import {
  processTranslatorOutput,
  createTranslatorIntentId,
  hasAmbiguity,
  type TranslatorOutput,
} from "./translator.js";

// Test fixtures
const SCHEMA_HASH = "test-hash-123";

function createTestSnapshot(data: unknown) {
  return createSnapshot(data, SCHEMA_HASH);
}

function createTestFragment(overrides: Partial<MelPatchFragment> = {}): MelPatchFragment {
  return {
    fragmentId: "frag-1",
    sourceIntentId: "intent-1",
    op: {
      kind: "setDefaultValue",
      path: "user.name",
      value: { kind: "lit", value: "Alice" },
    },
    confidence: 1.0,
    evidence: ["test"],
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("processTranslatorOutput", () => {
  it("should lower and evaluate fragments to concrete patches", () => {
    const output: TranslatorOutput = {
      fragments: [createTestFragment()],
      actionName: "updateUser",
      params: { userId: "123" },
    };

    const snapshot = createTestSnapshot({ user: { name: "Bob" } });
    const intentId = createTranslatorIntentId();

    const result = processTranslatorOutput(output, snapshot, { intentId });

    expect(result.patches).toHaveLength(1);
    expect(result.patches[0]).toEqual({
      op: "set",
      path: "user.name",
      value: "Alice",
    });
  });

  it("should use same intentId in evaluation context and intent", () => {
    const output: TranslatorOutput = {
      fragments: [createTestFragment()],
      actionName: "testAction",
    };

    const snapshot = createTestSnapshot({});
    const intentId = "fixed-intent-id-123";

    const result = processTranslatorOutput(output, snapshot, { intentId });

    // Intent should have the same intentId
    expect(result.intent.intentId).toBe(intentId);
    expect(result.intent.type).toBe("testAction");
  });

  it("should preserve action name from translator output", () => {
    const output: TranslatorOutput = {
      fragments: [createTestFragment()],
      actionName: "customActionName",
      params: { key: "value" },
    };

    const snapshot = createTestSnapshot({});
    const intentId = createTranslatorIntentId();

    const result = processTranslatorOutput(output, snapshot, { intentId });

    expect(result.intent.type).toBe("customActionName");
    expect(result.intent.input).toEqual({ key: "value" });
  });

  it("should allow actionName override in options", () => {
    const output: TranslatorOutput = {
      fragments: [createTestFragment()],
      actionName: "originalAction",
    };

    const snapshot = createTestSnapshot({});
    const intentId = createTranslatorIntentId();

    const result = processTranslatorOutput(output, snapshot, {
      intentId,
      actionName: "overriddenAction",
    });

    expect(result.intent.type).toBe("overriddenAction");
  });

  it("should handle empty fragments", () => {
    const output: TranslatorOutput = {
      fragments: [],
      actionName: "emptyAction",
    };

    const snapshot = createTestSnapshot({});
    const intentId = createTranslatorIntentId();

    const result = processTranslatorOutput(output, snapshot, { intentId });

    expect(result.patches).toHaveLength(0);
    expect(result.lowered).toHaveLength(0);
  });

  it("should handle Core IR expressions in value - snapshot reference", () => {
    // Fragment with Core IR expression that references snapshot data
    // resolvePath defaults to snapshot.data for unprefixed paths
    const fragment = createTestFragment({
      op: {
        kind: "setDefaultValue",
        path: "user.greeting",
        value: {
          kind: "get",
          path: "user.name",
        },
      },
    });

    const output: TranslatorOutput = {
      fragments: [fragment],
      actionName: "greet",
    };

    const snapshot = createTestSnapshot({ user: { name: "Alice" } });
    const intentId = createTranslatorIntentId();

    const result = processTranslatorOutput(output, snapshot, { intentId });

    expect(result.patches[0].value).toBe("Alice");
  });

  it("should handle Core IR expressions in value - meta.intentId", () => {
    // Fragment with Core IR expression that references meta.intentId
    const fragment = createTestFragment({
      op: {
        kind: "setDefaultValue",
        path: "log.intentId",
        value: {
          kind: "get",
          path: "meta.intentId",
        },
      },
    });

    const output: TranslatorOutput = {
      fragments: [fragment],
      actionName: "log",
    };

    const snapshot = createTestSnapshot({});
    const intentId = "my-intent-id-456";

    const result = processTranslatorOutput(output, snapshot, { intentId });

    expect(result.patches[0].value).toBe(intentId);
  });

  it("should handle Core IR expressions in value - input reference", () => {
    // Fragment with Core IR expression that references input params
    const fragment = createTestFragment({
      op: {
        kind: "setDefaultValue",
        path: "user.id",
        value: {
          kind: "get",
          path: "input.userId",
        },
      },
    });

    const output: TranslatorOutput = {
      fragments: [fragment],
      actionName: "setUserId",
      params: { userId: "user-789" },
    };

    const snapshot = createTestSnapshot({});
    const intentId = createTranslatorIntentId();

    const result = processTranslatorOutput(output, snapshot, { intentId });

    expect(result.patches[0].value).toBe("user-789");
  });

  it("should track skipped patches due to false condition", () => {
    const fragment = createTestFragment({
      op: {
        kind: "setDefaultValue",
        path: "user.name",
        value: { kind: "lit", value: "Skipped" },
      },
      // Condition is at fragment level, not inside op
      condition: { kind: "lit", value: false },
    });

    const output: TranslatorOutput = {
      fragments: [fragment],
      actionName: "conditionalUpdate",
    };

    const snapshot = createTestSnapshot({});
    const intentId = createTranslatorIntentId();

    const result = processTranslatorOutput(output, snapshot, { intentId });

    expect(result.patches).toHaveLength(0);
    expect(result.skipped).toHaveLength(1);
    expect(result.skipped[0].fragmentId).toBe("frag-1");
    expect(result.skipped[0].reason).toBe("false");
  });

  it("should apply patches when condition is true", () => {
    const fragment = createTestFragment({
      op: {
        kind: "setDefaultValue",
        path: "user.name",
        value: { kind: "lit", value: "Applied" },
      },
      // Condition is at fragment level, not inside op
      condition: { kind: "lit", value: true },
    });

    const output: TranslatorOutput = {
      fragments: [fragment],
      actionName: "conditionalUpdate",
    };

    const snapshot = createTestSnapshot({});
    const intentId = createTranslatorIntentId();

    const result = processTranslatorOutput(output, snapshot, { intentId });

    expect(result.patches).toHaveLength(1);
    expect(result.patches[0].value).toBe("Applied");
    expect(result.skipped).toHaveLength(0);
  });
});

describe("createTranslatorIntentId", () => {
  it("should create a unique UUID", () => {
    const id1 = createTranslatorIntentId();
    const id2 = createTranslatorIntentId();

    expect(id1).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    expect(id1).not.toBe(id2);
  });
});

describe("hasAmbiguity", () => {
  it("should return false for output without ambiguity", () => {
    const output: TranslatorOutput = {
      fragments: [],
      actionName: "test",
    };

    expect(hasAmbiguity(output)).toBe(false);
  });

  it("should return true for output with ambiguity object", () => {
    const output: TranslatorOutput = {
      fragments: [],
      actionName: "test",
      ambiguity: { type: "multiple_matches", options: ["a", "b"] },
    };

    expect(hasAmbiguity(output)).toBe(true);
  });

  it("should return false for null ambiguity", () => {
    const output: TranslatorOutput = {
      fragments: [],
      actionName: "test",
      ambiguity: null,
    };

    expect(hasAmbiguity(output)).toBe(false);
  });

  it("should return false for undefined ambiguity", () => {
    const output: TranslatorOutput = {
      fragments: [],
      actionName: "test",
      ambiguity: undefined,
    };

    expect(hasAmbiguity(output)).toBe(false);
  });
});
