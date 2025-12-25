import { describe, it, expect } from "vitest";
import {
  executeScenario,
  applyGiven,
  executeStep,
  recalculateDerived,
  evaluateAssertions,
  evaluateAssertion,
  type DomainDefinition,
  type ExecutionState,
} from "./scenario-executor";
import type {
  Scenario,
  ScenarioStep,
  ScenarioAssertion,
} from "./scenario-types";
import type {
  EditorSource,
  EditorDerived,
  EditorAction,
  EditorPolicy,
} from "../domain/types";

// ============================================================================
// Test Helpers
// ============================================================================

function createSource(
  overrides: Partial<EditorSource> & { id: string; path: string }
): EditorSource {
  return {
    schemaType: "string",
    description: "",
    ...overrides,
  };
}

function createDerived(
  overrides: Partial<EditorDerived> & { id: string; path: string; deps: string[] }
): EditorDerived {
  return {
    expr: null,
    description: "",
    ...overrides,
  };
}

function createAction(
  overrides: Partial<EditorAction> & { id: string; path: string }
): EditorAction {
  return {
    preconditions: true,
    effectType: "setState",
    effectConfig: null,
    description: "",
    ...overrides,
  };
}

function createPolicy(
  overrides: Partial<EditorPolicy> & { id: string; path: string; targetPath: string }
): EditorPolicy {
  return {
    condition: true,
    policyType: "allow",
    description: "",
    ...overrides,
  };
}

function createDomain(
  sources: EditorSource[] = [],
  derived: EditorDerived[] = [],
  actions: EditorAction[] = [],
  policies: EditorPolicy[] = []
): DomainDefinition {
  return {
    sources: Object.fromEntries(sources.map((s) => [s.id, s])),
    derived: Object.fromEntries(derived.map((d) => [d.id, d])),
    actions: Object.fromEntries(actions.map((a) => [a.id, a])),
    policies: Object.fromEntries(policies.map((p) => [p.id, p])),
  };
}

// ============================================================================
// applyGiven Tests
// ============================================================================

describe("applyGiven", () => {
  it("should apply given values to state", () => {
    const domain = createDomain([
      createSource({ id: "name", path: "data.name", defaultValue: "default" }),
    ]);

    const result = applyGiven({ "data.name": "John" }, domain);

    expect(result.values["data.name"]).toBe("John");
  });

  it("should use source defaults for unspecified paths", () => {
    const domain = createDomain([
      createSource({ id: "name", path: "data.name", defaultValue: "default" }),
      createSource({ id: "age", path: "data.age", schemaType: "number", defaultValue: 0 }),
    ]);

    const result = applyGiven({ "data.name": "John" }, domain);

    expect(result.values["data.name"]).toBe("John");
    expect(result.values["data.age"]).toBe(0);
  });

  it("should handle empty given", () => {
    const domain = createDomain([
      createSource({ id: "name", path: "data.name", defaultValue: "default" }),
    ]);

    const result = applyGiven({}, domain);

    expect(result.values["data.name"]).toBe("default");
  });

  it("should handle array values", () => {
    const domain = createDomain([
      createSource({ id: "items", path: "data.items", schemaType: "array", defaultValue: [] }),
    ]);

    const items = [{ id: "1", text: "test" }];
    const result = applyGiven({ "data.items": items }, domain);

    expect(result.values["data.items"]).toEqual(items);
  });
});

// ============================================================================
// recalculateDerived Tests
// ============================================================================

describe("recalculateDerived", () => {
  it("should calculate simple derived value", () => {
    const derived = {
      total: createDerived({
        id: "total",
        path: "derived.total",
        deps: ["data.count"],
        expr: ["*", ["get", "data.count"], 2],
      }),
    };

    const state: ExecutionState = { values: { "data.count": 5 } };
    const result = recalculateDerived(state, derived);

    expect(result.values["derived.total"]).toBe(10);
  });

  it("should handle chained dependencies", () => {
    const derived = {
      double: createDerived({
        id: "double",
        path: "derived.double",
        deps: ["data.value"],
        expr: ["*", ["get", "data.value"], 2],
      }),
      quadruple: createDerived({
        id: "quadruple",
        path: "derived.quadruple",
        deps: ["derived.double"],
        expr: ["*", ["get", "derived.double"], 2],
      }),
    };

    const state: ExecutionState = { values: { "data.value": 3 } };
    const result = recalculateDerived(state, derived);

    expect(result.values["derived.double"]).toBe(6);
    expect(result.values["derived.quadruple"]).toBe(12);
  });

  it("should handle array operations", () => {
    const derived = {
      count: createDerived({
        id: "count",
        path: "derived.count",
        deps: ["data.items"],
        expr: ["count", ["get", "data.items"]],
      }),
    };

    const state: ExecutionState = {
      values: { "data.items": [1, 2, 3, 4, 5] },
    };
    const result = recalculateDerived(state, derived);

    expect(result.values["derived.count"]).toBe(5);
  });

  it("should handle boolean expressions", () => {
    const derived = {
      canSubmit: createDerived({
        id: "canSubmit",
        path: "derived.canSubmit",
        deps: ["data.value"],
        expr: [">", ["get", "data.value"], 0],
      }),
    };

    const state: ExecutionState = { values: { "data.value": 5 } };
    const result = recalculateDerived(state, derived);

    expect(result.values["derived.canSubmit"]).toBe(true);
  });
});

