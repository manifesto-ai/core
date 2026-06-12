/**
 * JSON value-domain validation for snapshot/patch write boundaries.
 *
 * Manifesto state is required to be JSON-serializable and canonical
 * (constitution §2.6 "Schema-first"). Values that JSON cannot represent
 * must be rejected at the write boundary instead of being silently
 * dropped or coerced later by canonicalization/hashing (#480).
 *
 * Accepted: null, string, boolean, finite number, arrays of accepted
 * values, and plain objects (Object.prototype or null prototype) of
 * accepted values.
 *
 * Notes:
 * - -0 is accepted. JSON canonicalization normalizes it to 0, but
 *   rejecting it would fail innocent arithmetic results (e.g. mul(0, -1)).
 * - Shared (non-cyclic) references are accepted; JSON duplicates them.
 */

export type JsonValueViolation = {
  readonly path: string;
  readonly reason: string;
};

function isPlainObject(value: object): boolean {
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function walk(value: unknown, path: string, ancestors: Set<object>): JsonValueViolation | null {
  if (value === null) {
    return null;
  }

  switch (typeof value) {
    case "string":
    case "boolean":
      return null;
    case "number":
      return Number.isFinite(value)
        ? null
        : { path, reason: `non-finite number (${String(value)})` };
    case "undefined":
      return { path, reason: "undefined is not a JSON value" };
    case "function":
      return { path, reason: "functions are not JSON values" };
    case "symbol":
      return { path, reason: "symbols are not JSON values" };
    case "bigint":
      return { path, reason: "bigints are not JSON values" };
    case "object":
      break;
    default:
      return { path, reason: `unsupported value type (${typeof value})` };
  }

  const obj = value as object;
  if (ancestors.has(obj)) {
    return { path, reason: "circular reference" };
  }

  ancestors.add(obj);
  try {
    if (Array.isArray(obj)) {
      for (let index = 0; index < obj.length; index += 1) {
        const violation = walk(obj[index], `${path}[${index}]`, ancestors);
        if (violation) {
          return violation;
        }
      }
      return null;
    }

    if (!isPlainObject(obj)) {
      const name = obj.constructor?.name ?? "unknown";
      return {
        path,
        reason: `non-plain object (${name}) is not a JSON value`,
      };
    }

    for (const [key, entry] of Object.entries(obj)) {
      const violation = walk(entry, `${path}.${key}`, ancestors);
      if (violation) {
        return violation;
      }
    }
    return null;
  } finally {
    ancestors.delete(obj);
  }
}

/**
 * Returns the first JSON value-domain violation found in `value`, or null
 * when the value is fully JSON-compatible. Pure and total: never throws.
 */
export function findJsonValueViolation(
  value: unknown,
  basePath = "value",
): JsonValueViolation | null {
  return walk(value, basePath, new Set());
}
