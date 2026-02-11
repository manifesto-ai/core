/**
 * Manifesto App — Facade Types
 *
 * @see SPEC v2.0.0 §14.5, §15, §16.5
 * @see ADR-004 Phase 1
 * @module
 */

import type { ActorId } from "./identifiers.js";
import type { ActionHandle } from "./action.js";
import type {
  RecallRequest,
  RecallResult,
  MemorySelectionView,
  MemoryMaintenanceOp,
  MemoryMaintenanceContext,
  MemoryMaintenanceOutput,
  MemoryMaintenanceOptions,
} from "./memory.js";

// =============================================================================
// Facade Interfaces
// =============================================================================

/**
 * Memory facade interface.
 *
 * @see SPEC §14.5
 */
export interface MemoryFacade {
  enabled(): boolean;
  recall(
    req: RecallRequest | readonly RecallRequest[],
    ctx?: { actorId?: string; branchId?: string }
  ): Promise<RecallResult>;
  providers(): readonly string[];
  backfill(opts: { worldId: string; depth?: number }): Promise<void>;

  /**
   * Perform memory maintenance operations.
   *
   * @see SPEC §17.5 MEM-MAINT-1~10
   * @since v0.4.8
   */
  maintain(
    ops: readonly MemoryMaintenanceOp[],
    ctx: MemoryMaintenanceContext
  ): Promise<MemoryMaintenanceOutput>;
}

/**
 * System facade interface.
 *
 * @see SPEC §16.5
 */
export interface SystemMemoryFacade {
  /**
   * Run memory maintenance (forget-only).
   */
  maintain(opts: MemoryMaintenanceOptions): ActionHandle;
}

export interface SystemFacade {
  /**
   * Execute a system action.
   */
  act(type: `system.${string}`, input?: unknown): ActionHandle;

  /**
   * Memory maintenance operations.
   */
  readonly memory: SystemMemoryFacade;
}
