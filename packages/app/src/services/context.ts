/**
 * Service Context Implementation
 *
 * @see SPEC §13.1
 * @module
 */

import type { AppState, ServiceContext } from "../types/index.js";
import { createPatchHelpers } from "./patch-helpers.js";

/**
 * Options for creating a service context.
 */
export interface CreateServiceContextOptions {
  snapshot: Readonly<AppState<unknown>>;
  actorId: string;
  worldId: string;
  branchId: string;
  signal?: AbortSignal;
}

/**
 * Create a ServiceContext for handler invocation.
 *
 * @see SPEC §13.1
 */
export function createServiceContext(
  opts: CreateServiceContextOptions
): ServiceContext {
  return {
    snapshot: opts.snapshot,
    actorId: opts.actorId,
    worldId: opts.worldId,
    branchId: opts.branchId,
    patch: createPatchHelpers(),
    signal: opts.signal ?? new AbortController().signal,
  };
}
