import {
  semanticPathToPatchPath,
  type Patch,
  type Snapshot as CoreSnapshot,
} from "@manifesto-ai/core";

import {
  generateUUID,
} from "../runtime/uuid.js";

interface SystemGetReadParams {
  path: string;
  target?: string;
}

interface SystemGetGenerateParams {
  key: string;
  into: string;
}

function isGenerateParams(params: unknown): params is SystemGetGenerateParams {
  return (
    typeof params === "object" &&
    params !== null &&
    "key" in params &&
    "into" in params
  );
}

export function executeSystemGet(
  params: unknown,
  snapshot: CoreSnapshot,
): { patches: Patch[] } {
  if (isGenerateParams(params)) {
    return {
      patches: [{
        op: "set",
        path: normalizeTargetPath(params.into),
        value: generateSystemValue(params.key),
      }],
    };
  }

  const { path, target } = params as SystemGetReadParams;
  const result = resolvePathValue(path, snapshot);
  if (!target) {
    return { patches: [] };
  }

  return {
    patches: [{
      op: "set",
      path: normalizeTargetPath(target),
      value: result.value,
    }],
  };
}

function generateSystemValue(key: string): unknown {
  switch (key) {
    case "uuid":
      return generateUUID();
    case "timestamp":
    case "time.now":
      return Date.now();
    case "isoTimestamp":
      return new Date().toISOString();
    default:
      return null;
  }
}

function normalizeTargetPath(path: string): Patch["path"] {
  const normalized = normalizePath(path);
  const withoutDataRoot = normalized.startsWith("data.")
    ? normalized.slice("data.".length)
    : normalized.startsWith("state.")
      ? normalized.slice("state.".length)
    : normalized;
  return semanticPathToPatchPath(withoutDataRoot);
}

function normalizePath(path: string): string {
  if (path.startsWith("/")) {
    return path.slice(1).replace(/\//g, ".");
  }
  return path;
}

function resolvePathValue(
  path: string,
  snapshot: CoreSnapshot,
): { value: unknown; found: boolean } {
  const normalized = normalizePath(path);
  const parts = normalized.split(".");
  if (parts.length === 0) {
    return { value: undefined, found: false };
  }

  const [root, ...rest] = parts;
  let current: unknown;

  switch (root) {
    case "data":
    case "state":
      current = snapshot.state;
      break;
    case "computed":
      current = snapshot.computed;
      break;
    case "system":
      current = snapshot.system;
      break;
    case "meta":
      current = snapshot.meta;
      break;
    case "namespaces":
      current = snapshot.namespaces;
      break;
    default:
      current = snapshot.state;
      rest.unshift(root);
      break;
  }

  for (const part of rest) {
    if (current === null || current === undefined || typeof current !== "object") {
      return { value: undefined, found: false };
    }
    current = (current as Record<string, unknown>)[part];
  }

  return { value: current, found: current !== undefined };
}
