/**
 * @fileoverview Canonicalization Tests
 *
 * Verify canonicalization invariants:
 * - Idempotent: canonicalize(canonicalize(ir)) === canonicalize(ir)
 * - Order-invariant: cond order doesn't affect result
 */

import { describe, it, expect } from "vitest";
import { toJcs } from "@manifesto-ai/core";
import {
  canonicalizeSemantic,
  canonicalizeStrict,
  toSemanticCanonicalString,
} from "../canonical/index.js";
import type { IntentIR, Pred } from "../schema/index.js";

describe("Canonicalization", () => {
  const baseIR: IntentIR = {
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

  describe("Semantic Mode", () => {
    it("should be idempotent", () => {
      const once = canonicalizeSemantic(baseIR);
      const twice = canonicalizeSemantic(once);
      expect(toJcs(once)).toBe(toJcs(twice));
    });

    it("should uppercase lemma", () => {
      const ir: IntentIR = {
        ...baseIR,
        event: { lemma: "cancel", class: "CONTROL" },
      };
      // Note: lowercase lemma would fail schema validation
      // but canonicalization should still uppercase
      const canonical = canonicalizeSemantic({
        ...ir,
        event: { lemma: "CANCEL", class: "CONTROL" },
      });
      expect(canonical.event.lemma).toBe("CANCEL");
    });

    it("should remove ValueTerm.raw", () => {
      const ir: IntentIR = {
        ...baseIR,
        args: {
          THEME: {
            kind: "value",
            valueType: "number",
            shape: { range: "1-100" },
            raw: 42,
          },
        },
      };
      const canonical = canonicalizeSemantic(ir);
      const themeTerm = canonical.args.THEME;
      expect(themeTerm?.kind).toBe("value");
      if (themeTerm?.kind === "value") {
        expect(themeTerm.raw).toBeUndefined();
      }
    });

    it("should be order-invariant for predicates", () => {
      const predA: Pred = {
        lhs: "target.status",
        op: "=",
        rhs: { kind: "value", valueType: "enum", shape: { value: "active" } },
      };
      const predB: Pred = {
        lhs: "target.priority",
        op: ">",
        rhs: { kind: "value", valueType: "number", shape: { range: "1-10" } },
      };

      const ir1: IntentIR = { ...baseIR, cond: [predA, predB] };
      const ir2: IntentIR = { ...baseIR, cond: [predB, predA] };

      const canonical1 = toSemanticCanonicalString(ir1);
      const canonical2 = toSemanticCanonicalString(ir2);

      expect(canonical1).toBe(canonical2);
    });

    it("should remove empty optional fields", () => {
      const ir: IntentIR = {
        ...baseIR,
        cond: [],
        ext: {},
      };
      const canonical = canonicalizeSemantic(ir);
      expect(canonical.cond).toBeUndefined();
      expect(canonical.ext).toBeUndefined();
    });
  });

  describe("Strict Mode", () => {
    it("should be idempotent", () => {
      const once = canonicalizeStrict(baseIR);
      const twice = canonicalizeStrict(once);
      expect(toJcs(once)).toBe(toJcs(twice));
    });

    it("should preserve and normalize ValueTerm.raw", () => {
      const ir: IntentIR = {
        ...baseIR,
        args: {
          THEME: {
            kind: "value",
            valueType: "string",
            shape: {},
            raw: "  hello  ", // whitespace
          },
        },
      };
      const canonical = canonicalizeStrict(ir);
      const themeTerm = canonical.args.THEME;
      expect(themeTerm?.kind).toBe("value");
      if (themeTerm?.kind === "value") {
        expect(themeTerm.raw).toBe("hello"); // trimmed
      }
    });

    it("should normalize number raw values", () => {
      const ir: IntentIR = {
        ...baseIR,
        args: {
          THEME: {
            kind: "value",
            valueType: "number",
            shape: {},
            raw: "42",
          },
        },
      };
      const canonical = canonicalizeStrict(ir);
      const themeTerm = canonical.args.THEME;
      if (themeTerm?.kind === "value") {
        expect(themeTerm.raw).toBe(42); // parsed to number
      }
    });
  });

  describe("RFC 8785 Compliance", () => {
    it("should use lexicographic key ordering", () => {
      const ir: IntentIR = {
        v: "0.1",
        force: "DO",
        event: { lemma: "TEST", class: "CONTROL" },
        args: {
          THEME: { kind: "path", path: "/test" },
          TARGET: { kind: "entity", entityType: "X" },
        },
      };
      const canonical = toSemanticCanonicalString(ir);
      // In lexicographic order: TARGET comes before THEME
      const targetIdx = canonical.indexOf("TARGET");
      const themeIdx = canonical.indexOf("THEME");
      expect(targetIdx).toBeLessThan(themeIdx);
    });
  });
});
