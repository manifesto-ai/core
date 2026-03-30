import { describe, expect, it } from "vitest";
import type { Snapshot } from "@manifesto-ai/core";
import {
  computeSnapshotHash,
  computeWorldId,
  deriveTerminalStatus,
} from "./index.js";

function createTestSnapshot(
  data: Record<string, unknown>,
  overrides?: Partial<Snapshot>
): Snapshot {
  return {
    data,
    computed: {},
    system: {
      status: "idle",
      lastError: null,
      pendingRequirements: [],
      errors: [],
      currentAction: null,
    },
    input: {},
    meta: {
      version: 1,
      timestamp: 0,
      randomSeed: "seed",
      schemaHash: "schema-hash",
    },
    ...overrides,
  };
}

describe("@manifesto-ai/lineage hash", () => {
  it("keeps snapshot hash stable across platform/meta-only changes", () => {
    const base = createTestSnapshot({
      count: 1,
      $host: { internal: true },
      $mel: { guard: true },
    });
    const changed = createTestSnapshot(
      {
        count: 1,
        $host: { internal: false },
        $mel: { guard: false },
      },
      {
        computed: { derived: 1 },
        input: { transient: true },
        meta: {
          version: 2,
          timestamp: 10,
          randomSeed: "other",
          schemaHash: "other-schema",
        },
      }
    );

    expect(computeSnapshotHash(base)).toBe(computeSnapshotHash(changed));
  });

  it("changes snapshot hash when semantic data changes", () => {
    const left = createTestSnapshot({ count: 1 });
    const right = createTestSnapshot({ count: 2 });

    expect(computeSnapshotHash(left)).not.toBe(computeSnapshotHash(right));
  });

  it("derives terminal status from pending requirements and lastError", () => {
    expect(deriveTerminalStatus(createTestSnapshot({}))).toBe("completed");
    expect(deriveTerminalStatus(createTestSnapshot({}, {
      system: {
        status: "idle",
        lastError: null,
        pendingRequirements: [{
          id: "req-1",
          type: "effect",
          params: {},
          actionId: "action-1",
          flowPosition: {
            nodePath: "/effects/0",
            snapshotVersion: 1,
          },
          createdAt: 0,
        }],
        errors: [],
        currentAction: null,
      },
    }))).toBe("failed");
    expect(deriveTerminalStatus(createTestSnapshot({}, {
      system: {
        status: "idle",
        lastError: {
          code: "ERR",
          message: "boom",
          source: { actionId: "a", nodePath: "/x" },
          timestamp: 0,
        },
        pendingRequirements: [],
        errors: [],
        currentAction: null,
      },
    }))).toBe("failed");
  });

  it("computes deterministic world ids", () => {
    const snapshotHash = computeSnapshotHash(createTestSnapshot({ count: 1 }));
    expect(computeWorldId("schema-hash", snapshotHash, null)).toBe(
      computeWorldId("schema-hash", snapshotHash, null)
    );
    expect(computeWorldId("schema-hash", snapshotHash, "parent-a")).not.toBe(
      computeWorldId("schema-hash", snapshotHash, "parent-b")
    );
  });
});
