import type { SemanticPath } from "../schema/common.js";

/**
 * Parse a dot-separated path into segments.
 *
 * Supports escaping literal dots inside segments via backslash (for example `a\\.b` -> `a.b`).
 */
export function parsePath(path: SemanticPath): string[] {
  if (!path) return [];

  const segments: string[] = [];
  let current = "";
  let escaped = false;

  for (const char of path) {
    if (escaped) {
      if (char === "." || char === "\\") {
        current += char;
      } else {
        current += `\\${char}`;
      }
      escaped = false;
      continue;
    }

    if (char === "\\") {
      escaped = true;
      continue;
    }

    if (char === ".") {
      segments.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  if (escaped) {
    current += "\\";
  }

  segments.push(current);
  return segments;
}

function escapePathSegment(segment: string): string {
  return segment.replaceAll("\\", "\\\\").replaceAll(".", "\\.");
}

/**
 * Join path segments into a semantic path
 */
export function joinPath(...segments: string[]): SemanticPath {
  const escapedSegments = segments.filter(Boolean).map(escapePathSegment);
  return escapedSegments.join(".");
}

/**
 * Get value at path from object
 * Returns undefined for non-existent paths (never throws)
 */
export function getByPath(obj: unknown, path: SemanticPath): unknown {
  if (!path) return obj;

  const segments = parsePath(path);
  let current: unknown = obj;

  for (const segment of segments) {
    if (current === null || current === undefined) {
      return undefined;
    }

    if (typeof current === "object") {
      current = (current as Record<string, unknown>)[segment];
    } else {
      return undefined;
    }
  }

  return current;
}

/**
 * Immutably set value at path
 * Creates intermediate objects as needed
 */
export function setByPath(obj: unknown, path: SemanticPath, value: unknown): unknown {
  if (!path) return value;

  const segments = parsePath(path);
  return setByPathSegments(obj, segments, value);
}

function setByPathSegments(obj: unknown, segments: string[], value: unknown): unknown {
  if (segments.length === 0) return value;

  const [head, ...tail] = segments;
  const current = obj !== null && typeof obj === "object" ? obj : {};

  if (tail.length === 0) {
    return { ...current, [head]: value };
  }

  const nested = (current as Record<string, unknown>)[head];
  return {
    ...current,
    [head]: setByPathSegments(nested, tail, value),
  };
}

/**
 * Immutably remove value at path
 */
export function unsetByPath(obj: unknown, path: SemanticPath): unknown {
  if (!path) return undefined;

  const segments = parsePath(path);
  return unsetByPathSegments(obj, segments);
}

function unsetByPathSegments(obj: unknown, segments: string[]): unknown {
  if (segments.length === 0 || obj === null || typeof obj !== "object") {
    return obj;
  }

  const [head, ...tail] = segments;
  const current = obj as Record<string, unknown>;

  if (tail.length === 0) {
    const { [head]: _, ...rest } = current;
    return rest;
  }

  const nested = current[head];
  return {
    ...current,
    [head]: unsetByPathSegments(nested, tail),
  };
}

/**
 * Immutably shallow merge at path
 */
export function mergeAtPath(
  obj: unknown,
  path: SemanticPath,
  value: Record<string, unknown>
): unknown {
  const existing = getByPath(obj, path);
  const merged =
    existing !== null && typeof existing === "object"
      ? { ...existing, ...value }
      : value;

  return setByPath(obj, path, merged);
}

/**
 * Check if a path exists in an object
 */
export function hasPath(obj: unknown, path: SemanticPath): boolean {
  if (!path) return obj !== undefined;

  const segments = parsePath(path);
  let current: unknown = obj;

  for (const segment of segments) {
    if (current === null || current === undefined) {
      return false;
    }

    if (typeof current !== "object") {
      return false;
    }

    if (!(segment in (current as Record<string, unknown>))) {
      return false;
    }

    current = (current as Record<string, unknown>)[segment];
  }

  return true;
}

/**
 * Get parent path
 */
export function parentPath(path: SemanticPath): SemanticPath {
  const segments = parsePath(path);
  return joinPath(...segments.slice(0, -1));
}

/**
 * Get last segment of path
 */
export function lastSegment(path: SemanticPath): string {
  const segments = parsePath(path);
  return segments[segments.length - 1] ?? "";
}
