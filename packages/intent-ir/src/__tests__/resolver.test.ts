/**
 * @fileoverview Resolver Tests
 *
 * Reference resolution tests - deterministic, no mocks.
 */

import { describe, it, expect } from "vitest";
import { createResolver } from "../resolver/index.js";
import type { IntentIR, ResolvedIntentIR } from "../schema/index.js";
import type { ResolutionContext } from "../resolver/index.js";

describe("Resolver", () => {
  const resolver = createResolver();

  describe("resolveReferences", () => {
    it("should preserve collection scope (absent ref)", () => {
      const ir: IntentIR = {
        v: "0.2",
        force: "ASK",
        event: { lemma: "LIST", class: "OBSERVE" },
        args: {
          TARGET: {
            kind: "entity",
            entityType: "User",
            // no ref = collection scope
          },
        },
      };

      const resolved = resolver.resolveReferences(ir);
      expect(resolved.args.TARGET?.kind).toBe("entity");
      if (resolved.args.TARGET?.kind === "entity") {
        expect(resolved.args.TARGET.ref).toBeUndefined();
      }
    });

    it("should pass through id refs unchanged", () => {
      const ir: IntentIR = {
        v: "0.2",
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

      const resolved = resolver.resolveReferences(ir);
      if (resolved.args.TARGET?.kind === "entity" && resolved.args.TARGET.ref) {
        expect(resolved.args.TARGET.ref.kind).toBe("id");
        expect(resolved.args.TARGET.ref.id).toBe("123");
      }
    });

    it("should resolve 'this' to focus", () => {
      const ir: IntentIR = {
        v: "0.2",
        force: "DO",
        event: { lemma: "CANCEL", class: "CONTROL" },
        args: {
          TARGET: {
            kind: "entity",
            entityType: "Order",
            ref: { kind: "this" },
          },
        },
      };

      const context: ResolutionContext = {
        focus: { entityType: "Order", id: "order-456" },
        discourse: [],
      };

      const resolved = resolver.resolveReferences(ir, context);
      if (resolved.args.TARGET?.kind === "entity" && resolved.args.TARGET.ref) {
        expect(resolved.args.TARGET.ref.id).toBe("order-456");
      }
    });

    it("should throw when 'this' has no focus", () => {
      const ir: IntentIR = {
        v: "0.2",
        force: "DO",
        event: { lemma: "CANCEL", class: "CONTROL" },
        args: {
          TARGET: {
            kind: "entity",
            entityType: "Order",
            ref: { kind: "this" },
          },
        },
      };

      const context: ResolutionContext = {
        discourse: [],
      };

      expect(() => resolver.resolveReferences(ir, context)).toThrow(
        'Cannot resolve "this": no focus in context'
      );
    });

    it("should throw when 'this' type mismatch", () => {
      const ir: IntentIR = {
        v: "0.2",
        force: "DO",
        event: { lemma: "CANCEL", class: "CONTROL" },
        args: {
          TARGET: {
            kind: "entity",
            entityType: "Order",
            ref: { kind: "this" },
          },
        },
      };

      const context: ResolutionContext = {
        focus: { entityType: "User", id: "user-123" }, // wrong type
        discourse: [],
      };

      expect(() => resolver.resolveReferences(ir, context)).toThrow(
        "focus is User, expected Order"
      );
    });

    it("should resolve 'last' to most recent of type", () => {
      const ir: IntentIR = {
        v: "0.2",
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
          { entityType: "Order", id: "order-1", mentionedAt: 1 },
          { entityType: "User", id: "user-1", mentionedAt: 2 },
          { entityType: "Order", id: "order-2", mentionedAt: 3 }, // most recent Order
        ],
      };

      const resolved = resolver.resolveReferences(ir, context);
      if (resolved.args.TARGET?.kind === "entity" && resolved.args.TARGET.ref) {
        expect(resolved.args.TARGET.ref.id).toBe("order-2");
      }
    });

    it("should throw when 'last' has no matching type", () => {
      const ir: IntentIR = {
        v: "0.2",
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
          { entityType: "User", id: "user-1", mentionedAt: 1 },
        ],
      };

      expect(() => resolver.resolveReferences(ir, context)).toThrow(
        'no Order in discourse history'
      );
    });

    it("should resolve 'that' to most recent non-focus", () => {
      const ir: IntentIR = {
        v: "0.2",
        force: "DO",
        event: { lemma: "COPY", class: "TRANSFORM" },
        args: {
          SOURCE: {
            kind: "entity",
            entityType: "Order",
            ref: { kind: "that" },
          },
        },
      };

      const context: ResolutionContext = {
        focus: { entityType: "Order", id: "order-focus" },
        discourse: [
          { entityType: "Order", id: "order-focus", mentionedAt: 3 },
          { entityType: "Order", id: "order-other", mentionedAt: 2 },
        ],
      };

      const resolved = resolver.resolveReferences(ir, context);
      if (resolved.args.SOURCE?.kind === "entity" && resolved.args.SOURCE.ref) {
        // Should pick order-other, not order-focus
        expect(resolved.args.SOURCE.ref.id).toBe("order-other");
      }
    });

    it("should preserve non-entity terms", () => {
      const ir: IntentIR = {
        v: "0.2",
        force: "DO",
        event: { lemma: "SOLVE", class: "SOLVE" },
        args: {
          THEME: {
            kind: "expr",
            exprType: "latex",
            expr: "x^2",
          },
        },
      };

      const resolved = resolver.resolveReferences(ir);
      expect(resolved.args.THEME).toEqual(ir.args.THEME);
    });

    it("should resolve entity refs inside list terms", () => {
      const ir: IntentIR = {
        v: "0.2",
        force: "DO",
        event: { lemma: "ASSIGN", class: "TRANSFORM" },
        args: {
          TARGET: {
            kind: "list",
            items: [
              { kind: "entity", entityType: "Order", ref: { kind: "this" } },
              { kind: "entity", entityType: "Order", ref: { kind: "last" } },
            ],
          },
        },
      };

      const context: ResolutionContext = {
        focus: { entityType: "Order", id: "order-1" },
        discourse: [
          { entityType: "Order", id: "order-2", mentionedAt: 2 },
          { entityType: "Order", id: "order-3", mentionedAt: 3 },
        ],
      };

      const resolved = resolver.resolveReferences(ir, context);
      const target = resolved.args.TARGET;
      expect(target?.kind).toBe("list");
      if (target?.kind === "list") {
        const ids = target.items
          .map((item) => (item.kind === "entity" ? item.ref?.id : undefined))
          .filter(Boolean);
        expect(ids).toEqual(["order-1", "order-3"]);
      }
    });
  });
});
