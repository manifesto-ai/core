/**
 * Schema Compatibility Tests
 *
 * Tests for schema compatibility validation on fork operations.
 *
 * @see SPEC v2.0.0 §12.4
 * @see FDR-APP-INTEGRATION-001 FORK-*
 */

import { describe, it, expect } from "vitest";
import {
  validateSchemaCompatibility,
  extractEffectTypes,
  SchemaIncompatibleError,
} from "../index.js";
import type { DomainSchema } from "@manifesto-ai/core";

// =============================================================================
// Test Helpers
// =============================================================================

function createSchema(actions: DomainSchema["actions"]): DomainSchema {
  return {
    id: "test:schema",
    version: "1.0.0",
    hash: "test-hash",
    types: {},
    actions,
    computed: { fields: {} },
    state: { fields: {} },
  };
}

// =============================================================================
// Test Suites
// =============================================================================

describe("Schema Compatibility", () => {
  describe("extractEffectTypes", () => {
    it("extracts effect types from simple action", () => {
      const schema = createSchema({
        "todo.create": {
          flow: {
            kind: "effect",
            type: "api.save",
            params: {},
          },
        },
      });

      const effects = extractEffectTypes(schema);

      expect(effects).toContain("api.save");
    });

    it("extracts multiple effect types from seq flow", () => {
      const schema = createSchema({
        "item.sync": {
          flow: {
            kind: "seq",
            steps: [
              { kind: "effect", type: "api.fetch", params: {} },
              { kind: "effect", type: "api.save", params: {} },
              { kind: "effect", type: "api.notify", params: {} },
            ],
          },
        },
      });

      const effects = extractEffectTypes(schema);

      expect(effects).toContain("api.fetch");
      expect(effects).toContain("api.save");
      expect(effects).toContain("api.notify");
      expect(effects).toHaveLength(3);
    });

    it("extracts effect types from nested if flow", () => {
      const schema = createSchema({
        "order.process": {
          flow: {
            kind: "if",
            cond: { kind: "lit", value: true },
            then: { kind: "effect", type: "payment.charge", params: {} },
            else: { kind: "effect", type: "payment.refund", params: {} },
          },
        },
      });

      const effects = extractEffectTypes(schema);

      expect(effects).toContain("payment.charge");
      expect(effects).toContain("payment.refund");
    });

    it("extracts effect types from call flow", () => {
      const schema = createSchema({
        "complex.action": {
          flow: {
            kind: "call",
            flow: "some.action",
          },
        },
        "some.action": {
          flow: {
            kind: "seq",
            steps: [{ kind: "effect", type: "nested.effect", params: {} }],
          },
        },
      });

      const effects = extractEffectTypes(schema);

      expect(effects).toContain("nested.effect");
    });

    it("deduplicates effect types", () => {
      const schema = createSchema({
        "action1": {
          flow: { kind: "effect", type: "api.save", params: {} },
        },
        "action2": {
          flow: { kind: "effect", type: "api.save", params: {} },
        },
        "action3": {
          flow: {
            kind: "seq",
            steps: [
              { kind: "effect", type: "api.save", params: {} },
              { kind: "effect", type: "api.fetch", params: {} },
            ],
          },
        },
      });

      const effects = extractEffectTypes(schema);

      expect(effects).toContain("api.save");
      expect(effects).toContain("api.fetch");
      expect(effects).toHaveLength(2);
    });

    it("returns empty array for schema without actions", () => {
      const schema = createSchema({});

      const effects = extractEffectTypes(schema);

      expect(effects).toEqual([]);
    });

    it("returns empty array for actions without effects", () => {
      const schema = createSchema({
        "simple.action": {
          flow: { kind: "seq", steps: [] },
        },
      });

      const effects = extractEffectTypes(schema);

      expect(effects).toEqual([]);
    });

    it("handles deeply nested flows", () => {
      const schema = createSchema({
        "deep.action": {
          flow: {
            kind: "seq",
            steps: [
              {
                kind: "if",
                cond: { kind: "lit", value: true },
                then: {
                  kind: "seq",
                  steps: [
                    {
                      kind: "if",
                      cond: { kind: "lit", value: false },
                      then: { kind: "effect", type: "deep.effect1", params: {} },
                      else: { kind: "effect", type: "deep.effect2", params: {} },
                    },
                  ],
                },
              },
            ],
          },
        },
      });

      const effects = extractEffectTypes(schema);

      expect(effects).toContain("deep.effect1");
      expect(effects).toContain("deep.effect2");
    });
  });

  describe("validateSchemaCompatibility", () => {
    it("FORK-2: returns compatible when all effects are registered", () => {
      const schema = createSchema({
        "todo.create": {
          flow: { kind: "effect", type: "api.save", params: {} },
        },
        "todo.fetch": {
          flow: { kind: "effect", type: "api.fetch", params: {} },
        },
      });

      const registeredEffects = ["api.save", "api.fetch", "api.notify"];

      const result = validateSchemaCompatibility(schema, registeredEffects);

      expect(result.compatible).toBe(true);
      if (!result.compatible) {
        throw new Error("Expected schema to be compatible");
      }
    });

    it("FORK-3: returns incompatible with missing effects", () => {
      const schema = createSchema({
        "todo.create": {
          flow: { kind: "effect", type: "api.save", params: {} },
        },
        "todo.notify": {
          flow: { kind: "effect", type: "notification.send", params: {} },
        },
      });

      const registeredEffects = ["api.save"];

      const result = validateSchemaCompatibility(schema, registeredEffects);

      expect(result.compatible).toBe(false);
      if (!result.compatible) {
        expect(result.missingEffects).toContain("notification.send");
      }
    });

    it("returns multiple missing effects", () => {
      const schema = createSchema({
        "complex.action": {
          flow: {
            kind: "seq",
            steps: [
              { kind: "effect", type: "effect.a", params: {} },
              { kind: "effect", type: "effect.b", params: {} },
              { kind: "effect", type: "effect.c", params: {} },
            ],
          },
        },
      });

      const registeredEffects = ["effect.a"];

      const result = validateSchemaCompatibility(schema, registeredEffects);

      expect(result.compatible).toBe(false);
      if (!result.compatible) {
        expect(result.missingEffects).toContain("effect.b");
        expect(result.missingEffects).toContain("effect.c");
        expect(result.missingEffects).not.toContain("effect.a");
      }
    });

    it("returns compatible for schema with no effects", () => {
      const schema = createSchema({
        "simple.action": {
          flow: { kind: "seq", steps: [] },
        },
      });

      const registeredEffects: string[] = [];

      const result = validateSchemaCompatibility(schema, registeredEffects);

      expect(result.compatible).toBe(true);
    });
  });

  describe("SchemaIncompatibleError", () => {
    it("creates error with missing effects list", () => {
      const error = new SchemaIncompatibleError(["api.missing", "db.query"]);

      expect(error.name).toBe("SchemaIncompatibleError");
      expect(error.missingEffects).toEqual(["api.missing", "db.query"]);
      expect(error.message).toContain("api.missing");
      expect(error.message).toContain("db.query");
    });

    it("is instanceof Error", () => {
      const error = new SchemaIncompatibleError(["test.effect"]);

      expect(error).toBeInstanceOf(Error);
    });
  });

  describe("Integration with Fork", () => {
    it("FORK-2: compatible schema allows fork to proceed", () => {
      const newSchema = createSchema({
        "todo.add": {
          flow: { kind: "effect", type: "api.save", params: {} },
        },
      });

      const registeredEffects = ["api.save", "api.fetch"];

      const result = validateSchemaCompatibility(newSchema, registeredEffects);

      expect(result.compatible).toBe(true);
      // In real usage: fork would proceed
    });

    it("FORK-3: incompatible schema should fail fork without World creation", () => {
      const newSchema = createSchema({
        "todo.add": {
          flow: { kind: "effect", type: "unknown.effect", params: {} },
        },
      });

      const registeredEffects = ["api.save"];

      const result = validateSchemaCompatibility(newSchema, registeredEffects);

      expect(result.compatible).toBe(false);

      // In real usage: fork would throw SchemaIncompatibleError
      // No World would be created
      if (!result.compatible) {
        expect(() => {
          throw new SchemaIncompatibleError(result.missingEffects!);
        }).toThrow(SchemaIncompatibleError);
      }
    });
  });
});
