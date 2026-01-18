import type { Patch } from "@manifesto-ai/core";

/**
 * Create a single patch
 *
 * @example
 * ```ts
 * toPatch('data.user', { name: 'Alice' });
 * // → { op: 'set', path: 'data.user', value: { name: 'Alice' } }
 *
 * toPatch('data.temp', undefined, 'unset');
 * // → { op: 'unset', path: 'data.temp' }
 *
 * toPatch('data.settings', { theme: 'dark' }, 'merge');
 * // → { op: 'merge', path: 'data.settings', value: { theme: 'dark' } }
 * ```
 */
export function toPatch(path: string, value: unknown): Patch;
export function toPatch(path: string, value: undefined, op: "unset"): Patch;
export function toPatch(
  path: string,
  value: Record<string, unknown>,
  op: "merge"
): Patch;
export function toPatch(
  path: string,
  value: unknown,
  op: "set" | "unset" | "merge" = "set"
): Patch {
  if (op === "unset") {
    return { op: "unset", path };
  }
  if (op === "merge") {
    return { op: "merge", path, value: value as Record<string, unknown> };
  }
  return { op: "set", path, value };
}

/**
 * Create multiple patches from a path-value mapping
 *
 * @example
 * ```ts
 * toPatches({
 *   'data.user': userData,
 *   'data.loadedAt': Date.now(),
 *   'data.status': 'ready',
 * });
 * // → [
 * //   { op: 'set', path: 'data.user', value: userData },
 * //   { op: 'set', path: 'data.loadedAt', value: 1234567890 },
 * //   { op: 'set', path: 'data.status', value: 'ready' },
 * // ]
 * ```
 */
export function toPatches(
  mappings: Record<string, unknown>,
  op: "set" | "merge" = "set"
): Patch[] {
  return Object.entries(mappings).map(([path, value]) => {
    if (op === "merge") {
      return { op: "merge", path, value: value as Record<string, unknown> };
    }
    return { op: "set", path, value };
  });
}
