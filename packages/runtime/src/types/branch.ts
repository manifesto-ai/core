/**
 * Manifesto App — Branch Types
 *
 * @see SPEC v2.0.0 §9
 * @see ADR-004 Phase 1
 * @module
 */

import type { AppState } from "./state.js";
import type { ActionHandle } from "./action.js";
import type { ActOptions, ForkOptions, LineageOptions } from "./config.js";

// =============================================================================
// Branch Interface
// =============================================================================

/**
 * Branch interface.
 *
 * @see SPEC §9.1
 */
export interface Branch {
  readonly id: string;
  readonly name?: string;
  readonly schemaHash: string;

  head(): string;
  checkout(worldId: string): Promise<void>;
  act(type: string, input?: unknown, opts?: ActOptions): ActionHandle;
  fork(opts?: ForkOptions): Promise<Branch>;
  getState<T = unknown>(): AppState<T>;
  lineage(opts?: LineageOptions): readonly string[];
}
