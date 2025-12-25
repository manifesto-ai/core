import { describe, it, expect } from "vitest";
import { validateDomain } from "./validation";
import type { EditorSource, EditorDerived, EditorAction, EditorPolicy } from "@/domain";

// Helper to create a source with defaults
function createSource(overrides: Partial<EditorSource> & { id: string; path: string }): EditorSource {
  return {
    schemaType: "string",
    description: "",
    ...overrides,
  };
}

// Helper to create a derived with defaults
function createDerived(overrides: Partial<EditorDerived> & { id: string; path: string; deps: string[] }): EditorDerived {
  return {
    expr: null,
    description: "",
    ...overrides,
  };
}

// Helper to create an action with defaults
function createAction(overrides: Partial<EditorAction> & { id: string; path: string }): EditorAction {
  return {
    preconditions: null,
    effectType: "setState",
    effectConfig: null,
    description: "",
    ...overrides,
  };
}

// Helper to create a policy with defaults
function createPolicy(overrides: Partial<EditorPolicy> & { id: string; path: string }): EditorPolicy {
  return {
    targetPath: "",
    condition: null,
    policyType: "allow",
    description: "",
    ...overrides,
  };
}

describe("validation.ts - Domain Validation", () => {
  describe("domain metadata", () => {
    it("should require domain ID", () => {
      const result = validateDomain({
        domainName: "Test",
        sources: {},
        derived: {},
      });

      expect(result.valid).toBe(false);
      expect(result.issues).toContainEqual(
        expect.objectContaining({
          code: "DOMAIN_ID_REQUIRED",
          severity: "error",
        })
      );
    });

    it("should require domain name", () => {
      const result = validateDomain({
        domainId: "test-id",
        sources: {},
        derived: {},
      });

      expect(result.valid).toBe(false);
      expect(result.issues).toContainEqual(
        expect.objectContaining({
          code: "DOMAIN_NAME_REQUIRED",
          severity: "error",
        })
      );
    });

    it("should pass with valid metadata", () => {
      const result = validateDomain({
        domainId: "test-id",
        domainName: "Test Domain",
        sources: {},
        derived: {},
      });

      expect(result.valid).toBe(true);
      expect(result.issues).toHaveLength(0);
    });
  });

  describe("source validation", () => {
    it("should require source path", () => {
      const result = validateDomain({
        domainId: "test-id",
        domainName: "Test",
        sources: {
          source1: createSource({ id: "source1", path: "" }),
        },
        derived: {},
      });

      expect(result.valid).toBe(false);
      expect(result.issues).toContainEqual(
        expect.objectContaining({
          code: "SOURCE_PATH_REQUIRED",
          path: "source1",
        })
      );
    });

    it("should require source path to start with 'data.'", () => {
      const result = validateDomain({
        domainId: "test-id",
        domainName: "Test",
        sources: {
          source1: createSource({ id: "source1", path: "invalidPath" }),
        },
        derived: {},
      });

      expect(result.valid).toBe(false);
      expect(result.issues).toContainEqual(
        expect.objectContaining({
          code: "INVALID_SOURCE_PATH",
          path: "invalidPath",
          suggestedFix: {
            description: "Change to data.invalidPath",
            value: "data.invalidPath",
          },
        })
      );
    });

    it("should pass with valid source path", () => {
      const result = validateDomain({
        domainId: "test-id",
        domainName: "Test",
        sources: {
          source1: createSource({ id: "source1", path: "data.fieldName" }),
        },
        derived: {},
      });

      expect(result.valid).toBe(true);
    });
  });

  describe("derived validation", () => {
    it("should require derived path", () => {
      const result = validateDomain({
        domainId: "test-id",
        domainName: "Test",
        sources: {},
        derived: {
          derived1: createDerived({ id: "derived1", path: "", deps: [] }),
        },
      });

      expect(result.valid).toBe(false);
      expect(result.issues).toContainEqual(
        expect.objectContaining({
          code: "DERIVED_PATH_REQUIRED",
          path: "derived1",
        })
      );
    });

    it("should require derived path to start with 'derived.'", () => {
      const result = validateDomain({
        domainId: "test-id",
        domainName: "Test",
        sources: {},
        derived: {
          derived1: createDerived({ id: "derived1", path: "invalidPath", deps: [] }),
        },
      });

      expect(result.valid).toBe(false);
      expect(result.issues).toContainEqual(
        expect.objectContaining({
          code: "INVALID_DERIVED_PATH",
          path: "invalidPath",
          suggestedFix: {
            description: "Change to derived.invalidPath",
            value: "derived.invalidPath",
          },
        })
      );
    });

    it("should pass with valid derived path", () => {
      const result = validateDomain({
        domainId: "test-id",
        domainName: "Test",
        sources: {},
        derived: {
          derived1: createDerived({
            id: "derived1",
            path: "derived.calculatedValue",
            deps: [],
            expr: ["get", "data.foo"],
          }),
        },
      });

      expect(result.valid).toBe(true);
    });
  });

  describe("dependency validation", () => {
    it("should detect missing dependencies", () => {
      const result = validateDomain({
        domainId: "test-id",
        domainName: "Test",
        sources: {},
        derived: {
          derived1: createDerived({
            id: "derived1",
            path: "derived.result",
            deps: ["data.nonexistent"],
            expr: ["get", "data.nonexistent"],
          }),
        },
      });

      expect(result.valid).toBe(false);
      expect(result.issues).toContainEqual(
        expect.objectContaining({
          code: "MISSING_DEPENDENCY",
          message: "Dependency 'data.nonexistent' is not defined",
          path: "derived.result",
        })
      );
    });

    it("should pass when dependencies exist", () => {
      const result = validateDomain({
        domainId: "test-id",
        domainName: "Test",
        sources: {
          source1: createSource({ id: "source1", path: "data.price", schemaType: "number" }),
          source2: createSource({ id: "source2", path: "data.quantity", schemaType: "number" }),
        },
        derived: {
          derived1: createDerived({
            id: "derived1",
            path: "derived.total",
            deps: ["data.price", "data.quantity"],
            expr: ["*", ["get", "data.price"], ["get", "data.quantity"]],
          }),
        },
      });

      expect(result.valid).toBe(true);
    });

    it("should allow derived to depend on other derived", () => {
      const result = validateDomain({
        domainId: "test-id",
        domainName: "Test",
        sources: {
          source1: createSource({ id: "source1", path: "data.price", schemaType: "number" }),
        },
        derived: {
          derived1: createDerived({
            id: "derived1",
            path: "derived.doubled",
            deps: ["data.price"],
            expr: ["*", ["get", "data.price"], 2],
          }),
          derived2: createDerived({
            id: "derived2",
            path: "derived.quadrupled",
            deps: ["derived.doubled"],
            expr: ["*", ["get", "derived.doubled"], 2],
          }),
        },
      });

      expect(result.valid).toBe(true);
    });
  });

  describe("circular dependency validation", () => {
    it("should detect self-referencing cycle", () => {
      const result = validateDomain({
        domainId: "test-id",
        domainName: "Test",
        sources: {},
        derived: {
          derived1: createDerived({
            id: "derived1",
            path: "derived.a",
            deps: ["derived.a"],
          }),
        },
      });

      expect(result.valid).toBe(false);
      expect(result.issues).toContainEqual(
        expect.objectContaining({
          code: "CIRCULAR_DEPENDENCY",
          message: expect.stringContaining("derived.a"),
        })
      );
    });

    it("should detect two-node cycle", () => {
      const result = validateDomain({
        domainId: "test-id",
        domainName: "Test",
        sources: {},
        derived: {
          derived1: createDerived({
            id: "derived1",
            path: "derived.a",
            deps: ["derived.b"],
          }),
          derived2: createDerived({
            id: "derived2",
            path: "derived.b",
            deps: ["derived.a"],
          }),
        },
      });

      expect(result.valid).toBe(false);
      expect(result.issues).toContainEqual(
        expect.objectContaining({
          code: "CIRCULAR_DEPENDENCY",
        })
      );
    });

    it("should detect three-node cycle", () => {
      const result = validateDomain({
        domainId: "test-id",
        domainName: "Test",
        sources: {},
        derived: {
          derived1: createDerived({
            id: "derived1",
            path: "derived.a",
            deps: ["derived.c"],
          }),
          derived2: createDerived({
            id: "derived2",
            path: "derived.b",
            deps: ["derived.a"],
          }),
          derived3: createDerived({
            id: "derived3",
            path: "derived.c",
            deps: ["derived.b"],
          }),
        },
      });

      expect(result.valid).toBe(false);
      expect(result.issues).toContainEqual(
        expect.objectContaining({
          code: "CIRCULAR_DEPENDENCY",
        })
      );
    });

    it("should pass when no cycles exist", () => {
      const result = validateDomain({
        domainId: "test-id",
        domainName: "Test",
        sources: {
          source1: createSource({ id: "source1", path: "data.price", schemaType: "number" }),
        },
        derived: {
          derived1: createDerived({
            id: "derived1",
            path: "derived.doubled",
            deps: ["data.price"],
          }),
          derived2: createDerived({
            id: "derived2",
            path: "derived.quadrupled",
            deps: ["derived.doubled"],
          }),
        },
      });

      expect(result.valid).toBe(true);
    });
  });

  describe("complex scenarios", () => {
    it("should handle multiple errors", () => {
      const result = validateDomain({
        // missing domainId and domainName
        sources: {
          source1: createSource({ id: "source1", path: "invalidPath" }), // invalid path
        },
        derived: {
          derived1: createDerived({
            id: "derived1",
            path: "derived.result",
            deps: ["data.missing"], // missing dep
          }),
        },
      });

      expect(result.valid).toBe(false);
      expect(result.issues.length).toBeGreaterThanOrEqual(4);
    });

    it("should handle empty input", () => {
      const result = validateDomain({});

      expect(result.valid).toBe(false);
      expect(result.issues).toContainEqual(
        expect.objectContaining({ code: "DOMAIN_ID_REQUIRED" })
      );
      expect(result.issues).toContainEqual(
        expect.objectContaining({ code: "DOMAIN_NAME_REQUIRED" })
      );
    });

    it("should correctly report valid status", () => {
      const validResult = validateDomain({
        domainId: "test",
        domainName: "Test",
        sources: {},
        derived: {},
      });
      expect(validResult.valid).toBe(true);

      const invalidResult = validateDomain({
        domainId: "test",
        domainName: "Test",
        sources: {
          s1: createSource({ id: "s1", path: "invalid" }),
        },
        derived: {},
      });
      expect(invalidResult.valid).toBe(false);
    });
  });

  describe("action validation", () => {
    it("should require action path", () => {
      const result = validateDomain({
        domainId: "test-id",
        domainName: "Test",
        sources: {},
        derived: {},
        actions: {
          action1: createAction({ id: "action1", path: "" }),
        },
      });

      expect(result.valid).toBe(false);
      expect(result.issues).toContainEqual(
        expect.objectContaining({
          code: "ACTION_PATH_REQUIRED",
          path: "action1",
        })
      );
    });

    it("should require action path to start with 'action.'", () => {
      const result = validateDomain({
        domainId: "test-id",
        domainName: "Test",
        sources: {},
        derived: {},
        actions: {
          action1: createAction({ id: "action1", path: "invalidPath" }),
        },
      });

      expect(result.valid).toBe(false);
      expect(result.issues).toContainEqual(
        expect.objectContaining({
          code: "INVALID_ACTION_PATH",
          path: "invalidPath",
          suggestedFix: {
            description: "Change to action.invalidPath",
            value: "action.invalidPath",
          },
        })
      );
    });

    it("should pass with valid action path", () => {
      const result = validateDomain({
        domainId: "test-id",
        domainName: "Test",
        sources: {},
        derived: {},
        actions: {
          action1: createAction({ id: "action1", path: "action.checkout" }),
        },
      });

      expect(result.valid).toBe(true);
    });
  });

  describe("policy validation", () => {
    it("should require policy path", () => {
      const result = validateDomain({
        domainId: "test-id",
        domainName: "Test",
        sources: {},
        derived: {},
        actions: {},
        policies: {
          policy1: createPolicy({ id: "policy1", path: "" }),
        },
      });

      expect(result.valid).toBe(false);
      expect(result.issues).toContainEqual(
        expect.objectContaining({
          code: "POLICY_PATH_REQUIRED",
          path: "policy1",
        })
      );
    });

    it("should require policy path to start with 'policy.'", () => {
      const result = validateDomain({
        domainId: "test-id",
        domainName: "Test",
        sources: {},
        derived: {},
        actions: {},
        policies: {
          policy1: createPolicy({ id: "policy1", path: "invalidPath" }),
        },
      });

      expect(result.valid).toBe(false);
      expect(result.issues).toContainEqual(
        expect.objectContaining({
          code: "INVALID_POLICY_PATH",
          path: "invalidPath",
          suggestedFix: {
            description: "Change to policy.invalidPath",
            value: "policy.invalidPath",
          },
        })
      );
    });

    it("should validate policy target path exists", () => {
      const result = validateDomain({
        domainId: "test-id",
        domainName: "Test",
        sources: {},
        derived: {},
        actions: {},
        policies: {
          policy1: createPolicy({
            id: "policy1",
            path: "policy.testRule",
            targetPath: "data.nonexistent",
          }),
        },
      });

      expect(result.valid).toBe(false);
      expect(result.issues).toContainEqual(
        expect.objectContaining({
          code: "POLICY_INVALID_TARGET",
          message: "Policy target 'data.nonexistent' is not defined",
        })
      );
    });

    it("should pass with valid policy", () => {
      const result = validateDomain({
        domainId: "test-id",
        domainName: "Test",
        sources: {
          source1: createSource({ id: "source1", path: "data.price" }),
        },
        derived: {},
        actions: {},
        policies: {
          policy1: createPolicy({
            id: "policy1",
            path: "policy.priceRule",
            targetPath: "data.price",
            policyType: "deny",
          }),
        },
      });

      expect(result.valid).toBe(true);
    });
  });
});
