/**
 * @fileoverview Key Derivation Tests
 *
 * Deterministic key generation tests.
 */

import { describe, it, expect } from "vitest";
import {
  deriveIntentKey,
  deriveIntentKeySync,
  deriveSimKey,
  simhashDistance,
} from "../keys/index.js";
import type { IntentIR } from "../schema/index.js";
import type { IntentBody } from "../keys/types.js";

describe("Key Derivation", () => {
  describe("deriveIntentKey", () => {
    const body: IntentBody = {
      type: "order.cancel",
      input: { orderId: "123" },
    };
    const schemaHash = "abc123";

    it("should produce consistent hash (async)", async () => {
      const key1 = await deriveIntentKey(body, schemaHash);
      const key2 = await deriveIntentKey(body, schemaHash);
      expect(key1).toBe(key2);
    });

    it("should produce consistent hash (sync)", () => {
      const key1 = deriveIntentKeySync(body, schemaHash);
      const key2 = deriveIntentKeySync(body, schemaHash);
      expect(key1).toBe(key2);
    });

    it("should produce different hash for different body", async () => {
      const body2: IntentBody = {
        type: "order.cancel",
        input: { orderId: "456" }, // different
      };
      const key1 = await deriveIntentKey(body, schemaHash);
      const key2 = await deriveIntentKey(body2, schemaHash);
      expect(key1).not.toBe(key2);
    });

    it("should produce different hash for different schemaHash", async () => {
      const key1 = await deriveIntentKey(body, "schema-v1");
      const key2 = await deriveIntentKey(body, "schema-v2");
      expect(key1).not.toBe(key2);
    });

    it("should handle undefined input", async () => {
      const bodyNoInput: IntentBody = { type: "test.action" };
      const key = await deriveIntentKey(bodyNoInput, schemaHash);
      expect(key).toBeDefined();
      expect(typeof key).toBe("string");
    });

    it("should ignore scopeProposal.paths order", async () => {
      const body1: IntentBody = {
        type: "order.cancel",
        scopeProposal: { paths: ["b.path", "a.path"] },
      };
      const body2: IntentBody = {
        type: "order.cancel",
        scopeProposal: { paths: ["a.path", "b.path"] },
      };
      const key1 = await deriveIntentKey(body1, schemaHash);
      const key2 = await deriveIntentKey(body2, schemaHash);
      expect(key1).toBe(key2);
    });
  });

  describe("deriveSimKey", () => {
    const baseIR: IntentIR = {
      v: "0.1",
      force: "DO",
      event: { lemma: "CANCEL", class: "CONTROL" },
      args: {
        TARGET: {
          kind: "entity",
          entityType: "Order",
        },
      },
    };

    it("should produce consistent simKey", () => {
      const key1 = deriveSimKey(baseIR);
      const key2 = deriveSimKey(baseIR);
      expect(key1).toBe(key2);
    });

    it("should produce similar keys for similar intents", () => {
      const ir1 = baseIR;
      const ir2: IntentIR = {
        ...baseIR,
        mod: "MUST", // small difference
      };

      const key1 = deriveSimKey(ir1);
      const key2 = deriveSimKey(ir2);

      // Should be similar (low Hamming distance)
      const distance = simhashDistance(key1, key2);
      expect(distance).toBeLessThan(32); // Less than half the bits different
    });

    it("should produce different keys for different intents", () => {
      const ir2: IntentIR = {
        v: "0.1",
        force: "ASK",
        event: { lemma: "LIST", class: "OBSERVE" },
        args: {
          TARGET: { kind: "entity", entityType: "User" },
        },
      };

      const key1 = deriveSimKey(baseIR);
      const key2 = deriveSimKey(ir2);

      // Should be quite different
      const distance = simhashDistance(key1, key2);
      expect(distance).toBeGreaterThan(10);
    });
  });

  describe("simhashDistance", () => {
    it("should return 0 for identical keys", () => {
      const key = 0b1010101010n;
      expect(simhashDistance(key, key)).toBe(0);
    });

    it("should count differing bits", () => {
      const key1 = 0b1010n;
      const key2 = 0b1001n; // 2 bits different
      expect(simhashDistance(key1, key2)).toBe(2);
    });

    it("should return 64 for completely different keys", () => {
      const key1 = 0n;
      const key2 = 0xffffffffffffffffn; // all 64 bits set
      expect(simhashDistance(key1, key2)).toBe(64);
    });
  });
});
