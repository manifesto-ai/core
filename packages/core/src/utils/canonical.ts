/**
 * Canonical form utilities for deterministic hashing
 *
 * Algorithm:
 * 1. Sort all object keys alphabetically (recursive)
 * 2. Remove all keys with undefined value
 * 3. Preserve keys with null value
 * 4. Serialize using JSON with no whitespace
 */

/**
 * Recursively sort object keys alphabetically
 */
export function sortKeys(obj: unknown): unknown {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(sortKeys);
  }

  if (typeof obj === "object") {
    const sorted: Record<string, unknown> = {};
    const keys = Object.keys(obj as Record<string, unknown>).sort();

    for (const key of keys) {
      const value = (obj as Record<string, unknown>)[key];
      // Remove undefined values
      if (value !== undefined) {
        sorted[key] = sortKeys(value);
      }
    }

    return sorted;
  }

  return obj;
}

/**
 * Convert object to canonical JSON string
 * - Keys are sorted alphabetically
 * - Undefined values are removed
 * - No whitespace
 */
export function toCanonical(obj: unknown): string {
  const sorted = sortKeys(obj);
  return JSON.stringify(sorted);
}

/**
 * Parse canonical JSON string
 */
export function fromCanonical<T>(canonical: string): T {
  return JSON.parse(canonical) as T;
}

/**
 * Check if two objects are equal in canonical form
 */
export function canonicalEqual(a: unknown, b: unknown): boolean {
  return toCanonical(a) === toCanonical(b);
}
