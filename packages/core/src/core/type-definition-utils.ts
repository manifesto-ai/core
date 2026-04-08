import type { PatchSegment } from "../schema/patch.js";
import type { StateSpec } from "../schema/field.js";
import type { TypeDefinition, TypeSpec } from "../schema/type-spec.js";
import { parsePath } from "../utils/path.js";

export type TypeValidationOptions = {
  allowPartial?: boolean;
  allowUndefined?: boolean;
};

type TypeValidationResult = { ok: boolean; message?: string };

function isNumericSegment(segment: string): boolean {
  return /^\d+$/.test(segment);
}

function isNullType(definition: TypeDefinition, types: Record<string, TypeSpec>): boolean {
  const resolved = resolveTypeDefinition(definition, types);
  if (!resolved) {
    return false;
  }

  return (
    (resolved.kind === "primitive" && resolved.type === "null")
    || (resolved.kind === "literal" && resolved.value === null)
  );
}

function stripNullableEnvelope(
  definition: TypeDefinition,
  types: Record<string, TypeSpec>,
): TypeDefinition | null {
  const resolved = resolveTypeDefinition(definition, types);
  if (!resolved) {
    return null;
  }

  if (resolved.kind !== "union") {
    return resolved;
  }

  const nonNullTypes = resolved.types.filter((candidate) => !isNullType(candidate, types));
  const hasNull = nonNullTypes.length !== resolved.types.length;
  if (!hasNull) {
    return resolved;
  }

  if (nonNullTypes.length !== 1) {
    return null;
  }

  return resolveTypeDefinition(nonNullTypes[0], types);
}

export function resolveTypeDefinition(
  definition: TypeDefinition,
  types: Record<string, TypeSpec>,
  seenRefs: readonly string[] = [],
): TypeDefinition | null {
  if (definition.kind !== "ref") {
    return definition;
  }

  if (seenRefs.includes(definition.name)) {
    return null;
  }

  const next = types[definition.name];
  if (!next) {
    return null;
  }

  return resolveTypeDefinition(next.definition, types, [...seenRefs, definition.name]);
}

export function pathExistsInTypeDefinition(
  definition: TypeDefinition,
  types: Record<string, TypeSpec>,
  path: string,
): boolean {
  if (!path) {
    return true;
  }

  const segments = parsePath(path).map((segment) =>
    isNumericSegment(segment)
      ? ({ kind: "index", index: Number(segment) } satisfies PatchSegment)
      : ({ kind: "prop", name: segment } satisfies PatchSegment)
  );

  return getTypeDefinitionAtSegments(definition, types, segments) !== null;
}

export function pathExistsInTypeDefinitionSegments(
  definition: TypeDefinition,
  types: Record<string, TypeSpec>,
  segments: readonly PatchSegment[],
): boolean {
  return getTypeDefinitionAtSegments(definition, types, segments) !== null;
}

export function getTypeDefinitionAtSegments(
  definition: TypeDefinition,
  types: Record<string, TypeSpec>,
  segments: readonly PatchSegment[],
): TypeDefinition | null {
  let current: TypeDefinition | null = definition;

  for (const segment of segments) {
    if (!current) {
      return null;
    }

    const traversable = stripNullableEnvelope(current, types);
    if (!traversable) {
      return null;
    }

    switch (traversable.kind) {
      case "object":
        if (segment.kind !== "prop") {
          return null;
        }
        current = traversable.fields[segment.name]?.type ?? null;
        break;

      case "record":
        if (segment.kind !== "prop") {
          return null;
        }
        current = traversable.value;
        break;

      case "array":
        if (segment.kind !== "index") {
          return null;
        }
        current = traversable.element;
        break;

      case "primitive":
        return null;

      default:
        return null;
    }
  }

  return current;
}

