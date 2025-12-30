import { describe, it, expect } from "vitest";
import { z } from "zod";
import { flow, type Flow } from "../flow/flow-builder.js";
import { guard, onceNull, onceNotSet } from "../flow/helpers.js";
import { expr } from "../expr/expr-builder.js";
import { buildAccessor } from "../accessor/accessor-builder.js";
import { createFieldRef } from "../refs/field-ref.js";

describe("flow builder", () => {
  const schema = z.object({
    count: z.number(),
    status: z.enum(["pending", "active", "completed"]),
    completedAt: z.number().nullable(),
    name: z.string().optional(),
  });
  const state = buildAccessor(schema);

  describe("flow.seq", () => {
    it("creates sequence flow", () => {
      const f = flow.seq(flow.halt("step1"), flow.halt("step2"));
      const compiled = f.compile();
      expect(compiled.kind).toBe("seq");
      expect((compiled as { steps: unknown[] }).steps).toHaveLength(2);
    });

    it("handles multiple steps", () => {
      const f = flow.seq(flow.halt("a"), flow.halt("b"), flow.halt("c"));
      const compiled = f.compile();
      expect((compiled as { steps: unknown[] }).steps).toHaveLength(3);
    });
  });

  describe("flow.when", () => {
    it("creates conditional flow with then only", () => {
      const f = flow.when(expr.eq(state.status, "pending"), flow.halt("is pending"));
      const compiled = f.compile();
      expect(compiled.kind).toBe("if");
      expect(compiled).toHaveProperty("then");
      // else is included as undefined when not provided
      expect((compiled as { else?: unknown }).else).toBeUndefined();
    });

    it("creates conditional flow with then and else", () => {
      const f = flow.when(
        expr.eq(state.status, "pending"),
        flow.halt("is pending"),
        flow.halt("not pending")
      );
      const compiled = f.compile();
      expect(compiled.kind).toBe("if");
      expect(compiled).toHaveProperty("then");
      expect(compiled).toHaveProperty("else");
    });
  });

  describe("flow.patch", () => {
    it("creates set patch", () => {
      const f = flow.patch(state.count).set(expr.lit(42));
      const compiled = f.compile();
      expect(compiled.kind).toBe("patch");
      expect(compiled).toMatchObject({
        op: "set",
        path: "count",
        value: { kind: "lit", value: 42 },
      });
    });

    it("creates merge patch", () => {
      const f = flow.patch(state.count).merge(expr.lit(10));
      const compiled = f.compile();
      expect(compiled.kind).toBe("patch");
      expect(compiled).toMatchObject({
        op: "merge",
        path: "count",
      });
    });

    it("creates delete patch (uses unset op)", () => {
      const f = flow.patch(state.name).delete();
      const compiled = f.compile();
      expect(compiled.kind).toBe("patch");
      // delete() is an alias for unset()
      expect(compiled).toMatchObject({
        op: "unset",
        path: "name",
      });
    });
  });

  describe("flow.effect", () => {
    it("creates effect with params object", () => {
      const f = flow.effect("notify", { message: expr.lit("hello") });
      const compiled = f.compile();
      expect(compiled.kind).toBe("effect");
      expect(compiled).toMatchObject({
        type: "notify",
        params: { message: { kind: "lit", value: "hello" } },
      });
    });

    it("creates effect with field ref params", () => {
      const f = flow.effect("log", { value: state.count });
      const compiled = f.compile();
      expect(compiled.kind).toBe("effect");
      expect(compiled).toMatchObject({
        type: "log",
        params: { value: { kind: "get", path: "count" } },
      });
    });
  });

  describe("flow.halt", () => {
    it("creates halt flow", () => {
      const f = flow.halt("done");
      const compiled = f.compile();
      expect(compiled).toEqual({ kind: "halt", reason: "done" });
    });
  });

  describe("flow.fail", () => {
    it("creates fail flow", () => {
      const f = flow.fail("INVALID_STATE", "Cannot proceed");
      const compiled = f.compile();
      expect(compiled).toEqual({
        kind: "fail",
        code: "INVALID_STATE",
        message: { kind: "lit", value: "Cannot proceed" },
      });
    });
  });

  describe("flow.noop", () => {
    it("creates noop flow (uses empty seq)", () => {
      const f = flow.noop();
      const compiled = f.compile();
      // noop is implemented as an empty sequence since Core doesn't have noop kind
      expect(compiled).toEqual({ kind: "seq", steps: [] });
    });
  });
});

describe("flow helpers", () => {
  const schema = z.object({
    receivedAt: z.number().nullable(),
    processedAt: z.number().optional(),
    status: z.enum(["pending", "active", "completed"]),
  });
  const state = buildAccessor(schema);

  describe("guard", () => {
    it("creates guarded flow that checks condition first", () => {
      const f = guard(expr.eq(state.status, "pending"), ({ patch }) => {
        patch(state.status).set(expr.lit("active"));
      });
      const compiled = f.compile();
      expect(compiled.kind).toBe("if");
      const ifNode = compiled as { kind: "if"; cond: unknown; then: unknown };
      expect(ifNode.cond).toEqual({
        kind: "eq",
        left: { kind: "get", path: "status" },
        right: { kind: "lit", value: "pending" },
      });
    });
  });

  describe("onceNull", () => {
    it("creates flow that only runs when field is null", () => {
      const f = onceNull(state.receivedAt, ({ patch }) => {
        patch(state.receivedAt).set(expr.input<number>("timestamp"));
      });
      const compiled = f.compile();
      expect(compiled.kind).toBe("if");
      const ifNode = compiled as { kind: "if"; cond: unknown; then: unknown };
      expect(ifNode.cond).toEqual({
        kind: "isNull",
        arg: { kind: "get", path: "receivedAt" },
      });
    });
  });

  describe("onceNotSet", () => {
    it("creates flow that only runs when field is not set (uses isNull)", () => {
      const f = onceNotSet(state.processedAt, ({ patch }) => {
        patch(state.processedAt).set(expr.input<number>("timestamp"));
      });
      const compiled = f.compile();
      expect(compiled.kind).toBe("if");
      const ifNode = compiled as { kind: "if"; cond: unknown; then: unknown };
      // Note: onceNotSet compiles to isNull since Core treats null and undefined the same
      expect(ifNode.cond).toEqual({
        kind: "isNull",
        arg: { kind: "get", path: "processedAt" },
      });
    });
  });
});
