/**
 * @fileoverview Lexicon Tests
 *
 * Feature checking tests - pure validation, no mocks.
 */

import { describe, it, expect } from "vitest";
import { createLexicon, checkFeatures } from "../lexicon/index.js";
import type { IntentIR } from "../schema/index.js";

describe("Lexicon", () => {
  const lexicon = createLexicon({
    events: {
      CANCEL: {
        eventClass: "CONTROL",
        thetaFrame: {
          required: ["TARGET"],
          optional: [],
          restrictions: {
            TARGET: {
              termKinds: ["entity"],
              entityTypes: ["Order"],
            },
          },
        },
        policyHints: {
          destructive: true,
        },
      },
      LIST: {
        eventClass: "OBSERVE",
        thetaFrame: {
          required: [],
          optional: ["TARGET"],
          restrictions: {
            TARGET: {
              termKinds: ["entity"],
            },
          },
        },
      },
      SOLVE: {
        eventClass: "SOLVE",
        thetaFrame: {
          required: ["THEME"],
          optional: [],
          restrictions: {
            THEME: {
              termKinds: ["expr", "artifact"],
            },
          },
        },
      },
    },
    entities: {
      Order: { fields: { id: "string", status: "string" } },
      User: { fields: { id: "string", name: "string" } },
    },
  });

  describe("checkFeatures", () => {
    it("should pass valid IR", () => {
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
      const result = checkFeatures(ir, lexicon);
      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.requiresConfirm).toBe(true); // destructive
      }
    });

    it("should fail for unknown lemma", () => {
      const ir: IntentIR = {
        v: "0.1",
        force: "DO",
        event: { lemma: "UNKNOWN", class: "CONTROL" },
        args: {},
      };
      const result = checkFeatures(ir, lexicon);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error.code).toBe("UNKNOWN_LEMMA");
        expect(result.suggest).toBe("CLARIFY");
      }
    });

    it("should fail for class mismatch", () => {
      const ir: IntentIR = {
        v: "0.1",
        force: "DO",
        event: { lemma: "CANCEL", class: "OBSERVE" }, // wrong class
        args: {
          TARGET: { kind: "entity", entityType: "Order" },
        },
      };
      const result = checkFeatures(ir, lexicon);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error.code).toBe("CLASS_MISMATCH");
        expect(result.suggest).toBe("ERROR");
      }
    });

    it("should fail for missing required role", () => {
      const ir: IntentIR = {
        v: "0.1",
        force: "DO",
        event: { lemma: "CANCEL", class: "CONTROL" },
        args: {}, // missing TARGET
      };
      const result = checkFeatures(ir, lexicon);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error.code).toBe("MISSING_ROLE");
      }
    });

    it("should fail for invalid term kind", () => {
      const ir: IntentIR = {
        v: "0.1",
        force: "DO",
        event: { lemma: "SOLVE", class: "SOLVE" },
        args: {
          THEME: {
            kind: "value", // should be expr or artifact
            valueType: "string",
            shape: {},
          },
        },
      };
      const result = checkFeatures(ir, lexicon);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error.code).toBe("INVALID_TERM_KIND");
      }
    });

    it("should fail for invalid entity type", () => {
      const ir: IntentIR = {
        v: "0.1",
        force: "DO",
        event: { lemma: "CANCEL", class: "CONTROL" },
        args: {
          TARGET: {
            kind: "entity",
            entityType: "User", // should be Order
          },
        },
      };
      const result = checkFeatures(ir, lexicon);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error.code).toBe("INVALID_ENTITY_TYPE");
      }
    });

    it("should pass LIST without TARGET (optional)", () => {
      const ir: IntentIR = {
        v: "0.1",
        force: "ASK",
        event: { lemma: "LIST", class: "OBSERVE" },
        args: {},
      };
      const result = checkFeatures(ir, lexicon);
      expect(result.valid).toBe(true);
    });

    it("should fail for unknown entity type", () => {
      const ir: IntentIR = {
        v: "0.1",
        force: "ASK",
        event: { lemma: "LIST", class: "OBSERVE" },
        args: {
          TARGET: {
            kind: "entity",
            entityType: "Unknown", // not in lexicon
          },
        },
      };
      const result = checkFeatures(ir, lexicon);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error.code).toBe("UNKNOWN_ENTITY_TYPE");
      }
    });
  });

  describe("createLexicon", () => {
    it("should resolve event by lemma", () => {
      const entry = lexicon.resolveEvent("CANCEL");
      expect(entry).toBeDefined();
      expect(entry?.eventClass).toBe("CONTROL");
    });

    it("should resolve case-insensitively", () => {
      const entry = lexicon.resolveEvent("cancel");
      expect(entry).toBeDefined();
    });

    it("should resolve entity by type", () => {
      const entity = lexicon.resolveEntity("Order");
      expect(entity).toBeDefined();
    });

    it("should resolve action type", () => {
      const actionType = lexicon.resolveActionType("CANCEL");
      expect(actionType).toBe("cancel");
    });
  });
});