// ============================================================================
// executeStep Tests
// ============================================================================

describe("executeStep", () => {
  it("should execute action with setState effect", () => {
    const action = createAction({
      id: "increment",
      path: "action.increment",
      effectConfig: {
        updates: [{ path: "data.count", expr: ["+", ["get", "data.count"], 1] }],
      },
    });

    const domain = createDomain([], [], [action]);
    const state: ExecutionState = { values: { "data.count": 0 } };
    const step: ScenarioStep = { action: "action.increment" };

    const result = executeStep(step, state, domain);

    expect(result.success).toBe(true);
    expect(result.stateChanges["data.count"]).toEqual({ before: 0, after: 1 });
  });

  it("should fail when action not found", () => {
    const domain = createDomain();
    const state: ExecutionState = { values: {} };
    const step: ScenarioStep = { action: "action.unknown" };

    const result = executeStep(step, state, domain);

    expect(result.success).toBe(false);
    expect(result.error).toContain("not found");
  });

  it("should fail when precondition not met", () => {
    const action = createAction({
      id: "submit",
      path: "action.submit",
      preconditions: [">", ["get", "data.count"], 0],
    });

    const domain = createDomain([], [], [action]);
    const state: ExecutionState = { values: { "data.count": 0 } };
    const step: ScenarioStep = { action: "action.submit" };

    const result = executeStep(step, state, domain);

    expect(result.success).toBe(false);
    expect(result.preconditionMet).toBe(false);
  });

  it("should pass when precondition is met", () => {
    const action = createAction({
      id: "submit",
      path: "action.submit",
      preconditions: [">", ["get", "data.count"], 0],
      effectConfig: { updates: [] },
    });

    const domain = createDomain([], [], [action]);
    const state: ExecutionState = { values: { "data.count": 5 } };
    const step: ScenarioStep = { action: "action.submit" };

    const result = executeStep(step, state, domain);

    expect(result.success).toBe(true);
    expect(result.preconditionMet).toBe(true);
  });

  it("should handle action with input", () => {
    const action = createAction({
      id: "setName",
      path: "action.setName",
      effectConfig: {
        input: { name: "string" },
        updates: [{ path: "data.name", expr: ["get", "$input.name"] }],
      },
    });

    const domain = createDomain([], [], [action]);
    const state: ExecutionState = { values: { "data.name": "old" } };
    const step: ScenarioStep = {
      action: "action.setName",
      input: { name: "new" },
    };

    const result = executeStep(step, state, domain);

    expect(result.success).toBe(true);
    expect(result.stateChanges["data.name"]).toEqual({ before: "old", after: "new" });
  });

  it("should fail when deny policy condition is met", () => {
    const action = createAction({
      id: "delete",
      path: "action.delete",
      effectConfig: { updates: [] },
    });

    const policy = createPolicy({
      id: "denyDelete",
      path: "policy.denyDelete",
      targetPath: "action.delete",
      policyType: "deny",
      condition: ["get", "data.isProtected"],
    });

    const domain = createDomain([], [], [action], [policy]);
    const state: ExecutionState = { values: { "data.isProtected": true } };
    const step: ScenarioStep = { action: "action.delete" };

    const result = executeStep(step, state, domain);

    expect(result.success).toBe(false);
    expect(result.error).toContain("Policy denied");
  });

  it("should pass when deny policy condition is not met", () => {
    const action = createAction({
      id: "delete",
      path: "action.delete",
      effectConfig: { updates: [] },
    });

    const policy = createPolicy({
      id: "denyDelete",
      path: "policy.denyDelete",
      targetPath: "action.delete",
      policyType: "deny",
      condition: ["get", "data.isProtected"],
    });

    const domain = createDomain([], [], [action], [policy]);
    const state: ExecutionState = { values: { "data.isProtected": false } };
    const step: ScenarioStep = { action: "action.delete" };

    const result = executeStep(step, state, domain);

    expect(result.success).toBe(true);
  });
});

