/**
 * Memory Context Freezing Tests
 *
 * Tests for memory context preservation and determinism.
 *
 * @see SPEC v2.0.0 §11.4
 * @see FDR-APP-EXT-001 MEM-CTX-*
 */

import { describe, it, expect } from "vitest";
import {
  freezeMemoryContext,
  getMemoryContext,
  hasMemoryContext,
  markMemoryRecallFailed,
  wasMemoryRecallFailed,
  freezeRecallResult,
  getFrozenRecallResult,
  clearAppNamespace,
} from "../memory/context-freezing.js";
import type { Snapshot, RecallResult } from "../types/index.js";

// =============================================================================
// Test Helpers
// =============================================================================

function createBaseSnapshot(overrides?: Partial<Snapshot>): Snapshot {
  return {
    data: {},
    computed: {},
    input: {},
    system: {
      status: "idle",
      lastError: null,
      errors: [],
      pendingRequirements: [],
      currentAction: null,
    },
    meta: {
      version: 0,
      timestamp: Date.now(),
      randomSeed: "test-seed",
      schemaHash: "schema-1",
    },
    ...overrides,
  };
}

// =============================================================================
// Test Suites
// =============================================================================

describe("Memory Context Freezing", () => {
  describe("freezeMemoryContext", () => {
    it("MEM-7: freezes context into input.$app.memoryContext", () => {
      const snapshot = createBaseSnapshot();
      const context = { relevantDocs: ["doc1", "doc2"], timestamp: 12345 };

      const result = freezeMemoryContext(snapshot, context);

      expect(result.input).toHaveProperty("$app");
      expect((result.input as { $app: { memoryContext: unknown } }).$app.memoryContext).toEqual(context);
    });

    it("MEM-7: creates value copy, NOT reference", () => {
      const snapshot = createBaseSnapshot();
      const context = { items: [1, 2, 3], nested: { value: "test" } };

      const result = freezeMemoryContext(snapshot, context);

      // Modify original
      context.items.push(4);
      context.nested.value = "modified";

      // Frozen context should NOT be affected
      const frozen = (result.input as { $app: { memoryContext: typeof context } }).$app.memoryContext;
      expect(frozen.items).toEqual([1, 2, 3]);
      expect(frozen.nested.value).toBe("test");
    });

    it("preserves existing input fields", () => {
      const snapshot = createBaseSnapshot({
        input: { existingField: "value", query: "search term" },
      });
      const context = { data: "test" };

      const result = freezeMemoryContext(snapshot, context);

      expect(result.input).toHaveProperty("existingField", "value");
      expect(result.input).toHaveProperty("query", "search term");
      expect(result.input).toHaveProperty("$app");
    });

    it("preserves existing $app fields", () => {
      const snapshot = createBaseSnapshot({
        input: { $app: { otherField: "existing" } } as Snapshot["input"],
      });
      const context = { data: "test" };

      const result = freezeMemoryContext(snapshot, context);

      const appNamespace = (result.input as { $app: { otherField?: string; memoryContext: unknown } }).$app;
      expect(appNamespace.otherField).toBe("existing");
      expect(appNamespace.memoryContext).toEqual(context);
    });

    it("does not mutate original snapshot", () => {
      const snapshot = createBaseSnapshot();
      const originalInput = { ...snapshot.input };

      freezeMemoryContext(snapshot, { data: "test" });

      expect(snapshot.input).toEqual(originalInput);
    });
  });

  describe("getMemoryContext", () => {
    it("MEM-8: retrieves frozen context from snapshot", () => {
      const snapshot = createBaseSnapshot();
      const context = { relevantDocs: ["doc1"], score: 0.95 };
      const frozen = freezeMemoryContext(snapshot, context);

      const retrieved = getMemoryContext(frozen);

      expect(retrieved).toEqual(context);
    });

    it("returns undefined when no context is frozen", () => {
      const snapshot = createBaseSnapshot();

      const retrieved = getMemoryContext(snapshot);

      expect(retrieved).toBeUndefined();
    });

    it("supports generic type parameter", () => {
      const snapshot = createBaseSnapshot();
      interface MyContext {
        items: string[];
        count: number;
      }
      const context: MyContext = { items: ["a", "b"], count: 2 };
      const frozen = freezeMemoryContext(snapshot, context);

      const retrieved = getMemoryContext<MyContext>(frozen);

      expect(retrieved?.items).toEqual(["a", "b"]);
      expect(retrieved?.count).toBe(2);
    });
  });

  describe("hasMemoryContext", () => {
    it("returns true when context is frozen", () => {
      const snapshot = createBaseSnapshot();
      const frozen = freezeMemoryContext(snapshot, { data: "test" });

      expect(hasMemoryContext(frozen)).toBe(true);
    });

    it("returns false when no context is frozen", () => {
      const snapshot = createBaseSnapshot();

      expect(hasMemoryContext(snapshot)).toBe(false);
    });

    it("returns false when $app exists but memoryContext is undefined", () => {
      const snapshot = createBaseSnapshot({
        input: { $app: { otherField: "value" } } as Snapshot["input"],
      });

      expect(hasMemoryContext(snapshot)).toBe(false);
    });
  });

  describe("markMemoryRecallFailed / wasMemoryRecallFailed", () => {
    it("marks recall as failed in snapshot", () => {
      const snapshot = createBaseSnapshot();

      const marked = markMemoryRecallFailed(snapshot);

      expect(wasMemoryRecallFailed(marked)).toBe(true);
    });

    it("returns false when not marked", () => {
      const snapshot = createBaseSnapshot();

      expect(wasMemoryRecallFailed(snapshot)).toBe(false);
    });

    it("preserves other $app fields when marking failed", () => {
      const snapshot = createBaseSnapshot();
      const withContext = freezeMemoryContext(snapshot, { data: "test" });

      const marked = markMemoryRecallFailed(withContext);

      expect(hasMemoryContext(marked)).toBe(true);
      expect(wasMemoryRecallFailed(marked)).toBe(true);
    });
  });

  describe("freezeRecallResult / getFrozenRecallResult", () => {
    it("freezes RecallResult structure", () => {
      const snapshot = createBaseSnapshot();
      const recallResult: RecallResult = {
        attachments: [{ id: "att-1", type: "document", content: "content" }],
        selected: [{ id: "sel-1", relevance: 0.9 }],
        views: [],
      };

      const frozen = freezeRecallResult(snapshot, recallResult);
      const retrieved = getFrozenRecallResult(frozen);

      expect(retrieved?.attachments).toEqual(recallResult.attachments);
      expect(retrieved?.selected).toEqual(recallResult.selected);
    });

    it("returns undefined when no recall result is frozen", () => {
      const snapshot = createBaseSnapshot();

      const result = getFrozenRecallResult(snapshot);

      expect(result).toBeUndefined();
    });

    it("returns empty arrays for missing optional fields", () => {
      const snapshot = createBaseSnapshot();
      const frozen = freezeMemoryContext(snapshot, {
        // Partial recall context
      });

      const result = getFrozenRecallResult(frozen);

      expect(result?.attachments).toEqual([]);
      expect(result?.selected).toEqual([]);
      expect(result?.views).toEqual([]);
    });
  });

  describe("clearAppNamespace", () => {
    it("removes $app namespace from snapshot", () => {
      const snapshot = createBaseSnapshot();
      const withContext = freezeMemoryContext(snapshot, { data: "test" });

      const cleared = clearAppNamespace(withContext);

      expect(cleared.input).not.toHaveProperty("$app");
      expect(hasMemoryContext(cleared)).toBe(false);
    });

    it("preserves other input fields when clearing", () => {
      const snapshot = createBaseSnapshot({
        input: { query: "search", filter: "active" },
      });
      const withContext = freezeMemoryContext(snapshot, { data: "test" });

      const cleared = clearAppNamespace(withContext);

      expect(cleared.input).toHaveProperty("query", "search");
      expect(cleared.input).toHaveProperty("filter", "active");
      expect(cleared.input).not.toHaveProperty("$app");
    });

    it("returns same snapshot if no $app namespace exists", () => {
      const snapshot = createBaseSnapshot({
        input: { query: "search" },
      });

      const cleared = clearAppNamespace(snapshot);

      expect(cleared).toBe(snapshot);
    });
  });

  describe("Determinism Guarantees", () => {
    it("frozen context produces identical values on repeated access", () => {
      const snapshot = createBaseSnapshot();
      const context = { items: [1, 2, 3], nested: { deep: { value: "test" } } };
      const frozen = freezeMemoryContext(snapshot, context);

      const access1 = getMemoryContext(frozen);
      const access2 = getMemoryContext(frozen);

      expect(access1).toEqual(access2);
      expect(JSON.stringify(access1)).toBe(JSON.stringify(access2));
    });

    it("MEM-8: replay scenario uses frozen context", () => {
      // Simulate first execution
      const snapshot = createBaseSnapshot();
      const originalContext = { docs: ["doc1", "doc2"], timestamp: 1000 };
      const firstExecution = freezeMemoryContext(snapshot, originalContext);

      // Simulate replay - context should come from snapshot, not re-query
      const replayContext = getMemoryContext(firstExecution);

      expect(replayContext).toEqual(originalContext);
      // In real replay, MemoryStore would NOT be queried again
    });
  });
});
