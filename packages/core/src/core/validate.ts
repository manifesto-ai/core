import { DomainSchema } from "../schema/domain.js";
import type { ValidationResult, ValidationError } from "../schema/result.js";
import { validResult, invalidResult } from "../schema/result.js";
import { buildDependencyGraph, topologicalSort, detectCycles } from "../evaluator/dag.js";
import { isErr } from "../schema/common.js";

/**
 * Validate a domain schema
 *
 * Validation rules:
 * - V-001: All paths in ComputedSpec.deps MUST exist
 * - V-002: ComputedSpec dependency graph MUST be acyclic
 * - V-003: All paths in ExprNode.get MUST exist (TODO: implement path validation)
 * - V-004: All `call` references in FlowSpec MUST exist
 * - V-005: FlowSpec `call` graph MUST be acyclic
 * - V-006: ActionSpec.available expression MUST return boolean (runtime check)
 * - V-007: ActionSpec.input MUST be valid FieldSpec (Zod handles this)
 */
export function validate(schema: unknown): ValidationResult {
  const errors: ValidationError[] = [];

  // First, validate with Zod schema
  const parseResult = DomainSchema.safeParse(schema);
  if (!parseResult.success) {
    const zodErrors = parseResult.error.issues.map((e) => ({
      code: "SCHEMA_ERROR",
      message: e.message,
      path: e.path.map(String).join("."),
    }));
    return invalidResult(zodErrors);
  }

  const domainSchema = parseResult.data;

  // V-002: Check computed dependency graph is acyclic
  const depGraph = buildDependencyGraph(domainSchema.computed);
  const sortResult = topologicalSort(depGraph);
  if (isErr(sortResult)) {
    errors.push(sortResult.error);
  }

  // Additional cycle detection for detailed error
  const cycles = detectCycles(depGraph);
  if (cycles) {
    for (const cycle of cycles) {
      errors.push({
        code: "V-002",
        message: `Cyclic dependency: ${cycle.join(" -> ")}`,
        path: cycle[0],
      });
    }
  }

  // V-004: Check all call references exist
  const actionNames = new Set(Object.keys(domainSchema.actions));
  const callErrors = validateCallReferences(domainSchema, actionNames);
  errors.push(...callErrors);

  // V-005: Check call graph is acyclic
  const callCycleErrors = validateCallGraph(domainSchema);
  errors.push(...callCycleErrors);

  if (errors.length > 0) {
    return invalidResult(errors);
  }

  return validResult();
}

/**
 * Validate that all call references exist
 */
function validateCallReferences(
  schema: import("../schema/domain.js").DomainSchema,
  actionNames: Set<string>
): ValidationError[] {
  const errors: ValidationError[] = [];

  for (const [actionName, action] of Object.entries(schema.actions)) {
    const calls = collectCalls(action.flow);
    for (const callName of calls) {
      if (!actionNames.has(callName)) {
        errors.push({
          code: "V-004",
          message: `Unknown flow reference: "${callName}" in action "${actionName}"`,
          path: `actions.${actionName}`,
        });
      }
    }
  }

  return errors;
}

/**
 * Collect all call references from a flow node
 */
function collectCalls(flow: import("../schema/flow.js").FlowNode): string[] {
  const calls: string[] = [];

  switch (flow.kind) {
    case "call":
      calls.push(flow.flow);
      break;
    case "seq":
      for (const step of flow.steps) {
        calls.push(...collectCalls(step));
      }
      break;
    case "if":
      calls.push(...collectCalls(flow.then));
      if (flow.else) {
        calls.push(...collectCalls(flow.else));
      }
      break;
  }

  return calls;
}

/**
 * Validate call graph for cycles
 */
function validateCallGraph(
  schema: import("../schema/domain.js").DomainSchema
): ValidationError[] {
  const errors: ValidationError[] = [];

  // Build call graph
  const edges = new Map<string, string[]>();
  for (const [actionName, action] of Object.entries(schema.actions)) {
    edges.set(actionName, collectCalls(action.flow));
  }

  // Detect cycles using DFS
  const visited = new Set<string>();
  const recursionStack = new Set<string>();

  function dfs(node: string, path: string[]): boolean {
    visited.add(node);
    recursionStack.add(node);

    const deps = edges.get(node) ?? [];
    for (const dep of deps) {
      if (!visited.has(dep)) {
        if (dfs(dep, [...path, dep])) {
          return true;
        }
      } else if (recursionStack.has(dep)) {
        errors.push({
          code: "V-005",
          message: `Cyclic call detected: ${[...path, dep].join(" -> ")}`,
          path: `actions.${node}`,
        });
        return true;
      }
    }

    recursionStack.delete(node);
    return false;
  }

  for (const actionName of edges.keys()) {
    if (!visited.has(actionName)) {
      dfs(actionName, [actionName]);
    }
  }

  return errors;
}
