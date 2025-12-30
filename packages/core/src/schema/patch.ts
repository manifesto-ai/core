import { z } from "zod";
import { SemanticPath } from "./common.js";

/**
 * Patch - A single state modification operation.
 * Only three operations: set, unset, merge.
 */
export const Patch = z.discriminatedUnion("op", [
  z.object({
    op: z.literal("set"),
    path: SemanticPath,
    value: z.unknown(),
  }),
  z.object({
    op: z.literal("unset"),
    path: SemanticPath,
  }),
  z.object({
    op: z.literal("merge"),
    path: SemanticPath,
    value: z.record(z.string(), z.unknown()),
  }),
]);
export type Patch = z.infer<typeof Patch>;

/**
 * SetPatch - Set value at path
 */
export type SetPatch = Extract<Patch, { op: "set" }>;

/**
 * UnsetPatch - Remove value at path
 */
export type UnsetPatch = Extract<Patch, { op: "unset" }>;

/**
 * MergePatch - Shallow merge object at path
 */
export type MergePatch = Extract<Patch, { op: "merge" }>;

/**
 * Intent - A request to perform an action
 */
export const Intent = z.object({
  /**
   * Action type identifier
   */
  type: z.string(),

  /**
   * Action input parameters
   */
  input: z.unknown().optional(),

  /**
   * Unique identifier for this processing attempt.
   * MUST be unique per processing attempt.
   * MUST be stable across re-invocations for same attempt.
   */
  intentId: z.string(),
});
export type Intent = z.infer<typeof Intent>;

/**
 * Helper to create a set patch
 */
export function setPatch(path: SemanticPath, value: unknown): SetPatch {
  return { op: "set", path, value };
}

/**
 * Helper to create an unset patch
 */
export function unsetPatch(path: SemanticPath): UnsetPatch {
  return { op: "unset", path };
}

/**
 * Helper to create a merge patch
 */
export function mergePatch(path: SemanticPath, value: Record<string, unknown>): MergePatch {
  return { op: "merge", path, value };
}
