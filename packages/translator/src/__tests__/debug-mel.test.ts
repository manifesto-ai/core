/**
 * Debug test to see what MEL content and compiled schema look like
 */

import { describe, it, expect } from "vitest";
import TranslatorMel from "../domain/translator.mel";
import { createTranslatorApp, createMockLLMClient } from "../index.js";
import type { IntentIR } from "@manifesto-ai/intent-ir";

const SAMPLE_INTENT_IR: IntentIR = {
  v: "0.1",
  force: "DO",
  event: { lemma: "ADD_TASK", class: "CREATE" },
  args: { TARGET: { kind: "value", valueType: "string", shape: { value: "Test" } } },
};

describe("Debug Learn Action", () => {
  it("should test learn action", async () => {
    const llmClient = createMockLLMClient(SAMPLE_INTENT_IR);
    const app = createTranslatorApp({ llmClient });
    await app.ready();

    console.log("=== Before learn ===");
    const beforeState = app.getState();
    console.log("learnedLexicon:", (beforeState.data as any).learnedLexicon);

    // Execute learn action
    const handle = app.act("learn", {
      lemma: "create_todo",
      targetLemma: "ADD_TASK",
    });

    await handle.done();

    console.log("=== After learn ===");
    const afterState = app.getState();
    console.log("learnedLexicon:", JSON.stringify((afterState.data as any).learnedLexicon, null, 2));
    console.log("CREATE_TODO:", (afterState.data as any).learnedLexicon?.["CREATE_TODO"]);
    console.log("create_todo:", (afterState.data as any).learnedLexicon?.["create_todo"]);
    console.log("error:", (afterState.data as any).error);
    console.log("system.lastError:", afterState.system.lastError);

    expect((afterState.data as any).learnedLexicon["CREATE_TODO"]).toBeDefined();
  });
});

