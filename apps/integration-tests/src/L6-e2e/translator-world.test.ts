/**
 * L6: Translator → World Integration Tests
 *
 * Tests the complete flow:
 * NL → PatchFragment → processTranslatorOutput → Intent → App (WorldStore)
 *
 * This is the CORE integration that ties the translation layer to the runtime.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createApp, InMemoryWorldStore, type App } from "@manifesto-ai/app";
import { createHost, type ManifestoHost } from "@manifesto-ai/host";
import {
  processTranslatorOutput,
  createTranslatorIntentId,
  type TranslatorOutput,
} from "@manifesto-ai/host";
import type { DomainSchema } from "@manifesto-ai/core";
import type { MelPatchFragment } from "@manifesto-ai/compiler";
import { userActor } from "../fixtures/index.js";

// Import compiled schema
import CounterSchema from "../fixtures/schemas/counter-compiled.json";

const testSchema = CounterSchema as unknown as DomainSchema;

// =============================================================================
// Test Fixtures
// =============================================================================

function createSetValueFragment(
  path: string,
  value: unknown,
  intentId: string
): MelPatchFragment {
  return {
    fragmentId: `frag-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    sourceIntentId: intentId,
    op: {
      kind: "setDefaultValue",
      path,
      value: { kind: "lit", value },
    },
    confidence: 1.0,
    evidence: ["test"],
    createdAt: new Date().toISOString(),
  };
}

function createExprFragment(
  path: string,
  expr: { kind: string; [key: string]: unknown },
  intentId: string
): MelPatchFragment {
  return {
    fragmentId: `frag-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    sourceIntentId: intentId,
    op: {
      kind: "setDefaultValue",
      path,
      value: expr,
    },
    confidence: 1.0,
    evidence: ["test"],
    createdAt: new Date().toISOString(),
  };
}

// =============================================================================
// L6: Translator → Host Integration
// =============================================================================

describe("L6: Translator → Host Integration", () => {
  let host: ManifestoHost;

  beforeEach(() => {
    host = createHost(testSchema, {
      initialData: { count: 0, lastIntent: null },
    });
  });

  describe("processTranslatorOutput", () => {
    it("should convert PatchFragment to concrete patches", async () => {
      const intentId = createTranslatorIntentId();
      const snapshot = await host.getSnapshot();

      const output: TranslatorOutput = {
        fragments: [createSetValueFragment("count", 42, intentId)],
        actionName: "setCount",
      };

      const result = processTranslatorOutput(output, snapshot!, { intentId });

      expect(result.patches).toHaveLength(1);
      expect(result.patches[0]).toEqual({
        op: "set",
        path: "count",
        value: 42,
      });
    });

    it("should create intent with same intentId", async () => {
      const intentId = createTranslatorIntentId();
      const snapshot = await host.getSnapshot();

      const output: TranslatorOutput = {
        fragments: [createSetValueFragment("count", 10, intentId)],
        actionName: "setCount",
        params: { value: 10 },
      };

      const result = processTranslatorOutput(output, snapshot!, { intentId });

      expect(result.intent.intentId).toBe(intentId);
      expect(result.intent.type).toBe("setCount");
      expect(result.intent.input).toEqual({ value: 10 });
    });

    it("should evaluate expressions against snapshot", async () => {
      const intentId = createTranslatorIntentId();
      const snapshot = await host.getSnapshot();

      // Fragment that reads current count (initial count is 0)
      const output: TranslatorOutput = {
        fragments: [
          createExprFragment("lastIntent", { kind: "get", path: "count" }, intentId),
        ],
        actionName: "copyCount",
      };

      const result = processTranslatorOutput(output, snapshot!, { intentId });

      expect(result.patches[0].value).toBe(0);
    });

    it("should evaluate meta.intentId expressions", async () => {
      const intentId = "test-intent-123";
      const snapshot = await host.getSnapshot();

      const output: TranslatorOutput = {
        fragments: [
          createExprFragment("lastIntent", { kind: "get", path: "meta.intentId" }, intentId),
        ],
        actionName: "trackIntent",
      };

      const result = processTranslatorOutput(output, snapshot!, { intentId });

      expect(result.patches[0].value).toBe(intentId);
    });

    it("should evaluate input references", async () => {
      const intentId = createTranslatorIntentId();
      const snapshot = await host.getSnapshot();

      const output: TranslatorOutput = {
        fragments: [
          createExprFragment("count", { kind: "get", path: "input.newValue" }, intentId),
        ],
        actionName: "setFromInput",
        params: { newValue: 99 },
      };

      const result = processTranslatorOutput(output, snapshot!, { intentId });

      expect(result.patches[0].value).toBe(99);
    });

    it("should track skipped patches with false conditions", async () => {
      const intentId = createTranslatorIntentId();
      const snapshot = await host.getSnapshot();

      const fragment = createSetValueFragment("count", 100, intentId);
      (fragment as any).condition = { kind: "lit", value: false };

      const output: TranslatorOutput = {
        fragments: [fragment],
        actionName: "conditionalSet",
      };

      const result = processTranslatorOutput(output, snapshot!, { intentId });

      expect(result.patches).toHaveLength(0);
      expect(result.skipped).toHaveLength(1);
      expect(result.skipped[0].reason).toBe("false");
    });
  });
});

// =============================================================================
// L6: Translator → World Full Stack
// =============================================================================

describe("L6: Translator → World Full Stack", () => {
  let host: ManifestoHost;
  let app: App;
  let worldStore: InMemoryWorldStore;

  beforeEach(async () => {
    host = createHost(testSchema, {
      initialData: { count: 0, lastIntent: null },
    });

    worldStore = new InMemoryWorldStore();
    app = createApp({
      schema: testSchema,
      host,
      worldStore,
      initialData: { count: 0, lastIntent: null },
      actorPolicy: {
        mode: "anonymous",
        defaultActor: {
          actorId: userActor.actorId,
          kind: "human",
        },
      },
    });

    await app.ready();
  });

  afterEach(async () => {
    await app.dispose();
  });

  describe("NL → World State Change (Simulated)", () => {
    /**
     * This test simulates the Translator output without calling LLM.
     * In production, TranslatorBridge.translate() would return these fragments.
     */
    it("should complete NL → Fragment → World flow", async () => {
      // Initial state
      expect(app.getState().data.count).toBe(0);

      // Simulate: "set count to 50"
      const intentId = createTranslatorIntentId();
      const snapshot = await host.getSnapshot();

      const translatorOutput: TranslatorOutput = {
        fragments: [createSetValueFragment("count", 50, intentId)],
        actionName: "reset", // Use existing action
        params: { value: 50 },
      };

      // Process translator output
      const { intent } = processTranslatorOutput(translatorOutput, snapshot!, {
        intentId,
      });

      // Dispatch through App
      await app.act(intent.type, intent.input).done();

      // Verify state change
      expect(app.getState().data.count).toBe(50);
      expect(app.getState().computed["computed.doubled"]).toBe(100);
    });

    it("should handle multiple fragments in sequence", async () => {
      const intentId = createTranslatorIntentId();
      const snapshot = await host.getSnapshot();

      // Simulate: "set count to 10 and record the intent"
      const translatorOutput: TranslatorOutput = {
        fragments: [
          createSetValueFragment("count", 10, intentId),
          createExprFragment("lastIntent", { kind: "get", path: "meta.intentId" }, intentId),
        ],
        actionName: "reset",
        params: { value: 10 },
      };

      const { intent } = processTranslatorOutput(translatorOutput, snapshot!, {
        intentId,
      });

      await app.act(intent.type, intent.input).done();

      expect(app.getState().data.count).toBe(10);
      // Note: lastIntent may be set by the action's once() guard, not by our fragment
    });

    it("should preserve computed values after translator-initiated change", async () => {
      const intentId = createTranslatorIntentId();
      const snapshot = await host.getSnapshot();

      const translatorOutput: TranslatorOutput = {
        fragments: [createSetValueFragment("count", 25, intentId)],
        actionName: "reset",
        params: { value: 25 },
      };

      const { intent } = processTranslatorOutput(translatorOutput, snapshot!, {
        intentId,
      });

      await app.act(intent.type, intent.input).done();

      expect(app.getState().data.count).toBe(25);
      expect(app.getState().computed["computed.doubled"]).toBe(50);
      expect(app.getState().computed["computed.isPositive"]).toBe(true);
    });
  });

  describe("Conditional Fragment Evaluation", () => {
    it("should skip fragments with false conditions (lit false)", async () => {
      const intentId = createTranslatorIntentId();
      const snapshot = await host.getSnapshot();

      // Fragment with condition: literal false
      const fragment = createSetValueFragment("count", 100, intentId);
      (fragment as any).condition = { kind: "lit", value: false };

      const translatorOutput: TranslatorOutput = {
        fragments: [fragment],
        actionName: "conditionalReset",
        params: { value: 100 },
      };

      const result = processTranslatorOutput(translatorOutput, snapshot!, {
        intentId,
      });

      // Condition is false, so patch should be skipped
      expect(result.patches).toHaveLength(0);
      expect(result.skipped).toHaveLength(1);
      expect(result.skipped[0].reason).toBe("false");
    });

    it("should apply fragments with true conditions (lit true)", async () => {
      const intentId = createTranslatorIntentId();
      const snapshot = await host.getSnapshot();

      // Fragment with condition: literal true
      const fragment = createSetValueFragment("count", 100, intentId);
      (fragment as any).condition = { kind: "lit", value: true };

      const translatorOutput: TranslatorOutput = {
        fragments: [fragment],
        actionName: "conditionalReset",
        params: { value: 100 },
      };

      const result = processTranslatorOutput(translatorOutput, snapshot!, {
        intentId,
      });

      // Condition is true, so patch should apply
      expect(result.patches).toHaveLength(1);
      expect(result.patches[0].value).toBe(100);
    });

    /**
     * NOTE: Complex condition expressions (eq, gt, etc.) require lowering support.
     * Currently only 'lit' conditions are fully supported.
     * This documents the expected behavior when lowering is extended.
     */
    it.skip("should apply fragments with eq condition evaluating to true (eq not yet supported)", async () => {
      const intentId = createTranslatorIntentId();
      const snapshot = await host.getSnapshot();

      // Fragment with condition: if count == 0, set count to 100
      const fragment = createSetValueFragment("count", 100, intentId);
      (fragment as any).condition = {
        kind: "eq",
        left: { kind: "get", path: "count" },
        right: { kind: "lit", value: 0 },
      };

      const translatorOutput: TranslatorOutput = {
        fragments: [fragment],
        actionName: "conditionalReset",
        params: { value: 100 },
      };

      const result = processTranslatorOutput(translatorOutput, snapshot!, {
        intentId,
      });

      // Condition is true (count == 0), so patch should apply
      expect(result.patches).toHaveLength(1);
      expect(result.patches[0].value).toBe(100);
    });
  });

  describe("World Lineage After Translator Changes", () => {
    it("should create new world for each translator-initiated change", async () => {
      const initialWorldId = app.getCurrentHead();

      // First translator change
      const intentId1 = createTranslatorIntentId();
      const snapshot1 = await host.getSnapshot();
      const output1: TranslatorOutput = {
        fragments: [createSetValueFragment("count", 10, intentId1)],
        actionName: "reset",
        params: { value: 10 },
      };
      const { intent: intent1 } = processTranslatorOutput(output1, snapshot1, {
        intentId: intentId1,
      });
      await app.act(intent1.type, intent1.input).done();
      const worldId1 = app.getCurrentHead();

      // Second translator change
      const intentId2 = createTranslatorIntentId();
      const snapshot2 = await host.getSnapshot();
      const output2: TranslatorOutput = {
        fragments: [createSetValueFragment("count", 20, intentId2)],
        actionName: "reset",
        params: { value: 20 },
      };
      const { intent: intent2 } = processTranslatorOutput(output2, snapshot2, {
        intentId: intentId2,
      });
      await app.act(intent2.type, intent2.input).done();
      const worldId2 = app.getCurrentHead();

      // Each change creates a new world
      expect(worldId1).not.toBe(initialWorldId);
      expect(worldId2).not.toBe(worldId1);

      // Lineage should have 3 worlds (genesis + 2 changes)
      const lineage = app.currentBranch().lineage();
      expect(lineage.length).toBe(3);
    });
  });
});
