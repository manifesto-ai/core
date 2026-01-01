/**
 * Type system types for Translator
 * Aligned with MEL v0.3.3 TypeExpr
 */

import type { SemanticPath } from "./common.js";

/** Object type field */
export interface ObjectTypeField {
  readonly name: string;
  readonly type: TypeExpr;
  readonly optional: boolean;
}

/** Type expression (MEL v0.3.3 compatible) */
export type TypeExpr =
  | { readonly kind: "primitive"; readonly name: "string" | "number" | "boolean" | "null" }
  | { readonly kind: "literal"; readonly value: string | number }
  | { readonly kind: "ref"; readonly name: string }
  | { readonly kind: "union"; readonly members: readonly TypeExpr[] }
  | { readonly kind: "array"; readonly element: TypeExpr }
  | { readonly kind: "record"; readonly key: TypeExpr; readonly value: TypeExpr }
  | { readonly kind: "object"; readonly fields: readonly ObjectTypeField[] };

/** Resolved type with base kind information */
export interface ResolvedType {
  /** Fully resolved type expression */
  readonly resolved: TypeExpr;
  /** Original type name if from a named type */
  readonly sourceName?: string;
  /** Whether the type is nullable */
  readonly nullable: boolean;
  /** Base kind for pattern selection */
  readonly baseKind:
    | "string"
    | "number"
    | "boolean"
    | "null"
    | "array"
    | "record"
    | "object"
    | "union";
}

/** Type index mapping paths to resolved types */
export type TypeIndex = Readonly<Record<SemanticPath, ResolvedType>>;

/** Path node for expression paths */
export type PathNode =
  | { readonly kind: "name"; readonly name: string }
  | { readonly kind: "index"; readonly index: number }
  | { readonly kind: "chain"; readonly segments: readonly PathNode[] };

/** Expression node (MEL v0.3.3 call-only IR) */
export type ExprNode =
  | { readonly kind: "lit"; readonly value: null | boolean | number | string }
  | { readonly kind: "var"; readonly name: "item" }
  | { readonly kind: "sys"; readonly path: readonly string[] }
  | { readonly kind: "get"; readonly path: PathNode }
  | { readonly kind: "get"; readonly base: ExprNode; readonly path: PathNode }
  | { readonly kind: "call"; readonly fn: string; readonly args: readonly ExprNode[] }
  | { readonly kind: "obj"; readonly fields: readonly { key: string; value: ExprNode }[] }
  | { readonly kind: "arr"; readonly elements: readonly ExprNode[] };