describe("Debug MEL", () => {
  it("should show MEL content", () => {
    console.log("Type:", typeof TranslatorMel);
    console.log("Is string?", typeof TranslatorMel === "string");

    if (typeof TranslatorMel === "string") {
      console.log("Length:", TranslatorMel.length);
      console.log("First 300 chars:", TranslatorMel.slice(0, 300));
    }

    expect(true).toBe(true);
  });

  it("should show compiled schema", async () => {
    const llmClient = createMockLLMClient(SAMPLE_INTENT_IR);
    const app = createTranslatorApp({ llmClient });
    await app.ready();

    const schema = app.getDomainSchema();
    console.log("Schema name:", schema.name);
    console.log("Schema hash:", schema.hash);
    console.log("Actions:", Object.keys(schema.actions || {}));
    console.log("State fields:", Object.keys(schema.state?.fields || {}));
    console.log("Computed keys:", Object.keys(schema.computed || {}));
    console.log("Computed full:", JSON.stringify(schema.computed, null, 2));
    const translateAction = (schema.actions as Record<string, any>)?.translate;
    console.log("Translate action available guard:", JSON.stringify(translateAction?.available, null, 2));
    console.log("Translate action flow (first 500 chars):", JSON.stringify(translateAction?.flow, null, 2)?.slice(0, 500));

    const state = app.getState();
    console.log("State data type:", typeof state.data);
    console.log("State data keys:", Object.keys(state.data as object));
    console.log("State computed keys:", Object.keys(state.computed as object));
    console.log("state.data.currentInput:", (state.data as any).currentInput);
    console.log("state.data.currentStage:", (state.data as any).currentStage);
    console.log("Full state.data:", JSON.stringify(state.data, null, 2));

    expect(schema.actions).toBeDefined();
  });

  it("should test translate action directly after small delay", async () => {
    const llmClient = createMockLLMClient(SAMPLE_INTENT_IR);
    const app = createTranslatorApp({ llmClient });
    await app.ready();

    // Add delay to allow Host async initialization to complete
    await new Promise(resolve => setTimeout(resolve, 100));

    const state = app.getState();
    console.log("After delay - currentInput:", (state.data as any).currentInput);
    console.log("After delay - currentStage:", (state.data as any).currentStage);

    try {
      const handle = app.act("translate", {
        text: "Test input",
        lang: "en",
        strict: false,
      });
      await handle.done();
      console.log("translate action succeeded!");
    } catch (error) {
      console.log("translate action failed:", error);
    }
  });

  it("should inspect Host store snapshot", async () => {
    const llmClient = createMockLLMClient(SAMPLE_INTENT_IR);
    const app = createTranslatorApp({ llmClient });
    await app.ready();

    // Access the internal executor and host
    const executor = (app as any)._domainExecutor;
    const host = executor?.getHost();
    console.log("Host exists:", !!host);

    if (host) {
      // Access the internal store
      const store = (host as any).store;
      console.log("Store exists:", !!store);

      if (store) {
        const snapshot = await store.get();
        console.log("Stored snapshot exists:", !!snapshot);
        if (snapshot) {
          console.log("Stored snapshot.data:", snapshot.data);
          console.log("Stored snapshot.data.currentInput:", snapshot.data?.currentInput);
          console.log("Stored snapshot.data.currentStage:", snapshot.data?.currentStage);
        }
      }
    }

    expect(true).toBe(true);
  });

  it("should test via internal Host", async () => {
    const llmClient = createMockLLMClient(SAMPLE_INTENT_IR);
    const app = createTranslatorApp({ llmClient });
    await app.ready();

    // Access the internal executor's host
    const executor = (app as any)._domainExecutor;
    const host = executor?.getHost();

    if (host) {
      // Check what snapshot the host actually uses
      const store = (host as any).store;
      const snapshot = await store.get();
      const core = (host as any).core;
      const schema = (host as any).schema;

      console.log("Snapshot from store - data.currentInput:", (snapshot?.data as any)?.currentInput);
      console.log("Snapshot from store - data.currentStage:", (snapshot?.data as any)?.currentStage);

      // Direct core.compute with the SAME snapshot from store
      const { createIntent } = await import("@manifesto-ai/core");
      const intent = createIntent("translate", { text: "Test", lang: "en", strict: false }, "test-intent-direct");

      console.log("\n--- Direct core.compute with store snapshot ---");
      const directResult = await core.compute(schema, snapshot, intent);
      console.log("Direct core.compute status:", directResult.status);
      console.log("Direct core.compute lastError:", directResult.snapshot?.system?.lastError);

      // Now host.dispatch with SAME host (not a new app!)
      console.log("\n--- SAME host.dispatch ---");
      const intent2 = createIntent("translate", { text: "Test", lang: "en", strict: false }, "test-intent-dispatch");
      const dispatchResult = await host.dispatch(intent2);
      console.log("SAME Host.dispatch status:", dispatchResult.status);
      console.log("SAME Host.dispatch error:", dispatchResult.error?.message);

      // Also test with a fresh app
      console.log("\n--- Fresh app host.dispatch ---");
      const app2 = createTranslatorApp({ llmClient });
      await app2.ready();
      const executor2 = (app2 as any)._domainExecutor;
      const host2 = executor2?.getHost();

      const intent3 = createIntent("translate", { text: "Test", lang: "en", strict: false }, "test-intent-dispatch2");
      const dispatchResult2 = await host2.dispatch(intent3);
      console.log("Fresh Host.dispatch status:", dispatchResult2.status);
      console.log("Fresh Host.dispatch error:", dispatchResult2.error?.message);
    }

    expect(true).toBe(true);
  });

  it("should test Core expression evaluation directly", async () => {
    // Import Core functions directly
    const { evaluateExpr, createContext, createSnapshot, isOk } = await import("@manifesto-ai/core");

    const llmClient = createMockLLMClient(SAMPLE_INTENT_IR);
    const app = createTranslatorApp({ llmClient });
    await app.ready();

    const schema = app.getDomainSchema();
    const translateAction = (schema.actions as Record<string, any>)?.translate;
    const availableExpr = translateAction?.available;

    console.log("Available expression:", JSON.stringify(availableExpr, null, 2));

    // Create a test snapshot with our initial data
    const testData = {
      currentInput: null,
      currentStage: "pending",
    };

    const testSnapshot = createSnapshot(testData, schema.hash, {
      now: Date.now(),
      randomSeed: "test-seed",
    });

    console.log("Test snapshot.data:", testSnapshot.data);
    console.log("Test snapshot.data.currentInput:", (testSnapshot.data as any).currentInput);

    // Create evaluation context
    const ctx = createContext(testSnapshot, schema, "translate", "available", "test-intent");

    // Evaluate the isNull expression directly
    const isNullExpr = { kind: "isNull" as const, arg: { kind: "get" as const, path: "currentInput" } };
    const isNullResult = evaluateExpr(isNullExpr, ctx);
    console.log("isNull(currentInput) result:", isNullResult);

    // Evaluate the full available expression
    const availResult = evaluateExpr(availableExpr, ctx);
    console.log("Full available expression result:", availResult);

    // Test get expression alone
    const getExpr = { kind: "get" as const, path: "currentInput" };
    const getResult = evaluateExpr(getExpr, ctx);
    console.log("get(currentInput) result:", getResult);

    expect(isOk(availResult)).toBe(true);
    if (isOk(availResult)) {
      console.log("Available value:", availResult.value);
    }
  });
});
