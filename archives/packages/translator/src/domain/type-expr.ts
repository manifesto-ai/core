/**
 * Type System (SPEC-1.1.1v §6.3)
 *
 * TypeExpr: Type declarations (what user writes)
 * ResolvedType: Runtime types (what engine uses)
 * TypeIndex: Maps semantic paths to resolved types
 */

import { z } from "zod";
import type { PrimitiveValue, SemanticPath } from "./types.js";

// =============================================================================
// TypeExpr (Declaration View)
// =============================================================================

export interface TypeExprPrimitive {
  kind: "primitive";
  name: "string" | "number" | "boolean" | "null";
}

export interface TypeExprLiteral {
  kind: "literal";
  value: PrimitiveValue;
}

export interface TypeExprRef {
  kind: "ref";
  name: string;
}

export interface TypeExprArray {
  kind: "array";
  element: TypeExpr;
}

export interface TypeExprRecord {
  kind: "record";
  key: TypeExpr;
  value: TypeExpr;
}

export interface TypeExprUnion {
  kind: "union";
  members: TypeExpr[];
}

export interface TypeExprObjectField {
  type: TypeExpr;
  optional: boolean;
}

export interface TypeExprObject {
  kind: "object";
  fields: Record<string, TypeExprObjectField>;
}

/**
 * Type expression for declarations
 *
 * Represents type definitions as structured AST, aligned with MEL v0.3.3.
 */
export type TypeExpr =
  | TypeExprPrimitive
  | TypeExprLiteral
  | TypeExprRef
  | TypeExprArray
  | TypeExprRecord
  | TypeExprUnion
  | TypeExprObject;

// =============================================================================
// ResolvedType (Resolved View)
// =============================================================================

export interface ResolvedTypePrimitive {
  kind: "primitive";
  name: "string" | "number" | "boolean" | "null";
}

export interface ResolvedTypeLiteral {
  kind: "literal";
  value: PrimitiveValue;
}

export interface ResolvedTypeArray {
  kind: "array";
  element: ResolvedType;
}

export interface ResolvedTypeRecord {
  kind: "record";
  key: ResolvedType;
  value: ResolvedType;
}

export interface ResolvedTypeUnion {
  kind: "union";
  members: ResolvedType[];
  nullable: boolean;
}

export interface ResolvedTypeObjectField {
  type: ResolvedType;
  optional: boolean;
}

export interface ResolvedTypeObject {
  kind: "object";
  fields: Record<string, ResolvedTypeObjectField>;
  typeName?: string;
}

/**
 * Resolved type (after reference resolution)
 *
 * Key differences from TypeExpr:
 * - No `ref` kind (all references resolved)
 * - `union` includes `nullable` flag for optimization
 * - `object` MAY include `typeName` for provenance
 */
export type ResolvedType =
  | ResolvedTypePrimitive
  | ResolvedTypeLiteral
  | ResolvedTypeArray
  | ResolvedTypeRecord
  | ResolvedTypeUnion
  | ResolvedTypeObject;

// =============================================================================
// TypeIndex
// =============================================================================

/**
 * Type index: maps semantic paths to resolved types
 *
 * MUST include entries for:
 * - State fields: `state.<field>`
 * - Computed: `computed.<name>`
 * - Action params: `actions.<action>.params.<param>`
 * - Type fields: `types.<Type>.fields.<field>`
 *
 * TypeIndex is NOT stored in schema. It is deterministically derived
 * from schema via `deriveTypeIndex(schema)`.
 */
export type TypeIndex = Record<SemanticPath, ResolvedType>;

// =============================================================================
// Zod Schemas
// =============================================================================

const PrimitiveNameSchema = z.enum(["string", "number", "boolean", "null"]);

export const TypeExprSchema: z.ZodType<TypeExpr> = z.lazy(() =>
  z.discriminatedUnion("kind", [
    z.object({
      kind: z.literal("primitive"),
      name: PrimitiveNameSchema,
    }),
    z.object({
      kind: z.literal("literal"),
      value: z.union([z.null(), z.boolean(), z.number(), z.string()]),
    }),
    z.object({
      kind: z.literal("ref"),
      name: z.string(),
    }),
    z.object({
      kind: z.literal("array"),
      element: TypeExprSchema,
    }),
    z.object({
      kind: z.literal("record"),
      key: TypeExprSchema,
      value: TypeExprSchema,
    }),
    z.object({
      kind: z.literal("union"),
      members: z.array(TypeExprSchema),
    }),
    z.object({
      kind: z.literal("object"),
      fields: z.record(
        z.object({
          type: TypeExprSchema,
          optional: z.boolean(),
        })
      ),
    }),
  ])
);

export const ResolvedTypeSchema: z.ZodType<ResolvedType> = z.lazy(() =>
  z.discriminatedUnion("kind", [
    z.object({
      kind: z.literal("primitive"),
      name: PrimitiveNameSchema,
    }),
    z.object({
      kind: z.literal("literal"),
      value: z.union([z.null(), z.boolean(), z.number(), z.string()]),
    }),
    z.object({
      kind: z.literal("array"),
      element: ResolvedTypeSchema,
    }),
    z.object({
      kind: z.literal("record"),
      key: ResolvedTypeSchema,
      value: ResolvedTypeSchema,
    }),
    z.object({
      kind: z.literal("union"),
      members: z.array(ResolvedTypeSchema),
      nullable: z.boolean(),
    }),
    z.object({
      kind: z.literal("object"),
      fields: z.record(
        z.object({
          type: ResolvedTypeSchema,
          optional: z.boolean(),
        })
      ),
      typeName: z.string().optional(),
    }),
  ])
);

export const TypeIndexSchema = z.record(ResolvedTypeSchema);

// =============================================================================
// Helper Functions
// =============================================================================

/** Create a primitive type */
export function primitiveType(
  name: "string" | "number" | "boolean" | "null"
): TypeExprPrimitive {
  return { kind: "primitive", name };
}

/** Create a literal type */
export function literalType(value: PrimitiveValue): TypeExprLiteral {
  return { kind: "literal", value };
}

/** Create a type reference */
export function refType(name: string): TypeExprRef {
  return { kind: "ref", name };
}

/** Create an array type */
export function arrayType(element: TypeExpr): TypeExprArray {
  return { kind: "array", element };
}

/** Create a record type */
export function recordType(key: TypeExpr, value: TypeExpr): TypeExprRecord {
  return { kind: "record", key, value };
}

/** Create a union type */
export function unionType(...members: TypeExpr[]): TypeExprUnion {
  return { kind: "union", members };
}

/** Create an object type */
export function objectType(
  fields: Record<string, { type: TypeExpr; optional?: boolean }>
): TypeExprObject {
  const normalizedFields: Record<string, TypeExprObjectField> = {};
  for (const [key, value] of Object.entries(fields)) {
    normalizedFields[key] = {
      type: value.type,
      optional: value.optional ?? false,
    };
  }
  return { kind: "object", fields: normalizedFields };
}
