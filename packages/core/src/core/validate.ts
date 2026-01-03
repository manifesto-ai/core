import { DomainSchema } from "../schema/domain.js";
import type { ValidationResult, ValidationError } from "../schema/result.js";
import { validResult, invalidResult } from "../schema/result.js";
import { buildDependencyGraph, topologicalSort, detectCycles } from "../evaluator/dag.js";
import { isErr } from "../schema/common.js";
import { hashSchemaSync } from "../utils/hash.js";
import {
  isValidSchemaId,
  isValidSemver,
  collectGetPathsFromExpr,
  collectGetPathsFromFlow,
  pathExistsInStateSpec,
  pathExistsInComputedSpec,
  pathExistsInFieldSpec,
} from "./validation-utils.js";

/**
 * Validate a domain schema
 *
 * Validation rules:
 * - V-001: All paths in ComputedSpec.deps MUST exist
 * - V-002: ComputedSpec dependency graph MUST be acyclic
 * - V-003: All paths in ExprNode.get MUST exist
 * - V-004: All `call` references in FlowSpec MUST exist
 * - V-005: FlowSpec `call` graph MUST be acyclic
 * - V-006: ActionSpec.available expression MUST return boolean (runtime check)
 * - V-007: ActionSpec.input MUST be valid FieldSpec (Zod handles this)
 * - V-008: Schema hash MUST match canonical hash
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

  if (!isValidSchemaId(domainSchema.id)) {
    errors.push({
      code: "SCHEMA_ERROR",
      message: "Schema id must be a valid URI or UUID",
      path: "id",
    });
  }

  if (!isValidSemver(domainSchema.version)) {
    errors.push({
      code: "SCHEMA_ERROR",
      message: "Schema version must follow Semantic Versioning 2.0",
      path: "version",
    });
  }

  const schemaHash = domainSchema.hash;
  if (!schemaHash) {
    errors.push({
      code: "SCHEMA_ERROR",
      message: "Schema hash is required",
      path: "hash",
    });
  } else {
    const rawSchema = schema as Record<string, unknown>;
    const { hash: _hash, ...schemaWithoutHash } = rawSchema;
    const expectedHash = hashSchemaSync(schemaWithoutHash as Omit<DomainSchema, "hash">);
    if (schemaHash !== expectedHash) {
      errors.push({
        code: "V-008",
        message: `Schema hash mismatch: expected ${expectedHash}, got ${schemaHash}`,
        path: "hash",
      });
    }
  }

  if (Object.keys(domainSchema.state.fields).length === 0) {
    errors.push({
      code: "SCHEMA_ERROR",
      message: "StateSpec.fields must not be empty",
      path: "state.fields",
    });
  }

  if (Object.keys(domainSchema.computed.fields).length === 0) {
    errors.push({
      code: "SCHEMA_ERROR",
      message: "ComputedSpec.fields must not be empty",
      path: "computed.fields",
    });
  }

  if (Object.keys(domainSchema.actions).length === 0) {
    errors.push({
      code: "SCHEMA_ERROR",
      message: "actions must not be empty",
      path: "actions",
    });
  }

  errors.push(...validateStateDefaults(domainSchema.state, "state.fields"));

  errors.push(...validateComputedDeps(domainSchema));

  errors.push(...validateComputedExprPaths(domainSchema));

  errors.push(...validateComputedDepsCoverage(domainSchema));

  errors.push(...validateActionExprPaths(domainSchema));

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

function validateStateDefaults(
  state: import("../schema/field.js").StateSpec,
  basePath: string
): ValidationError[] {
  const errors: ValidationError[] = [];

  const visit = (
    spec: import("../schema/field.js").FieldSpec,
    path: string
  ) => {
    if (!spec.required && spec.default === undefined) {
      errors.push({
        code: "SCHEMA_ERROR",
        message: "Optional fields must define a default value",
        path,
      });
    }

    if (spec.type === "object" && spec.fields) {
      for (const [name, field] of Object.entries(spec.fields)) {
        visit(field, `${path}.${name}`);
      }
    }

    if (spec.type === "array" && spec.items) {
      visit(spec.items, `${path}[]`);
    }
  };

  for (const [name, field] of Object.entries(state.fields)) {
    visit(field, `${basePath}.${name}`);
  }

  return errors;
}

function validateComputedDeps(
  schema: import("../schema/domain.js").DomainSchema
): ValidationError[] {
  const errors: ValidationError[] = [];

  for (const [path, spec] of Object.entries(schema.computed.fields)) {
    for (const dep of spec.deps) {
      const exists =
        pathExistsInComputedSpec(schema.computed, dep) ||
        pathExistsInStateSpec(schema.state, dep);
      if (!exists) {
        errors.push({
          code: "V-001",
          message: `Unknown dependency path: ${dep}`,
          path: `computed.fields.${path}`,
        });
      }
    }
  }

  return errors;
}

function validateComputedExprPaths(
  schema: import("../schema/domain.js").DomainSchema
): ValidationError[] {
  const errors: ValidationError[] = [];

  for (const [path, spec] of Object.entries(schema.computed.fields)) {
    const exprPaths = collectGetPathsFromExpr(spec.expr);
    const invalidPaths = exprPaths.filter((exprPath) => {
      if (exprPath.startsWith("$")) return false;
      if (exprPath.startsWith("computed.")) {
        return !pathExistsInComputedSpec(schema.computed, exprPath);
      }
      if (exprPath.startsWith("input.")) {
        return true;
      }
      if (exprPath.startsWith("system.")) {
        return true;
      }
      return !pathExistsInStateSpec(schema.state, exprPath);
    });

    for (const exprPath of invalidPaths) {
      errors.push({
        code: "V-003",
        message: `Unknown path in computed expression: ${exprPath}`,
        path: `computed.fields.${path}`,
      });
    }
  }

  return errors;
}

function validateComputedDepsCoverage(
  schema: import("../schema/domain.js").DomainSchema
): ValidationError[] {
  const errors: ValidationError[] = [];

  for (const [path, spec] of Object.entries(schema.computed.fields)) {
    const exprPaths = collectGetPathsFromExpr(spec.expr);
    const deps = new Set(spec.deps);
    const relevantPaths = new Set(
      exprPaths.filter((exprPath) => {
        if (exprPath.startsWith("$")) {
          return false;
        }
        if (exprPath === "input" || exprPath.startsWith("input.")) {
          return false;
        }
        if (exprPath === "system" || exprPath.startsWith("system.")) {
          return false;
        }
        if (exprPath === "meta" || exprPath.startsWith("meta.")) {
          return false;
        }
        if (exprPath.startsWith("computed.")) {
          return pathExistsInComputedSpec(schema.computed, exprPath);
        }
        return pathExistsInStateSpec(schema.state, exprPath);
      })
    );

    for (const exprPath of relevantPaths) {
      if (!deps.has(exprPath)) {
        errors.push({
          code: "V-001",
          message: `Missing dependency for computed expression path: ${exprPath}`,
          path: `computed.fields.${path}`,
        });
      }
    }
  }

  return errors;
}

function validateActionExprPaths(
  schema: import("../schema/domain.js").DomainSchema
): ValidationError[] {
  const errors: ValidationError[] = [];

  for (const [actionName, action] of Object.entries(schema.actions)) {
    const exprPaths = [
      ...collectGetPathsFromFlow(action.flow),
      ...(action.available ? collectGetPathsFromExpr(action.available) : []),
    ];

    for (const exprPath of exprPaths) {
      if (exprPath.startsWith("$")) {
        continue;
      }

      if (exprPath === "input" || exprPath.startsWith("input.")) {
        if (action.input) {
          const subPath = exprPath === "input" ? "" : exprPath.slice(6);
          if (!pathExistsInFieldSpec(action.input, subPath)) {
            errors.push({
              code: "V-003",
              message: `Unknown input path: ${exprPath}`,
              path: `actions.${actionName}`,
            });
          }
        }
        continue;
      }

      if (exprPath.startsWith("computed.")) {
        if (!pathExistsInComputedSpec(schema.computed, exprPath)) {
          errors.push({
            code: "V-003",
            message: `Unknown computed path: ${exprPath}`,
            path: `actions.${actionName}`,
          });
        }
        continue;
      }

      if (exprPath.startsWith("system.")) {
        continue;
      }

      if (exprPath === "meta" || exprPath.startsWith("meta.")) {
        continue;
      }

      if (!pathExistsInStateSpec(schema.state, exprPath)) {
        errors.push({
          code: "V-003",
          message: `Unknown state path: ${exprPath}`,
          path: `actions.${actionName}`,
        });
      }
    }
  }

  return errors;
}
