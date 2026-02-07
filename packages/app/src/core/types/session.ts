/**
 * Manifesto App — Session Types
 *
 * @see SPEC v2.0.0 §10
 * @see ADR-004 Phase 1
 * @module
 */

import type { AppState } from "./state.js";
import type { ActionHandle } from "./action.js";
import type { ActOptions } from "./config.js";
import type { RecallRequest, RecallResult } from "./memory.js";

// =============================================================================
// Session Interface
// =============================================================================

/**
 * Session interface.
 *
 * @see SPEC §10.1
 */
export interface Session {
  readonly actorId: string;
  readonly branchId: string;

  act(type: string, input?: unknown, opts?: ActOptions): ActionHandle;
  recall(req: RecallRequest | readonly RecallRequest[]): Promise<RecallResult>;
  getState<T = unknown>(): AppState<T>;
}
