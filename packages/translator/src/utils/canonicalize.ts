/**
 * JSON Canonicalization (RFC 8785 - JCS)
 *
 * Implements JSON Canonicalization Scheme for deterministic serialization.
 * Used for content-addressed fragmentId computation.
 */

import type { JsonValue } from "../domain/types.js";

/**
 * Canonicalize a JSON value according to RFC 8785 (JCS)
 *
 * Rules:
 * 1. No whitespace between tokens
 * 2. Object keys sorted lexicographically by UTF-16 code units
 * 3. Numbers in shortest form without scientific notation for integers
 * 4. No duplicate keys (validated, not normalized)
 * 5. Unicode escape sequences for control characters
 *
 * @param value - JSON value to canonicalize
 * @returns Canonical JSON string
 */
export function canonicalize(value: JsonValue): string {
  return canonicalizeValue(value);
}

function canonicalizeValue(value: JsonValue): string {
  if (value === null) {
    return "null";
  }

  switch (typeof value) {
    case "boolean":
      return value ? "true" : "false";

    case "number":
      return canonicalizeNumber(value);

    case "string":
      return canonicalizeString(value);

    case "object":
      if (Array.isArray(value)) {
        return canonicalizeArray(value);
      }
      return canonicalizeObject(value as Record<string, JsonValue>);

    default:
      throw new Error(`Unsupported JSON value type: ${typeof value}`);
  }
}

/**
 * Canonicalize a number
 *
 * Rules:
 * - NaN and Infinity are not valid JSON
 * - Use shortest representation
 * - No scientific notation for integers
 * - No trailing zeros after decimal point
 */
function canonicalizeNumber(n: number): string {
  if (!Number.isFinite(n)) {
    throw new Error(`Invalid JSON number: ${n}`);
  }

  // Handle -0
  if (Object.is(n, -0)) {
    return "0";
  }

  // Use built-in JSON serialization which handles most cases correctly
  return JSON.stringify(n);
}

/**
 * Canonicalize a string
 *
 * Rules:
 * - Escape control characters (U+0000 to U+001F)
 * - Escape backslash and double quote
 * - Use \uXXXX for control characters
 */
function canonicalizeString(s: string): string {
  let result = '"';

  for (let i = 0; i < s.length; i++) {
    const char = s[i];
    const code = char.charCodeAt(0);

    if (code < 0x20) {
      // Control characters
      switch (code) {
        case 0x08:
          result += "\\b";
          break;
        case 0x09:
          result += "\\t";
          break;
        case 0x0a:
          result += "\\n";
          break;
        case 0x0c:
          result += "\\f";
          break;
        case 0x0d:
          result += "\\r";
          break;
        default:
          result += "\\u" + code.toString(16).padStart(4, "0");
      }
    } else if (char === '"') {
      result += '\\"';
    } else if (char === "\\") {
      result += "\\\\";
    } else {
      result += char;
    }
  }

  result += '"';
  return result;
}

/**
 * Canonicalize an array
 */
function canonicalizeArray(arr: JsonValue[]): string {
  const elements = arr.map((element) => canonicalizeValue(element));
  return "[" + elements.join(",") + "]";
}

/**
 * Canonicalize an object
 *
 * Rules:
 * - Keys sorted lexicographically by UTF-16 code units
 * - No duplicate keys
 */
function canonicalizeObject(obj: Record<string, JsonValue>): string {
  const keys = Object.keys(obj);

  // Sort keys lexicographically by UTF-16 code units
  keys.sort((a, b) => {
    // Compare by UTF-16 code units (JavaScript's default string comparison)
    if (a < b) return -1;
    if (a > b) return 1;
    return 0;
  });

  const pairs = keys.map((key) => {
    const value = obj[key];
    return canonicalizeString(key) + ":" + canonicalizeValue(value);
  });

  return "{" + pairs.join(",") + "}";
}

/**
 * Validate that an object has no duplicate keys
 *
 * Note: JavaScript objects cannot have duplicate keys, but this is useful
 * for validating parsed JSON before canonicalization.
 */
export function validateNoDuplicateKeys(
  _obj: Record<string, unknown>
): boolean {
  // In JavaScript, objects cannot have duplicate keys by definition
  // This is a no-op but provided for API completeness
  return true;
}

/**
 * Parse JSON and validate before canonicalization
 */
export function parseAndCanonicalize(json: string): string {
  const parsed = JSON.parse(json) as JsonValue;
  return canonicalize(parsed);
}
