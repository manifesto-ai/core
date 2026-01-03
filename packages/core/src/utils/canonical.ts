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
 * Canonicalize JSON per RFC 8785 (JCS)
 * - Objects: keys sorted by Unicode code points
 * - Arrays: preserve order
 * - Undefined/function/symbol: omitted in objects, null in arrays
 * - Non-finite numbers: null
 */
export function toJcs(value: unknown): string {
  return serializeJcsValue(value);
}

function serializeJcsValue(value: unknown): string {
  if (value === null) return "null";

  const valueType = typeof value;
  switch (valueType) {
    case "string":
      return JSON.stringify(value);
    case "number":
      return Number.isFinite(value) ? JSON.stringify(value) : "null";
    case "boolean":
      return value ? "true" : "false";
    case "undefined":
      return "null";
    case "object":
      if (Array.isArray(value)) {
        return serializeJcsArray(value);
      }
      return serializeJcsObject(value as Record<string, unknown>);
    default:
      return "null";
  }
}

function serializeJcsArray(values: unknown[]): string {
  const items = values.map((item) => {
    if (item === undefined || typeof item === "function" || typeof item === "symbol") {
      return "null";
    }
    return serializeJcsValue(item);
  });
  return `[${items.join(",")}]`;
}

function serializeJcsObject(obj: Record<string, unknown>): string {
  const keys = Object.keys(obj).sort(compareUnicodeCodePoints);
  const parts: string[] = [];

  for (const key of keys) {
    const value = obj[key];
    if (value === undefined || typeof value === "function" || typeof value === "symbol") {
      continue;
    }
    parts.push(`${JSON.stringify(key)}:${serializeJcsValue(value)}`);
  }

  return `{${parts.join(",")}}`;
}

function compareUnicodeCodePoints(a: string, b: string): number {
  const aPoints = Array.from(a);
  const bPoints = Array.from(b);
  const length = Math.min(aPoints.length, bPoints.length);

  for (let i = 0; i < length; i++) {
    const aCode = aPoints[i].codePointAt(0) ?? 0;
    const bCode = bPoints[i].codePointAt(0) ?? 0;
    if (aCode !== bCode) {
      return aCode - bCode;
    }
  }

  return aPoints.length - bPoints.length;
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
