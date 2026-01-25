/**
 * L6: Counter E2E Tests
 *
 * Full stack integration: MEL → Compile → Host → App (WorldStore)
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import {
  tokenize,
  parse,
  validateSemantics,
  generate,
} from "@manifesto-ai/compiler";
import { createApp, InMemoryWorldStore, type App } from "@manifesto-ai/app";
import { createHost, type ManifestoHost } from "@manifesto-ai/host";
import type { DomainSchema } from "@manifesto-ai/core";
import { userActor } from "../fixtures/index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

// =============================================================================
// L6: Counter Full Stack E2E
// =============================================================================

describe("L6: Counter E2E", () => {
  let schema: DomainSchema;
  let host: ManifestoHost;
  let app: App;
  let worldStore: InMemoryWorldStore;

  beforeEach(async () => {
    // 1. Compile MEL to DomainSchema
    const counterMel = readFileSync(
      join(__dirname, "../fixtures/schemas/counter.mel"),
      "utf-8"
    );

    const lexResult = tokenize(counterMel);
    const parseResult = parse(lexResult.tokens);

    if (!parseResult.program) {
      throw new Error(`Parse errors: ${parseResult.diagnostics.map((e) => e.message).join(", ")}`);
    }

    const validationResult = validateSemantics(parseResult.program);
    if (!validationResult.valid) {
      throw new Error(`Validation errors: ${validationResult.diagnostics.map((e) => e.message).join(", ")}`);
    }

    const generateResult = generate(parseResult.program);
    if (!generateResult.schema) {
      throw new Error(`Generation errors: ${generateResult.diagnostics.map((e) => e.message).join(", ")}`);
    }

    schema = generateResult.schema;

    // 2. Create Host with schema
    host = createHost(schema, {
      initialData: { count: 0, lastIntent: null },
    });

    // 3. Create App with Host + WorldStore
    worldStore = new InMemoryWorldStore();
    app = createApp({
      schema,
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

  describe("Complete lifecycle", () => {
    it("should complete full MEL → Schema → Host → App flow", async () => {
      // Initial state
      expect(app.getState().data.count).toBe(0);

      // Increment
      await app.act("increment").done();
      expect(app.getState().data.count).toBe(1);

      // Use reset since increment uses once() guard
      await app.act("reset", { value: 2 }).done();
      expect(app.getState().data.count).toBe(2);

      // Check computed (use full path with "computed." prefix)
      expect(app.getState().computed["computed.doubled"]).toBe(4);
      expect(app.getState().computed["computed.isPositive"]).toBe(true);
    });

    it("should handle increment and decrement cycle", async () => {
      // Use add action to accumulate count (no once guard, just when guard)
      await app.act("add", { amount: 1 }).done();
      await app.act("add", { amount: 1 }).done();
      await app.act("add", { amount: 1 }).done();
      expect(app.getState().data.count).toBe(3);

      await app.act("decrement").done();
      expect(app.getState().data.count).toBe(2);

      await app.act("decrement").done();
      await app.act("decrement").done();
      expect(app.getState().data.count).toBe(0);
    });

    it("should handle reset action", async () => {
      await app.act("add", { amount: 2 }).done();
      expect(app.getState().data.count).toBe(2);

      await app.act("reset", { value: 100 }).done();
      expect(app.getState().data.count).toBe(100);
      expect(app.getState().computed["computed.doubled"]).toBe(200);
    });

    it("should handle add action with amount", async () => {
      await app.act("add", { amount: 5 }).done();
      expect(app.getState().data.count).toBe(5);

      await app.act("add", { amount: 10 }).done();
      expect(app.getState().data.count).toBe(15);
    });
  });

  describe("Computed values", () => {
    it("should update computed values in real-time", async () => {
      expect(app.getState().computed["computed.doubled"]).toBe(0);
      expect(app.getState().computed["computed.isPositive"]).toBe(false);
      expect(app.getState().computed["computed.isNegative"]).toBe(false);

      await app.act("increment").done();

      expect(app.getState().computed["computed.doubled"]).toBe(2);
      expect(app.getState().computed["computed.isPositive"]).toBe(true);
      expect(app.getState().computed["computed.isNegative"]).toBe(false);
    });

    it("should handle negative values in computed", async () => {
      // Note: reset has when(gte(value, 0)) guard, so negative values won't work
      // We can't directly set negative value with reset
      // This test documents the expected behavior
      await app.act("reset", { value: -5 }).done();

      // Since reset has guard when gte(value, 0), -5 won't be set
      // Count should remain at 0
      expect(app.getState().data.count).toBe(0);
      expect(app.getState().computed["computed.doubled"]).toBe(0);
      expect(app.getState().computed["computed.isPositive"]).toBe(false);
      expect(app.getState().computed["computed.isNegative"]).toBe(false);
    });
  });

  describe("World lineage", () => {
    it("should create world transitions for each action", async () => {
      const initialWorldId = app.getCurrentHead();

      await app.act("increment").done();
      const afterIncrementId = app.getCurrentHead();

      await app.act("decrement").done();
      const afterDecrementId = app.getCurrentHead();

      // Each action should create a new world
      expect(afterIncrementId).not.toBe(initialWorldId);
      expect(afterDecrementId).not.toBe(afterIncrementId);
    });

    it("should maintain lineage history", async () => {
      await app.act("add", { amount: 1 }).done();
      await app.act("add", { amount: 1 }).done();
      await app.act("add", { amount: 1 }).done();

      const lineage = app.currentBranch().lineage();
      expect(lineage.length).toBe(4);
    });
  });

  describe("State persistence across operations", () => {
    it("should maintain state consistency across multiple actions", async () => {
      const operations = [
        { type: "add", input: { amount: 1 }, expected: 1 },
        { type: "add", input: { amount: 1 }, expected: 2 },
        { type: "add", input: { amount: 8 }, expected: 10 },
        { type: "decrement", input: {}, expected: 9 },
        { type: "reset", input: { value: 0 }, expected: 0 },
        // Negative amounts are ignored by add's when guard
        { type: "add", input: { amount: -5 }, expected: 0 },
      ];

      for (const op of operations) {
        await app.act(op.type, op.input || {}).done();
        expect(app.getState().data.count).toBe(op.expected);
      }
    });
  });
});

// =============================================================================
// L6: Schema Compilation E2E
// =============================================================================

describe("L6: Schema Compilation E2E", () => {
  it("should compile and validate counter schema", () => {
    const counterMel = readFileSync(
      join(__dirname, "../fixtures/schemas/counter.mel"),
      "utf-8"
    );

    const lexResult = tokenize(counterMel);
    const parseResult = parse(lexResult.tokens);
    const generateResult = generate(parseResult.program!);
    const schema = generateResult.schema!;

    // Validate schema structure - using correct nested structure
    expect(schema.id).toContain("counter");
    expect(schema.hash).toBeDefined();

    // State has fields nested structure
    expect(schema.state.fields).toBeDefined();
    expect(schema.state.fields.count).toBeDefined();
    expect(schema.state.fields.lastIntent).toBeDefined();

    // Computed has fields with "computed." prefix
    expect(schema.computed.fields).toBeDefined();
    expect(schema.computed.fields["computed.doubled"]).toBeDefined();
    expect(schema.computed.fields["computed.isPositive"]).toBeDefined();
    expect(schema.computed.fields["computed.isNegative"]).toBeDefined();

    // Actions have flow property
    expect(schema.actions).toBeDefined();
    expect(schema.actions.increment).toBeDefined();
    expect(schema.actions.increment.flow).toBeDefined();
    expect(schema.actions.decrement).toBeDefined();
    expect(schema.actions.reset).toBeDefined();
    expect(schema.actions.add).toBeDefined();
  });

  it("should produce deterministic schema hash", () => {
    const counterMel = readFileSync(
      join(__dirname, "../fixtures/schemas/counter.mel"),
      "utf-8"
    );

    // Compile twice
    const lexResult1 = tokenize(counterMel);
    const parseResult1 = parse(lexResult1.tokens);
    const schema1 = generate(parseResult1.program!).schema!;

    const lexResult2 = tokenize(counterMel);
    const parseResult2 = parse(lexResult2.tokens);
    const schema2 = generate(parseResult2.program!).schema!;

    expect(schema1.hash).toBe(schema2.hash);
  });
});
