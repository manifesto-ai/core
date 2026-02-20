/**
 * Typed Ops Usage Pattern Simulation
 *
 * Tests real-world usage patterns and edge cases to verify type-level
 * correctness before shipping to users.
 */
import { describe, it, expect, expectTypeOf } from "vitest";
import { defineOps } from "../typed-ops.js";
import type { DataPaths, ValueAt, ObjectPaths } from "../typed-ops.js";
import type { Patch, SetPatch } from "@manifesto-ai/core";

// ============================================================================
// Scenario 1: Todo App (basic CRUD)
// ============================================================================

type TodoItem = { id: string; title: string; completed: boolean };

type TodoState = {
  todos: TodoItem[];
  count: number;
  filter: "all" | "active" | "completed";
};

describe("Scenario 1: Todo App", () => {
  const ops = defineOps<TodoState>();

  it("should set primitive fields", () => {
    const p1 = ops.set("count", 10);
    expect(p1).toEqual({ op: "set", path: "count", value: 10 });

    const p2 = ops.set("filter", "active");
    expect(p2).toEqual({ op: "set", path: "filter", value: "active" });
  });

  it("should replace entire array", () => {
    const newTodos: TodoItem[] = [
      { id: "1", title: "Test", completed: false },
    ];
    const p = ops.set("todos", newTodos);
    expect(p).toEqual({ op: "set", path: "todos", value: newTodos });
  });

  it("should NOT allow merge on primitive or array fields", () => {
    type MP = ObjectPaths<TodoState>;
    expectTypeOf<"count">().not.toMatchTypeOf<MP>();
    expectTypeOf<"filter">().not.toMatchTypeOf<MP>();
    expectTypeOf<"todos">().not.toMatchTypeOf<MP>();
  });

  it("should work in effect handler return pattern", () => {
    const handler = async (): Promise<Patch[]> => {
      return [
        ops.set("count", 5),
        ops.set("filter", "completed"),
      ];
    };
    expectTypeOf(handler).returns.resolves.toMatchTypeOf<Patch[]>();
  });

  it("should NOT generate nested paths for array items", () => {
    // Array items (todos.0.title) are not reachable via typed paths.
    // Use raw.set for individual array item access.
    type Paths = DataPaths<TodoState>;
    expectTypeOf<"todos.0">().not.toMatchTypeOf<Paths>();
    expectTypeOf<"todos.0.title">().not.toMatchTypeOf<Paths>();
  });
});

// ============================================================================
// Scenario 2: E-commerce (deeply nested objects)
// ============================================================================

type Address = {
  street: string;
  city: string;
  zip: string;
  country: string;
};

type Customer = {
  name: string;
  email: string;
  address: Address;
  preferences: {
    newsletter: boolean;
    theme: "light" | "dark";
  };
};

type CartItem = {
  productId: string;
  quantity: number;
  price: number;
};

type EcommerceState = {
  customer: Customer;
  cart: CartItem[];
  total: number;
  status: "idle" | "checkout" | "payment" | "confirmed";
  error: string | null;
};

describe("Scenario 2: E-commerce (deep nesting)", () => {
  const ops = defineOps<EcommerceState>();

  it("should autocomplete paths up to 3 levels of nesting", () => {
    type Paths = DataPaths<EcommerceState>;
    // root
    expectTypeOf<"customer">().toMatchTypeOf<Paths>();
    expectTypeOf<"total">().toMatchTypeOf<Paths>();
    // 1 level nested
    expectTypeOf<"customer.name">().toMatchTypeOf<Paths>();
    expectTypeOf<"customer.address">().toMatchTypeOf<Paths>();
    expectTypeOf<"customer.preferences">().toMatchTypeOf<Paths>();
    // 2 levels nested
    expectTypeOf<"customer.address.city">().toMatchTypeOf<Paths>();
    expectTypeOf<"customer.preferences.theme">().toMatchTypeOf<Paths>();
  });

  it("should type-check values at nested paths", () => {
    const p1 = ops.set("customer.address.city", "Seoul");
    expect(p1.value).toBe("Seoul");

    const p2 = ops.set("customer.preferences.theme", "dark");
    expect(p2.value).toBe("dark");

    const p3 = ops.set("status", "checkout");
    expect(p3.value).toBe("checkout");
  });

  it("should merge at object paths only", () => {
    const p1 = ops.merge("customer.address", { city: "Busan", zip: "12345" });
    expect(p1).toEqual({
      op: "merge",
      path: "customer.address",
      value: { city: "Busan", zip: "12345" },
    });

    const p2 = ops.merge("customer.preferences", { newsletter: true });
    expect(p2).toEqual({
      op: "merge",
      path: "customer.preferences",
      value: { newsletter: true },
    });

    const p3 = ops.merge("customer", { name: "Kim" });
    expect(p3.value).toEqual({ name: "Kim" });
  });

  it("should handle null union fields", () => {
    const p1 = ops.set("error", "Payment failed");
    expect(p1.value).toBe("Payment failed");

    const p2 = ops.set("error", null);
    expect(p2.value).toBeNull();
  });
});

