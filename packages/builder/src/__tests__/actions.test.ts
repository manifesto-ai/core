import { describe, it, expect } from "vitest";
import { z } from "zod";
import { createActionsBuilder } from "../actions/actions-builder.js";
import { flow } from "../flow/flow-builder.js";
import { expr } from "../expr/expr-builder.js";
import { buildAccessor } from "../accessor/accessor-builder.js";
import { createComputedBuilder } from "../computed/computed-builder.js";
import { isActionRef } from "../refs/action-ref.js";

describe("ActionsBuilder", () => {
  const schema = z.object({
    status: z.enum(["pending", "active", "completed"]),
    receivedAt: z.number().nullable(),
    count: z.number(),
  });
  const state = buildAccessor(schema);

  describe("define", () => {
    it("defines action with simple flow", () => {
      const builder = createActionsBuilder();

      const { complete } = builder.define({
        complete: {
          flow: flow.patch(state.status).set(expr.lit("completed")),
        },
      });

      expect(isActionRef(complete)).toBe(true);
      expect(complete.name).toBe("complete");
    });

    it("defines action with availability condition", () => {
      const computedBuilder = createComputedBuilder();
      const { canComplete } = computedBuilder.define({
        canComplete: expr.eq(state.status, "active"),
      });

      const builder = createActionsBuilder();

      const { complete } = builder.define({
        complete: {
          available: canComplete,
          flow: flow.patch(state.status).set(expr.lit("completed")),
        },
      });

      expect(complete.name).toBe("complete");
    });

    it("defines action with input schema", () => {
      const builder = createActionsBuilder();

      const { receive } = builder.define({
        receive: {
          input: z.object({
            timestamp: z.number(),
          }),
          flow: flow.patch(state.receivedAt).set(expr.input<number>("timestamp")),
        },
      });

      expect(receive.name).toBe("receive");
    });

    it("defines action with description", () => {
      const builder = createActionsBuilder();

      const { reset } = builder.define({
        reset: {
          description: "Reset the state to initial values",
          flow: flow.seq(
            flow.patch(state.status).set(expr.lit("pending")),
            flow.patch(state.receivedAt).set(expr.lit<number | null>(null)),
            flow.patch(state.count).set(expr.lit(0))
          ),
        },
      });

      expect(reset.name).toBe("reset");
    });

    it("defines multiple actions", () => {
      const builder = createActionsBuilder();

      const { start, stop, reset } = builder.define({
        start: {
          flow: flow.patch(state.status).set(expr.lit("active")),
        },
        stop: {
          flow: flow.patch(state.status).set(expr.lit("completed")),
        },
        reset: {
          flow: flow.patch(state.status).set(expr.lit("pending")),
        },
      });

      expect(start.name).toBe("start");
      expect(stop.name).toBe("stop");
      expect(reset.name).toBe("reset");
    });

    it("allows multiple define calls", () => {
      const builder = createActionsBuilder();

      const { first } = builder.define({
        first: { flow: flow.halt("first") },
      });

      const { second } = builder.define({
        second: { flow: flow.halt("second") },
      });

      expect(first.name).toBe("first");
      expect(second.name).toBe("second");
    });
  });

  describe("intent", () => {
    it("creates intent body from action ref", () => {
      const builder = createActionsBuilder();

      const { increment } = builder.define({
        increment: {
          input: z.object({ amount: z.number() }),
          flow: flow.patch(state.count).set(
            expr.add(state.count, expr.input<number>("amount"))
          ),
        },
      });

      const intent = increment.intent({ amount: 5 });

      expect(intent).toEqual({
        action: "increment",
        input: { amount: 5 },
      });
    });

    it("creates intent without input", () => {
      const builder = createActionsBuilder();

      const { doSomething } = builder.define({
        doSomething: { flow: flow.noop() },
      });

      const intent = doSomething.intent(undefined);

      expect(intent).toEqual({
        action: "doSomething",
        input: undefined,
      });
    });
  });

  describe("buildSpec", () => {
    it("builds spec with flow node", () => {
      const builder = createActionsBuilder();

      builder.define({
        activate: {
          flow: flow.patch(state.status).set(expr.lit("active")),
        },
      });

      const spec = builder.buildSpec();

      expect(spec.activate).toBeDefined();
      expect(spec.activate.flow).toEqual({
        kind: "patch",
        op: "set",
        path: "status",
        value: { kind: "lit", value: "active" },
      });
    });

    it("includes availability expression when provided", () => {
      const computedBuilder = createComputedBuilder();
      const { isPending } = computedBuilder.define({
        isPending: expr.eq(state.status, "pending"),
      });

      const builder = createActionsBuilder();

      builder.define({
        activate: {
          available: isPending,
          flow: flow.patch(state.status).set(expr.lit("active")),
        },
      });

      const spec = builder.buildSpec();
      expect(spec.activate.available).toEqual({ kind: "get", path: "computed.isPending" });
    });

    it("includes input schema when provided", () => {
      const builder = createActionsBuilder();

      builder.define({
        setCount: {
          input: z.object({ value: z.number() }),
          flow: flow.patch(state.count).set(expr.input<number>("value")),
        },
      });

      const spec = builder.buildSpec();
      expect(spec.setCount.inputSchema).toBeDefined();
    });

    it("includes description when provided", () => {
      const builder = createActionsBuilder();

      builder.define({
        myAction: {
          description: "Does something important",
          flow: flow.noop(),
        },
      });

      const spec = builder.buildSpec();
      expect(spec.myAction.description).toBe("Does something important");
    });
  });

  describe("getNames", () => {
    it("returns all defined action names", () => {
      const builder = createActionsBuilder();

      builder.define({
        a: { flow: flow.noop() },
        b: { flow: flow.noop() },
      });

      builder.define({
        c: { flow: flow.noop() },
      });

      const names = builder.getNames();
      expect(names).toContain("a");
      expect(names).toContain("b");
      expect(names).toContain("c");
    });
  });

  describe("getAllDeps", () => {
    it("collects deps from action flows", () => {
      const builder = createActionsBuilder();

      builder.define({
        updateStatus: {
          flow: flow.when(
            expr.eq(state.status, "pending"),
            flow.patch(state.status).set(expr.lit("active"))
          ),
        },
      });

      const deps = builder.getAllDeps();
      expect(deps.has("status")).toBe(true);
    });
  });
});
