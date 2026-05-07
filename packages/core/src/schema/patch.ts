import { z } from "zod";

/**
 * PatchSegment - A single segment in a patch path.
 */
export const PatchSegment = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("prop"),
    name: z.string().min(1),
  }),
  z.object({
    kind: z.literal("index"),
    index: z.number().int().nonnegative(),
  }),
]);
export type PatchSegment = z.infer<typeof PatchSegment>;

/**
 * PatchPath - Root-relative path segments.
 *
 * The transition channel determines the root:
 * - ComputeResult.patches: snapshot.state
 * - NamespaceDelta.patches: snapshot.namespaces[namespace]
 */
export const PatchPath = z.array(PatchSegment).min(1);
export type PatchPath = z.infer<typeof PatchPath>;

/**
 * Patch - A single state modification operation.
 * Only three operations: set, unset, merge.
 */
export const Patch = z.discriminatedUnion("op", [
  z.object({
    op: z.literal("set"),
    path: PatchPath,
    value: z.unknown(),
  }),
  z.object({
    op: z.literal("unset"),
    path: PatchPath,
  }),
  z.object({
    op: z.literal("merge"),
    path: PatchPath,
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
 * Helper to create a prop segment
 */
export function propSegment(name: string): PatchSegment {
  return { kind: "prop", name };
}

/**
 * Helper to create an index segment
 */
export function indexSegment(index: number): PatchSegment {
  return { kind: "index", index };
}

/**
 * Helper to create a set patch
 */
export function setPatch(path: PatchPath, value: unknown): SetPatch {
  return { op: "set", path, value };
}

/**
 * Helper to create an unset patch
 */
export function unsetPatch(path: PatchPath): UnsetPatch {
  return { op: "unset", path };
}

/**
 * Helper to create a merge patch
 */
export function mergePatch(path: PatchPath, value: Record<string, unknown>): MergePatch {
  return { op: "merge", path, value };
}