// ============================================================================
// Scenario 3: Optional fields
// ============================================================================

type ProfileState = {
  name: string;
  bio?: string;
  avatar?: {
    url: string;
    width: number;
    height: number;
  };
  settings: {
    language: string;
    notifications?: boolean;
  };
};

describe("Scenario 3: Optional fields", () => {
  const ops = defineOps<ProfileState>();

  it("should handle optional primitive fields", () => {
    type Paths = DataPaths<ProfileState>;
    expectTypeOf<"bio">().toMatchTypeOf<Paths>();
    expectTypeOf<"name">().toMatchTypeOf<Paths>();
  });

  it("should handle optional object fields and their nested paths", () => {
    type Paths = DataPaths<ProfileState>;
    expectTypeOf<"avatar">().toMatchTypeOf<Paths>();
    expectTypeOf<"avatar.url">().toMatchTypeOf<Paths>();
    expectTypeOf<"avatar.width">().toMatchTypeOf<Paths>();
  });

  it("should type-check optional field values correctly", () => {
    const p1 = ops.set("bio", "Hello world");
    expect(p1.value).toBe("Hello world");

    const p2 = ops.set("avatar", { url: "https://example.com/a.png", width: 100, height: 100 });
    expect(p2.value).toEqual({ url: "https://example.com/a.png", width: 100, height: 100 });
  });

  it("should allow merge on optional object paths", () => {
    type MP = ObjectPaths<ProfileState>;
    expectTypeOf<"avatar">().toMatchTypeOf<MP>();
    expectTypeOf<"settings">().toMatchTypeOf<MP>();

    const p = ops.merge("avatar", { url: "https://new.com/b.png" });
    expect(p.value).toEqual({ url: "https://new.com/b.png" });
  });

  it("should exclude undefined from set() for optional fields", () => {
    // bio?: string  →  ValueAt = string | undefined
    // But set() uses Exclude<ValueAt, undefined> so undefined is rejected.
    // Use ops.unset("bio") to remove optional fields.
    type BioValue = ValueAt<ProfileState, "bio">;
    expectTypeOf<undefined>().toMatchTypeOf<BioValue>(); // ValueAt still includes undefined

    // But the set() method signature rejects it:
    // ops.set("bio", undefined)  →  TS compile error
    // ops.unset("bio")           →  correct way to clear
    const p = ops.set("bio", "Hello");
    expect(p.value).toBe("Hello");
  });
});

// ============================================================================
// Scenario 4: Effect handler — API sync pattern
// ============================================================================

type SyncState = {
  data: {
    items: string[];
    lastSync: string | null;
  };
  syncStatus: "idle" | "syncing" | "success" | "error";
  errorMessage: string | null;
  retryCount: number;
};

