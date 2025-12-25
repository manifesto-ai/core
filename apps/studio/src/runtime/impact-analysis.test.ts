import { describe, it, expect } from "vitest";
import {
  getDirectDependents,
  getAllDependents,
  getRelatedActions,
  getRelatedPolicies,
  getDependencies,
  getAllDependencies,
} from "./impact-analysis";
import type { EditorDerived, EditorAction, EditorPolicy } from "@/domain";

// Helper to create a derived with defaults
function createDerived(
  overrides: Partial<EditorDerived> & { id: string; path: string; deps: string[] }
): EditorDerived {
  return {
    expr: null,
    description: "",
    ...overrides,
  };
}

// Helper to create an action with defaults
function createAction(
  overrides: Partial<EditorAction> & { id: string; path: string }
): EditorAction {
  return {
    preconditions: null,
    effectType: "setState",
    effectConfig: null,
    description: "",
    ...overrides,
  };
}

// Helper to create a policy with defaults
function createPolicy(
  overrides: Partial<EditorPolicy> & { id: string; path: string }
): EditorPolicy {
  return {
    targetPath: "",
    condition: null,
    policyType: "allow",
    description: "",
    ...overrides,
  };
}

describe("impact-analysis.ts", () => {
  describe("getDirectDependents", () => {
    it("should return empty array for undefined derived", () => {
      expect(getDirectDependents("data.price", undefined)).toEqual([]);
    });

    it("should return empty array for empty derived", () => {
      expect(getDirectDependents("data.price", {})).toEqual([]);
    });

    it("should find direct dependents", () => {
      const derived = {
        d1: createDerived({
          id: "d1",
          path: "derived.total",
          deps: ["data.price", "data.quantity"],
        }),
        d2: createDerived({
          id: "d2",
          path: "derived.tax",
          deps: ["data.price"],
        }),
        d3: createDerived({
          id: "d3",
          path: "derived.other",
          deps: ["data.quantity"],
        }),
      };

      expect(getDirectDependents("data.price", derived)).toEqual([
        "derived.total",
        "derived.tax",
      ]);
    });

    it("should return empty array when no dependents", () => {
      const derived = {
        d1: createDerived({
          id: "d1",
          path: "derived.total",
          deps: ["data.quantity"],
        }),
      };

      expect(getDirectDependents("data.price", derived)).toEqual([]);
    });
  });

  describe("getAllDependents", () => {
    it("should find transitive dependents", () => {
      const derived = {
        d1: createDerived({
          id: "d1",
          path: "derived.doubled",
          deps: ["data.price"],
        }),
        d2: createDerived({
          id: "d2",
          path: "derived.quadrupled",
          deps: ["derived.doubled"],
        }),
        d3: createDerived({
          id: "d3",
          path: "derived.octupled",
          deps: ["derived.quadrupled"],
        }),
      };

      const result = getAllDependents("data.price", derived);
      expect(result).toContain("derived.doubled");
      expect(result).toContain("derived.quadrupled");
      expect(result).toContain("derived.octupled");
      expect(result).toHaveLength(3);
    });

    it("should handle diamond dependencies", () => {
      const derived = {
        d1: createDerived({
          id: "d1",
          path: "derived.a",
          deps: ["data.price"],
        }),
        d2: createDerived({
          id: "d2",
          path: "derived.b",
          deps: ["data.price"],
        }),
        d3: createDerived({
          id: "d3",
          path: "derived.c",
          deps: ["derived.a", "derived.b"],
        }),
      };

      const result = getAllDependents("data.price", derived);
      expect(result).toContain("derived.a");
      expect(result).toContain("derived.b");
      expect(result).toContain("derived.c");
      expect(result).toHaveLength(3);
    });

    it("should handle circular references without infinite loop", () => {
      // This shouldn't happen in valid data, but test robustness
      const derived = {
        d1: createDerived({
          id: "d1",
          path: "derived.a",
          deps: ["data.price", "derived.b"],
        }),
        d2: createDerived({
          id: "d2",
          path: "derived.b",
          deps: ["derived.a"],
        }),
      };

      const result = getAllDependents("data.price", derived);
      expect(result).toContain("derived.a");
      expect(result).toContain("derived.b");
    });
  });

  describe("getRelatedActions", () => {
    it("should return empty array for undefined actions", () => {
      expect(getRelatedActions("data.price", undefined)).toEqual([]);
    });

    it("should find actions with preconditions referencing path", () => {
      const actions = {
        a1: createAction({
          id: "a1",
          path: "action.checkout",
          preconditions: [">=", ["get", "data.price"], 0],
        }),
        a2: createAction({
          id: "a2",
          path: "action.other",
          preconditions: [">=", ["get", "data.quantity"], 0],
        }),
      };

      expect(getRelatedActions("data.price", actions)).toEqual([
        "action.checkout",
      ]);
    });

    it("should find actions with effect config referencing path", () => {
      const actions = {
        a1: createAction({
          id: "a1",
          path: "action.updatePrice",
          effectType: "setState",
          effectConfig: { target: "data.price", value: 100 },
        }),
      };

      expect(getRelatedActions("data.price", actions)).toEqual([
        "action.updatePrice",
      ]);
    });
  });

  describe("getRelatedPolicies", () => {
    it("should return empty array for undefined policies", () => {
      expect(getRelatedPolicies("data.price", undefined)).toEqual([]);
    });

    it("should find policies targeting the path", () => {
      const policies = {
        p1: createPolicy({
          id: "p1",
          path: "policy.priceRule",
          targetPath: "data.price",
        }),
        p2: createPolicy({
          id: "p2",
          path: "policy.quantityRule",
          targetPath: "data.quantity",
        }),
      };

      expect(getRelatedPolicies("data.price", policies)).toEqual([
        "policy.priceRule",
      ]);
    });

    it("should find policies with condition referencing path", () => {
      const policies = {
        p1: createPolicy({
          id: "p1",
          path: "policy.checkoutRule",
          targetPath: "action.checkout",
          condition: [">", ["get", "data.price"], 0],
        }),
      };

      expect(getRelatedPolicies("data.price", policies)).toEqual([
        "policy.checkoutRule",
      ]);
    });
  });

  describe("getDependencies", () => {
    it("should return empty array for undefined derived", () => {
      expect(getDependencies("derived.total", undefined)).toEqual([]);
    });

    it("should return dependencies for a derived path", () => {
      const derived = {
        d1: createDerived({
          id: "d1",
          path: "derived.total",
          deps: ["data.price", "data.quantity"],
        }),
      };

      expect(getDependencies("derived.total", derived)).toEqual([
        "data.price",
        "data.quantity",
      ]);
    });

    it("should return empty array for non-derived path", () => {
      const derived = {
        d1: createDerived({
          id: "d1",
          path: "derived.total",
          deps: ["data.price"],
        }),
      };

      expect(getDependencies("data.price", derived)).toEqual([]);
    });
  });

  describe("getAllDependencies", () => {
    it("should find transitive dependencies", () => {
      const sources = {
        s1: { id: "s1", path: "data.price", schemaType: "number" as const, description: "" },
      };
      const derived = {
        d1: createDerived({
          id: "d1",
          path: "derived.doubled",
          deps: ["data.price"],
        }),
        d2: createDerived({
          id: "d2",
          path: "derived.quadrupled",
          deps: ["derived.doubled"],
        }),
      };

      const result = getAllDependencies("derived.quadrupled", derived, sources);
      expect(result).toContain("derived.doubled");
      expect(result).toContain("data.price");
    });

    it("should stop at source paths", () => {
      const sources = {
        s1: { id: "s1", path: "data.price", schemaType: "number" as const, description: "" },
        s2: { id: "s2", path: "data.quantity", schemaType: "number" as const, description: "" },
      };
      const derived = {
        d1: createDerived({
          id: "d1",
          path: "derived.total",
          deps: ["data.price", "data.quantity"],
        }),
      };

      const result = getAllDependencies("derived.total", derived, sources);
      expect(result).toEqual(["data.price", "data.quantity"]);
    });
  });
});
