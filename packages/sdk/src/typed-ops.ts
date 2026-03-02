import { semanticPathToPatchPath } from "@manifesto-ai/core";
import type { SetPatch, UnsetPatch, MergePatch } from "@manifesto-ai/core";

// ============================================================================
// Type-Level Path Utilities
// ============================================================================

/**
 * Depth counter for recursive type operations.
 * Prevents infinite recursion in TypeScript's type system.
 *
 * Usage: Prev[4] = 3, Prev[3] = 2, ... Prev[0] = never
 */
type Prev = [never, 0, 1, 2, 3, 4];

/**
 * Extract all valid dot-separated paths from a data type.
 *
 * - Object keys become path segments
 * - Nested objects generate dot-separated paths (e.g. "user.name")
 * - Arrays, primitives, and Record<string, T> are leaf nodes
 *   (Record sub-paths are not supported by Core's path resolution)
 * - Limited to 3 levels of nesting to avoid TS recursion limits
 *   (root key + 3 nested levels = max 4 path segments)
 *
 * @example
 * type State = { user: { name: string; age: number }; count: number };
 * type P = DataPaths<State>;
 * // "user" | "user.name" | "user.age" | "count"
 */
export type DataPaths<T, D extends number = 3> = [D] extends [never]
  ? never
  : T extends Record<string, unknown>
    ? T extends unknown[]
      ? never
      : {
          [K in keyof T & string]:
            | K
            | (NonNullable<T[K]> extends Record<string, unknown>
                ? NonNullable<T[K]> extends unknown[]
                  ? never
                  : string extends keyof NonNullable<T[K]>
                    ? never // Record<string, T> — dynamic keys not resolved by Core
                    : `${K}.${DataPaths<NonNullable<T[K]>, Prev[D]>}`
                : never);
        }[keyof T & string]
    : never;

/**
 * Resolve the value type at a dot-separated path.
 *
 * @example
 * type State = { user: { name: string } };
 * type V = ValueAt<State, "user.name">; // string
 * type U = ValueAt<State, "user">;      // { name: string }
 */
export type ValueAt<T, P extends string> = P extends `${infer K}.${infer Rest}`
  ? K extends keyof T
    ? ValueAt<NonNullable<T[K]>, Rest>
    : never
  : P extends keyof T
    ? T[P]
    : never;

/**
 * Paths that resolve to plain object types (valid targets for merge).
 * Arrays and primitives are excluded since merge performs shallow object merge.
 *
 * @example
 * type State = { user: { name: string }; tags: string[]; count: number };
 * type M = ObjectPaths<State>;
 * // "user" (tags and count excluded - not plain objects)
 */
export type ObjectPaths<T, D extends number = 3> = [D] extends [never]
  ? never
  : T extends Record<string, unknown>
    ? T extends unknown[]
      ? never
      : {
          [K in keyof T & string]:
            | (NonNullable<T[K]> extends Record<string, unknown>
                ? NonNullable<T[K]> extends unknown[]
                  ? never
                  : K
                : never)
            | (NonNullable<T[K]> extends Record<string, unknown>
                ? NonNullable<T[K]> extends unknown[]
                  ? never
                  : string extends keyof NonNullable<T[K]>
                    ? never // Record<string, T> — don't recurse into dynamic keys
                    : `${K}.${ObjectPaths<NonNullable<T[K]>, Prev[D]>}`
                : never);
        }[keyof T & string]
    : never;

// ============================================================================
// TypedOps Interface
// ============================================================================

/**
 * Type-safe patch operations builder.
 *
 * Provides IDE autocomplete for state paths and compile-time type checking
 * for patch values. All methods return standard Patch objects compatible
 * with Core's apply() function.
 * System mutation convenience APIs are intentionally excluded.
 *
 * @typeParam TData - The shape of domain state (snapshot.data)
 */
export interface TypedOps<TData extends Record<string, unknown>> {
  /**
   * Create a set patch — replace value at path (create if missing).
   *
   * @example
   * ops.set('count', 5);
   * ops.set('user.name', 'Alice');
   */
  set<P extends DataPaths<TData>>(path: P, value: Exclude<ValueAt<TData, P>, undefined>): SetPatch;

  /**
   * Create an unset patch — remove property at path.
   *
   * @example
   * ops.unset('temporaryField');
   */
  unset<P extends DataPaths<TData>>(path: P): UnsetPatch;

  /**
   * Create a merge patch — shallow merge at object path.
   * Only valid for paths that resolve to plain object types.
   *
   * @example
   * ops.merge('user', { name: 'Bob' });
   */
  merge<P extends ObjectPaths<TData>>(
    path: P,
    value: { [K in keyof ValueAt<TData, P>]?: Exclude<ValueAt<TData, P>[K], undefined> },
  ): MergePatch;

  /**
   * Raw (untyped) patch creation — escape hatch for dynamic paths
   * or platform namespace ($*) targets.
   */
  raw: {
    set(path: string, value: unknown): SetPatch;
    unset(path: string): UnsetPatch;
    merge(path: string, value: Record<string, unknown>): MergePatch;
  };
}

// ============================================================================
// Factory
// ============================================================================

/**
 * Create a type-safe patch operations builder.
 *
 * Injects the domain state type to enable:
 * - IDE autocomplete on all valid state paths
 * - Compile-time type checking of patch values
 * - Merge restricted to object-typed paths
 *
 * @typeParam TData - The shape of domain state (snapshot.data)
 *
 * @example
 * type State = {
 *   count: number;
 *   user: { name: string; age: number };
 *   tags: string[];
 * };
 *
 * const ops = defineOps<State>();
 *
 * ops.set('count', 5);              // OK — value: number
 * ops.set('user.name', 'Alice');    // OK — value: string
 * ops.set('count', 'hello');        // TS error — expected number
 * ops.merge('user', { name: 'B' }); // OK — partial object merge
 * ops.unset('tags');                // OK
 *
 * // Escape hatch for dynamic / platform paths
 * ops.raw.set('$host.custom', { key: 'value' });
 */
export function defineOps<
  TData extends Record<string, unknown>,
>(): TypedOps<TData> {
  const toPatchPath = (path: string) => semanticPathToPatchPath(path);

  return {
    set(path: string, value: unknown): SetPatch {
      return { op: "set", path: toPatchPath(path), value };
    },
    unset(path: string): UnsetPatch {
      return { op: "unset", path: toPatchPath(path) };
    },
    merge(path: string, value: unknown): MergePatch {
      return { op: "merge", path: toPatchPath(path), value: value as Record<string, unknown> };
    },
    raw: {
      set(path: string, value: unknown): SetPatch {
        return { op: "set", path: toPatchPath(path), value };
      },
      unset(path: string): UnsetPatch {
        return { op: "unset", path: toPatchPath(path) };
      },
      merge(path: string, value: Record<string, unknown>): MergePatch {
        return { op: "merge", path: toPatchPath(path), value };
      },
    },
  };
}
