import type { PatchPath, PatchSegment } from "../schema/patch.js";
import { parsePath } from "./path.js";

const UNSAFE_PROP_SEGMENTS = new Set(["__proto__", "constructor", "prototype"]);

/**
 * Render PatchPath for logs and error messages only.
 */
export function patchPathToDisplayString(path: PatchPath): string {
  let output = "";

  for (let i = 0; i < path.length; i++) {
    const segment = path[i];
    if (segment.kind === "prop") {
      output += i === 0 ? segment.name : `.${segment.name}`;
      continue;
    }
    output += `[${segment.index}]`;
  }

  return output;
}

/**
 * Convert a legacy semantic string path into PatchPath segments.
 * This helper exists for internal bridging only.
 */
export function semanticPathToPatchPath(path: string): PatchPath {
  const segments = parsePath(path);
  if (segments.length === 0) {
    return [{ kind: "prop", name: path }];
  }

  return segments.map((segment): PatchSegment => {
    if (/^[0-9]+$/.test(segment)) {
      return { kind: "index", index: Number(segment) };
    }
    return { kind: "prop", name: segment };
  });
}

export function isSafePatchPath(path: PatchPath): boolean {
  return path.every((segment) => segment.kind !== "prop" || !UNSAFE_PROP_SEGMENTS.has(segment.name));
}

export function getByPatchPath(obj: unknown, path: PatchPath): unknown {
  let current: unknown = obj;

  for (const segment of path) {
    if (segment.kind === "prop") {
      if (current === null || typeof current !== "object" || Array.isArray(current)) {
        return undefined;
      }
      current = (current as Record<string, unknown>)[segment.name];
      continue;
    }

    if (!Array.isArray(current)) {
      return undefined;
    }
    current = current[segment.index];
  }

  return current;
}

export function setByPatchPath(obj: unknown, path: PatchPath, value: unknown): unknown {
  return setBySegments(obj, path, value);
}

export function unsetByPatchPath(obj: unknown, path: PatchPath): unknown {
  return unsetBySegments(obj, path);
}

export function mergeAtPatchPath(
  obj: unknown,
  path: PatchPath,
  value: Record<string, unknown>
): unknown {
  const existing = getByPatchPath(obj, path);
  const merged = isRecord(existing) ? { ...existing, ...value } : value;
  return setByPatchPath(obj, path, merged);
}

function setBySegments(obj: unknown, segments: PatchPath, value: unknown): unknown {
  if (segments.length === 0) {
    return value;
  }

  const [head, ...tail] = segments;

  if (head.kind === "prop") {
    const current = isRecord(obj) ? obj : {};
    const nextValue = setBySegments(current[head.name], tail, value);
    return {
      ...current,
      [head.name]: nextValue,
    };
  }

  const current = Array.isArray(obj) ? [...obj] : [];
  current[head.index] = setBySegments(current[head.index], tail, value);
  return current;
}

function unsetBySegments(obj: unknown, segments: PatchPath): unknown {
  if (segments.length === 0) {
    return obj;
  }

  const [head, ...tail] = segments;

  if (head.kind === "prop") {
    if (!isRecord(obj)) {
      return obj;
    }

    if (tail.length === 0) {
      const { [head.name]: _removed, ...rest } = obj;
      return rest;
    }

    return {
      ...obj,
      [head.name]: unsetBySegments(obj[head.name], tail),
    };
  }

  if (!Array.isArray(obj)) {
    return obj;
  }

  const next = [...obj];
  if (tail.length === 0) {
    if (head.index >= 0 && head.index < next.length) {
      next.splice(head.index, 1);
    }
    return next;
  }

  next[head.index] = unsetBySegments(next[head.index], tail);
  return next;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
