import { describe, it, expect } from "vitest";
import { z } from "zod";
import { defineDomain } from "../domain/define-domain.js";
import { hashSchema } from "@manifesto-ai/core";
import { setupDomain, validateDomain } from "../domain/setup-domain.js";
import { isFieldRef } from "../refs/field-ref.js";
import { isComputedRef } from "../refs/computed-ref.js";
import { isActionRef } from "../refs/action-ref.js";
import { guard, onceNull, onceNotSet } from "../flow/helpers.js";

describe("defineDomain", () => {
  describe("basic domain definition", () => {
    it("creates a domain module with schema", () => {
      const EventSchema = z.object({
        id: z.string(),
        status: z.enum(["pending", "received", "completed"]),
      });

      const EventDomain = defineDomain(EventSchema, ({ computed, actions, expr, flow, state }) => {
        const { isPending } = computed.define({
          isPending: expr.eq(state.status, "pending"),
        });

        const { complete } = actions.define({
          complete: {
            available: isPending,
            flow: flow.patch(state.status).set(expr.lit("completed")),
          },
        });

        return { computed: { isPending }, actions: { complete } };
      });

      expect(EventDomain.schema).toBeDefined();
      expect(EventDomain.schema.id).toBeDefined();
      expect(EventDomain.schema.version).toBe("0.0.0-dev");
      expect(EventDomain.schema.hash).toBeDefined();
    });

    it("computes schema hash using canonical SHA-256", async () => {
      const Schema = z.object({
        value: z.number(),
      });

      const domain = defineDomain(Schema, ({ state, computed, actions, expr, flow }) => {
        const { isPositive } = computed.define({
          isPositive: expr.gt(state.value, 0),
        });
        const { setValue } = actions.define({
          setValue: {
            flow: flow.patch(state.value).set(expr.lit(1)),
          },
        });
        return { computed: { isPositive }, actions: { setValue } };
      });

      const { hash, ...schemaWithoutHash } = domain.schema;
      const expected = await hashSchema(schemaWithoutHash);
      expect(hash).toBe(expected);
    });

    it("provides state accessor", () => {
      const Schema = z.object({
        name: z.string(),
        count: z.number(),
      });

      const domain = defineDomain(Schema, ({ state }) => {
        expect(isFieldRef(state.name)).toBe(true);
        expect(isFieldRef(state.count)).toBe(true);
        return { computed: {}, actions: {} };
      });

      expect(isFieldRef(domain.state.name)).toBe(true);
      expect(domain.state.name.path).toBe("name");
    });

    it("exports computed refs", () => {
      const Schema = z.object({
        value: z.number(),
      });

      const domain = defineDomain(Schema, ({ state, computed, expr }) => {
        const { isPositive, isZero } = computed.define({
          isPositive: expr.gt(state.value, 0),
          isZero: expr.eq(state.value, 0),
        });
        return { computed: { isPositive, isZero }, actions: {} };
      });

      expect(isComputedRef(domain.computed.isPositive)).toBe(true);
      expect(isComputedRef(domain.computed.isZero)).toBe(true);
    });

    it("exports action refs", () => {
      const Schema = z.object({
        count: z.number(),
      });

      const domain = defineDomain(Schema, ({ state, actions, expr, flow }) => {
        const { increment, reset } = actions.define({
          increment: {
            flow: flow.patch(state.count).set(expr.add(state.count, 1)),
          },
          reset: {
            flow: flow.patch(state.count).set(expr.lit(0)),
          },
        });
        return { computed: {}, actions: { increment, reset } };
      });

      expect(isActionRef(domain.actions.increment)).toBe(true);
      expect(isActionRef(domain.actions.reset)).toBe(true);
    });
  });

  describe("domain options", () => {
    it("uses provided id and version", () => {
      const Schema = z.object({ value: z.number() });

      const domain = defineDomain(
        Schema,
        () => ({ computed: {}, actions: {} }),
        { id: "test:custom", version: "2.0.0" }
      );

      expect(domain.schema.id).toBe("test:custom");
      expect(domain.schema.version).toBe("2.0.0");
    });

    it("includes meta when provided", () => {
      const Schema = z.object({ value: z.number() });

      const domain = defineDomain(
        Schema,
        () => ({ computed: {}, actions: {} }),
        {
          meta: {
            description: "Test domain",
          },
        }
      );

      expect(domain.schema.meta).toEqual({
        description: "Test domain",
      });
    });

    it("generates unique id when not provided", () => {
      const Schema = z.object({ value: z.number() });

      const domain1 = defineDomain(Schema, () => ({ computed: {}, actions: {} }));
      const domain2 = defineDomain(Schema, () => ({ computed: {}, actions: {} }));

      expect(domain1.schema.id).toMatch(/^domain:/);
      expect(domain2.schema.id).toMatch(/^domain:/);
      expect(domain1.schema.id).not.toBe(domain2.schema.id);
    });
  });

  describe("flow helpers available", () => {
    it("guard helper works in domain context", () => {
      const Schema = z.object({
        status: z.enum(["pending", "active"]),
      });

      const domain = defineDomain(Schema, ({ state, actions, expr, flow }) => {
        const { activate } = actions.define({
          activate: {
            flow: guard(expr.eq(state.status, "pending"), ({ patch }) => {
              patch(state.status).set(expr.lit("active"));
            }),
          },
        });
        return { computed: {}, actions: { activate } };
      });

      expect(domain.schema.actions.activate.flow.kind).toBe("if");
    });

    it("onceNull helper works in domain context", () => {
      const Schema = z.object({
        processedAt: z.number().nullable(),
      });

      const domain = defineDomain(Schema, ({ state, actions, expr, flow }) => {
        const { process } = actions.define({
          process: {
            flow: onceNull(state.processedAt, ({ patch }) => {
              patch(state.processedAt).set(expr.lit(Date.now()));
            }),
          },
        });
        return { computed: {}, actions: { process } };
      });

      expect(domain.schema.actions.process.flow.kind).toBe("if");
    });

    it("onceNotSet helper works in domain context", () => {
      const Schema = z.object({
        initializedAt: z.number().optional(),
      });

      const domain = defineDomain(Schema, ({ state, actions, expr, flow }) => {
        const { initialize } = actions.define({
          initialize: {
            flow: onceNotSet(state.initializedAt, ({ patch }) => {
              patch(state.initializedAt).set(expr.lit(Date.now()));
            }),
          },
        });
        return { computed: {}, actions: { initialize } };
      });

      expect(domain.schema.actions.initialize.flow.kind).toBe("if");
    });
  });
});

describe("setupDomain", () => {
  it("returns schema and hash from domain", () => {
    const Schema = z.object({ value: z.number() });
    const domain = defineDomain(Schema, () => ({ computed: {}, actions: {} }));

    const result = setupDomain(domain);

    expect(result.schema).toBe(domain.schema);
    expect(result.schemaHash).toBe(domain.schema.hash);
    expect(result.diagnostics).toBeDefined();
  });
});

describe("validateDomain", () => {
  it("returns diagnostics from domain", () => {
    const Schema = z.object({ value: z.number() });
    const domain = defineDomain(Schema, () => ({ computed: {}, actions: {} }));

    const diagnostics = validateDomain(domain);

    expect(diagnostics).toBe(domain.diagnostics);
  });
});
