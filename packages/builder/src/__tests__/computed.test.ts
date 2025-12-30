import { describe, it, expect } from "vitest";
import { z } from "zod";
import { createComputedBuilder } from "../computed/computed-builder.js";
import { expr } from "../expr/expr-builder.js";
import { buildAccessor } from "../accessor/accessor-builder.js";
import { isComputedRef } from "../refs/computed-ref.js";

describe("ComputedBuilder", () => {
  const schema = z.object({
    status: z.enum(["pending", "active", "completed"]),
    receivedAt: z.number().nullable(),
    total: z.number(),
    count: z.number(),
  });
  const state = buildAccessor(schema);

  describe("define", () => {
    it("defines a single computed with Expr", () => {
      const builder = createComputedBuilder();

      const { isPending } = builder.define({
        isPending: expr.eq(state.status, "pending"),
      });

      expect(isComputedRef(isPending)).toBe(true);
      expect(isPending.name).toBe("isPending");
      expect(isPending.path).toBe("computed.isPending");
    });

    it("defines multiple computed values", () => {
      const builder = createComputedBuilder();

      const { canProcess, isReceived } = builder.define({
        canProcess: expr.and(expr.eq(state.status, "pending"), expr.isNotNull(state.receivedAt)),
        isReceived: expr.isNotNull(state.receivedAt),
      });

      expect(canProcess.name).toBe("canProcess");
      expect(isReceived.name).toBe("isReceived");
    });

    it("allows multiple define calls", () => {
      const builder = createComputedBuilder();

      const { first } = builder.define({
        first: expr.eq(state.status, "pending"),
      });

      const { second } = builder.define({
        second: expr.eq(state.status, "active"),
      });

      expect(first.name).toBe("first");
      expect(second.name).toBe("second");
    });

    it("supports computed with description", () => {
      const builder = createComputedBuilder();

      const { average } = builder.define({
        average: {
          expr: expr.div(state.total, state.count),
          description: "Average value calculated from total and count",
        },
      });

      expect(average.name).toBe("average");
    });
  });

  describe("buildSpec", () => {
    it("builds spec with deps and expr", () => {
      const builder = createComputedBuilder();

      builder.define({
        isPending: expr.eq(state.status, "pending"),
        hasData: expr.gt(state.count, 0),
      });

      const spec = builder.buildSpec();

      // Keys are now full paths (e.g., "computed.isPending")
      expect(spec["computed.isPending"]).toBeDefined();
      expect(spec["computed.isPending"].expr).toEqual({
        kind: "eq",
        left: { kind: "get", path: "status" },
        right: { kind: "lit", value: "pending" },
      });
      expect(spec["computed.isPending"].deps).toContain("status");

      expect(spec["computed.hasData"]).toBeDefined();
      expect(spec["computed.hasData"].deps).toContain("count");
    });

    it("includes description in spec when provided", () => {
      const builder = createComputedBuilder();

      builder.define({
        myComputed: {
          expr: expr.eq(state.status, "pending"),
          description: "Test description",
        },
      });

      const spec = builder.buildSpec();
      expect(spec["computed.myComputed"].description).toBe("Test description");
    });

    it("tracks all deps from complex expressions", () => {
      const builder = createComputedBuilder();

      builder.define({
        complex: expr.and(
          expr.eq(state.status, "active"),
          expr.gt(state.count, 0),
          expr.isNull(state.receivedAt)
        ),
      });

      const spec = builder.buildSpec();
      const deps = spec["computed.complex"].deps;
      expect(deps).toContain("status");
      expect(deps).toContain("count");
      expect(deps).toContain("receivedAt");
    });
  });

  describe("getNames", () => {
    it("returns all defined computed names", () => {
      const builder = createComputedBuilder();

      builder.define({
        first: expr.lit(true),
        second: expr.lit(false),
      });

      builder.define({
        third: expr.lit(true),
      });

      const names = builder.getNames();
      expect(names).toContain("first");
      expect(names).toContain("second");
      expect(names).toContain("third");
    });
  });

  describe("getAllDeps", () => {
    it("returns all dependencies from all computed", () => {
      const builder = createComputedBuilder();

      builder.define({
        a: expr.eq(state.status, "pending"),
        b: expr.gt(state.count, 0),
      });

      const deps = builder.getAllDeps();
      expect(deps.has("status")).toBe(true);
      expect(deps.has("count")).toBe(true);
    });
  });
});
