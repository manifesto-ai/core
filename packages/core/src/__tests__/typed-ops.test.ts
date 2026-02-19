import { describe, it, expect, expectTypeOf } from "vitest";
import { defineOps } from "../schema/typed-ops.js";
import type { DataPaths, ValueAt, ObjectPaths } from "../schema/typed-ops.js";
import type { SetPatch, UnsetPatch, MergePatch } from "../schema/patch.js";

// ============================================================================
// Test Domain Types
// ============================================================================

type TodoItem = {
  title: string;
  completed: boolean;
};

type UserProfile = {
  name: string;
  age: number;
  address: {
    city: string;
    zip: string;
  };
};

type TestState = {
  count: number;
  label: string;
  user: UserProfile;
  todos: TodoItem[];
  filter: "all" | "active" | "completed";
  metadata: {
    createdAt: string;
    tags: string[];
  };
};

// ============================================================================
// Compile-Time Type Tests
// ============================================================================

describe("Type-level: DataPaths", () => {
  it("should include top-level keys", () => {
    type Paths = DataPaths<TestState>;
    expectTypeOf<"count">().toMatchTypeOf<Paths>();
    expectTypeOf<"label">().toMatchTypeOf<Paths>();
    expectTypeOf<"user">().toMatchTypeOf<Paths>();
    expectTypeOf<"todos">().toMatchTypeOf<Paths>();
    expectTypeOf<"filter">().toMatchTypeOf<Paths>();
    expectTypeOf<"metadata">().toMatchTypeOf<Paths>();
  });

  it("should include nested object paths", () => {
    type Paths = DataPaths<TestState>;
    expectTypeOf<"user.name">().toMatchTypeOf<Paths>();
    expectTypeOf<"user.age">().toMatchTypeOf<Paths>();
    expectTypeOf<"user.address">().toMatchTypeOf<Paths>();
    expectTypeOf<"user.address.city">().toMatchTypeOf<Paths>();
    expectTypeOf<"user.address.zip">().toMatchTypeOf<Paths>();
    expectTypeOf<"metadata.createdAt">().toMatchTypeOf<Paths>();
  });

  it("should NOT include invalid paths", () => {
    type Paths = DataPaths<TestState>;
    expectTypeOf<"nonexistent">().not.toMatchTypeOf<Paths>();
    expectTypeOf<"user.nonexistent">().not.toMatchTypeOf<Paths>();
    expectTypeOf<"count.value">().not.toMatchTypeOf<Paths>();
  });
});

describe("Type-level: ValueAt", () => {
  it("should resolve top-level field types", () => {
    expectTypeOf<ValueAt<TestState, "count">>().toEqualTypeOf<number>();
    expectTypeOf<ValueAt<TestState, "label">>().toEqualTypeOf<string>();
    expectTypeOf<ValueAt<TestState, "todos">>().toEqualTypeOf<TodoItem[]>();
    expectTypeOf<ValueAt<TestState, "filter">>().toEqualTypeOf<
      "all" | "active" | "completed"
    >();
  });

  it("should resolve nested field types", () => {
    expectTypeOf<ValueAt<TestState, "user.name">>().toEqualTypeOf<string>();
    expectTypeOf<ValueAt<TestState, "user.age">>().toEqualTypeOf<number>();
    expectTypeOf<ValueAt<TestState, "user.address">>().toEqualTypeOf<{
      city: string;
      zip: string;
    }>();
    expectTypeOf<ValueAt<TestState, "user.address.city">>().toEqualTypeOf<string>();
  });

  it("should resolve object types", () => {
    expectTypeOf<ValueAt<TestState, "user">>().toEqualTypeOf<UserProfile>();
    expectTypeOf<ValueAt<TestState, "metadata">>().toEqualTypeOf<{
      createdAt: string;
      tags: string[];
    }>();
  });
});

describe("Type-level: ObjectPaths", () => {
  it("should include plain object paths", () => {
    type OP = ObjectPaths<TestState>;
    expectTypeOf<"user">().toMatchTypeOf<OP>();
    expectTypeOf<"user.address">().toMatchTypeOf<OP>();
    expectTypeOf<"metadata">().toMatchTypeOf<OP>();
  });

  it("should exclude primitive and array paths", () => {
    type OP = ObjectPaths<TestState>;
    expectTypeOf<"count">().not.toMatchTypeOf<OP>();
    expectTypeOf<"label">().not.toMatchTypeOf<OP>();
    expectTypeOf<"todos">().not.toMatchTypeOf<OP>();
    expectTypeOf<"filter">().not.toMatchTypeOf<OP>();
    expectTypeOf<"metadata.tags">().not.toMatchTypeOf<OP>();
    expectTypeOf<"metadata.createdAt">().not.toMatchTypeOf<OP>();
  });
});

