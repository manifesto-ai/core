/**
 * WorldHead Type Tests
 *
 * @see World SPEC v2.0.5 §9.7
 */

import { describe, it, expect } from "vitest";
import { WorldHead, createWorldId } from "../schema/index.js";

describe("WorldHead Zod Schema", () => {
  it("should validate a valid WorldHead", () => {
    const input = {
      worldId: createWorldId("world_abc123"),
      branchId: "main",
      branchName: "main",
      createdAt: 1700000000000,
      schemaHash: "hash_abc",
    };

    const result = WorldHead.safeParse(input);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.worldId).toBe("world_abc123");
      expect(result.data.branchId).toBe("main");
      expect(result.data.branchName).toBe("main");
      expect(result.data.createdAt).toBe(1700000000000);
      expect(result.data.schemaHash).toBe("hash_abc");
    }
  });

  it("should reject missing required fields", () => {
    const result = WorldHead.safeParse({
      worldId: "world_abc123",
      branchId: "main",
      // missing branchName, createdAt, schemaHash
    });

    expect(result.success).toBe(false);
  });

  it("should reject invalid createdAt type", () => {
    const result = WorldHead.safeParse({
      worldId: "world_abc123",
      branchId: "main",
      branchName: "main",
      createdAt: "not-a-number",
      schemaHash: "hash_abc",
    });

    expect(result.success).toBe(false);
  });
});
