/**
 * system.get Built-in Effect Handler
 *
 * The system.get effect type is reserved and handled directly by Host.
 * It provides two functionalities:
 * 1. Read access to state and computed values (path param)
 * 2. System value generation for $system.* references (key param)
 *
 * @module
 */

import type { Patch, Snapshot } from "@manifesto-ai/core";

/**
 * Parameters for system.get effect (read mode).
 */
export interface SystemGetReadParams {
  /** Path to retrieve (e.g., "data.todos", "computed.totalCount") */
  path: string;

  /** Target path to store the result (optional) */
  target?: string;
}

/**
 * Parameters for system.get effect (generate mode).
 * Used by compiler lowering for $system.* references.
 */
export interface SystemGetGenerateParams {
  /** System value key to generate (e.g., "uuid", "timestamp", "isoTimestamp") */
  key: string;

  /** Target path to store the generated value */
  into: string;
}

/**
 * Combined parameters for system.get effect.
 */
export type SystemGetParams = SystemGetReadParams | SystemGetGenerateParams;

/**
 * Result of system.get operation.
 */
export interface SystemGetResult {
  value: unknown;
  found: boolean;
}

/**
 * Check if params are for generate mode (compiler lowering).
 */
function isGenerateParams(params: SystemGetParams): params is SystemGetGenerateParams {
  return "key" in params && "into" in params;
}

/**
 * Generate a system value.
 */
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
      console.warn(`system.get: unknown key "${key}"`);
      return null;
  }
}

/**
 * Generate a UUID.
 */
function generateUUID(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback for environments without crypto.randomUUID
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Execute system.get effect.
 *
 * Handles two modes:
 * 1. Generate mode (key + into): Generate system values like uuid, timestamp
 * 2. Read mode (path + target): Read values from snapshot
 */
export function executeSystemGet(
  params: SystemGetParams,
  snapshot: Snapshot
): { patches: Patch[]; result: SystemGetResult } {
  // Generate mode: $system.uuid, $system.timestamp, etc.
  if (isGenerateParams(params)) {
    const value = generateSystemValue(params.key);
    const patches: Patch[] = [{
      op: "set",
      path: normalizePath(params.into),
      value,
    }];
    return { patches, result: { value, found: true } };
  }

  // Read mode: Read from snapshot
  const { path, target } = params;

  // Resolve value from path
  const result = resolvePathValue(path, snapshot);

  // If target is specified, create patch to store result
  const patches: Patch[] = [];
  if (target) {
    patches.push({
      op: "set",
      path: normalizePath(target),
      value: result.value,
    });
  }

  return { patches, result };
}

/**
 * Normalize incoming paths to semantic (dot) paths.
 */
function normalizePath(path: string): string {
  if (path.startsWith("/")) {
    return path.slice(1).replace(/\//g, ".");
  }
  return path;
}

/**
 * Resolve a path to its value in the snapshot.
 *
 * Supports:
 * - data.* - Domain state
 * - computed.* - Computed values
 * - system.* - System state
 * - meta.* - Snapshot metadata
 */
function resolvePathValue(
  path: string,
  snapshot: Snapshot
): SystemGetResult {
  const normalized = normalizePath(path);
  const parts = normalized.split(".");

  if (parts.length === 0) {
    return { value: undefined, found: false };
  }

  const root = parts[0];
  const rest = parts.slice(1);

  let current: unknown;

  switch (root) {
    case "data":
      current = snapshot.data;
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
    default:
      // Assume data root if not specified
      current = snapshot.data;
      // Re-add the first part since it's part of the data path
      rest.unshift(root);
  }

  // Navigate to the value
  for (const part of rest) {
    if (current === null || current === undefined) {
      return { value: undefined, found: false };
    }

    if (typeof current !== "object") {
      return { value: undefined, found: false };
    }

    current = (current as Record<string, unknown>)[part];
  }

  return { value: current, found: current !== undefined };
}
