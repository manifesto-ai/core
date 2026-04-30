import { DomainSchema } from "../schema/domain.js";
import type { ValidationResult, ValidationError } from "../schema/result.js";
import type { TypeSpec } from "../schema/type-spec.js";
import type { FlowNode } from "../schema/flow.js";
import type { PatchPath } from "../schema/patch.js";
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
  validateValueAgainstFieldSpec,
} from "./validation-utils.js";
import {
  getTypeDefinitionAtSegments,
  pathExistsInTypeDefinition,
  resolveTypeDefinition,
  validateValueAgainstTypeDefinition,
} from "./type-definition-utils.js";
import {
  patchPathToDisplayString,
} from "../utils/patch-path.js";

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
 * - V-009: ActionSpec.dispatchable expression MUST return boolean (runtime check)
 * - V-010: Typing seams MUST align with compatibility carriers and resolve refs
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

  errors.push(...validateReservedStateIdentifiers(domainSchema));

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

  errors.push(...validateTypingSeams(domainSchema));

  errors.push(...validateStateDefaults(domainSchema, "state.fields"));

  errors.push(...validateComputedDeps(domainSchema));

  errors.push(...validateComputedRuntimeIsolation(domainSchema));

  errors.push(...validateComputedExprPaths(domainSchema));

  errors.push(...validateComputedDepsCoverage(domainSchema));

  errors.push(...validateActionExprPaths(domainSchema));

  errors.push(...validateCompilerNamespacePatchFlows(domainSchema));

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

