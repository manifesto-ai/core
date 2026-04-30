import { describe, expect, it } from "vitest";
import type { Snapshot } from "@manifesto-ai/core";
import {
  computeHash,
  computeSnapshotHash,
  computeWorldId,
  deriveTerminalStatus,
} from "./hash.js";

function createTestSnapshot(
  state: Record<string, unknown>,
  overrides?: Partial<Snapshot>
): Snapshot {
  return {
    state,
    computed: {},
    system: {
      status: "idle",
      lastError: null,
      pendingRequirements: [],
      currentAction: null,
    },
    input: {},
    meta: {
      version: 1,
      timestamp: 0,
      randomSeed: "seed",
      schemaHash: "schema-hash",
    },
    namespaces: {
      host: {},
      mel: { guards: { intent: {} } },
    },
    ...overrides,
  };
}

describe("@manifesto-ai/lineage hash", () => {
  it("keeps snapshot hash stable across platform/meta-only changes", () => {
    const base = createTestSnapshot(
      { count: 1 },
      {
        namespaces: {
          host: { internal: true },
          mel: { guards: { intent: { guard: "true" } } },
        },
      }
    );
    const changed = createTestSnapshot(
      { count: 1 },
      {
        computed: { derived: 1 },
        input: { transient: true },
        meta: {
          version: 2,
          timestamp: 10,
          randomSeed: "other",
          schemaHash: "other-schema",
        },
        namespaces: {
          host: { internal: false },
          mel: { guards: { intent: { guard: "false" } } },
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

  it("treats dollar-prefixed state keys as semantic state", () => {
    const left = createTestSnapshot({ count: 1 });
    const right = createTestSnapshot({ count: 1, $host: { legacy: true } });

    expect(computeSnapshotHash(left)).not.toBe(computeSnapshotHash(right));
  });

  it("keeps migrated legacy namespace relocation continuous with domain-only hash input", () => {
    const migrated = createTestSnapshot(
      { count: 1, nested: { ok: true } },
      {
        namespaces: {
          host: { legacy: true },
          mel: { guards: { intent: { guard: "true" } } },
        },
      }
    );
    const expected = computeHash({
      state: { count: 1, nested: { ok: true } },
      system: {
        terminalStatus: "completed",
        currentError: null,
        pendingDigest: "empty",
      },
    });

    expect(computeSnapshotHash(migrated)).toBe(expected);
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