// ============================================================================
// evaluateAssertion Tests
// ============================================================================

describe("evaluateAssertion", () => {
  it("should pass eq assertion when values match", () => {
    const state: ExecutionState = { values: { "data.count": 5 } };
    const assertion: ScenarioAssertion = {
      path: "data.count",
      operator: "eq",
      expected: 5,
    };

    const result = evaluateAssertion(assertion, state);

    expect(result.passed).toBe(true);
  });

  it("should fail eq assertion when values differ", () => {
    const state: ExecutionState = { values: { "data.count": 5 } };
    const assertion: ScenarioAssertion = {
      path: "data.count",
      operator: "eq",
      expected: 10,
    };

    const result = evaluateAssertion(assertion, state);

    expect(result.passed).toBe(false);
    expect(result.actual).toBe(5);
    expect(result.expected).toBe(10);
  });

  it("should handle gt operator", () => {
    const state: ExecutionState = { values: { "data.count": 5 } };

    expect(
      evaluateAssertion(
        { path: "data.count", operator: "gt", expected: 3 },
        state
      ).passed
    ).toBe(true);

    expect(
      evaluateAssertion(
        { path: "data.count", operator: "gt", expected: 5 },
        state
      ).passed
    ).toBe(false);
  });

  it("should handle gte operator", () => {
    const state: ExecutionState = { values: { "data.count": 5 } };

    expect(
      evaluateAssertion(
        { path: "data.count", operator: "gte", expected: 5 },
        state
      ).passed
    ).toBe(true);
  });

  it("should handle lt operator", () => {
    const state: ExecutionState = { values: { "data.count": 5 } };

    expect(
      evaluateAssertion(
        { path: "data.count", operator: "lt", expected: 10 },
        state
      ).passed
    ).toBe(true);
  });

  it("should handle lte operator", () => {
    const state: ExecutionState = { values: { "data.count": 5 } };

    expect(
      evaluateAssertion(
        { path: "data.count", operator: "lte", expected: 5 },
        state
      ).passed
    ).toBe(true);
  });

  it("should handle contains operator for arrays", () => {
    const state: ExecutionState = { values: { "data.items": [1, 2, 3] } };

    expect(
      evaluateAssertion(
        { path: "data.items", operator: "contains", expected: 2 },
        state
      ).passed
    ).toBe(true);

    expect(
      evaluateAssertion(
        { path: "data.items", operator: "contains", expected: 5 },
        state
      ).passed
    ).toBe(false);
  });

  it("should handle contains operator for strings", () => {
    const state: ExecutionState = { values: { "data.text": "hello world" } };

    expect(
      evaluateAssertion(
        { path: "data.text", operator: "contains", expected: "world" },
        state
      ).passed
    ).toBe(true);
  });

  it("should handle length operator", () => {
    const state: ExecutionState = { values: { "data.items": [1, 2, 3] } };

    expect(
      evaluateAssertion(
        { path: "data.items", operator: "length", expected: 3 },
        state
      ).passed
    ).toBe(true);
  });

  it("should handle truthy operator", () => {
    const state: ExecutionState = { values: { "data.flag": true } };

    expect(
      evaluateAssertion(
        { path: "data.flag", operator: "truthy" },
        state
      ).passed
    ).toBe(true);
  });

  it("should handle falsy operator", () => {
    const state: ExecutionState = { values: { "data.flag": false } };

    expect(
      evaluateAssertion(
        { path: "data.flag", operator: "falsy" },
        state
      ).passed
    ).toBe(true);
  });

  it("should handle array index notation", () => {
    const state: ExecutionState = {
      values: { "data.items": [{ text: "first" }, { text: "second" }] },
    };

    const result = evaluateAssertion(
      { path: "data.items[0].text", operator: "eq", expected: "first" },
      state
    );

    expect(result.passed).toBe(true);
    expect(result.actual).toBe("first");
  });

  it("should handle deep object comparison", () => {
    const state: ExecutionState = {
      values: { "data.user": { name: "John", age: 30 } },
    };

    expect(
      evaluateAssertion(
        {
          path: "data.user",
          operator: "eq",
          expected: { name: "John", age: 30 },
        },
        state
      ).passed
    ).toBe(true);
  });
});

// ============================================================================
// executeScenario Integration Tests
// ============================================================================

