import { describe, it, expect } from "vitest";
import { z } from "zod";
import { defineDomain } from "../domain/define-domain.js";

describe("Diagnostics", () => {
  describe("valid domain", () => {
    it("reports valid when domain has no issues", () => {
      const Schema = z.object({
        status: z.enum(["pending", "active"]),
        count: z.number(),
      });

      const domain = defineDomain(Schema, ({ state, computed, actions, expr, flow }) => {
        const { isPending } = computed.define({
          isPending: expr.eq(state.status, "pending"),
        });

        const { activate } = actions.define({
          activate: {
            available: isPending,
            flow: flow.patch(state.status).set(expr.lit("active")),
          },
        });

        return { computed: { isPending }, actions: { activate } };
      });

      expect(domain.diagnostics.valid).toBe(true);
      expect(domain.diagnostics.errors).toHaveLength(0);
    });
  });

  describe("path validation", () => {
    it("detects valid state paths", () => {
      const Schema = z.object({
        nested: z.object({
          value: z.number(),
        }),
      });

      const domain = defineDomain(Schema, ({ state, computed, expr }) => {
        const { hasValue } = computed.define({
          hasValue: expr.gt(state.nested.value, 0),
        });

        return { computed: { hasValue }, actions: {} };
      });

      expect(domain.diagnostics.valid).toBe(true);
    });
  });

  describe("diagnostic structure", () => {
    it("provides errors array", () => {
      const Schema = z.object({ value: z.number() });
      const domain = defineDomain(Schema, () => ({ computed: {}, actions: {} }));

      expect(Array.isArray(domain.diagnostics.errors)).toBe(true);
    });

    it("provides warnings array", () => {
      const Schema = z.object({ value: z.number() });
      const domain = defineDomain(Schema, () => ({ computed: {}, actions: {} }));

      expect(Array.isArray(domain.diagnostics.warnings)).toBe(true);
    });

    it("valid is true when no errors", () => {
      const Schema = z.object({ value: z.number() });
      const domain = defineDomain(Schema, () => ({ computed: {}, actions: {} }));

      expect(domain.diagnostics.valid).toBe(true);
      expect(domain.diagnostics.errors).toHaveLength(0);
    });
  });

  describe("complex domain validation", () => {
    it("validates domain with multiple computed and actions", () => {
      const Schema = z.object({
        status: z.enum(["pending", "processing", "completed", "failed"]),
        startedAt: z.number().nullable(),
        completedAt: z.number().nullable(),
        errorMessage: z.string().nullable(),
        retryCount: z.number(),
      });

      const domain = defineDomain(Schema, ({ state, computed, actions, expr, flow }) => {
        const { canStart, canRetry, isCompleted, isFailed } = computed.define({
          canStart: expr.and(
            expr.eq(state.status, "pending"),
            expr.isNull(state.startedAt)
          ),
          canRetry: expr.and(
            expr.eq(state.status, "failed"),
            expr.lt(state.retryCount, 3)
          ),
          isCompleted: expr.eq(state.status, "completed"),
          isFailed: expr.eq(state.status, "failed"),
        });

        const { start, complete, fail, retry } = actions.define({
          start: {
            available: canStart,
            flow: flow.seq(
              flow.patch(state.status).set(expr.lit("processing")),
              flow.patch(state.startedAt).set(expr.lit(Date.now()))
            ),
          },
          complete: {
            available: expr.eq(state.status, "processing"),
            flow: flow.seq(
              flow.patch(state.status).set(expr.lit("completed")),
              flow.patch(state.completedAt).set(expr.lit(Date.now()))
            ),
          },
          fail: {
            available: expr.eq(state.status, "processing"),
            flow: flow.seq(
              flow.patch(state.status).set(expr.lit("failed")),
              flow.patch(state.errorMessage).set(expr.lit("Error occurred"))
            ),
          },
          retry: {
            available: canRetry,
            flow: flow.seq(
              flow.patch(state.status).set(expr.lit("processing")),
              flow.patch(state.errorMessage).set(expr.lit(null)),
              flow.patch(state.retryCount).set(expr.add(state.retryCount, 1)),
              flow.patch(state.startedAt).set(expr.lit(Date.now()))
            ),
          },
        });

        return {
          computed: { canStart, canRetry, isCompleted, isFailed },
          actions: { start, complete, fail, retry },
        };
      });

      expect(domain.diagnostics.valid).toBe(true);
      expect(domain.diagnostics.errors).toHaveLength(0);

      // Verify schema was generated correctly
      expect(Object.keys(domain.schema.computed.fields)).toHaveLength(4);
      expect(Object.keys(domain.schema.actions)).toHaveLength(4);
    });
  });

  describe("record type handling", () => {
    it("validates domain with record fields", () => {
      const Schema = z.object({
        items: z.record(
          z.string(),
          z.object({
            name: z.string(),
            quantity: z.number(),
          })
        ),
        totalItems: z.number(),
      });

      const domain = defineDomain(Schema, ({ state, computed, actions, expr, flow }) => {
        const { hasItems } = computed.define({
          hasItems: expr.gt(state.totalItems, 0),
        });

        const { incrementTotal, decrementTotal } = actions.define({
          incrementTotal: {
            flow: flow.patch(state.totalItems).set(expr.add(state.totalItems, 1)),
          },
          decrementTotal: {
            flow: flow.patch(state.totalItems).set(expr.sub(state.totalItems, 1)),
          },
        });

        return { computed: { hasItems }, actions: { incrementTotal, decrementTotal } };
      });

      expect(domain.diagnostics.valid).toBe(true);
    });
  });
});
