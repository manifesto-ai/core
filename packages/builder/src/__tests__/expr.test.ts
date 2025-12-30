import { describe, it, expect } from "vitest";
import { z } from "zod";
import { expr } from "../expr/expr-builder.js";
import { buildAccessor } from "../accessor/accessor-builder.js";

describe("expr builder", () => {
  const schema = z.object({
    name: z.string(),
    age: z.number(),
    active: z.boolean(),
    score: z.number().nullable(),
    status: z.enum(["pending", "completed"]),
  });
  const state = buildAccessor(schema);

  describe("literals", () => {
    it("expr.lit creates literal expression", () => {
      const e = expr.lit(42);
      expect(e.compile()).toEqual({ kind: "lit", value: 42 });
    });

    it("expr.lit handles string literals", () => {
      const e = expr.lit("hello");
      expect(e.compile()).toEqual({ kind: "lit", value: "hello" });
    });

    it("expr.lit handles boolean literals", () => {
      const e = expr.lit(true);
      expect(e.compile()).toEqual({ kind: "lit", value: true });
    });

    it("expr.lit handles null", () => {
      const e = expr.lit(null);
      expect(e.compile()).toEqual({ kind: "lit", value: null });
    });
  });

  describe("get", () => {
    it("expr.get creates get expression from FieldRef", () => {
      const e = expr.get(state.name);
      expect(e.compile()).toEqual({ kind: "get", path: "name" });
    });

    it("expr.get returns Expr with deps", () => {
      const e = expr.get(state.age);
      expect(e.deps()).toEqual(["age"]);
    });
  });

  describe("comparisons", () => {
    it("expr.eq compiles equality", () => {
      const e = expr.eq(state.status, "pending");
      expect(e.compile()).toEqual({
        kind: "eq",
        left: { kind: "get", path: "status" },
        right: { kind: "lit", value: "pending" },
      });
    });

    it("expr.neq compiles inequality", () => {
      const e = expr.neq(state.active, false);
      expect(e.compile()).toEqual({
        kind: "neq",
        left: { kind: "get", path: "active" },
        right: { kind: "lit", value: false },
      });
    });

    it("expr.gt compiles greater than", () => {
      const e = expr.gt(state.age, 18);
      expect(e.compile()).toEqual({
        kind: "gt",
        left: { kind: "get", path: "age" },
        right: { kind: "lit", value: 18 },
      });
    });

    it("expr.gte compiles greater than or equal", () => {
      const e = expr.gte(state.score, 0);
      expect(e.compile()).toEqual({
        kind: "gte",
        left: { kind: "get", path: "score" },
        right: { kind: "lit", value: 0 },
      });
    });

    it("expr.lt compiles less than", () => {
      const e = expr.lt(state.age, 65);
      expect(e.compile()).toEqual({
        kind: "lt",
        left: { kind: "get", path: "age" },
        right: { kind: "lit", value: 65 },
      });
    });

    it("expr.lte compiles less than or equal", () => {
      const e = expr.lte(state.score, 100);
      expect(e.compile()).toEqual({
        kind: "lte",
        left: { kind: "get", path: "score" },
        right: { kind: "lit", value: 100 },
      });
    });
  });

  describe("logical operators", () => {
    it("expr.and compiles AND with two args", () => {
      const e = expr.and(expr.get(state.active), expr.eq(state.status, "pending"));
      const compiled = e.compile();
      expect(compiled.kind).toBe("and");
      expect((compiled as { args: unknown[] }).args).toHaveLength(2);
    });

    it("expr.and compiles AND with multiple args", () => {
      const e = expr.and(
        expr.get(state.active),
        expr.eq(state.status, "pending"),
        expr.gt(state.age, 18)
      );
      const compiled = e.compile();
      expect(compiled.kind).toBe("and");
      expect((compiled as { args: unknown[] }).args).toHaveLength(3);
    });

    it("expr.or compiles OR", () => {
      const e = expr.or(expr.eq(state.status, "pending"), expr.eq(state.status, "completed"));
      const compiled = e.compile();
      expect(compiled.kind).toBe("or");
      expect((compiled as { args: unknown[] }).args).toHaveLength(2);
    });

    it("expr.not compiles NOT", () => {
      const e = expr.not(expr.get(state.active));
      expect(e.compile()).toEqual({
        kind: "not",
        arg: { kind: "get", path: "active" },
      });
    });
  });

  describe("null checks", () => {
    it("expr.isNull compiles null check", () => {
      const e = expr.isNull(state.score);
      expect(e.compile()).toEqual({
        kind: "isNull",
        arg: { kind: "get", path: "score" },
      });
    });

    it("expr.isNotNull compiles to not(isNull(...))", () => {
      const e = expr.isNotNull(state.score);
      expect(e.compile()).toEqual({
        kind: "not",
        arg: {
          kind: "isNull",
          arg: { kind: "get", path: "score" },
        },
      });
    });

    it("expr.isSet compiles to not(isNull(...))", () => {
      const e = expr.isSet(state.score);
      expect(e.compile()).toEqual({
        kind: "not",
        arg: {
          kind: "isNull",
          arg: { kind: "get", path: "score" },
        },
      });
    });

    it("expr.isNotSet compiles to isNull(...)", () => {
      const e = expr.isNotSet(state.score);
      expect(e.compile()).toEqual({
        kind: "isNull",
        arg: { kind: "get", path: "score" },
      });
    });
  });

  describe("arithmetic", () => {
    it("expr.add compiles addition", () => {
      const e = expr.add(state.age, 1);
      expect(e.compile()).toEqual({
        kind: "add",
        left: { kind: "get", path: "age" },
        right: { kind: "lit", value: 1 },
      });
    });

    it("expr.sub compiles subtraction", () => {
      const e = expr.sub(state.score, 10);
      expect(e.compile()).toEqual({
        kind: "sub",
        left: { kind: "get", path: "score" },
        right: { kind: "lit", value: 10 },
      });
    });

    it("expr.mul compiles multiplication", () => {
      const e = expr.mul(state.score, 2);
      expect(e.compile()).toEqual({
        kind: "mul",
        left: { kind: "get", path: "score" },
        right: { kind: "lit", value: 2 },
      });
    });

    it("expr.div compiles division", () => {
      const e = expr.div(state.score, 2);
      expect(e.compile()).toEqual({
        kind: "div",
        left: { kind: "get", path: "score" },
        right: { kind: "lit", value: 2 },
      });
    });
  });

  describe("input", () => {
    it("expr.input creates input expression", () => {
      const e = expr.input<number>("amount");
      expect(e.compile()).toEqual({ kind: "get", path: "input.amount" });
    });

    it("expr.input without path gets root input", () => {
      const e = expr.input();
      expect(e.compile()).toEqual({ kind: "get", path: "input" });
    });
  });

  describe("coalesce", () => {
    it("expr.coalesce compiles coalesce with args array", () => {
      const e = expr.coalesce(state.score, 0);
      expect(e.compile()).toEqual({
        kind: "coalesce",
        args: [
          { kind: "get", path: "score" },
          { kind: "lit", value: 0 },
        ],
      });
    });
  });

  describe("cond", () => {
    it("expr.cond compiles to if node", () => {
      const e = expr.cond(expr.get(state.active), "yes", "no");
      expect(e.compile()).toEqual({
        kind: "if",
        cond: { kind: "get", path: "active" },
        then: { kind: "lit", value: "yes" },
        else: { kind: "lit", value: "no" },
      });
    });
  });

  describe("dependency tracking", () => {
    it("collects deps from nested expressions", () => {
      const e = expr.and(
        expr.eq(state.status, "pending"),
        expr.gt(state.age, 18),
        expr.isNull(state.score)
      );
      const deps = e.deps();
      expect(deps).toContain("status");
      expect(deps).toContain("age");
      expect(deps).toContain("score");
    });
  });

  // Collection operations tests with array schema
  describe("collection operations", () => {
    const todoSchema = z.object({
      todos: z.array(
        z.object({
          id: z.string(),
          title: z.string(),
          completed: z.boolean(),
        })
      ),
      tags: z.array(z.string()),
      settings: z.record(z.string(), z.string()),
    });
    const todoState = buildAccessor(todoSchema);

    describe("filter", () => {
      it("expr.filter compiles with predicate", () => {
        const e = expr.filter(todoState.todos, (item) => expr.not(item.completed as unknown as typeof state.active));
        const compiled = e.compile();
        expect(compiled).toEqual({
          kind: "filter",
          array: { kind: "get", path: "todos" },
          predicate: {
            kind: "not",
            arg: { kind: "get", path: "$item.completed" },
          },
        });
      });

      it("expr.filter tracks dependencies on array", () => {
        const e = expr.filter(todoState.todos, (item) => expr.eq(item.completed as unknown as typeof state.active, true));
        expect(e.deps()).toContain("todos");
      });
    });

    describe("map", () => {
      it("expr.map compiles with mapper", () => {
        const e = expr.map(todoState.todos, (item) =>
          expr.merge(item, { completed: expr.lit(true) })
        );
        const compiled = e.compile();
        expect(compiled.kind).toBe("map");
        expect((compiled as { array: unknown }).array).toEqual({
          kind: "get",
          path: "todos",
        });
        expect((compiled as { mapper: { kind: string } }).mapper.kind).toBe("merge");
      });

      it("expr.map tracks dependencies on array", () => {
        const e = expr.map(todoState.todos, (item) =>
          expr.merge(item, { completed: expr.lit(false) })
        );
        expect(e.deps()).toContain("todos");
      });
    });

    describe("merge", () => {
      it("expr.merge compiles objects", () => {
        const e = expr.merge({ a: 1 }, { b: 2 });
        expect(e.compile()).toEqual({
          kind: "merge",
          objects: [
            { kind: "lit", value: { a: 1 } },
            { kind: "lit", value: { b: 2 } },
          ],
        });
      });

      it("expr.merge with refs tracks dependencies", () => {
        const e = expr.merge(todoState.settings, { theme: expr.lit("dark") });
        expect(e.deps()).toContain("settings");
      });
    });

    describe("at", () => {
      it("expr.at compiles array access", () => {
        const e = expr.at(todoState.todos, 0);
        expect(e.compile()).toEqual({
          kind: "at",
          array: { kind: "get", path: "todos" },
          index: { kind: "lit", value: 0 },
        });
      });

      it("expr.at with negative index", () => {
        const e = expr.at(todoState.todos, -1);
        expect(e.compile()).toEqual({
          kind: "at",
          array: { kind: "get", path: "todos" },
          index: { kind: "lit", value: -1 },
        });
      });
    });

    describe("first and last", () => {
      it("expr.first compiles first element access", () => {
        const e = expr.first(todoState.todos);
        expect(e.compile()).toEqual({
          kind: "first",
          array: { kind: "get", path: "todos" },
        });
      });

      it("expr.last compiles last element access", () => {
        const e = expr.last(todoState.todos);
        expect(e.compile()).toEqual({
          kind: "last",
          array: { kind: "get", path: "todos" },
        });
      });
    });

    describe("find", () => {
      it("expr.find compiles with predicate", () => {
        const e = expr.find(todoState.todos, (item) =>
          expr.eq(item.id as unknown as typeof state.name, "target-id")
        );
        const compiled = e.compile();
        expect(compiled).toEqual({
          kind: "find",
          array: { kind: "get", path: "todos" },
          predicate: {
            kind: "eq",
            left: { kind: "get", path: "$item.id" },
            right: { kind: "lit", value: "target-id" },
          },
        });
      });
    });

    describe("every and some", () => {
      it("expr.every compiles with predicate", () => {
        const e = expr.every(todoState.todos, (item) =>
          expr.get(item.completed as unknown as typeof state.active)
        );
        const compiled = e.compile();
        expect(compiled.kind).toBe("every");
        expect((compiled as { predicate: { kind: string } }).predicate.kind).toBe("get");
      });

      it("expr.some compiles with predicate", () => {
        const e = expr.some(todoState.todos, (item) =>
          expr.get(item.completed as unknown as typeof state.active)
        );
        const compiled = e.compile();
        expect(compiled.kind).toBe("some");
        expect((compiled as { predicate: { kind: string } }).predicate.kind).toBe("get");
      });
    });

    describe("includes", () => {
      it("expr.includes compiles with literal item", () => {
        const e = expr.includes(todoState.tags, "important");
        expect(e.compile()).toEqual({
          kind: "includes",
          array: { kind: "get", path: "tags" },
          item: { kind: "lit", value: "important" },
        });
      });
    });

    describe("slice", () => {
      it("expr.slice compiles with start only", () => {
        const e = expr.slice(todoState.todos, 0);
        expect(e.compile()).toEqual({
          kind: "slice",
          array: { kind: "get", path: "todos" },
          start: { kind: "lit", value: 0 },
        });
      });

      it("expr.slice compiles with start and end", () => {
        const e = expr.slice(todoState.todos, 0, 10);
        expect(e.compile()).toEqual({
          kind: "slice",
          array: { kind: "get", path: "todos" },
          start: { kind: "lit", value: 0 },
          end: { kind: "lit", value: 10 },
        });
      });
    });

    describe("substring", () => {
      it("expr.substring compiles with start only", () => {
        const e = expr.substring(state.name, 0);
        expect(e.compile()).toEqual({
          kind: "substring",
          str: { kind: "get", path: "name" },
          start: { kind: "lit", value: 0 },
        });
      });

      it("expr.substring compiles with start and end", () => {
        const e = expr.substring(state.name, 0, 5);
        expect(e.compile()).toEqual({
          kind: "substring",
          str: { kind: "get", path: "name" },
          start: { kind: "lit", value: 0 },
          end: { kind: "lit", value: 5 },
        });
      });
    });

    describe("append", () => {
      it("expr.append compiles to concat", () => {
        const e = expr.append(todoState.tags, "new-tag");
        expect(e.compile()).toEqual({
          kind: "concat",
          args: [
            { kind: "get", path: "tags" },
            { kind: "lit", value: "new-tag" },
          ],
        });
      });

      it("expr.append with multiple items", () => {
        const e = expr.append(todoState.tags, "tag1", "tag2");
        expect(e.compile()).toEqual({
          kind: "concat",
          args: [
            { kind: "get", path: "tags" },
            { kind: "lit", value: "tag1" },
            { kind: "lit", value: "tag2" },
          ],
        });
      });
    });

    describe("object operations", () => {
      it("expr.keys compiles", () => {
        const e = expr.keys(todoState.settings);
        expect(e.compile()).toEqual({
          kind: "keys",
          obj: { kind: "get", path: "settings" },
        });
      });

      it("expr.values compiles", () => {
        const e = expr.values(todoState.settings);
        expect(e.compile()).toEqual({
          kind: "values",
          obj: { kind: "get", path: "settings" },
        });
      });

      it("expr.entries compiles", () => {
        const e = expr.entries(todoState.settings);
        expect(e.compile()).toEqual({
          kind: "entries",
          obj: { kind: "get", path: "settings" },
        });
      });
    });
  });
});
