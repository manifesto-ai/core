/**
 * L6: Counter E2E Tests
 *
 * Full stack integration: MEL → Compile → Host → World → Bridge
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
import { createHost, type ManifestoHost } from "@manifesto-ai/host";
import { createManifestoWorld, type ManifestoWorld } from "@manifesto-ai/world";
import { createBridge, type Bridge } from "@manifesto-ai/bridge";
import type { DomainSchema } from "@manifesto-ai/core";
import { userActor } from "../fixtures/index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

// =============================================================================
// L6: Counter Full Stack E2E
// =============================================================================

describe("L6: Counter E2E", () => {
  let schema: DomainSchema;
  let host: ManifestoHost;
  let world: ManifestoWorld;
  let bridge: Bridge;

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

    // 3. Create World with Host
    world = createManifestoWorld({
      schemaHash: schema.hash,
      host,
    });

    world.registerActor(userActor, { mode: "auto_approve" });

    // 4. Create genesis
    const snapshot = await host.getSnapshot();
    await world.createGenesis(snapshot);

    // 5. Create Bridge
    bridge = createBridge({
      world,
      schemaHash: schema.hash,
      defaultActor: userActor,
    });

    await bridge.refresh();
  });

  afterEach(() => {
    bridge.dispose();
    // Note: ManifestoWorld doesn't have dispose()
  });

  describe("Complete lifecycle", () => {
    it("should complete full MEL → Schema → Host → World → Bridge flow", async () => {
      // Initial state
      expect(bridge.get("count")).toBe(0);

      // Increment
      await bridge.dispatch({ type: "increment", input: {} });
      expect(bridge.get("count")).toBe(1);

      // Use reset since increment uses once() guard
      await bridge.dispatch({ type: "reset", input: { value: 2 } });
      expect(bridge.get("count")).toBe(2);

      // Check computed (use full path with "computed." prefix)
      expect(bridge.get("computed.doubled")).toBe(4);
      expect(bridge.get("computed.isPositive")).toBe(true);
    });

    it("should handle increment and decrement cycle", async () => {
      // Use add action to accumulate count (no once guard, just when guard)
      await bridge.dispatch({ type: "add", input: { amount: 1 } });
      await bridge.dispatch({ type: "add", input: { amount: 1 } });
      await bridge.dispatch({ type: "add", input: { amount: 1 } });
      expect(bridge.get("count")).toBe(3);

      await bridge.dispatch({ type: "decrement", input: {} });
      expect(bridge.get("count")).toBe(2);

      await bridge.dispatch({ type: "decrement", input: {} });
      await bridge.dispatch({ type: "decrement", input: {} });
      expect(bridge.get("count")).toBe(0);
    });

    it("should handle reset action", async () => {
      await bridge.dispatch({ type: "add", input: { amount: 2 } });
      expect(bridge.get("count")).toBe(2);

      await bridge.dispatch({ type: "reset", input: { value: 100 } });
      expect(bridge.get("count")).toBe(100);
      expect(bridge.get("computed.doubled")).toBe(200);
    });

    it("should handle add action with amount", async () => {
      await bridge.dispatch({ type: "add", input: { amount: 5 } });
      expect(bridge.get("count")).toBe(5);

      await bridge.dispatch({ type: "add", input: { amount: 10 } });
      expect(bridge.get("count")).toBe(15);
    });
  });

  describe("Computed values", () => {
    it("should update computed values in real-time", async () => {
      expect(bridge.get("computed.doubled")).toBe(0);
      expect(bridge.get("computed.isPositive")).toBe(false);
      expect(bridge.get("computed.isNegative")).toBe(false);

      await bridge.dispatch({ type: "increment", input: {} });

      expect(bridge.get("computed.doubled")).toBe(2);
      expect(bridge.get("computed.isPositive")).toBe(true);
      expect(bridge.get("computed.isNegative")).toBe(false);
    });

    it("should handle negative values in computed", async () => {
      // Note: reset has when(gte(value, 0)) guard, so negative values won't work
      // We can't directly set negative value with reset
      // This test documents the expected behavior
      await bridge.dispatch({ type: "reset", input: { value: -5 } });

      // Since reset has guard when gte(value, 0), -5 won't be set
      // Count should remain at 0
      expect(bridge.get("count")).toBe(0);
      expect(bridge.get("computed.doubled")).toBe(0);
      expect(bridge.get("computed.isPositive")).toBe(false);
      expect(bridge.get("computed.isNegative")).toBe(false);
    });
  });

  describe("World lineage", () => {
    it("should create world transitions for each action", async () => {
      const initialWorldId = bridge.getWorldId();

      await bridge.dispatch({ type: "increment", input: {} });
      const afterIncrementId = bridge.getWorldId();

      await bridge.dispatch({ type: "decrement", input: {} });
      const afterDecrementId = bridge.getWorldId();

      // Each action should create a new world
      expect(afterIncrementId).not.toBe(initialWorldId);
      expect(afterDecrementId).not.toBe(afterIncrementId);
    });

    it("should maintain lineage history", async () => {
      await bridge.dispatch({ type: "add", input: { amount: 1 } });
      await bridge.dispatch({ type: "add", input: { amount: 1 } });
      await bridge.dispatch({ type: "add", input: { amount: 1 } });

      const lineage = world.getLineage();
      const allWorlds = lineage.getAllWorlds();

      // Genesis + 3 actions = 4 worlds
      expect(allWorlds.length).toBe(4);
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
        await bridge.dispatch({ type: op.type, input: op.input || {} });
        expect(bridge.get("count")).toBe(op.expected);
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
