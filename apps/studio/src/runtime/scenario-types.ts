/**
 * Scenario Test Types
 *
 * Given-When-Then format for testing domain logic.
 */

import { z } from "zod";

// ============================================================================
// Scenario Definition Types
// ============================================================================

/**
 * A single action step in the scenario
 */
export interface ScenarioStep {
  /** Action path (e.g., "action.addTodo") */
  action: string;
  /** Input parameters for the action */
  input?: Record<string, unknown>;
  /** Mock responses for effects */
  mockEffects?: Record<string, unknown>;
  /** If true, this step is expected to fail (e.g., precondition not met) */
  expectFailure?: boolean;
}

/**
 * Assertion operators for Then conditions
 */
export type AssertionOperator =
  | "eq"       // equal
  | "neq"      // not equal
  | "gt"       // greater than
  | "gte"      // greater than or equal
  | "lt"       // less than
  | "lte"      // less than or equal
  | "contains" // array/string contains
  | "length"   // array/string length equals
  | "truthy"   // value is truthy
  | "falsy";   // value is falsy

/**
 * A single assertion in the Then section
 */
export interface ScenarioAssertion {
  /** Path to check (e.g., "derived.totalCount") */
  path: string;
  /** Comparison operator */
  operator: AssertionOperator;
  /** Expected value (not needed for truthy/falsy) */
  expected?: unknown;
}

/**
 * Complete scenario definition
 */
export interface Scenario {
  /** Unique identifier */
  id: string;
  /** Human-readable name */
  name: string;
  /** Optional description */
  description?: string;

  /** Given: Initial state values */
  given: Record<string, unknown>;

  /** When: Actions to execute */
  when: ScenarioStep[];

  /** Then: Assertions to verify */
  then: ScenarioAssertion[];
}

// ============================================================================
// Execution Result Types
// ============================================================================

/**
 * Result of executing a single action step
 */
export interface StepResult {
  /** Action that was executed */
  action: string;
  /** Whether the step succeeded */
  success: boolean;
  /** Error message if failed */
  error?: string;
  /** Whether precondition was met */
  preconditionMet: boolean;
  /** State after this step (only changed paths) */
  stateChanges: Record<string, { before: unknown; after: unknown }>;
}

/**
 * Result of evaluating a single assertion
 */
export interface AssertionResult {
  /** Path that was checked */
  path: string;
  /** Operator used */
  operator: AssertionOperator;
  /** Whether assertion passed */
  passed: boolean;
  /** Expected value */
  expected: unknown;
  /** Actual value found */
  actual: unknown;
  /** Error message for debugging */
  message?: string;
}

/**
 * Complete result of running a scenario
 */
export interface ScenarioResult {
  /** Scenario that was run */
  scenarioId: string;
  /** Overall pass/fail */
  passed: boolean;
  /** Results of each action step */
  steps: StepResult[];
  /** Results of each assertion */
  assertions: AssertionResult[];
  /** Final state after all steps */
  finalState: Record<string, unknown>;
  /** Execution time in milliseconds */
  duration: number;
  /** Timestamp when run */
  runAt: string;
}

// ============================================================================
// Zod Schemas (for validation)
// ============================================================================

export const ScenarioStepSchema = z.object({
  action: z.string(),
  input: z.record(z.unknown()).optional(),
  mockEffects: z.record(z.unknown()).optional(),
  expectFailure: z.boolean().optional(),
});

export const ScenarioAssertionSchema = z.object({
  path: z.string(),
  operator: z.enum([
    "eq", "neq", "gt", "gte", "lt", "lte", "contains", "length", "truthy", "falsy"
  ]),
  expected: z.unknown().optional(),
});

export const ScenarioSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  given: z.record(z.unknown()),
  when: z.array(ScenarioStepSchema),
  then: z.array(ScenarioAssertionSchema),
});

export const StepResultSchema = z.object({
  action: z.string(),
  success: z.boolean(),
  error: z.string().optional(),
  preconditionMet: z.boolean(),
  stateChanges: z.record(z.object({
    before: z.unknown(),
    after: z.unknown(),
  })),
});

export const AssertionResultSchema = z.object({
  path: z.string(),
  operator: z.enum([
    "eq", "neq", "gt", "gte", "lt", "lte", "contains", "length", "truthy", "falsy"
  ]),
  passed: z.boolean(),
  expected: z.unknown(),
  actual: z.unknown(),
  message: z.string().optional(),
});

export const ScenarioResultSchema = z.object({
  scenarioId: z.string(),
  passed: z.boolean(),
  steps: z.array(StepResultSchema),
  assertions: z.array(AssertionResultSchema),
  finalState: z.record(z.unknown()),
  duration: z.number(),
  runAt: z.string(),
});

// ============================================================================
// Type guards
// ============================================================================

export function isScenario(value: unknown): value is Scenario {
  return ScenarioSchema.safeParse(value).success;
}

export function isScenarioResult(value: unknown): value is ScenarioResult {
  return ScenarioResultSchema.safeParse(value).success;
}