function validateReservedStateIdentifiers(
  schema: import("../schema/domain.js").DomainSchema,
): ValidationError[] {
  const errors: ValidationError[] = [];

  const visitFields = (
    fields: Record<string, import("../schema/field.js").FieldSpec>,
    path: string,
  ): void => {
    for (const [name, field] of Object.entries(fields)) {
      const fieldPath = `${path}.${name}`;
      if (name.startsWith("$")) {
        errors.push({
          code: "SCHEMA_ERROR",
          message: `State field "${name}" uses reserved namespace prefix "$"`,
          path: fieldPath,
        });
      }

      if (field.type === "object" && field.fields) {
        visitFields(field.fields, fieldPath);
      }
    }
  };

  visitFields(schema.state.fields, "state.fields");

  if (schema.state.fieldTypes) {
    for (const name of Object.keys(schema.state.fieldTypes)) {
      if (name.startsWith("$")) {
        errors.push({
          code: "SCHEMA_ERROR",
          message: `state.fieldTypes.${name} uses reserved namespace prefix "$"`,
          path: `state.fieldTypes.${name}`,
        });
      }
    }
  }

  return errors;
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

function validateTypingSeams(
  schema: import("../schema/domain.js").DomainSchema,
): ValidationError[] {
  const errors: ValidationError[] = [];

  if (schema.state.fieldTypes) {
    for (const name of Object.keys(schema.state.fieldTypes)) {
      if (!(name in schema.state.fields)) {
        errors.push({
          code: "V-010",
          message: `state.fieldTypes.${name} has no matching state.fields entry`,
          path: `state.fieldTypes.${name}`,
        });
      }

      errors.push(
        ...validateTypeDefinitionRefs(
          schema.state.fieldTypes[name],
          schema.types,
          `state.fieldTypes.${name}`,
        ),
      );
    }
  }

  for (const [actionName, action] of Object.entries(schema.actions)) {
    if (!action.inputType) {
      if (action.params && action.params.length > 0) {
        errors.push(...validateActionParams(actionName, action, schema.types));
      }
      continue;
    }

    errors.push(
      ...validateTypeDefinitionRefs(
        action.inputType,
        schema.types,
        `actions.${actionName}.inputType`,
      ),
    );

    if (action.params && action.params.length > 0) {
      errors.push(...validateActionParams(actionName, action, schema.types));
    }
  }

  return errors;
}

function validateActionParams(
  actionName: string,
  action: import("../schema/action.js").ActionSpec,
  types: Record<string, TypeSpec>,
): ValidationError[] {
  const params = action.params ?? [];
  if (params.length === 0) {
    return [];
  }

  const duplicateErrors: ValidationError[] = [];
  const seenParams = new Set<string>();
  for (const [index, paramName] of params.entries()) {
    if (seenParams.has(paramName)) {
      duplicateErrors.push({
        code: "V-010",
        message: `Duplicate parameter name "${paramName}" is not allowed`,
        path: `actions.${actionName}.params.${index}`,
      });
      continue;
    }
    seenParams.add(paramName);
  }

  let inputFields: readonly string[] | null = null;

  if (action.inputType) {
    inputFields = getInputTypeFieldNames(action.inputType, types);
  } else if (action.input?.type === "object" && action.input.fields) {
    inputFields = Object.keys(action.input.fields);
  }

  if (!inputFields) {
    return [
      ...duplicateErrors,
      {
      code: "V-010",
      message: `actions.${actionName}.params requires an object-shaped input carrier`,
      path: `actions.${actionName}.params`,
    }];
  }

  const inputFieldSet = new Set(inputFields);
  return [
    ...duplicateErrors,
    ...params.flatMap((paramName, index) => (
    inputFieldSet.has(paramName)
      ? []
      : [{
        code: "V-010",
        message: `Parameter "${paramName}" has no matching input field`,
        path: `actions.${actionName}.params.${index}`,
      }]
  ))];
}

function getInputTypeFieldNames(
  definition: import("../schema/type-spec.js").TypeDefinition,
  types: Record<string, TypeSpec>,
  seenRefs: readonly string[] = [],
): readonly string[] | null {
  if (definition.kind === "ref") {
    if (seenRefs.includes(definition.name)) {
      return null;
    }
    const next = types[definition.name];
    return next
      ? getInputTypeFieldNames(next.definition, types, [...seenRefs, definition.name])
      : null;
  }

  if (definition.kind === "union") {
    const nonNullTypes = definition.types.filter((candidate) => !isNullLikeResolved(candidate, types, seenRefs));
    return nonNullTypes.length === 1
      ? getInputTypeFieldNames(nonNullTypes[0], types, seenRefs)
      : null;
  }

  return definition.kind === "object"
    ? Object.keys(definition.fields)
    : null;
}

function isNullLikeResolved(
  definition: import("../schema/type-spec.js").TypeDefinition,
  types: Record<string, TypeSpec>,
  seenRefs: readonly string[] = [],
): boolean {
  const resolved = resolveTypeDefinition(definition, types, seenRefs);
  if (!resolved) {
    return false;
  }

  return (
    (resolved.kind === "primitive" && resolved.type === "null")
    || (resolved.kind === "literal" && resolved.value === null)
  );
}

function validateTypeDefinitionRefs(
  definition: import("../schema/type-spec.js").TypeDefinition,
  types: Record<string, TypeSpec>,
  path: string,
  seenRefs: readonly string[] = [],
): ValidationError[] {
  const errors: ValidationError[] = [];

  if (definition.kind === "ref") {
    if (seenRefs.includes(definition.name)) {
      errors.push({
        code: "V-010",
        message: `Cyclic type reference "${definition.name}" in typing seam`,
        path,
      });
      return errors;
    }

    const next = types[definition.name];
    if (!next || !resolveTypeDefinition(definition, types)) {
      errors.push({
        code: "V-010",
        message: `Unknown type reference "${definition.name}" in typing seam`,
        path,
      });
      return errors;
    }

    errors.push(
      ...validateTypeDefinitionRefs(
        next.definition,
        types,
        path,
        [...seenRefs, definition.name],
      ),
    );
    return errors;
  }

  switch (definition.kind) {
    case "array":
      return validateTypeDefinitionRefs(definition.element, types, `${path}.element`, seenRefs);
    case "record": {
      const recordErrors = [
        ...validateTypeDefinitionRefs(definition.key, types, `${path}.key`, seenRefs),
        ...validateTypeDefinitionRefs(definition.value, types, `${path}.value`, seenRefs),
      ];
      const resolvedKey = resolveTypeDefinition(definition.key, types);
      if (resolvedKey && (resolvedKey.kind !== "primitive" || resolvedKey.type !== "string")) {
        recordErrors.push({
          code: "V-010",
          message: "Record typing seams require string keys",
          path: `${path}.key`,
        });
      }
      return recordErrors;
    }
    case "object":
      for (const [fieldName, field] of Object.entries(definition.fields)) {
        errors.push(
          ...validateTypeDefinitionRefs(field.type, types, `${path}.fields.${fieldName}.type`, seenRefs),
        );
      }
      return errors;
    case "union":
      for (const [index, candidate] of definition.types.entries()) {
        errors.push(
          ...validateTypeDefinitionRefs(candidate, types, `${path}.types.${index}`, seenRefs),
        );
      }
      return errors;
    default:
      return errors;
  }
}

function validateStateDefaults(
  schema: import("../schema/domain.js").DomainSchema,
  basePath: string
): ValidationError[] {
  const errors: ValidationError[] = [];
  const state = schema.state;

  const visit = (
    spec: import("../schema/field.js").FieldSpec,
    path: string,
    typeDefinition?: import("../schema/type-spec.js").TypeDefinition,
  ) => {
    if (!spec.required && spec.default === undefined) {
      errors.push({
        code: "SCHEMA_ERROR",
        message: "Optional fields must define a default value",
        path,
      });
    }

    if (spec.default !== undefined) {
      if (typeDefinition) {
        const typeCheck = validateValueAgainstTypeDefinition(spec.default, typeDefinition, schema.types);
        if (!typeCheck.ok) {
          errors.push({
            code: "V-009",
            message: `Default value type mismatch: ${typeCheck.message}`,
            path,
          });
        }
      } else if (spec.default === null && spec.required !== false) {
        errors.push({
          code: "V-009",
          message: `Default value 'null' is not compatible with required field type '${typeof spec.type === "string" ? spec.type : "enum"}'`,
          path,
        });
      } else if (spec.default !== null) {
        const typeCheck = validateValueAgainstFieldSpec(spec.default, spec);
        if (!typeCheck.ok) {
          errors.push({
            code: "V-009",
            message: `Default value type mismatch: ${typeCheck.message}`,
            path,
          });
        }
      }
    }

    if (spec.type === "object" && spec.fields) {
      for (const [name, field] of Object.entries(spec.fields)) {
        const nestedType = typeDefinition
          ? getTypeDefinitionAtSegments(typeDefinition, schema.types, [{ kind: "prop", name }])
          : null;
        visit(field, `${path}.${name}`, nestedType ?? undefined);
      }
    }

    if (spec.type === "array" && spec.items) {
      const itemType = typeDefinition
        ? getTypeDefinitionAtSegments(typeDefinition, schema.types, [{ kind: "index", index: 0 }])
        : null;
      visit(spec.items, `${path}[]`, itemType ?? undefined);
    }
  };

  for (const [name, field] of Object.entries(state.fields)) {
    visit(field, `${basePath}.${name}`, state.fieldTypes?.[name]);
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
        pathExistsInStateSpec(schema.state, dep, schema.types);
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
      if (pathExistsInComputedSpec(schema.computed, exprPath)) {
        return false;
      }
      if (exprPath.startsWith("input.")) {
        return true;
      }
      if (exprPath.startsWith("system.")) {
        return true;
      }
      return !pathExistsInStateSpec(schema.state, exprPath, schema.types);
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

function validateComputedRuntimeIsolation(
  schema: import("../schema/domain.js").DomainSchema
): ValidationError[] {
  const errors: ValidationError[] = [];

  for (const [path, spec] of Object.entries(schema.computed.fields)) {
    const exprPaths = collectGetPathsFromExpr(spec.expr);

    for (const exprPath of exprPaths) {
      if (!isForbiddenComputedRuntimePath(exprPath)) {
        continue;
      }

      errors.push({
        code: "V-012",
        message: `Computed expression must not read runtime or namespace path: ${exprPath}`,
        path: `computed.fields.${path}`,
      });
    }
  }

  return errors;
}

function isForbiddenComputedRuntimePath(path: string): boolean {
  if (path === "input" || path.startsWith("input.")) {
    return true;
  }
  if (path.startsWith("system.")) {
    return true;
  }
  if (path.startsWith("meta.")) {
    return true;
  }
  if (path.startsWith("$")) {
    return !isAllowedLexicalPath(path);
  }
  return false;
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
        if (pathExistsInComputedSpec(schema.computed, exprPath)) {
          return true;
        }
        return pathExistsInStateSpec(schema.state, exprPath, schema.types);
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
      ...(action.dispatchable ? collectGetPathsFromExpr(action.dispatchable) : []),
    ];

    for (const exprPath of exprPaths) {
      if (exprPath.startsWith("$")) {
        if (!isAllowedActionDollarPath(exprPath)) {
          errors.push({
            code: "V-003",
            message: `Namespace or reserved runtime path is not allowed in action expression: ${exprPath}`,
            path: `actions.${actionName}`,
          });
        }
        continue;
      }

      if (exprPath === "input" || exprPath.startsWith("input.")) {
        if (action.inputType) {
          const subPath = exprPath === "input" ? "" : exprPath.slice(6);
          if (!pathExistsInTypeDefinition(action.inputType, schema.types, subPath)) {
            errors.push({
              code: "V-003",
              message: `Unknown input path: ${exprPath}`,
              path: `actions.${actionName}`,
            });
          }
        } else if (action.input) {
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

      if (pathExistsInComputedSpec(schema.computed, exprPath)) {
        continue;
      }

      if (exprPath.startsWith("system.")) {
        continue;
      }

      if (exprPath === "meta" || exprPath.startsWith("meta.")) {
        continue;
      }

      if (!pathExistsInStateSpec(schema.state, exprPath, schema.types)) {
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

function validateCompilerNamespacePatchFlows(
  schema: import("../schema/domain.js").DomainSchema
): ValidationError[] {
  const errors: ValidationError[] = [];

  for (const [actionName, action] of Object.entries(schema.actions)) {
    visitNamespacePatchFlows(action.flow, `actions.${actionName}.flow`, errors);
  }

  return errors;
}

function visitNamespacePatchFlows(
  flow: FlowNode,
  path: string,
  errors: ValidationError[],
): void {
  switch (flow.kind) {
    case "seq":
      flow.steps.forEach((step, index) => {
        visitNamespacePatchFlows(step, `${path}.steps.${index}`, errors);
      });
      return;
    case "if":
      visitNamespacePatchFlows(flow.then, `${path}.then`, errors);
      if (flow.else) {
        visitNamespacePatchFlows(flow.else, `${path}.else`, errors);
      }
      return;
    case "namespacePatch":
      if (
        flow.namespace !== "mel"
        || flow.op !== "merge"
        || !isMelGuardIntentPatchPath(flow.path)
        || flow.value?.kind !== "object"
      ) {
        errors.push({
          code: "SCHEMA_ERROR",
          message: `Unsupported compiler namespace patch: ${flow.namespace}.${patchPathToDisplayString(flow.path)}`,
          path,
        });
      }
      return;
    case "patch":
    case "effect":
    case "call":
    case "halt":
    case "fail":
      return;
  }
}

function isMelGuardIntentPatchPath(path: PatchPath): boolean {
  return path.length === 2
    && path[0]?.kind === "prop"
    && path[0].name === "guards"
    && path[1]?.kind === "prop"
    && path[1].name === "intent";
}

function isAllowedLexicalPath(path: string): boolean {
  return path === "$item" || path.startsWith("$item.") || path === "$index" || path === "$array";
}

function isAllowedActionDollarPath(path: string): boolean {
  return isAllowedLexicalPath(path)
    || path.startsWith("$system.")
    || isAllowedCompilerMelNamespacePath(path);
}

function isAllowedCompilerMelNamespacePath(path: string): boolean {
  return path.startsWith("$mel.guards.intent.");
}