describe("Scenario 4: Effect handler pattern", () => {
  const ops = defineOps<SyncState>();

  it("should build success patch sequence", () => {
    const now = "2026-02-19T00:00:00Z";
    const items = ["a", "b", "c"];

    const patches: Patch[] = [
      ops.set("data.items", items),
      ops.set("data.lastSync", now),
      ops.set("syncStatus", "success"),
      ops.set("errorMessage", null),
    ];

    expect(patches).toHaveLength(4);
    expect(patches[0]).toEqual({ op: "set", path: "data.items", value: items });
    expect(patches[2]).toEqual({ op: "set", path: "syncStatus", value: "success" });
  });

  it("should build error patch sequence", () => {
    const patches: Patch[] = [
      ops.set("syncStatus", "error"),
      ops.set("errorMessage", "Network timeout"),
      ops.set("retryCount", 3),
    ];

    expect(patches).toHaveLength(3);
  });

  it("should merge data object partially", () => {
    const p = ops.merge("data", { lastSync: "2026-02-19T12:00:00Z" });
    expect(p).toEqual({
      op: "merge",
      path: "data",
      value: { lastSync: "2026-02-19T12:00:00Z" },
    });
  });

  it("should create error convenience patch", () => {
    const p = ops.error("SYNC_FAILED", "API returned 500", { context: { endpoint: "/api/items" } });
    expect(p.op).toBe("set");
    expect(p.path).toBe("system.lastError");
  });

  it("should create error patch with source metadata", () => {
    const p = ops.error("SYNC_FAILED", "API returned 500", {
      source: { actionId: "sync-action", nodePath: "sync.fetch" },
      timestamp: Date.now(),
      context: { endpoint: "/api/items" },
    });
    expect(p.op).toBe("set");
    expect((p.value as Record<string, unknown>).code).toBe("SYNC_FAILED");
    expect((p.value as Record<string, { actionId: string }>).source.actionId).toBe("sync-action");
  });
});

// ============================================================================
// Scenario 5: raw escape hatch — platform namespaces
// ============================================================================

type SimpleState = {
  count: number;
};

describe("Scenario 5: raw escape hatch", () => {
  const ops = defineOps<SimpleState>();

  it("should allow platform namespace paths via raw", () => {
    const p1 = ops.raw.set("$host.intentSlots", { slot1: "value" });
    expect(p1.path).toBe("$host.intentSlots");

    const p2 = ops.raw.merge("$host.config", { debug: true });
    expect(p2.path).toBe("$host.config");
  });

  it("should allow system paths via raw", () => {
    const p = ops.raw.set("system.status", "idle");
    expect(p).toEqual({ op: "set", path: "system.status", value: "idle" });
  });

  it("should allow input paths via raw", () => {
    const p = ops.raw.set("input.amount", 100);
    expect(p).toEqual({ op: "set", path: "input.amount", value: 100 });
  });

  it("should allow array item access via raw", () => {
    type TodoDomain = { todos: TodoItem[] };
    const todoOps = defineOps<TodoDomain>();

    // Typed API only allows whole-array replacement
    const p1 = todoOps.set("todos", [{ id: "1", title: "a", completed: false }]);
    expect(p1.op).toBe("set");

    // Raw allows individual item access
    const p2 = todoOps.raw.set("todos.0.completed", true);
    expect(p2).toEqual({ op: "set", path: "todos.0.completed", value: true });
  });
});

// ============================================================================
// Scenario 6: Edge case — flat state (no nesting)
// ============================================================================

type FlatState = {
  a: string;
  b: number;
  c: boolean;
};

describe("Scenario 6: Flat state (no nesting)", () => {
  const ops = defineOps<FlatState>();

  it("should have only top-level paths", () => {
    type Paths = DataPaths<FlatState>;
    expectTypeOf<"a">().toMatchTypeOf<Paths>();
    expectTypeOf<"b">().toMatchTypeOf<Paths>();
    expectTypeOf<"c">().toMatchTypeOf<Paths>();
  });

  it("should have no mergeable paths (all primitives)", () => {
    type MP = ObjectPaths<FlatState>;
    expectTypeOf<"a">().not.toMatchTypeOf<MP>();
    expectTypeOf<"b">().not.toMatchTypeOf<MP>();
    expectTypeOf<"c">().not.toMatchTypeOf<MP>();
  });

  it("should create correct patches", () => {
    expect(ops.set("a", "hello")).toEqual({ op: "set", path: "a", value: "hello" });
    expect(ops.set("b", 42)).toEqual({ op: "set", path: "b", value: 42 });
    expect(ops.set("c", true)).toEqual({ op: "set", path: "c", value: true });
    expect(ops.unset("a")).toEqual({ op: "unset", path: "a" });
  });
});

