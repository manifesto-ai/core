import type { TypeSpec } from "@manifesto-ai/core";
import { typeDefinitionToDomainType } from "./domain-type-definition.js";
import {
  arrayType,
  objectType,
  primitiveType,
  recordType,
  tupleType,
  unionOf,
  type DomainType,
  type DomainTypeField,
} from "./domain-type-model.js";

/**
 * Rewrite a context field type into a shape that is statically assignable to
 * the SDK external-context contract (`Readonly<Record<string, JsonValue>>`).
 *
 * Returns `null` when the type cannot be represented as a JSON-safe
 * TypeScript type, in which case the caller degrades the field to `JsonValue`
 * with a diagnostic. Rules:
 *
 * - `unknown` is not JSON-safe (it would break the domain-shape constraint).
 * - Named type refs are inlined structurally: generated interfaces do not
 *   carry implicit index signatures, so a ref would not be assignable to the
 *   external-context record type even when its fields are JSON-safe.
 *   Recursive refs degrade.
 * - Optional object fields become required `T | null` fields: `undefined` is
 *   not a `JsonValue`, so optional properties would break assignability.
 * - Record keys must be string-typed.
 */
export function toContextSafeType(
  type: DomainType,
  schemaTypes: Readonly<Record<string, TypeSpec>>,
  seenRefs: ReadonlySet<string> = new Set()
): DomainType | null {
  switch (type.kind) {
    case "unknown":
      return null;
    case "primitive":
    case "literal":
      return type;
    case "array": {
      const element = toContextSafeType(type.element, schemaTypes, seenRefs);
      return element === null ? null : arrayType(element);
    }
    case "tuple": {
      const elements: DomainType[] = [];
      for (const element of type.elements) {
        const safe = toContextSafeType(element, schemaTypes, seenRefs);
        if (safe === null) {
          return null;
        }
        elements.push(safe);
      }
      return tupleType(elements);
    }
    case "record": {
      if (!isStringKeyType(type.key)) {
        return null;
      }
      const value = toContextSafeType(type.value, schemaTypes, seenRefs);
      return value === null ? null : recordType(type.key, value);
    }
    case "object": {
      const fields: Record<string, DomainTypeField> = {};
      for (const name of Object.keys(type.fields)) {
        const field = type.fields[name];
        const safe = toContextSafeType(field.type, schemaTypes, seenRefs);
        if (safe === null) {
          return null;
        }
        fields[name] = {
          type: field.optional
            ? unionOf([safe, primitiveType("null")])
            : safe,
          optional: false,
        };
      }
      return objectType(fields);
    }
    case "union": {
      const members: DomainType[] = [];
      for (const member of type.types) {
        const safe = toContextSafeType(member, schemaTypes, seenRefs);
        if (safe === null) {
          return null;
        }
        members.push(safe);
      }
      return unionOf(members);
    }
    case "ref": {
      if (seenRefs.has(type.name)) {
        return null;
      }
      const spec = schemaTypes[type.name];
      if (!spec) {
        return null;
      }
      const resolved = typeDefinitionToDomainType(spec.definition, {
        resolveRef: (name) => Object.hasOwn(schemaTypes, name),
      });
      const nextSeen = new Set(seenRefs);
      nextSeen.add(type.name);
      return toContextSafeType(resolved, schemaTypes, nextSeen);
    }
  }
}

function isStringKeyType(key: DomainType): boolean {
  switch (key.kind) {
    case "primitive":
      return key.type === "string";
    case "literal":
      return typeof key.value === "string";
    case "union":
      return key.types.every((member) => isStringKeyType(member));
    default:
      return false;
  }
}
