import { describe, expect, it } from "vitest";
import type { Snapshot as CoreSnapshot } from "@manifesto-ai/core";

import {
  buildSnapshotProjectionPlan,
  cloneAndDeepFreeze,
  projectCanonicalSnapshot,
  projectEffectContextSnapshot,
  projectedSnapshotsEqual,
  type Snapshot,
} from "../projection/snapshot-projection.js";
import { diffProjectedPaths } from "../runtime/reports.js";
import { createCounterSchema } from "./helpers/schema.js";

function createCanonicalSnapshot(): CoreSnapshot {
  return {
    state: { count: 3, status: "idle" },
    computed: {
      doubled: 6,
      $hidden: "platform-only",
    },
    system: {
      status: "pending",
      lastError: null,
      pendingRequirements: [
        {
          id: "req-1",
          type: "api.fetch",
          params: {},
          intentId: "intent-1",
          actionType: "load",
        },
      ],
      currentAction: "load",
    },
    input: { secret: true },
    meta: {
      version: 7,
      timestamp: 1_000,
      randomSeed: "seed",
      schemaHash: "hash-1",
    },
    namespaces: { $mel: { guard: true } },
  } as unknown as CoreSnapshot;
}

function snap(state: unknown, computed: Record<string, unknown> = {}): Snapshot<unknown> {
  return {
    state,
    computed,
    system: { status: "idle", lastError: null },
    meta: { schemaHash: "hash" },
  };
}

describe("buildSnapshotProjectionPlan()", () => {
  it("collects the schema computed keys as visible keys", () => {
    const plan = buildSnapshotProjectionPlan(createCounterSchema());

    expect(plan.visibleComputedKeys).toEqual(["doubled"]);
  });
});

describe("projectCanonicalSnapshot()", () => {
  it("projects state, plan-visible computed, system status, and schema hash only", () => {
    const canonical = createCanonicalSnapshot();
    const projected = projectCanonicalSnapshot(canonical, {
      visibleComputedKeys: ["doubled"],
    });

    expect(projected).toEqual({
      state: { count: 3, status: "idle" },
      computed: { doubled: 6 },
      system: { status: "pending", lastError: null },
      meta: { schemaHash: "hash-1" },
    });
    expect(projected).not.toHaveProperty("namespaces");
    expect(projected).not.toHaveProperty("input");
    expect(projected.system).not.toHaveProperty("pendingRequirements");
    expect(projected.meta).not.toHaveProperty("version");
  });

  it("skips visible computed keys missing from the canonical snapshot", () => {
    const projected = projectCanonicalSnapshot(createCanonicalSnapshot(), {
      visibleComputedKeys: ["doubled", "missing"],
    });

    expect(projected.computed).toEqual({ doubled: 6 });
  });

  it("clones state so canonical mutations cannot leak into the projection", () => {
    const canonical = createCanonicalSnapshot();
    const projected = projectCanonicalSnapshot<{ count: number }>(canonical, {
      visibleComputedKeys: [],
    });

    (canonical.state as { count: number }).count = 999;

    expect(projected.state.count).toBe(3);
  });

  it("projects effect-context snapshots identically", () => {
    const canonical = createCanonicalSnapshot();
    const plan = { visibleComputedKeys: ["doubled"] };

    expect(projectEffectContextSnapshot(canonical, plan))
      .toEqual(projectCanonicalSnapshot(canonical, plan));
  });
});

