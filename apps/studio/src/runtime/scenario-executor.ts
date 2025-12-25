/**
 * Scenario Executor
 *
 * Pure functions for executing Given-When-Then scenarios.
 * Enables testing domain logic without side effects.
 */

import type {
  Scenario,
  ScenarioStep,
  ScenarioAssertion,
  ScenarioResult,
  StepResult,
  AssertionResult,
  AssertionOperator,
} from "./scenario-types";
import type {
  EditorSource,
  EditorDerived,
  EditorAction,
  EditorPolicy,
} from "../domain/types";
import { evaluateExpression, type EvaluationContext } from "../components/editor/expression/expression-evaluator";

// ============================================================================
// Types
// ============================================================================

export interface DomainDefinition {
  sources: Record<string, EditorSource>;
  derived: Record<string, EditorDerived>;
  actions: Record<string, EditorAction>;
  policies: Record<string, EditorPolicy>;
}

export interface ExecutionState {
  values: Record<string, unknown>;
}

interface SetStateUpdate {
  path: string;
  expr?: unknown;
  value?: unknown;
}

interface SetStateEffectConfig {
  input?: Record<string, string>;
  updates: SetStateUpdate[];
}

// ============================================================================
// Main Executor
// ============================================================================

/**
 * Execute a complete scenario
 */
export function executeScenario(
  scenario: Scenario,
  domain: DomainDefinition
): ScenarioResult {
  const startTime = performance.now();

  // Step 1: Apply Given state
  let state = applyGiven(scenario.given, domain);

  // Step 2: Recalculate derived values
  state = recalculateDerived(state, domain.derived);

  // Step 3: Execute each action step
  const steps: StepResult[] = [];
  for (let i = 0; i < scenario.when.length; i++) {
    const step = scenario.when[i];
    const stepResult = executeStep(step, state, domain);
    steps.push(stepResult);

    if (stepResult.success) {
      // Update state with changes
      for (const [path, change] of Object.entries(stepResult.stateChanges)) {
        state.values[path] = change.after;
      }
      // Recalculate derived after each step
      state = recalculateDerived(state, domain.derived);
    }
  }

  // Step 4: Evaluate assertions
  const assertions = evaluateAssertions(scenario.then, state);

  // Calculate overall result
  // A step "passes" if: (success && !expectFailure) || (!success && expectFailure)
  const allStepsPassed = scenario.when.every((step, i) => {
    const result = steps[i];
    const expectFailure = step.expectFailure ?? false;
    return expectFailure ? !result.success : result.success;
  });
  const allAssertionsPassed = assertions.every((a) => a.passed);
  const passed = allStepsPassed && allAssertionsPassed;

  const endTime = performance.now();

  return {
    scenarioId: scenario.id,
    passed,
    steps,
    assertions,
    finalState: state.values,
    duration: endTime - startTime,
    runAt: new Date().toISOString(),
  };
}

// ============================================================================
// Given: Apply Initial State
// ============================================================================

/**
 * Apply given state values, using source defaults for unspecified paths
 */
export function applyGiven(
  given: Record<string, unknown>,
  domain: DomainDefinition
): ExecutionState {
  const values: Record<string, unknown> = {};

  // First, apply source defaults
  for (const source of Object.values(domain.sources)) {
    if (source.defaultValue !== undefined) {
      values[source.path] = source.defaultValue;
    }
  }

  // Then, override with given values
  for (const [path, value] of Object.entries(given)) {
    values[path] = value;
  }

  return { values };
}

// ============================================================================
// When: Execute Action Steps
// ============================================================================

/**
 * Execute a single action step
 */
export function executeStep(
  step: ScenarioStep,
  state: ExecutionState,
  domain: DomainDefinition
): StepResult {
  // Find the action
  const action = Object.values(domain.actions).find(
    (a) => a.path === step.action
  );

  if (!action) {
    return {
      action: step.action,
      success: false,
      error: `Action not found: ${step.action}`,
      preconditionMet: false,
      stateChanges: {},
    };
  }

  // Check preconditions
  const preconditionMet = checkPrecondition(action.preconditions, state, step.input);
  if (!preconditionMet) {
    return {
      action: step.action,
      success: false,
      error: "Precondition not met",
      preconditionMet: false,
      stateChanges: {},
    };
  }

  // Check policies
  const policyResult = checkPolicies(action.path, state, domain.policies);
  if (!policyResult.allowed) {
    return {
      action: step.action,
      success: false,
      error: `Policy denied: ${policyResult.reason}`,
      preconditionMet: true,
      stateChanges: {},
    };
  }

  // Execute the effect
  if (action.effectType === "setState") {
    return executeSetStateEffect(step, state, action);
  }

  // For other effect types (apiCall, navigate, custom), use mocks
  if (step.mockEffects && step.mockEffects[action.effectType]) {
    return {
      action: step.action,
      success: true,
      preconditionMet: true,
      stateChanges: {},
    };
  }

  return {
    action: step.action,
    success: false,
    error: `Unsupported effect type without mock: ${action.effectType}`,
    preconditionMet: true,
    stateChanges: {},
  };
}

