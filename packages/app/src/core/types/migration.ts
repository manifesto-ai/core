/**
 * Manifesto App — Migration Types
 *
 * @see SPEC v2.0.0 §9.3-9.4
 * @see ADR-004 Phase 1
 * @module
 */

import type { DomainSchema } from "@manifesto-ai/core";
import type { ActorRef } from "@manifesto-ai/world";
import type { AppState } from "./state.js";

// =============================================================================
// Migration Types
// =============================================================================

/**
 * Migration context for custom migration functions.
 *
 * @see SPEC §9.3
 */
export interface MigrationContext {
  from: {
    schemaHash: string;
    worldId: string;
    state: AppState<unknown>;
  };
  to: {
    schemaHash: string;
    schema: DomainSchema;
  };
}

/**
 * Custom migration function type.
 *
 * @see SPEC §9.3
 */
export type MigrationFn = (ctx: MigrationContext) => unknown;

/**
 * Schema-changing fork audit record.
 *
 * @see SPEC §9.4
 */
export interface MigrationLink {
  readonly linkId: string;

  readonly from: {
    readonly schemaHash: string;
    readonly worldId: string;
    readonly branchId: string;
  };

  readonly to: {
    readonly schemaHash: string;
    readonly worldId: string;
    readonly branchId: string;
  };

  readonly migration: {
    readonly strategy: "auto" | "custom";
    readonly migratedAt: number;
    readonly migratedBy: ActorRef;
    readonly reason?: string;
  };
}
