import type { ExprNode } from "../schema/expr.js";
import type { FlowNode } from "../schema/flow.js";
import type { FieldSpec, StateSpec } from "../schema/field.js";
import type { ComputedSpec } from "../schema/computed.js";

const SEMVER_REGEX =
  /^\d+\.\d+\.\d+(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;
const URI_SCHEME_REGEX = /^[a-zA-Z][a-zA-Z0-9+.-]*:/;
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isValidSchemaId(id: string): boolean {
  return URI_SCHEME_REGEX.test(id) || UUID_REGEX.test(id);
}

export function isValidSemver(version: string): boolean {
  return SEMVER_REGEX.test(version);
}

export function collectGetPathsFromExpr(expr: ExprNode): string[] {
  const paths: string[] = [];

  const visit = (node: ExprNode) => {
    switch (node.kind) {
      case "lit":
        return;
      case "get":
        paths.push(node.path);
        return;
      case "eq":
      case "neq":
      case "gt":
      case "gte":
      case "lt":
      case "lte":
      case "add":
      case "sub":
      case "mul":
      case "div":
      case "mod":
        visit(node.left);
        visit(node.right);
        return;
      case "pow":
        visit(node.base);
        visit(node.exponent);
        return;
      case "and":
      case "or":
      case "concat":
      case "min":
      case "max":
      case "coalesce":
        node.args.forEach(visit);
        return;
      case "not":
      case "neg":
      case "abs":
      case "floor":
      case "ceil":
      case "round":
      case "sqrt":
      case "typeof":
      case "isNull":
      case "toString":
      case "len":
        visit(node.arg);
        return;
      case "sumArray":
      case "minArray":
      case "maxArray":
      case "first":
      case "last":
        visit(node.array);
        return;
      case "if":
        visit(node.cond);
        visit(node.then);
        visit(node.else);
        return;
      case "substring":
        visit(node.str);
        visit(node.start);
        if (node.end) visit(node.end);
        return;
      case "trim":
      case "toLowerCase":
      case "toUpperCase":
      case "strLen":
        visit(node.str);
        return;
      case "at":
        visit(node.array);
        visit(node.index);
        return;
      case "slice":
        visit(node.array);
        visit(node.start);
        if (node.end) visit(node.end);
        return;
      case "includes":
        visit(node.array);
        visit(node.item);
        return;
      case "filter":
      case "find":
      case "every":
      case "some":
        visit(node.array);
        visit(node.predicate);
        return;
      case "map":
        visit(node.array);
        visit(node.mapper);
        return;
      case "append":
        visit(node.array);
        node.items.forEach(visit);
        return;
      case "object":
        Object.values(node.fields).forEach(visit);
        return;
      case "keys":
      case "values":
      case "entries":
        visit(node.obj);
        return;
      case "merge":
        node.objects.forEach(visit);
        return;
    }
  };

  visit(expr);
  return paths;
}

export function collectGetPathsFromFlow(flow: FlowNode): string[] {
  const paths: string[] = [];

  const visitFlow = (node: FlowNode) => {
    switch (node.kind) {
      case "seq":
        node.steps.forEach(visitFlow);
        return;
      case "if":
        paths.push(...collectGetPathsFromExpr(node.cond));
        visitFlow(node.then);
        if (node.else) visitFlow(node.else);
        return;
      case "patch":
        if (node.op !== "unset" && node.value) {
          paths.push(...collectGetPathsFromExpr(node.value));
        }
        return;
      case "effect":
        Object.values(node.params).forEach((expr) => {
          paths.push(...collectGetPathsFromExpr(expr));
        });
        return;
      case "fail":
        if (node.message) {
          paths.push(...collectGetPathsFromExpr(node.message));
        }
        return;
      case "call":
      case "halt":
        return;
    }
  };

  visitFlow(flow);
  return paths;
}

export function pathExistsInStateSpec(state: StateSpec, path: string): boolean {
  return pathExistsInFieldSpec({ type: "object", required: true, fields: state.fields }, path);
}

export function pathExistsInComputedSpec(computed: ComputedSpec, path: string): boolean {
  return path in computed.fields;
}

export function pathExistsInFieldSpec(spec: FieldSpec, path: string): boolean {
  if (!path) {
    return true;
  }

  const segments = path.split(".");
  let current: FieldSpec | null = spec;

  for (const segment of segments) {
    if (!current) {
      return false;
    }

    const fieldType = current.type;
    if (fieldType === "object") {
      if (!current.fields) {
        // Open object allows any nested path (e.g., Json types)
        return true;
      }
      if (!(segment in current.fields)) {
        return false;
      }
      current = current.fields[segment];
      continue;
    }

    if (fieldType === "array") {
      if (!isNumericSegment(segment)) {
        return false;
      }
      current = current.items ?? null;
      continue;
    }

    return false;
  }

  return true;
}

export function validateValueAgainstFieldSpec(
  value: unknown,
  spec: FieldSpec,
  options?: { allowPartial?: boolean; allowUndefined?: boolean }
): { ok: boolean; message?: string } {
  if (value === undefined) {
    if (options?.allowUndefined && spec.required === false) {
      return { ok: true };
    }
    return { ok: false, message: "Value is required" };
  }

  if (value === null) {
    return { ok: true };
  }

  const fieldType = spec.type;
  if (typeof fieldType === "object" && "enum" in fieldType) {
    return fieldType.enum.some((entry) => Object.is(entry, value))
      ? { ok: true }
      : { ok: false, message: "Value is not in enum" };
  }

  switch (fieldType) {
    case "null":
      return value === null ? { ok: true } : { ok: false, message: "Expected null" };
    case "string":
      return typeof value === "string" ? { ok: true } : { ok: false, message: "Expected string" };
    case "number":
      return typeof value === "number" && Number.isFinite(value)
        ? { ok: true }
        : { ok: false, message: "Expected number" };
    case "boolean":
      return typeof value === "boolean" ? { ok: true } : { ok: false, message: "Expected boolean" };
    case "object":
      if (value === null || Array.isArray(value) || typeof value !== "object") {
        return { ok: false, message: "Expected object" };
      }
      return validateObjectValue(
        value as Record<string, unknown>,
        spec,
        options?.allowPartial ?? false,
        options?.allowUndefined ?? false
      );
    case "array":
      if (!Array.isArray(value)) {
        return { ok: false, message: "Expected array" };
      }
      if (!spec.items) {
        return { ok: true };
      }
      for (const item of value) {
        const result = validateValueAgainstFieldSpec(item, spec.items, { allowUndefined: false });
        if (!result.ok) {
          return result;
        }
      }
      return { ok: true };
  }
}

function validateObjectValue(
  value: Record<string, unknown>,
  spec: FieldSpec,
  allowPartial: boolean,
  allowUndefined: boolean
): { ok: boolean; message?: string } {
  if (!spec.fields) {
    return { ok: true };
  }

  const fieldEntries = Object.entries(spec.fields);
  const fieldNames = new Set(fieldEntries.map(([name]) => name));

  for (const key of Object.keys(value)) {
    if (!fieldNames.has(key)) {
      return { ok: false, message: `Unknown field: ${key}` };
    }
    const fieldSpec = spec.fields[key];
    const result = validateValueAgainstFieldSpec(value[key], fieldSpec, {
      allowPartial,
      allowUndefined,
    });
    if (!result.ok) {
      return result;
    }
  }

  if (!allowPartial) {
    for (const [name, fieldSpec] of fieldEntries) {
      if (fieldSpec.required && !(name in value)) {
        return { ok: false, message: `Missing required field: ${name}` };
      }
    }
  }

  return { ok: true };
}

export function getFieldSpecAtPath(spec: FieldSpec, path: string): FieldSpec | null {
  if (!path) return spec;

  const segments = path.split(".");
  let current: FieldSpec | null = spec;

  for (const segment of segments) {
    if (!current) return null;

    const fieldType = current.type;
    if (fieldType === "object") {
      if (!current.fields || !(segment in current.fields)) {
        return null;
      }
      current = current.fields[segment];
      continue;
    }

    if (fieldType === "array") {
      if (!isNumericSegment(segment)) {
        return null;
      }
      current = current.items ?? null;
      continue;
    }

    return null;
  }

  return current;
}

function isNumericSegment(segment: string): boolean {
  return /^[0-9]+$/.test(segment);
}
