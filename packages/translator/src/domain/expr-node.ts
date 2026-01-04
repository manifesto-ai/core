/**
 * MEL Expression IR (SPEC-1.1.1v §6.2)
 *
 * MEL v0.3.3 canonical expression IR with 7 node kinds.
 * This is the target representation for all computed expressions.
 */

import { z } from "zod";
import type { PrimitiveValue } from "./types.js";

// =============================================================================
// Path Types
// =============================================================================

/** Path segment for property access */
export interface PathSegment {
  kind: "prop";
  name: string;
}

/** Array of path segments */
export type PathNode = PathSegment[];

/**
 * System path as segment array (MEL v0.3.3 canonical)
 * $meta.intentId → ["meta", "intentId"]
 * $system.uuid → ["system", "uuid"]
 * $input.raw → ["input", "raw"]
 */
export type SystemPath = string[];

// =============================================================================
// Expression Node Types (7 kinds)
// =============================================================================

/** Literal expression (primitive only) */
export interface ExprLit {
  kind: "lit";
  value: PrimitiveValue;
}

/** Variable reference ($item only in v0.3.3) */
export interface ExprVar {
  kind: "var";
  name: "item";
}

/** System value access ($meta.*, $system.*, $input.*) */
export interface ExprSys {
  kind: "sys";
  path: SystemPath;
}

/** Property access (base absent = root state) */
export interface ExprGet {
  kind: "get";
  base?: ExprNode;
  path: PathNode;
}

/** Function call (all operations) */
export interface ExprCall {
  kind: "call";
  fn: string;
  args: ExprNode[];
}

/** Object field for ExprObj */
export interface ObjField {
  key: string;
  value: ExprNode;
}

/** Object literal (key/value pairs) */
export interface ExprObj {
  kind: "obj";
  fields: ObjField[];
}

/** Array literal */
export interface ExprArr {
  kind: "arr";
  elements: ExprNode[];
}

/**
 * MEL v0.3.3 canonical expression IR
 *
 * 7 node kinds:
 * - lit: Primitive literals (not objects/arrays)
 * - var: Variable ($item only)
 * - sys: System values ($meta.*, $system.*, $input.*)
 * - get: Property access
 * - call: Function calls
 * - obj: Object literals
 * - arr: Array literals
 */
export type ExprNode =
  | ExprLit
  | ExprVar
  | ExprSys
  | ExprGet
  | ExprCall
  | ExprObj
  | ExprArr;

// =============================================================================
// Zod Schemas
// =============================================================================

export const PathSegmentSchema = z.object({
  kind: z.literal("prop"),
  name: z.string(),
});

export const PathNodeSchema = z.array(PathSegmentSchema);

export const SystemPathSchema = z.array(z.string());

// Recursive schema for ExprNode
export const ExprNodeSchema: z.ZodType<ExprNode> = z.lazy(() =>
  z.discriminatedUnion("kind", [
    z.object({
      kind: z.literal("lit"),
      value: z.union([z.null(), z.boolean(), z.number(), z.string()]),
    }),
    z.object({
      kind: z.literal("var"),
      name: z.literal("item"),
    }),
    z.object({
      kind: z.literal("sys"),
      path: SystemPathSchema,
    }),
    z.object({
      kind: z.literal("get"),
      base: ExprNodeSchema.optional(),
      path: PathNodeSchema,
    }),
    z.object({
      kind: z.literal("call"),
      fn: z.string(),
      args: z.array(ExprNodeSchema),
    }),
    z.object({
      kind: z.literal("obj"),
      fields: z.array(
        z.object({
          key: z.string(),
          value: ExprNodeSchema,
        })
      ),
    }),
    z.object({
      kind: z.literal("arr"),
      elements: z.array(ExprNodeSchema),
    }),
  ])
);

// =============================================================================
// Helper Functions
// =============================================================================

/** Create a literal expression */
export function lit(value: PrimitiveValue): ExprLit {
  return { kind: "lit", value };
}

/** Create a variable expression ($item) */
export function varItem(): ExprVar {
  return { kind: "var", name: "item" };
}

/** Create a system expression */
export function sys(...path: string[]): ExprSys {
  return { kind: "sys", path };
}

/** Create a property access expression */
export function get(path: string[], base?: ExprNode): ExprGet {
  return {
    kind: "get",
    ...(base && { base }),
    path: path.map((name) => ({ kind: "prop" as const, name })),
  };
}

/** Create a function call expression */
export function call(fn: string, ...args: ExprNode[]): ExprCall {
  return { kind: "call", fn, args };
}

/** Create an object literal expression */
export function obj(fields: Record<string, ExprNode>): ExprObj {
  return {
    kind: "obj",
    fields: Object.entries(fields).map(([key, value]) => ({ key, value })),
  };
}

/** Create an array literal expression */
export function arr(...elements: ExprNode[]): ExprArr {
  return { kind: "arr", elements };
}