describe("executeScenario", () => {
  it("should execute simple counter scenario", () => {
    const domain = createDomain(
      [createSource({ id: "count", path: "data.count", schemaType: "number", defaultValue: 0 })],
      [],
      [
        createAction({
          id: "increment",
          path: "action.increment",
          effectConfig: {
            updates: [{ path: "data.count", expr: ["+", ["get", "data.count"], 1] }],
          },
        }),
      ]
    );

    const scenario: Scenario = {
      id: "increment-test",
      name: "Increment Test",
      given: { "data.count": 5 },
      when: [{ action: "action.increment" }],
      then: [{ path: "data.count", operator: "eq", expected: 6 }],
    };

    const result = executeScenario(scenario, domain);

    expect(result.passed).toBe(true);
    expect(result.steps.length).toBe(1);
    expect(result.steps[0].success).toBe(true);
    expect(result.assertions.length).toBe(1);
    expect(result.assertions[0].passed).toBe(true);
  });

  it("should execute scenario with derived recalculation", () => {
    const domain = createDomain(
      [createSource({ id: "items", path: "data.items", schemaType: "array", defaultValue: [] })],
      [
        createDerived({
          id: "count",
          path: "derived.count",
          deps: ["data.items"],
          expr: ["count", ["get", "data.items"]],
        }),
      ],
      [
        createAction({
          id: "addItem",
          path: "action.addItem",
          effectConfig: {
            input: { value: "number" },
            updates: [
              {
                path: "data.items",
                expr: ["append", ["get", "data.items"], ["get", "$input.value"]],
              },
            ],
          },
        }),
      ]
    );

    const scenario: Scenario = {
      id: "add-item-test",
      name: "Add Item Test",
      given: { "data.items": [1, 2] },
      when: [{ action: "action.addItem", input: { value: 3 } }],
      then: [
        { path: "data.items", operator: "length", expected: 3 },
        { path: "derived.count", operator: "eq", expected: 3 },
      ],
    };

    const result = executeScenario(scenario, domain);

    expect(result.passed).toBe(true);
    expect(result.assertions.every((a) => a.passed)).toBe(true);
  });

  it("should fail scenario when assertion fails", () => {
    const domain = createDomain(
      [createSource({ id: "count", path: "data.count", schemaType: "number", defaultValue: 0 })]
    );

    const scenario: Scenario = {
      id: "fail-test",
      name: "Fail Test",
      given: { "data.count": 5 },
      when: [],
      then: [{ path: "data.count", operator: "eq", expected: 10 }],
    };

    const result = executeScenario(scenario, domain);

    expect(result.passed).toBe(false);
    expect(result.assertions[0].passed).toBe(false);
  });

  it("should fail scenario when action fails", () => {
    const domain = createDomain(
      [createSource({ id: "count", path: "data.count", schemaType: "number", defaultValue: 0 })],
      [],
      [
        createAction({
          id: "submit",
          path: "action.submit",
          preconditions: [">", ["get", "data.count"], 0],
        }),
      ]
    );

    const scenario: Scenario = {
      id: "precondition-fail",
      name: "Precondition Fail",
      given: { "data.count": 0 },
      when: [{ action: "action.submit" }],
      then: [],
    };

    const result = executeScenario(scenario, domain);

    expect(result.passed).toBe(false);
    expect(result.steps[0].success).toBe(false);
    expect(result.steps[0].preconditionMet).toBe(false);
  });

  it("should execute multiple steps in sequence", () => {
    const domain = createDomain(
      [createSource({ id: "count", path: "data.count", schemaType: "number", defaultValue: 0 })],
      [],
      [
        createAction({
          id: "increment",
          path: "action.increment",
          effectConfig: {
            updates: [{ path: "data.count", expr: ["+", ["get", "data.count"], 1] }],
          },
        }),
      ]
    );

    const scenario: Scenario = {
      id: "multi-step",
      name: "Multi Step",
      given: { "data.count": 0 },
      when: [
        { action: "action.increment" },
        { action: "action.increment" },
        { action: "action.increment" },
      ],
      then: [{ path: "data.count", operator: "eq", expected: 3 }],
    };

    const result = executeScenario(scenario, domain);

    expect(result.passed).toBe(true);
    expect(result.steps.length).toBe(3);
    expect(result.steps.every((s) => s.success)).toBe(true);
  });

  it("should record execution duration", () => {
    const domain = createDomain();
    const scenario: Scenario = {
      id: "duration-test",
      name: "Duration Test",
      given: {},
      when: [],
      then: [],
    };

    const result = executeScenario(scenario, domain);

    expect(result.duration).toBeGreaterThanOrEqual(0);
    expect(result.runAt).toBeTruthy();
  });
});