/**
 * Check if precondition is met
 */
function checkPrecondition(
  preconditions: unknown,
  state: ExecutionState,
  input?: Record<string, unknown>
): boolean {
  // If true or null/undefined, precondition is met
  if (preconditions === true || preconditions === null || preconditions === undefined) {
    return true;
  }

  // Evaluate expression
  const context = createContext(state, input);
  const result = evaluateExpression(preconditions, context);

  if (!result.success) {
    return false;
  }

  return Boolean(result.value);
}

/**
 * Check if action is allowed by policies
 */
function checkPolicies(
  actionPath: string,
  state: ExecutionState,
  policies: Record<string, EditorPolicy>
): { allowed: boolean; reason?: string } {
  for (const policy of Object.values(policies)) {
    if (policy.targetPath !== actionPath) continue;

    const context = createContext(state);
    const result = evaluateExpression(policy.condition, context);

    if (!result.success) continue;

    const conditionMet = Boolean(result.value);

    if (policy.policyType === "deny" && conditionMet) {
      return { allowed: false, reason: policy.description || policy.path };
    }

    if (policy.policyType === "allow" && !conditionMet) {
      return { allowed: false, reason: `Required condition not met: ${policy.description || policy.path}` };
    }
  }

  return { allowed: true };
}

/**
 * Execute setState effect
 */
function executeSetStateEffect(
  step: ScenarioStep,
  state: ExecutionState,
  action: EditorAction
): StepResult {
  const effectConfig = action.effectConfig as SetStateEffectConfig;
  const stateChanges: Record<string, { before: unknown; after: unknown }> = {};

  if (!effectConfig?.updates) {
    return {
      action: step.action,
      success: true,
      preconditionMet: true,
      stateChanges: {},
    };
  }

  // Create context with input
  const context = createContext(state, step.input);

  for (const update of effectConfig.updates) {
    const before = state.values[update.path];
    let after: unknown;

    if (update.value !== undefined) {
      after = update.value;
    } else if (update.expr !== undefined) {
      const result = evaluateExpressionWithInput(update.expr, context);
      if (!result.success) {
        return {
          action: step.action,
          success: false,
          error: `Failed to evaluate expression for ${update.path}: ${result.error}`,
          preconditionMet: true,
          stateChanges,
        };
      }
      after = result.value;
    } else {
      continue;
    }

    stateChanges[update.path] = { before, after };
    state.values[update.path] = after;
  }

  return {
    action: step.action,
    success: true,
    preconditionMet: true,
    stateChanges,
  };
}

// ============================================================================
// Derived: Recalculate Computed Values
// ============================================================================

/**
 * Recalculate all derived values based on current state
 */
export function recalculateDerived(
  state: ExecutionState,
  derived: Record<string, EditorDerived>
): ExecutionState {
  // Sort derived by dependencies (topological sort)
  const sorted = topologicalSort(derived);

  for (const d of sorted) {
    const context = createContext(state);
    const result = evaluateExpression(d.expr, context);

    if (result.success) {
      state.values[d.path] = result.value;
    }
  }

  return state;
}

/**
 * Topological sort of derived values based on dependencies
 */
function topologicalSort(derived: Record<string, EditorDerived>): EditorDerived[] {
  const result: EditorDerived[] = [];
  const visited = new Set<string>();
  const visiting = new Set<string>();

  const derivedByPath = new Map<string, EditorDerived>();
  for (const d of Object.values(derived)) {
    derivedByPath.set(d.path, d);
  }

  function visit(d: EditorDerived) {
    if (visited.has(d.path)) return;
    if (visiting.has(d.path)) return; // Cycle - skip

    visiting.add(d.path);

    for (const dep of d.deps) {
      const depDerived = derivedByPath.get(dep);
      if (depDerived) {
        visit(depDerived);
      }
    }

    visiting.delete(d.path);
    visited.add(d.path);
    result.push(d);
  }

  for (const d of Object.values(derived)) {
    visit(d);
  }

  return result;
}

// ============================================================================
// Then: Evaluate Assertions
// ============================================================================

/**
 * Evaluate all assertions against current state
 */
export function evaluateAssertions(
  assertions: ScenarioAssertion[],
  state: ExecutionState
): AssertionResult[] {
  return assertions.map((assertion) => evaluateAssertion(assertion, state));
}

/**
 * Evaluate a single assertion
 */
export function evaluateAssertion(
  assertion: ScenarioAssertion,
  state: ExecutionState
): AssertionResult {
  const actual = getValueAtPath(state.values, assertion.path);
  const expected = assertion.expected;
  const operator = assertion.operator;

  const passed = compareValues(actual, expected, operator);

  return {
    path: assertion.path,
    operator,
    passed,
    expected,
    actual,
    message: passed
      ? undefined
      : `Expected ${formatValue(expected)} but got ${formatValue(actual)}`,
  };
}

