/**
 * World Factories Tests
 *
 * Per World SPEC v2.0.4:
 * - Platform namespaces ($-prefixed) are excluded from snapshotHash
 * - Future-proof $-prefix pattern automatically handles new namespaces
 */
import { describe, it, expect } from "vitest";
import { computeSnapshotHash } from "../factories.js";
import type { Snapshot } from "@manifesto-ai/core";

/**
 * Create a minimal valid snapshot for testing
 */
function createTestSnapshot(
  data: Record<string, unknown>,
  system?: Partial<Snapshot["system"]>
): Snapshot {
  return {
    data,
    computed: {},
    system: {
      status: "completed",
      pendingRequirements: [],
      errors: [],
      ...system,
    },
    input: {},
    meta: {
      version: 1,
      timestamp: new Date().toISOString(),
      hash: "test-hash",
    },
  };
}

describe("World SPEC v2.0.4: $-prefix pattern", () => {
  describe("computeSnapshotHash", () => {
    it("excludes ALL $-prefixed namespaces from hash", async () => {
      const snapshot1 = createTestSnapshot({
        count: 42,
        $host: { internal: true },
        $mel: { guards: {} },
        $app: { futureNamespace: true },
        $trace: { debug: true },
      });

      const hash1 = await computeSnapshotHash(snapshot1);

      // Change only platform namespaces
      const snapshot2 = createTestSnapshot({
        count: 42, // Same domain data
        $host: { internal: false, extraField: "changed" },
        $mel: { guards: { g1: "i1" } },
        $app: { futureNamespace: false },
        $trace: { debug: false, moreData: [1, 2, 3] },
      });

      const hash2 = await computeSnapshotHash(snapshot2);

      // Hashes should be identical (platform namespaces excluded)
      expect(hash1).toBe(hash2);
    });

    it("produces different hashes when domain data changes", async () => {
      const snapshot1 = createTestSnapshot({
        count: 42,
        $host: { internal: true },
      });

      const snapshot2 = createTestSnapshot({
        count: 43, // Different domain data
        $host: { internal: true },
      });

      const hash1 = await computeSnapshotHash(snapshot1);
      const hash2 = await computeSnapshotHash(snapshot2);

      expect(hash1).not.toBe(hash2);
    });

    it("preserves non-$-prefixed keys in hash computation", async () => {
      const snapshot1 = createTestSnapshot({
        count: 42,
        _private: { value: 1 }, // Underscore is NOT platform namespace
        normal: "data",
        $host: { internal: true },
      });

      const snapshot2 = createTestSnapshot({
        count: 42,
        _private: { value: 2 }, // Different underscore-prefixed value
        normal: "data",
        $host: { internal: true },
      });

      const hash1 = await computeSnapshotHash(snapshot1);
      const hash2 = await computeSnapshotHash(snapshot2);

      // Different because _private changed (not a platform namespace)
      expect(hash1).not.toBe(hash2);
    });

    it("handles empty data correctly", async () => {
      const snapshot = createTestSnapshot({});

      const hash = await computeSnapshotHash(snapshot);

      expect(hash).toBeDefined();
      expect(typeof hash).toBe("string");
      expect(hash.length).toBeGreaterThan(0);
    });

    it("handles data with only platform namespaces", async () => {
      const snapshot1 = createTestSnapshot({
        $host: { state: "a" },
        $mel: { guards: {} },
      });

      const snapshot2 = createTestSnapshot({
        $host: { state: "b" },
        $mel: { guards: { different: true } },
      });

      const hash1 = await computeSnapshotHash(snapshot1);
      const hash2 = await computeSnapshotHash(snapshot2);

      // Both have empty domain data, so hashes should be the same
      expect(hash1).toBe(hash2);
    });

    it("handles deeply nested domain data consistently", async () => {
      const deepData = {
        level1: {
          level2: {
            level3: {
              value: "deep",
            },
          },
        },
        $host: { metadata: { deep: true } },
      };

      const snapshot1 = createTestSnapshot(deepData);
      const snapshot2 = createTestSnapshot({
        ...deepData,
        $host: { metadata: { deep: false, changed: true } },
      });

      const hash1 = await computeSnapshotHash(snapshot1);
      const hash2 = await computeSnapshotHash(snapshot2);

      // Only $host changed, so hashes should be identical
      expect(hash1).toBe(hash2);
    });
  });

  describe("known platform namespaces", () => {
    it("excludes $host (Host-owned state, WORLD-HASH-4a)", async () => {
      const snapshot1 = createTestSnapshot({
        count: 1,
        $host: { errors: [], intentSlots: {} },
      });

      const snapshot2 = createTestSnapshot({
        count: 1,
        $host: { errors: ["error"], intentSlots: { slot1: "value" } },
      });

      const hash1 = await computeSnapshotHash(snapshot1);
      const hash2 = await computeSnapshotHash(snapshot2);

      expect(hash1).toBe(hash2);
    });

    it("excludes $mel (Compiler-owned guard state, WORLD-HASH-4b)", async () => {
      const snapshot1 = createTestSnapshot({
        count: 1,
        $mel: { guards: {} },
      });

      const snapshot2 = createTestSnapshot({
        count: 1,
        $mel: { guards: { guard1: "instance1" } },
      });

      const hash1 = await computeSnapshotHash(snapshot1);
      const hash2 = await computeSnapshotHash(snapshot2);

      expect(hash1).toBe(hash2);
    });
  });

  describe("future platform namespaces", () => {
    it("automatically excludes $app (future namespace)", async () => {
      const snapshot1 = createTestSnapshot({
        domainField: "value",
        $app: { config: { theme: "dark" } },
      });

      const snapshot2 = createTestSnapshot({
        domainField: "value",
        $app: { config: { theme: "light", fontSize: 16 } },
      });

      const hash1 = await computeSnapshotHash(snapshot1);
      const hash2 = await computeSnapshotHash(snapshot2);

      expect(hash1).toBe(hash2);
    });

    it("automatically excludes $trace (future namespace)", async () => {
      const snapshot1 = createTestSnapshot({
        domainField: "value",
        $trace: { spans: [] },
      });

      const snapshot2 = createTestSnapshot({
        domainField: "value",
        $trace: { spans: [{ id: "span1", duration: 100 }] },
      });

      const hash1 = await computeSnapshotHash(snapshot1);
      const hash2 = await computeSnapshotHash(snapshot2);

      expect(hash1).toBe(hash2);
    });

    it("automatically excludes any future $-prefixed namespace", async () => {
      const snapshot1 = createTestSnapshot({
        domainField: "value",
        $anyFutureNamespace: { data: 1 },
        $anotherFuture: { config: "a" },
        $$doublePrefix: { valid: true },
        $123numeric: { num: 123 },
      });

      const snapshot2 = createTestSnapshot({
        domainField: "value",
        $anyFutureNamespace: { data: 999 },
        $anotherFuture: { config: "z" },
        $$doublePrefix: { valid: false },
        $123numeric: { num: 456 },
      });

      const hash1 = await computeSnapshotHash(snapshot1);
      const hash2 = await computeSnapshotHash(snapshot2);

      expect(hash1).toBe(hash2);
    });
  });
});
