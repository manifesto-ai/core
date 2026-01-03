/**
 * Snapshot Adapter Tests
 *
 * Tests for converting Snapshot to SnapshotView.
 */
import { describe, it, expect } from "vitest";
import {
  toSnapshotView,
  deepFreeze,
  toDeepFrozenSnapshotView,
} from "./snapshot-adapter.js";
import type { Snapshot } from "@manifesto-ai/core";

describe("toSnapshotView", () => {
  const createMockSnapshot = (): Snapshot => ({
    data: {
      users: [{ id: "1", name: "Alice" }],
      count: 10,
    },
    computed: {
      totalUsers: 1,
      isActive: true,
    },
    system: {
      status: "idle",
      lastError: null,
      errors: [],
      pendingRequirements: [],
      currentAction: null,
    },
    input: { type: "test", input: {} },
    meta: {
      version: 5,
      timestamp: Date.now(),
      schemaHash: "hash-123",
    },
  });

  it("should include data field", () => {
    const snapshot = createMockSnapshot();
    const view = toSnapshotView(snapshot);

    expect(view.data).toBeDefined();
    expect((view.data as any).users).toHaveLength(1);
    expect((view.data as any).count).toBe(10);
  });

  it("should include computed field", () => {
    const snapshot = createMockSnapshot();
    const view = toSnapshotView(snapshot);

    expect(view.computed).toBeDefined();
    expect(view.computed.totalUsers).toBe(1);
    expect(view.computed.isActive).toBe(true);
  });

  it("should exclude meta field", () => {
    const snapshot = createMockSnapshot();
    const view = toSnapshotView(snapshot);

    expect((view as any).meta).toBeUndefined();
  });

  it("should exclude system field", () => {
    const snapshot = createMockSnapshot();
    const view = toSnapshotView(snapshot);

    expect((view as any).system).toBeUndefined();
  });

  it("should exclude input field", () => {
    const snapshot = createMockSnapshot();
    const view = toSnapshotView(snapshot);

    expect((view as any).input).toBeUndefined();
  });

  it("should freeze the view object", () => {
    const snapshot = createMockSnapshot();
    const view = toSnapshotView(snapshot);

    expect(Object.isFrozen(view)).toBe(true);
  });

  it("should freeze the computed object", () => {
    const snapshot = createMockSnapshot();
    const view = toSnapshotView(snapshot);

    expect(Object.isFrozen(view.computed)).toBe(true);
  });

  it("should throw when trying to modify frozen view", () => {
    const snapshot = createMockSnapshot();
    const view = toSnapshotView(snapshot);

    expect(() => {
      (view as any).newField = "value";
    }).toThrow();
  });

  it("should throw when trying to modify frozen computed", () => {
    const snapshot = createMockSnapshot();
    const view = toSnapshotView(snapshot);

    expect(() => {
      (view.computed as any).newField = "value";
    }).toThrow();
  });

  it("should handle empty data", () => {
    const snapshot: Snapshot = {
      data: {},
      computed: {},
      system: {
        status: "idle",
        lastError: null,
        errors: [],
        pendingRequirements: [],
        currentAction: null,
      },
      input: null,
      meta: { version: 1, timestamp: Date.now(), schemaHash: "hash" },
    };

    const view = toSnapshotView(snapshot);

    expect(view.data).toEqual({});
    expect(view.computed).toEqual({});
  });
});

describe("deepFreeze", () => {
  it("should freeze object and nested objects", () => {
    const obj = {
      level1: {
        level2: {
          level3: { value: "deep" },
        },
      },
    };

    const frozen = deepFreeze(obj);

    expect(Object.isFrozen(frozen)).toBe(true);
    expect(Object.isFrozen(frozen.level1)).toBe(true);
    expect(Object.isFrozen(frozen.level1.level2)).toBe(true);
    expect(Object.isFrozen(frozen.level1.level2.level3)).toBe(true);
  });

  it("should freeze arrays", () => {
    const obj = {
      items: [{ name: "a" }, { name: "b" }],
    };

    const frozen = deepFreeze(obj);

    expect(Object.isFrozen(frozen.items)).toBe(true);
    expect(Object.isFrozen(frozen.items[0])).toBe(true);
    expect(Object.isFrozen(frozen.items[1])).toBe(true);
  });

  it("should handle primitives in object", () => {
    const obj = {
      str: "hello",
      num: 42,
      bool: true,
      nil: null,
    };

    const frozen = deepFreeze(obj);

    expect(Object.isFrozen(frozen)).toBe(true);
    expect(frozen.str).toBe("hello");
    expect(frozen.num).toBe(42);
  });
});

describe("toDeepFrozenSnapshotView", () => {
  it("should deep freeze the entire view", () => {
    const snapshot: Snapshot = {
      data: {
        nested: {
          deep: { value: "test" },
        },
      },
      computed: {
        derived: { nested: true },
      },
      system: {
        status: "idle",
        lastError: null,
        errors: [],
        pendingRequirements: [],
        currentAction: null,
      },
      input: null,
      meta: { version: 1, timestamp: Date.now(), schemaHash: "hash" },
    };

    const view = toDeepFrozenSnapshotView(snapshot);

    expect(Object.isFrozen(view)).toBe(true);
    expect(Object.isFrozen(view.data)).toBe(true);
    expect(Object.isFrozen((view.data as any).nested)).toBe(true);
    expect(Object.isFrozen((view.data as any).nested.deep)).toBe(true);
    expect(Object.isFrozen(view.computed)).toBe(true);
    expect(Object.isFrozen((view.computed as any).derived)).toBe(true);
  });

  it("should create independent copy of data", () => {
    const snapshot: Snapshot = {
      data: { value: "original" },
      computed: {},
      system: {
        status: "idle",
        lastError: null,
        errors: [],
        pendingRequirements: [],
        currentAction: null,
      },
      input: null,
      meta: { version: 1, timestamp: Date.now(), schemaHash: "hash" },
    };

    const view = toDeepFrozenSnapshotView(snapshot);

    // Modify original
    (snapshot.data as any).value = "modified";

    // View should still have original value (due to structuredClone)
    expect((view.data as any).value).toBe("original");
  });
});
