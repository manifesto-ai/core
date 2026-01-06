/**
 * system.get Built-in Effect Handler
 *
 * The system.get effect type is reserved and handled directly by Host.
 * It provides read access to state and computed values during flow execution.
 *
 * @see SPEC §18.5 SYSGET-1~6
 * @module
 */

import type { Patch } from "@manifesto-ai/core";
import type { AppState, ServiceContext } from "../types/index.js";

/**
 * Parameters for system.get effect.
 */
export interface SystemGetParams {
  /** Path to retrieve (e.g., "data.todos", "computed.totalCount") */
  path: string;

  /** Target path to store the result (optional) */
  target?: string;
}

/**
 * Result of system.get operation.
 */
export interface SystemGetResult {
  value: unknown;
  found: boolean;
}

/**
 * Execute system.get effect.
 *
 * SYSGET-5: Returns value at path from state or computed.
 * SYSGET-6: Handled by Host directly (this function is called by Host).
 *
 * @param params - Effect parameters
 * @param snapshot - Current snapshot
 * @returns Patches to apply (if target specified) or empty array
 */
export function executeSystemGet(
  params: SystemGetParams,
  snapshot: Readonly<AppState<unknown>>
): { patches: Patch[]; result: SystemGetResult } {
  const { path, target } = params;

  // Resolve value from path
  const result = resolvePathValue(path, snapshot);

  // If target is specified, create patch to store result
  const patches: Patch[] = [];
  if (target) {
    patches.push({
      op: "set",
      path: target.startsWith("/") ? target : `/${target.replace(/\./g, "/")}`,
      value: result.value,
    });
  }

  return { patches, result };
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
  snapshot: Readonly<AppState<unknown>>
): SystemGetResult {
  const parts = path.split(".");

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

/**
 * Create system.get service handler for Host integration.
 *
 * Note: This is NOT registered as a user service.
 * The ServiceRegistry validates that users cannot override system.get.
 * This handler is used internally by Host.
 */
export function createSystemGetHandler() {
  return async (
    params: Record<string, unknown>,
    ctx: ServiceContext
  ): Promise<Patch[]> => {
    const { patches } = executeSystemGet(
      params as SystemGetParams,
      ctx.snapshot
    );
    return patches;
  };
}
