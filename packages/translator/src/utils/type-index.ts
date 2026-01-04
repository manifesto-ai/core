/**
 * Type Index Derivation (SPEC-1.1.1v §4.5, §8A.2)
 *
 * TypeIndex is deterministically derived from DomainSchema.
 * It MUST NOT be stored or provided independently.
 */

import type { DomainSchema } from "../domain/context.js";
import type {
  TypeIndex,
  TypeExpr,
  ResolvedType,
  ResolvedTypeObject,
} from "../domain/type-expr.js";
import type { SemanticPath } from "../domain/types.js";

/**
 * Derive TypeIndex from DomainSchema
 *
 * TypeIndex MUST include entries for:
 * - State fields: `state.<field>`
 * - Computed: `computed.<name>`
 * - Action params: `actions.<action>.params.<param>`
 * - Type fields: `types.<Type>.fields.<field>`
 *
 * @param schema - Domain schema to derive from
 * @returns TypeIndex mapping paths to resolved types
 */
export function deriveTypeIndex(schema: DomainSchema): TypeIndex {
  const index: TypeIndex = {};
  const typeRegistry = extractTypeRegistry(schema);

  // Index state fields
  if (schema.state && typeof schema.state === "object") {
    const state = schema.state as Record<string, unknown>;
    const fields = (state.fields ?? state) as Record<string, unknown>;

    for (const [fieldName, fieldDef] of Object.entries(fields)) {
      const path: SemanticPath = `state.${fieldName}`;
      const typeExpr = extractTypeExpr(fieldDef);
      if (typeExpr) {
        index[path] = resolveType(typeExpr, typeRegistry);
      }
    }
  }

  // Index computed values
  if (schema.computed && typeof schema.computed === "object") {
    for (const [name, def] of Object.entries(
      schema.computed as Record<string, unknown>
    )) {
      const path: SemanticPath = `computed.${name}`;
      const typeExpr = extractReturnType(def);
      if (typeExpr) {
        index[path] = resolveType(typeExpr, typeRegistry);
      }
    }
  }

  // Index action parameters
  if (schema.actions && typeof schema.actions === "object") {
    for (const [actionName, actionDef] of Object.entries(schema.actions)) {
      const action = actionDef as Record<string, unknown>;
      const params = action.params as Record<string, unknown> | undefined;

      if (params) {
        for (const [paramName, paramDef] of Object.entries(params)) {
          const path: SemanticPath = `actions.${actionName}.params.${paramName}`;
          const typeExpr = extractTypeExpr(paramDef);
          if (typeExpr) {
            index[path] = resolveType(typeExpr, typeRegistry);
          }
        }
      }
    }
  }

  // Index named types and their fields
  if (schema.types && typeof schema.types === "object") {
    for (const [typeName, typeDef] of Object.entries(
      schema.types as Record<string, unknown>
    )) {
      const typeExpr = typeDef as TypeExpr;

      // Add the type itself
      const typePath: SemanticPath = `types.${typeName}`;
      index[typePath] = resolveType(typeExpr, typeRegistry);

      // Add fields if it's an object type
      if (typeExpr.kind === "object") {
        for (const [fieldName, fieldDef] of Object.entries(typeExpr.fields)) {
          const fieldPath: SemanticPath = `types.${typeName}.fields.${fieldName}`;
          index[fieldPath] = resolveType(fieldDef.type, typeRegistry);
        }
      }
    }
  }

  return index;
}

/**
 * Extract type registry from schema for reference resolution
 */
function extractTypeRegistry(
  schema: DomainSchema
): Record<string, TypeExpr> {
  const registry: Record<string, TypeExpr> = {};

  if (schema.types && typeof schema.types === "object") {
    for (const [name, def] of Object.entries(
      schema.types as Record<string, unknown>
    )) {
      registry[name] = def as TypeExpr;
    }
  }

  return registry;
}

/**
 * Extract TypeExpr from a field definition
 */
function extractTypeExpr(def: unknown): TypeExpr | null {
  if (!def || typeof def !== "object") {
    return null;
  }

  const obj = def as Record<string, unknown>;

  // If it has a 'type' field, use that
  if (obj.type && typeof obj.type === "object") {
    return obj.type as TypeExpr;
  }

  // If it has a 'kind' field, it's already a TypeExpr
  if (obj.kind && typeof obj.kind === "string") {
    return obj as unknown as TypeExpr;
  }

  return null;
}

/**
 * Extract return type from a computed definition
 */
function extractReturnType(def: unknown): TypeExpr | null {
  if (!def || typeof def !== "object") {
    return null;
  }

  const obj = def as Record<string, unknown>;

  // If it has a 'returnType' field
  if (obj.returnType && typeof obj.returnType === "object") {
    return obj.returnType as TypeExpr;
  }

  // If it has a 'type' field
  if (obj.type && typeof obj.type === "object") {
    return obj.type as TypeExpr;
  }

  return null;
}

/**
 * Resolve a TypeExpr to ResolvedType
 *
 * Resolves all type references and computes nullable flag for unions.
 */
function resolveType(
  typeExpr: TypeExpr,
  registry: Record<string, TypeExpr>,
  seen: Set<string> = new Set()
): ResolvedType {
  switch (typeExpr.kind) {
    case "primitive":
      return { kind: "primitive", name: typeExpr.name };

    case "literal":
      return { kind: "literal", value: typeExpr.value };

    case "ref": {
      const name = typeExpr.name;

      // Detect circular references
      if (seen.has(name)) {
        // Return a placeholder for circular references
        return { kind: "primitive", name: "null" };
      }

      const referenced = registry[name];
      if (!referenced) {
        // Unknown reference, treat as opaque
        return { kind: "primitive", name: "null" };
      }

      // Resolve the referenced type
      const resolved = resolveType(
        referenced,
        registry,
        new Set([...seen, name])
      );

      // Add typeName if it's an object
      if (resolved.kind === "object") {
        return { ...resolved, typeName: name };
      }

      return resolved;
    }

    case "array":
      return {
        kind: "array",
        element: resolveType(typeExpr.element, registry, seen),
      };

    case "record":
      return {
        kind: "record",
        key: resolveType(typeExpr.key, registry, seen),
        value: resolveType(typeExpr.value, registry, seen),
      };

    case "union": {
      const members = typeExpr.members.map((m) =>
        resolveType(m, registry, seen)
      );
      const nullable = members.some(
        (m) => m.kind === "primitive" && m.name === "null"
      );
      return { kind: "union", members, nullable };
    }

    case "object": {
      const fields: ResolvedTypeObject["fields"] = {};
      for (const [name, field] of Object.entries(typeExpr.fields)) {
        fields[name] = {
          type: resolveType(field.type, registry, seen),
          optional: field.optional,
        };
      }
      return { kind: "object", fields };
    }

    default:
      // Should never happen if TypeExpr is well-formed
      return { kind: "primitive", name: "null" };
  }
}

/**
 * Get a resolved type from the index
 */
export function getResolvedType(
  index: TypeIndex,
  path: SemanticPath
): ResolvedType | undefined {
  return index[path];
}

/**
 * Check if a path exists in the index
 */
export function hasPath(index: TypeIndex, path: SemanticPath): boolean {
  return path in index;
}

/**
 * Get all paths in the index
 */
export function getAllPaths(index: TypeIndex): SemanticPath[] {
  return Object.keys(index);
}

/**
 * Get paths matching a prefix
 */
export function getPathsByPrefix(
  index: TypeIndex,
  prefix: string
): SemanticPath[] {
  return Object.keys(index).filter(
    (path) => path === prefix || path.startsWith(prefix + ".")
  );
}
