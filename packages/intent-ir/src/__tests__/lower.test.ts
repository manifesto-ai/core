/**
 * @fileoverview Lowering Tests
 *
 * IntentIR -> IntentBody tests.
 */

import { describe, it, expect } from "vitest";
import { lower, lowerOrThrow } from "../lower/index.js";
import { createLexicon } from "../lexicon/index.js";
import { createResolver } from "../resolver/index.js";
import type { IntentIR } from "../schema/index.js";
import type { ResolutionContext } from "../resolver/index.js";

describe("Lowering", () => {
  const lexicon = createLexicon({
    events: {
      CANCEL: {
        eventClass: "CONTROL",
        thetaFrame: {
          required: ["TARGET"],
          optional: [],
          restrictions: {
            TARGET: { termKinds: ["entity"] },
          },
        },
      },
      LIST: {
        eventClass: "OBSERVE",
        thetaFrame: {
          required: [],
          optional: ["TARGET"],
          restrictions: {},
        },
      },
    },
    entities: {
      Order: { fields: {} },
      User: { fields: {} },
    },
    actionTypes: {
      CANCEL: "order.cancel",
      LIST: "entity.list",
    },
  });

  const resolver = createResolver();

  describe("lower", () => {
    it("should lower valid IR to IntentBody", () => {
      const ir: IntentIR = {
        v: "0.1",
        force: "DO",
        event: { lemma: "CANCEL", class: "CONTROL" },
        args: {
          TARGET: {
            kind: "entity",
            entityType: "Order",
            ref: { kind: "id", id: "123" },
          },
        },
      };

      const result = lower(ir, lexicon, resolver);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.body.type).toBe("order.cancel");
        expect(result.body.input).toBeDefined();
      }
    });

    it("should resolve references during lowering", () => {
      const ir: IntentIR = {
        v: "0.1",
        force: "DO",
        event: { lemma: "CANCEL", class: "CONTROL" },
        args: {
          TARGET: {
            kind: "entity",
            entityType: "Order",
            ref: { kind: "last" },
          },
        },
      };

      const context: ResolutionContext = {
        discourse: [
          { entityType: "Order", id: "order-456", mentionedAt: 1 },
        ],
      };

      const result = lower(ir, lexicon, resolver, context);
      expect(result.ok).toBe(true);
      if (result.ok) {
        // Check resolved IR has concrete ID
        const target = result.resolvedIR.args.TARGET;
        if (target?.kind === "entity" && target.ref) {
          expect(target.ref.id).toBe("order-456");
        }
      }
    });

    it("should return error for unknown lemma", () => {
      const ir: IntentIR = {
        v: "0.1",
        force: "DO",
        event: { lemma: "UNKNOWN", class: "CONTROL" },
        args: {},
      };

      const result = lower(ir, lexicon, resolver);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("UNKNOWN_LEMMA");
      }
    });

    it("should return error for resolution failure", () => {
      const ir: IntentIR = {
        v: "0.1",
        force: "DO",
        event: { lemma: "CANCEL", class: "CONTROL" },
        args: {
          TARGET: {
            kind: "entity",
            entityType: "Order",
            ref: { kind: "this" }, // no focus
          },
        },
      };

      const result = lower(ir, lexicon, resolver, { discourse: [] });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("RESOLUTION_FAILED");
      }
    });

    it("should map cond to input filter", () => {
      const ir: IntentIR = {
        v: "0.1",
        force: "ASK",
        event: { lemma: "LIST", class: "OBSERVE" },
        args: {
          TARGET: { kind: "entity", entityType: "User" },
        },
        cond: [
          {
            lhs: "target.status",
            op: "=",
            rhs: { kind: "value", valueType: "enum", shape: { value: "active" } },
          },
        ],
      };

      const result = lower(ir, lexicon, resolver);
      expect(result.ok).toBe(true);
      if (result.ok) {
        const input = result.body.input as { filter?: unknown[] };
        expect(input.filter).toBeDefined();
        expect(input.filter?.length).toBe(1);
      }
    });
  });

  describe("lowerOrThrow", () => {
    it("should return body and resolvedIR on success", () => {
      const ir: IntentIR = {
        v: "0.1",
        force: "ASK",
        event: { lemma: "LIST", class: "OBSERVE" },
        args: {},
      };

      const { body, resolvedIR } = lowerOrThrow(ir, lexicon, resolver);
      expect(body.type).toBe("entity.list");
      expect(resolvedIR.force).toBe("ASK");
    });

    it("should throw on unknown lemma", () => {
      const ir: IntentIR = {
        v: "0.1",
        force: "DO",
        event: { lemma: "UNKNOWN", class: "CONTROL" },
        args: {},
      };

      expect(() => lowerOrThrow(ir, lexicon, resolver)).toThrow("Unknown lemma");
    });
  });
});