describe("cloneAndDeepFreeze()", () => {
  it("returns a deep-frozen clone without freezing the original", () => {
    const original = { nested: { value: 1 }, list: [{ id: "a" }] };
    const frozen = cloneAndDeepFreeze(original);

    expect(frozen).toEqual(original);
    expect(frozen).not.toBe(original);
    expect(Object.isFrozen(frozen)).toBe(true);
    expect(Object.isFrozen(frozen.nested)).toBe(true);
    expect(Object.isFrozen(frozen.list[0])).toBe(true);
    expect(Object.isFrozen(original)).toBe(false);

    expect(() => {
      (frozen.nested as { value: number }).value = 2;
    }).toThrow(TypeError);
  });

  it("handles cyclic structures without infinite recursion", () => {
    const original: { name: string; self?: unknown } = { name: "loop" };
    original.self = original;

    const frozen = cloneAndDeepFreeze(original);

    expect(Object.isFrozen(frozen)).toBe(true);
    expect(frozen.self).toBe(frozen);
  });

  it("exposes binary values through cloning read-only accessors", () => {
    const original = { bytes: new Uint8Array([1, 2, 3]) };
    const frozen = cloneAndDeepFreeze(original);

    const firstRead = frozen.bytes;
    expect([...firstRead]).toEqual([1, 2, 3]);

    firstRead[0] = 99;
    expect([...frozen.bytes]).toEqual([1, 2, 3]);
    expect(frozen.bytes).not.toBe(firstRead);

    expect(() => {
      (frozen as { bytes: Uint8Array }).bytes = new Uint8Array([9]);
    }).toThrow(TypeError);
  });

  it("returns primitives unchanged", () => {
    expect(cloneAndDeepFreeze(5)).toBe(5);
    expect(cloneAndDeepFreeze(null)).toBe(null);
    expect(cloneAndDeepFreeze("x")).toBe("x");
  });
});

describe("projectedSnapshotsEqual()", () => {
  it("treats structurally equal snapshots as equal regardless of key order", () => {
    const left = snap({ a: 1, b: { c: [1, 2] } });
    const right = snap({ b: { c: [1, 2] }, a: 1 });

    expect(projectedSnapshotsEqual(left, right)).toBe(true);
  });

  it("ignores keys whose value is undefined", () => {
    const left = snap({ a: 1, b: undefined });
    const right = snap({ a: 1 });

    expect(projectedSnapshotsEqual(left, right)).toBe(true);
  });

  it("distinguishes primitive value and type changes", () => {
    expect(projectedSnapshotsEqual(snap({ a: 1 }), snap({ a: 2 }))).toBe(false);
    expect(projectedSnapshotsEqual(snap({ a: 1 }), snap({ a: "1" }))).toBe(false);
    expect(projectedSnapshotsEqual(snap({ a: null }), snap({ a: {} }))).toBe(false);
  });

  it("distinguishes arrays from objects and respects array holes", () => {
    expect(projectedSnapshotsEqual(snap({ a: [] }), snap({ a: {} }))).toBe(false);
    expect(projectedSnapshotsEqual(snap({ a: [1, 2] }), snap({ a: [1] }))).toBe(false);

    const withHole: unknown[] = [];
    withHole[1] = 2;
    expect(projectedSnapshotsEqual(snap({ a: withHole }), snap({ a: [undefined, 2] })))
      .toBe(false);
  });

  it("compares Date, RegExp, Map, Set, and typed-array values by content", () => {
    expect(projectedSnapshotsEqual(
      snap({ at: new Date(1_000) }),
      snap({ at: new Date(1_000) }),
    )).toBe(true);
    expect(projectedSnapshotsEqual(
      snap({ at: new Date(1_000) }),
      snap({ at: new Date(2_000) }),
    )).toBe(false);

    expect(projectedSnapshotsEqual(
      snap({ pattern: /abc/gi }),
      snap({ pattern: /abc/gi }),
    )).toBe(true);
    expect(projectedSnapshotsEqual(
      snap({ pattern: /abc/g }),
      snap({ pattern: /abc/i }),
    )).toBe(false);

    expect(projectedSnapshotsEqual(
      snap({ map: new Map([["k", 1]]) }),
      snap({ map: new Map([["k", 1]]) }),
    )).toBe(true);
    expect(projectedSnapshotsEqual(
      snap({ map: new Map([["k", 1]]) }),
      snap({ map: new Map([["k", 2]]) }),
    )).toBe(false);

    expect(projectedSnapshotsEqual(
      snap({ set: new Set([1, 2]) }),
      snap({ set: new Set([1, 2]) }),
    )).toBe(true);
    expect(projectedSnapshotsEqual(
      snap({ set: new Set([1, 2]) }),
      snap({ set: new Set([1, 3]) }),
    )).toBe(false);

    expect(projectedSnapshotsEqual(
      snap({ bytes: new Uint8Array([1, 2]) }),
      snap({ bytes: new Uint8Array([1, 2]) }),
    )).toBe(true);
    expect(projectedSnapshotsEqual(
      snap({ bytes: new Uint8Array([1, 2]) }),
      snap({ bytes: new Uint8Array([1, 3]) }),
    )).toBe(false);
    expect(projectedSnapshotsEqual(
      snap({ bytes: new Uint8Array([1, 2]) }),
      snap({ bytes: new Int8Array([1, 2]) }),
    )).toBe(false);
  });

  it("compares ArrayBuffer values by bytes", () => {
    expect(projectedSnapshotsEqual(
      snap({ buffer: new Uint8Array([7, 8]).buffer }),
      snap({ buffer: new Uint8Array([7, 8]).buffer }),
    )).toBe(true);
    expect(projectedSnapshotsEqual(
      snap({ buffer: new Uint8Array([7, 8]).buffer }),
      snap({ buffer: new Uint8Array([7, 9]).buffer }),
    )).toBe(false);
  });

  it("terminates on equivalent cyclic structures", () => {
    const leftState: { self?: unknown; value: number } = { value: 1 };
    leftState.self = leftState;
    const rightState: { self?: unknown; value: number } = { value: 1 };
    rightState.self = rightState;

    expect(projectedSnapshotsEqual(snap(leftState), snap(rightState))).toBe(true);
  });
});

