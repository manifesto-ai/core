/**
 * Delta Generator Tests
 *
 * Tests for FDR-APP-INTEGRATION-001 §3.6 (DELTA-GEN-*)
 * - DELTA-GEN-3: Platform namespaces ($host, $mel) stripped from delta
 * - DELTA-GEN-4: Deterministic delta generation
 *
 * @see FDR-APP-INTEGRATION-001 v0.4.1
 * @see World SPEC v2.0.3 (WORLD-HASH-4a, WORLD-HASH-4b)
 */

import { describe, it, expect } from "vitest";
import {
  generateDelta,
  toCanonicalSnapshot,
} from "../storage/world-store/delta-generator.js";
import type { Snapshot } from "../core/types/index.js";

function createSnapshot(
  data: Record<string, unknown>,
  overrides?: Partial<Snapshot>
): Snapshot {
  return {
    data,
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
      timestamp: 0,
      randomSeed: "seed",
      schemaHash: "schema-1",
    },
    ...overrides,
  };
}

describe("Delta Generator (FDR-APP-INTEGRATION-001 §3.6)", () => {
  describe("toCanonicalSnapshot", () => {
    it("DELTA-GEN-3/WORLD-HASH-4a: removes $host from data", () => {
      const snapshot = createSnapshot({
        count: 42,
        $host: { internal: true, slots: {} },
      });

      const canonical = toCanonicalSnapshot(snapshot);

      expect(canonical.data).toEqual({ count: 42 });
      expect(canonical.data).not.toHaveProperty("$host");
    });

    it("DELTA-GEN-3/WORLD-HASH-4b: removes $mel from data", () => {
      const snapshot = createSnapshot({
        count: 42,
        $mel: { guards: { intent: { g1: "i1" } } },
      });

      const canonical = toCanonicalSnapshot(snapshot);

      expect(canonical.data).toEqual({ count: 42 });
      expect(canonical.data).not.toHaveProperty("$mel");
    });

    it("DELTA-GEN-3: removes both $host and $mel from data", () => {
      const snapshot = createSnapshot({
        count: 42,
        user: { name: "test" },
        $host: { internal: true },
        $mel: { guards: { intent: { g1: "i1" } } },
      });

      const canonical = toCanonicalSnapshot(snapshot);

      expect(canonical.data).toEqual({
        count: 42,
        user: { name: "test" },
      });
      expect(canonical.data).not.toHaveProperty("$host");
      expect(canonical.data).not.toHaveProperty("$mel");
    });

    it("SCHEMA-RESERVED-1: removes ALL $-prefixed keys (future-proof)", () => {
      const snapshot = createSnapshot({
        count: 42,
        $host: { internal: true },
        $mel: { guards: {} },
        $app: { futureNamespace: true }, // Future platform namespace
        $trace: { debug: true }, // Another future namespace
      });

      const canonical = toCanonicalSnapshot(snapshot);

      expect(canonical.data).toEqual({ count: 42 });
      expect(canonical.data).not.toHaveProperty("$host");
      expect(canonical.data).not.toHaveProperty("$mel");
      expect(canonical.data).not.toHaveProperty("$app");
      expect(canonical.data).not.toHaveProperty("$trace");
    });

    it("preserves non-$-prefixed keys", () => {
      const snapshot = createSnapshot({
        count: 42,
        _private: { value: 1 }, // Underscore prefix is NOT platform
        normal: "data",
      });

      const canonical = toCanonicalSnapshot(snapshot);

      expect(canonical.data).toHaveProperty("_private");
      expect(canonical.data).toHaveProperty("normal");
    });

    it("sorts keys deterministically", () => {
      const snapshot = createSnapshot({
        zebra: 3,
        alpha: 1,
        beta: 2,
      });

      const canonical = toCanonicalSnapshot(snapshot);

      const keys = Object.keys(canonical.data);
      expect(keys).toEqual(["alpha", "beta", "zebra"]);
    });
  });

  describe("generateDelta", () => {
    it("DELTA-GEN-3: excludes $host changes from delta patches", () => {
      const base = createSnapshot({
        count: 0,
        $host: { internal: false },
      });

      const terminal = createSnapshot({
        count: 1,
        $host: { internal: true, newField: "added" },
      });

      const patches = generateDelta(base, terminal);

      // Only domain data changes should be in patches
      expect(patches).toHaveLength(1);
      expect(patches[0]).toEqual({
        op: "set",
        path: "data.count",
        value: 1,
      });

      // No patches for $host changes
      const hostPatches = patches.filter((p) => p.path.includes("$host"));
      expect(hostPatches).toHaveLength(0);
    });

    it("DELTA-GEN-3: excludes $mel changes from delta patches", () => {
      const base = createSnapshot({
        count: 0,
        $mel: { guards: { intent: {} } },
      });

      const terminal = createSnapshot({
        count: 1,
        $mel: { guards: { intent: { g1: "i1", g2: "i2" } } },
      });

      const patches = generateDelta(base, terminal);

      // Only domain data changes should be in patches
      expect(patches).toHaveLength(1);
      expect(patches[0]).toEqual({
        op: "set",
        path: "data.count",
        value: 1,
      });

      // No patches for $mel changes
      const melPatches = patches.filter((p) => p.path.includes("$mel"));
      expect(melPatches).toHaveLength(0);
    });

    it("DELTA-GEN-3: generates empty delta when only platform namespaces change", () => {
      const base = createSnapshot({
        count: 42,
        $host: { version: 1 },
        $mel: { guards: { intent: {} } },
      });

      const terminal = createSnapshot({
        count: 42, // Same domain data
        $host: { version: 2, newSlot: true }, // Only $host changed
        $mel: { guards: { intent: { g1: "i1" } } }, // Only $mel changed
      });

      const patches = generateDelta(base, terminal);

      // No changes to domain data, so no patches
      expect(patches).toHaveLength(0);
    });

    it("DELTA-GEN-4: same input produces identical patches", () => {
      const base = createSnapshot({
        count: 0,
        items: ["a"],
        $host: { v: 1 },
      });

      const terminal = createSnapshot({
        count: 1,
        items: ["a", "b"],
        $host: { v: 2 },
      });

      const patches1 = generateDelta(base, terminal);
      const patches2 = generateDelta(base, terminal);

      expect(patches1).toEqual(patches2);
    });

    it("DELTA-GEN-6: patches are sorted by path lexicographically", () => {
      const base = createSnapshot({
        zebra: 0,
        alpha: 0,
        beta: 0,
      });

      const terminal = createSnapshot({
        zebra: 3,
        alpha: 1,
        beta: 2,
      });

      const patches = generateDelta(base, terminal);

      const paths = patches.map((p) => p.path);
      expect(paths).toEqual(["data.alpha", "data.beta", "data.zebra"]);
    });

    it("handles nested platform namespaces correctly", () => {
      const base = createSnapshot({
        user: { name: "old" },
        $host: { nested: { deep: { value: 1 } } },
      });

      const terminal = createSnapshot({
        user: { name: "new" },
        $host: { nested: { deep: { value: 2, added: true } } },
      });

      const patches = generateDelta(base, terminal);

      // Only user.name change
      expect(patches).toHaveLength(1);
      expect(patches[0].path).toBe("data.user.name");
    });

    it("SCHEMA-RESERVED-1: excludes ANY $-prefixed namespace from delta (future-proof)", () => {
      const base = createSnapshot({
        count: 0,
        $host: { v: 1 },
        $mel: { guards: {} },
        $app: { telemetry: false }, // Future namespace
        $trace: { logs: [] }, // Future namespace
      });

      const terminal = createSnapshot({
        count: 1,
        $host: { v: 2 },
        $mel: { guards: { g1: "i1" } },
        $app: { telemetry: true }, // Changed
        $trace: { logs: ["entry"] }, // Changed
      });

      const patches = generateDelta(base, terminal);

      // Only domain data change
      expect(patches).toHaveLength(1);
      expect(patches[0]).toEqual({
        op: "set",
        path: "data.count",
        value: 1,
      });

      // No patches for ANY $-prefixed namespace
      const platformPatches = patches.filter((p) => p.path.includes("$"));
      expect(platformPatches).toHaveLength(0);
    });
  });

  describe("STORE-4 compliance: Delta scope matches snapshotHash input scope", () => {
    it("delta scope is consistent with World SPEC snapshotHash rules", () => {
      // Per World SPEC v2.0.3:
      // - snapshotHash excludes $host (WORLD-HASH-4a)
      // - snapshotHash excludes $mel (WORLD-HASH-4b)
      // Per FDR-APP-INTEGRATION-001 v0.4.1:
      // - Delta MUST only contain changes within snapshotHash input scope (STORE-4)

      const base = createSnapshot({
        domainField: "original",
        $host: { hostField: "original" },
        $mel: { melField: "original" },
      });

      const terminal = createSnapshot({
        domainField: "changed",
        $host: { hostField: "changed" },
        $mel: { melField: "changed" },
      });

      const patches = generateDelta(base, terminal);

      // Verify: patches only contain domain fields (snapshotHash input scope)
      for (const patch of patches) {
        expect(patch.path).not.toContain("$host");
        expect(patch.path).not.toContain("$mel");
      }

      // Verify: domain change is captured
      expect(patches).toContainEqual({
        op: "set",
        path: "data.domainField",
        value: "changed",
      });
    });
  });
});