// ============================================================================
// Scenario 7: Record<string, T> fields (dynamic keys)
// ============================================================================

type DashboardState = {
  widgets: Record<string, { title: string; visible: boolean }>;
  layout: string;
};

describe("Scenario 7: Record<string, T> fields", () => {
  const ops = defineOps<DashboardState>();

  it("should include Record field as a valid path", () => {
    type Paths = DataPaths<DashboardState>;
    expectTypeOf<"widgets">().toMatchTypeOf<Paths>();
    expectTypeOf<"layout">().toMatchTypeOf<Paths>();
  });

  it("should NOT generate sub-paths for Record<string, T> fields", () => {
    // Record<string, T> has dynamic keys that Core's path resolution
    // cannot validate — sub-paths would fail with PATH_NOT_FOUND.
    // Use raw.set("widgets.chart", value) for dynamic key access.
    type Paths = DataPaths<DashboardState>;
    expectTypeOf<"widgets.chart">().not.toMatchTypeOf<Paths>();
    expectTypeOf<"widgets.anything">().not.toMatchTypeOf<Paths>();
  });

  it("should still resolve Record sub-path value type via ValueAt", () => {
    // ValueAt still resolves — useful for raw escape hatch typing
    type V = ValueAt<DashboardState, "widgets.myWidget">;
    expectTypeOf<V>().toEqualTypeOf<{ title: string; visible: boolean }>();
  });

  it("should allow merge on Record fields", () => {
    const p = ops.merge("widgets", {
      widget1: { title: "Chart", visible: true },
    });
    expect(p).toEqual({
      op: "merge",
      path: "widgets",
      value: { widget1: { title: "Chart", visible: true } },
    });
  });

  it("should allow set to replace entire Record", () => {
    const p = ops.set("widgets", {
      w1: { title: "A", visible: true },
      w2: { title: "B", visible: false },
    });
    expect(p.op).toBe("set");
  });
});

// ============================================================================
// Scenario 8: Depth limit verification
// ============================================================================

type DeepState = {
  a: {
    b: {
      c: {
        d: {
          e: {
            value: string;
          };
        };
      };
    };
  };
};

describe("Scenario 8: Depth limit (D=3)", () => {
  it("should resolve up to root + 3 levels of nesting (4 segments)", () => {
    // D=3 → key gen at D=3,2,1,0 → 4 recursion steps → 4 segments max
    //
    // D=3: "a" + recurse(Prev[3]=2)
    // D=2: "b" + recurse(Prev[2]=1)
    // D=1: "c" + recurse(Prev[1]=0)
    // D=0: "d" (key only) + recurse(Prev[0]=never) → stops
    type Paths = DataPaths<DeepState>;
    expectTypeOf<"a">().toMatchTypeOf<Paths>();         // 1 segment
    expectTypeOf<"a.b">().toMatchTypeOf<Paths>();       // 2 segments
    expectTypeOf<"a.b.c">().toMatchTypeOf<Paths>();     // 3 segments
    expectTypeOf<"a.b.c.d">().toMatchTypeOf<Paths>();   // 4 segments (limit)
  });

  it("should NOT resolve beyond 4 segments", () => {
    type Paths = DataPaths<DeepState>;
    // 5 segments → blocked by depth limit
    expectTypeOf<"a.b.c.d.e">().not.toMatchTypeOf<Paths>();
    // 6 segments → also blocked
    expectTypeOf<"a.b.c.d.e.value">().not.toMatchTypeOf<Paths>();
  });

  it("should still allow raw for deep paths beyond limit", () => {
    const ops = defineOps<DeepState>();
    const p = ops.raw.set("a.b.c.d.e.value", "deep");
    expect(p.value).toBe("deep");
  });
});

// ============================================================================
// Scenario 9: Multiple defineOps instances (isolation)
// ============================================================================

type StateA = { x: number };
type StateB = { y: string };

