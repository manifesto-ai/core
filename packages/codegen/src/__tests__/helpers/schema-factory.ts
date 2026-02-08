import type { DomainSchema, TypeDefinition, TypeSpec } from "@manifesto-ai/core";
import { hashSchemaSync } from "@manifesto-ai/core";

export function createTestSchema(
  overrides: Partial<Omit<DomainSchema, "hash">> = {}
): DomainSchema {
  const base = {
    id: "manifesto:test",
    version: "1.0.0",
    types: {},
    state: { fields: {} },
    computed: { fields: {} },
    actions: {},
    ...overrides,
  };

  const hash = hashSchemaSync(base);
  return { ...base, hash };
}

export function createTypeSpec(
  name: string,
  definition: TypeDefinition
): TypeSpec {
  return { name, definition };
}

// TypeDefinition factories
export function primitiveType(type: string): TypeDefinition {
  return { kind: "primitive", type };
}

export function literalType(value: string | number | boolean | null): TypeDefinition {
  return { kind: "literal", value };
}

export function arrayType(element: TypeDefinition): TypeDefinition {
  return { kind: "array", element };
}

export function recordType(key: TypeDefinition, value: TypeDefinition): TypeDefinition {
  return { kind: "record", key, value };
}

export function objectType(
  fields: Record<string, { type: TypeDefinition; optional: boolean }>
): TypeDefinition {
  return { kind: "object", fields };
}

export function unionType(types: TypeDefinition[]): TypeDefinition {
  return { kind: "union", types };
}

export function refType(name: string): TypeDefinition {
  return { kind: "ref", name };
}
