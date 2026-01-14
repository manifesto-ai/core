/**
 * @fileoverview Keys Module Tests
 *
 * Tests for SimKey serialization/deserialization.
 */

import { describe, it, expect } from "vitest";
import {
  serializeSimKey,
  deserializeSimKey,
  isValidSimKeyHex,
} from "../keys/index.js";

describe("SimKey Serialization", () => {
  describe("serializeSimKey", () => {
    it("should serialize zero to 16 zeros", () => {
      const result = serializeSimKey(0n);
      expect(result).toBe("0000000000000000");
      expect(result.length).toBe(16);
    });

    it("should serialize small numbers with left padding", () => {
      const result = serializeSimKey(255n);
      expect(result).toBe("00000000000000ff");
      expect(result.length).toBe(16);
    });

    it("should serialize large numbers correctly", () => {
      const result = serializeSimKey(0xdeadbeefcafebaben);
      expect(result).toBe("deadbeefcafebabe");
      expect(result.length).toBe(16);
    });

    it("should produce lowercase hex", () => {
      const result = serializeSimKey(0xabcdef123456789an);
      expect(result).toBe("abcdef123456789a");
      expect(result).toMatch(/^[0-9a-f]{16}$/);
    });

    it("should handle max 64-bit value", () => {
      const maxValue = 0xffffffffffffffffn;
      const result = serializeSimKey(maxValue);
      expect(result).toBe("ffffffffffffffff");
    });
  });

  describe("deserializeSimKey", () => {
    it("should deserialize zeros correctly", () => {
      const result = deserializeSimKey("0000000000000000");
      expect(result).toBe(0n);
    });

    it("should deserialize padded numbers", () => {
      const result = deserializeSimKey("00000000000000ff");
      expect(result).toBe(255n);
    });

    it("should deserialize large numbers", () => {
      const result = deserializeSimKey("deadbeefcafebabe");
      expect(result).toBe(0xdeadbeefcafebaben);
    });

    it("should handle uppercase input", () => {
      const result = deserializeSimKey("DEADBEEFCAFEBABE");
      expect(result).toBe(0xdeadbeefcafebaben);
    });

    it("should handle mixed case input", () => {
      const result = deserializeSimKey("DeAdBeEfCaFeBaBe");
      expect(result).toBe(0xdeadbeefcafebaben);
    });
  });

  describe("roundtrip", () => {
    it("should roundtrip zero", () => {
      const original = 0n;
      const serialized = serializeSimKey(original);
      const deserialized = deserializeSimKey(serialized);
      expect(deserialized).toBe(original);
    });

    it("should roundtrip small numbers", () => {
      const original = 12345n;
      const serialized = serializeSimKey(original);
      const deserialized = deserializeSimKey(serialized);
      expect(deserialized).toBe(original);
    });

    it("should roundtrip large numbers", () => {
      const original = 0x123456789abcdef0n;
      const serialized = serializeSimKey(original);
      const deserialized = deserializeSimKey(serialized);
      expect(deserialized).toBe(original);
    });

    it("should roundtrip max value", () => {
      const original = 0xffffffffffffffffn;
      const serialized = serializeSimKey(original);
      const deserialized = deserializeSimKey(serialized);
      expect(deserialized).toBe(original);
    });

    it("should roundtrip random values", () => {
      const testValues = [
        0xabcdef0123456789n,
        0x1111111111111111n,
        0xaaaaaaaaaaaaaaaaan,
        0x5555555555555555n,
      ];

      for (const original of testValues) {
        const serialized = serializeSimKey(original);
        const deserialized = deserializeSimKey(serialized);
        expect(deserialized).toBe(original);
      }
    });
  });

  describe("isValidSimKeyHex", () => {
    it("should accept valid 16-char lowercase hex", () => {
      expect(isValidSimKeyHex("0000000000000000")).toBe(true);
      expect(isValidSimKeyHex("deadbeefcafebabe")).toBe(true);
      expect(isValidSimKeyHex("ffffffffffffffff")).toBe(true);
    });

    it("should reject strings that are too short", () => {
      expect(isValidSimKeyHex("")).toBe(false);
      expect(isValidSimKeyHex("123")).toBe(false);
      expect(isValidSimKeyHex("000000000000000")).toBe(false); // 15 chars
    });

    it("should reject strings that are too long", () => {
      expect(isValidSimKeyHex("00000000000000000")).toBe(false); // 17 chars
      expect(isValidSimKeyHex("deadbeefcafebabeX")).toBe(false);
    });

    it("should reject non-hex characters", () => {
      expect(isValidSimKeyHex("ghijklmnopqrstuv")).toBe(false);
      expect(isValidSimKeyHex("000000000000000g")).toBe(false);
      expect(isValidSimKeyHex("zzzzzzzzzzzzzzzz")).toBe(false);
    });

    it("should reject uppercase (strict mode)", () => {
      // Our implementation requires lowercase
      expect(isValidSimKeyHex("DEADBEEFCAFEBABE")).toBe(false);
      expect(isValidSimKeyHex("DeAdBeEfCaFeBaBe")).toBe(false);
    });

    it("should reject non-string inputs", () => {
      expect(isValidSimKeyHex(null as unknown as string)).toBe(false);
      expect(isValidSimKeyHex(undefined as unknown as string)).toBe(false);
      expect(isValidSimKeyHex(123 as unknown as string)).toBe(false);
    });
  });
});