// ============================================================================
// Runtime Tests
// ============================================================================

describe("defineOps", () => {
  const ops = defineOps<TestState>();

  describe("set", () => {
    it("should create a set patch for a top-level field", () => {
      const patch = ops.set("count", 42);
      expect(patch).toEqual({ op: "set", path: "count", value: 42 });
    });

    it("should create a set patch for a nested field", () => {
      const patch = ops.set("user.name", "Alice");
      expect(patch).toEqual({ op: "set", path: "user.name", value: "Alice" });
    });

    it("should create a set patch for an enum field", () => {
      const patch = ops.set("filter", "active");
      expect(patch).toEqual({ op: "set", path: "filter", value: "active" });
    });

    it("should create a set patch for a deeply nested field", () => {
      const patch = ops.set("user.address.city", "Seoul");
      expect(patch).toEqual({
        op: "set",
        path: "user.address.city",
        value: "Seoul",
      });
    });

    it("should create a set patch for an array field", () => {
      const todos: TodoItem[] = [{ title: "test", completed: false }];
      const patch = ops.set("todos", todos);
      expect(patch).toEqual({ op: "set", path: "todos", value: todos });
    });

    it("should return SetPatch type", () => {
      const patch = ops.set("count", 1);
      expectTypeOf(patch).toEqualTypeOf<SetPatch>();
    });
  });

  describe("unset", () => {
    it("should create an unset patch", () => {
      const patch = ops.unset("count");
      expect(patch).toEqual({ op: "unset", path: "count" });
    });

    it("should create an unset patch for nested field", () => {
      const patch = ops.unset("user.name");
      expect(patch).toEqual({ op: "unset", path: "user.name" });
    });

    it("should return UnsetPatch type", () => {
      const patch = ops.unset("count");
      expectTypeOf(patch).toEqualTypeOf<UnsetPatch>();
    });
  });

  describe("merge", () => {
    it("should create a merge patch for an object field", () => {
      const patch = ops.merge("user", { name: "Bob" });
      expect(patch).toEqual({
        op: "merge",
        path: "user",
        value: { name: "Bob" },
      });
    });

    it("should create a merge patch for a nested object", () => {
      const patch = ops.merge("user.address", { city: "Busan" });
      expect(patch).toEqual({
        op: "merge",
        path: "user.address",
        value: { city: "Busan" },
      });
    });

    it("should return MergePatch type", () => {
      const patch = ops.merge("user", { age: 30 });
      expectTypeOf(patch).toEqualTypeOf<MergePatch>();
    });
  });

  describe("error", () => {
    it("should create a system.lastError set patch", () => {
      const patch = ops.error("VALIDATION", "Field required");
      expect(patch).toEqual({
        op: "set",
        path: "system.lastError",
        value: {
          code: "VALIDATION",
          message: "Field required",
          source: { actionId: "", nodePath: "" },
          timestamp: 0,
        },
      });
    });

    it("should include context when provided", () => {
      const patch = ops.error("API_ERROR", "Timeout", { endpoint: "/api/v1" });
      expect(patch.value).toEqual(
        expect.objectContaining({
          code: "API_ERROR",
          context: { endpoint: "/api/v1" },
        }),
      );
    });

    it("should return SetPatch type", () => {
      const patch = ops.error("CODE", "msg");
      expectTypeOf(patch).toEqualTypeOf<SetPatch>();
    });
  });

  describe("raw", () => {
    it("should create untyped set patch", () => {
      const patch = ops.raw.set("$host.custom", { key: "value" });
      expect(patch).toEqual({
        op: "set",
        path: "$host.custom",
        value: { key: "value" },
      });
    });

    it("should create untyped unset patch", () => {
      const patch = ops.raw.unset("$host.temp");
      expect(patch).toEqual({ op: "unset", path: "$host.temp" });
    });

    it("should create untyped merge patch", () => {
      const patch = ops.raw.merge("$host.config", { enabled: true });
      expect(patch).toEqual({
        op: "merge",
        path: "$host.config",
        value: { enabled: true },
      });
    });
  });

  describe("integration with apply()", () => {
    it("should produce patches compatible with Core apply", () => {
      const patches = [
        ops.set("count", 10),
        ops.set("user.name", "Charlie"),
        ops.merge("user.address", { zip: "12345" }),
      ];

      // Verify all patches have valid structure
      for (const patch of patches) {
        expect(patch).toHaveProperty("op");
        expect(patch).toHaveProperty("path");
        expect(typeof patch.path).toBe("string");
        expect(patch.path.length).toBeGreaterThan(0);
      }
    });
  });
});