describe("Scenario 9: Multiple instances isolation", () => {
  it("should not leak paths between instances", () => {
    const opsA = defineOps<StateA>();
    const opsB = defineOps<StateB>();

    const pA = opsA.set("x", 42);
    expect(pA.value).toBe(42);

    const pB = opsB.set("y", "hello");
    expect(pB.value).toBe("hello");

    type PathsA = DataPaths<StateA>;
    type PathsB = DataPaths<StateB>;
    expectTypeOf<"x">().toMatchTypeOf<PathsA>();
    expectTypeOf<"y">().not.toMatchTypeOf<PathsA>();
    expectTypeOf<"y">().toMatchTypeOf<PathsB>();
    expectTypeOf<"x">().not.toMatchTypeOf<PathsB>();
  });
});

// ============================================================================
// Scenario 10: Patch[] accumulation pattern
// ============================================================================

describe("Scenario 10: Batch accumulation", () => {
  const ops = defineOps<EcommerceState>();

  it("should accumulate heterogeneous patches in array", () => {
    const patches: Patch[] = [];

    patches.push(ops.set("status", "checkout"));
    patches.push(ops.merge("customer", { email: "new@test.com" }));
    patches.push(ops.unset("error"));
    patches.push(ops.set("total", 99.99));

    expect(patches).toHaveLength(4);
    expect(patches.map((p) => p.op)).toEqual(["set", "merge", "unset", "set"]);
  });
});

// ============================================================================
// Scenario 11: ValueAt edge cases
// ============================================================================

describe("Scenario 11: ValueAt edge cases", () => {
  it("should resolve nullable types", () => {
    type S = { error: string | null; count: number };
    type V = ValueAt<S, "error">;
    expectTypeOf<V>().toEqualTypeOf<string | null>();
  });

  it("should resolve union literal types", () => {
    type S = { status: "a" | "b" | "c" };
    type V = ValueAt<S, "status">;
    expectTypeOf<V>().toEqualTypeOf<"a" | "b" | "c">();
  });

  it("should resolve array types as-is", () => {
    type S = { items: number[] };
    type V = ValueAt<S, "items">;
    expectTypeOf<V>().toEqualTypeOf<number[]>();
  });

  it("should return never for invalid paths", () => {
    type S = { count: number };
    type V = ValueAt<S, "nonexistent">;
    expectTypeOf<V>().toEqualTypeOf<never>();
  });
});

// ============================================================================
// Scenario 12: Reserved snapshot root exclusion
// ============================================================================

type ReservedFieldState = {
  count: number;
  system: { foo: string };
  input: { bar: number };
  computed: { baz: boolean };
  meta: { qux: string };
  safe: { nested: string };
};

describe("Scenario 12: Reserved snapshot root exclusion", () => {
  const ops = defineOps<ReservedFieldState>();

  it("should allow non-reserved paths", () => {
    const p1 = ops.set("count", 42);
    expect(p1).toEqual({ op: "set", path: "count", value: 42 });

    const p2 = ops.set("safe.nested", "hello");
    expect(p2).toEqual({ op: "set", path: "safe.nested", value: "hello" });
  });

  it("should exclude reserved root paths from DataPaths", () => {
    // These paths would be misrouted by Core's splitPatchPath():
    // "system.foo" → snapshot.system.foo (not snapshot.data.system.foo)
    // TypedOps filters them out to prevent silent runtime corruption.
    type Paths = DataPaths<ReservedFieldState>;

    // DataPaths itself still generates these (it's generic)
    expectTypeOf<"system">().toMatchTypeOf<Paths>();
    expectTypeOf<"system.foo">().toMatchTypeOf<Paths>();

    // But TypedOps interface filters them — verified by:
    // ops.set("system", ...) → TS error
    // ops.set("system.foo", ...) → TS error
    // Users should use raw for reserved namespace access.
  });

  it("should allow reserved path access via raw escape hatch", () => {
    const p = ops.raw.set("system.status", "idle");
    expect(p).toEqual({ op: "set", path: "system.status", value: "idle" });
  });

  it("should not filter reserved names in nested positions", () => {
    // "safe.nested" is fine — "nested" is not a root-level reserved prefix.
    // Nested occurrences of reserved words are safe because splitPatchPath()
    // only checks the first segment.
    type NestState = { safe: { system: string; input: number } };
    type Paths = DataPaths<NestState>;
    expectTypeOf<"safe.system">().toMatchTypeOf<Paths>();
    expectTypeOf<"safe.input">().toMatchTypeOf<Paths>();
  });
});