/**
 * Get value at a path, supporting array index notation
 */
function getValueAtPath(values: Record<string, unknown>, path: string): unknown {
  // Handle array index notation like "data.todos[0].text"
  const match = path.match(/^(.+?)\[(\d+)\](.*)$/);
  if (match) {
    const [, basePath, index, rest] = match;
    const arr = values[basePath];
    if (!Array.isArray(arr)) return undefined;
    const item = arr[parseInt(index, 10)];
    if (rest === "") return item;
    // Handle nested path like ".text"
    const nestedPath = rest.startsWith(".") ? rest.slice(1) : rest;
    if (item && typeof item === "object") {
      return (item as Record<string, unknown>)[nestedPath];
    }
    return undefined;
  }

  // Handle dot notation for nested objects
  // Use strict undefined check - 0, false, "" are valid values
  if (path.includes(".") && values[path] === undefined) {
    const parts = path.split(".");
    let current: unknown = values;
    for (const part of parts) {
      if (current && typeof current === "object") {
        current = (current as Record<string, unknown>)[part];
      } else {
        return undefined;
      }
    }
    return current;
  }

  return values[path];
}

/**
 * Compare values based on operator
 */
function compareValues(
  actual: unknown,
  expected: unknown,
  operator: AssertionOperator
): boolean {
  switch (operator) {
    case "eq":
      return deepEqual(actual, expected);
    case "neq":
      return !deepEqual(actual, expected);
    case "gt":
      return (actual as number) > (expected as number);
    case "gte":
      return (actual as number) >= (expected as number);
    case "lt":
      return (actual as number) < (expected as number);
    case "lte":
      return (actual as number) <= (expected as number);
    case "contains":
      if (Array.isArray(actual)) {
        return actual.some((item) => deepEqual(item, expected));
      }
      if (typeof actual === "string" && typeof expected === "string") {
        return actual.includes(expected);
      }
      return false;
    case "length":
      if (Array.isArray(actual) || typeof actual === "string") {
        return actual.length === expected;
      }
      return false;
    case "truthy":
      return Boolean(actual);
    case "falsy":
      return !actual;
    default:
      return false;
  }
}

/**
 * Deep equality check
 */
function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (typeof a !== "object" || a === null || b === null) return false;

  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((item, i) => deepEqual(item, b[i]));
  }

  if (Array.isArray(a) !== Array.isArray(b)) return false;

  const keysA = Object.keys(a);
  const keysB = Object.keys(b as object);
  if (keysA.length !== keysB.length) return false;

  return keysA.every((key) =>
    deepEqual(
      (a as Record<string, unknown>)[key],
      (b as Record<string, unknown>)[key]
    )
  );
}

/**
 * Format value for display
 */
function formatValue(value: unknown): string {
  if (value === undefined) return "undefined";
  if (value === null) return "null";
  return JSON.stringify(value);
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Create evaluation context from state and optional input
 */
function createContext(
  state: ExecutionState,
  input?: Record<string, unknown>
): EvaluationContext {
  const values = { ...state.values };

  // Add input values with $input prefix
  if (input) {
    for (const [key, value] of Object.entries(input)) {
      values[`$input.${key}`] = value;
    }
  }

  return { values };
}

/**
 * Evaluate expression with input handling
 *
 * Core First 원칙: Core evaluator로 모든 표현식 평가
 * 특수 케이스: append의 새 요소가 객체 리터럴인 경우만 처리
 */
function evaluateExpressionWithInput(
  expr: unknown,
  context: EvaluationContext
): { success: boolean; value?: unknown; error?: string } {
  // Handle special case: append with object literal
  // Core evaluator doesn't recursively evaluate object literals
  if (Array.isArray(expr) && expr[0] === "append" && expr.length >= 3) {
    const arrResult = evaluateExpression(expr[1], context);
    if (!arrResult.success) return arrResult;
    const arr = arrResult.value as unknown[];
    const item = evaluateItem(expr[2], context);
    return { success: true, value: [...arr, item] };
  }

  // Use Core evaluator for everything else
  return evaluateExpression(expr, context);
}

/**
 * Evaluate an item that might be an object with expression values
 *
 * 객체 리터럴 내부의 표현식을 재귀적으로 평가
 * Core evaluator는 객체 리터럴을 표현식으로 취급하지 않음
 */
function evaluateItem(
  item: unknown,
  context: EvaluationContext
): unknown {
  if (item === null || item === undefined) return item;

  if (Array.isArray(item)) {
    // Check if it's an operator expression (starts with string operator)
    if (item.length > 0 && typeof item[0] === "string") {
      // Use Core evaluator
      const result = evaluateExpression(item, context);
      return result.success ? result.value : null;
    }
    // Array literal - evaluate each element
    return item.map((i) => evaluateItem(i, context));
  }

  if (typeof item === "object") {
    // Object literal - evaluate each value
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(item)) {
      result[key] = evaluateItem(value, context);
    }
    return result;
  }

  return item;
}