describe("diffProjectedPaths()", () => {
  it("returns no changed paths for identical snapshots", () => {
    const left = snap({ count: 1 }, { doubled: 2 });
    const right = snap({ count: 1 }, { doubled: 2 });

    expect(diffProjectedPaths(left, right)).toEqual([]);
  });

  it("reports changed, set, and unset paths across snapshot sections", () => {
    const left = snap({ count: 1, removed: "x" }, { doubled: 2 });
    const right = snap({ count: 2, added: "y" }, { doubled: 4 });
    right.system = { status: "pending", lastError: null };

    expect(diffProjectedPaths(left, right)).toEqual([
      { path: ["computed", "doubled"], kind: "changed" },
      { path: ["state", "added"], kind: "set" },
      { path: ["state", "count"], kind: "changed" },
      { path: ["state", "removed"], kind: "unset" },
      { path: ["system", "status"], kind: "changed" },
    ]);
  });

  it("descends into nested objects and arrays with index segments", () => {
    const left = snap({
      todos: [{ id: "a", done: false }],
      profile: { name: "Kim", age: 30 },
    });
    const right = snap({
      todos: [{ id: "a", done: true }, { id: "b", done: false }],
      profile: { name: "Lee", age: 30 },
    });

    expect(diffProjectedPaths(left, right)).toEqual([
      { path: ["state", "profile", "name"], kind: "changed" },
      { path: ["state", "todos", 0, "done"], kind: "changed" },
      { path: ["state", "todos", 1], kind: "set" },
    ]);
  });

  it("reports removed array entries as unset", () => {
    const left = snap({ items: [1, 2, 3] });
    const right = snap({ items: [1] });

    expect(diffProjectedPaths(left, right)).toEqual([
      { path: ["state", "items", 1], kind: "unset" },
      { path: ["state", "items", 2], kind: "unset" },
    ]);
  });

  it("treats container shape changes as a single changed path", () => {
    expect(diffProjectedPaths(snap({ a: [1] }), snap({ a: { 0: 1 } }))).toEqual([
      { path: ["state", "a"], kind: "changed" },
    ]);
    expect(diffProjectedPaths(
      snap({ at: new Date(1_000) }),
      snap({ at: new Date(2_000) }),
    )).toEqual([
      { path: ["state", "at"], kind: "changed" },
    ]);
  });

  it("treats null transitions as changed", () => {
    expect(diffProjectedPaths(snap({ a: null }), snap({ a: { b: 1 } }))).toEqual([
      { path: ["state", "a"], kind: "changed" },
    ]);
  });

  it("freezes the returned report", () => {
    const report = diffProjectedPaths(snap({ a: 1 }), snap({ a: 2 }));

    expect(Object.isFrozen(report)).toBe(true);
    expect(Object.isFrozen(report[0])).toBe(true);
    expect(Object.isFrozen(report[0]?.path)).toBe(true);
  });
});