export function getStateTypeDefinitionAtSegments(
  state: StateSpec,
  types: Record<string, TypeSpec>,
  segments: readonly PatchSegment[],
): TypeDefinition | null {
  if (!state.fieldTypes || segments.length === 0) {
    return null;
  }

  const [root, ...rest] = segments;
  if (!root || root.kind !== "prop") {
    return null;
  }

  if (!(root.name in state.fields)) {
    return null;
  }

  const rootType = state.fieldTypes[root.name];
  if (!rootType) {
    return null;
  }

  return rest.length === 0
    ? rootType
    : getTypeDefinitionAtSegments(rootType, types, rest);
}

export function validateValueAgainstTypeDefinition(
  value: unknown,
  definition: TypeDefinition,
  types: Record<string, TypeSpec>,
  options?: TypeValidationOptions,
): TypeValidationResult {
  if (value === undefined) {
    return options?.allowUndefined
      ? { ok: true }
      : { ok: false, message: "Value is required" };
  }

  const resolved = resolveTypeDefinition(definition, types);
  if (!resolved) {
    return { ok: false, message: "Unknown type reference" };
  }

  if (resolved.kind === "union") {
    const results = resolved.types.map((candidate) =>
      validateValueAgainstTypeDefinition(value, candidate, types, options)
    );
    return results.find((result) => result.ok)
      ?? { ok: false, message: "Value does not match any union branch" };
  }

  switch (resolved.kind) {
    case "primitive":
      switch (resolved.type) {
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
          return value !== null && !Array.isArray(value) && typeof value === "object"
            ? { ok: true }
            : { ok: false, message: "Expected object" };
        case "array":
          return Array.isArray(value)
            ? { ok: true }
            : { ok: false, message: "Expected array" };
        default:
          return { ok: false, message: `Unsupported primitive type: ${resolved.type}` };
      }

    case "literal":
      return Object.is(value, resolved.value)
        ? { ok: true }
        : { ok: false, message: `Expected literal ${JSON.stringify(resolved.value)}` };

    case "array":
      if (!Array.isArray(value)) {
        return { ok: false, message: "Expected array" };
      }
      for (const item of value) {
        const itemResult = validateValueAgainstTypeDefinition(item, resolved.element, types, {
          allowUndefined: false,
        });
        if (!itemResult.ok) {
          return itemResult;
        }
      }
      return { ok: true };

    case "object":
      if (value === null || Array.isArray(value) || typeof value !== "object") {
        return { ok: false, message: "Expected object" };
      }
      return validateObjectValue(
        value as Record<string, unknown>,
        resolved.fields,
        types,
        options?.allowPartial ?? false,
        options?.allowUndefined ?? false,
      );

    case "record":
      if (value === null || Array.isArray(value) || typeof value !== "object") {
        return { ok: false, message: "Expected object" };
      }
      const keyType = resolveTypeDefinition(resolved.key, types);
      if (!keyType || keyType.kind !== "primitive" || keyType.type !== "string") {
        return { ok: false, message: "Record keys must be strings" };
      }
      for (const entry of Object.values(value as Record<string, unknown>)) {
        const entryResult = validateValueAgainstTypeDefinition(entry, resolved.value, types, {
          allowUndefined: false,
        });
        if (!entryResult.ok) {
          return entryResult;
        }
      }
      return { ok: true };

    case "ref":
      return { ok: false, message: "Unresolved type reference" };
  }
}

function validateObjectValue(
  value: Record<string, unknown>,
  fields: Record<string, { type: TypeDefinition; optional: boolean }>,
  types: Record<string, TypeSpec>,
  allowPartial: boolean,
  allowUndefined: boolean,
): TypeValidationResult {
  const fieldNames = new Set(Object.keys(fields));

  for (const key of Object.keys(value)) {
    if (!fieldNames.has(key)) {
      return { ok: false, message: `Unknown field: ${key}` };
    }
  }

  for (const [name, field] of Object.entries(fields)) {
    if (!(name in value)) {
      if (!allowPartial && !field.optional) {
        return { ok: false, message: `Missing required field: ${name}` };
      }
      continue;
    }

    const result = validateValueAgainstTypeDefinition(value[name], field.type, types, {
      allowPartial,
      allowUndefined,
    });
    if (!result.ok) {
      return result;
    }
  }

  return { ok: true };
}
