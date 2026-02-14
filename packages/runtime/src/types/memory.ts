/**
 * Manifesto App — Memory Types
 *
 * @see SPEC v2.0.0 §11, §14, §17.5
 * @see ADR-004 Phase 1
 * @module
 */

import type { WorldId, World } from "@manifesto-ai/world";
import type { ActorRef } from "@manifesto-ai/world";
import type { MemoryId, ActorId } from "./identifiers.js";
import type { AppState } from "./state.js";

// =============================================================================
// v2.0.0 MemoryStore Interface
// =============================================================================

/**
 * Memory record input for create operations.
 *
 * @see SPEC v2.0.0 §11.2
 */
export type MemoryRecordInput<T = unknown> = {
  readonly id?: MemoryId;
  readonly data: T;
  readonly createdAt?: number;
  readonly updatedAt?: number;
  readonly tags?: readonly string[];
  readonly meta?: Record<string, unknown>;
};

/**
 * Stored memory record.
 *
 * @see SPEC v2.0.0 §11.2
 */
export type StoredMemoryRecord<T = unknown> = {
  readonly id: MemoryId;
  readonly data: T;
  readonly createdAt: number;
  readonly updatedAt: number;
  readonly tags?: readonly string[];
  readonly meta?: Record<string, unknown>;
};

/**
 * Memory filter for queries.
 */
export type MemoryFilter = {
  readonly tags?: readonly string[];
  readonly createdAfter?: number;
  readonly createdBefore?: number;
  readonly limit?: number;
};

/**
 * MemoryStore: External mutable storage.
 * Separate from World (immutable history).
 *
 * @see SPEC v2.0.0 §11.1
 */
export interface MemoryStore<T = unknown> {
  // CRUD (Required)
  create(record: MemoryRecordInput<T>): Promise<MemoryId>;
  get(id: MemoryId): Promise<StoredMemoryRecord<T> | null>;
  update(id: MemoryId, patch: Partial<T>): Promise<void>;
  delete(id: MemoryId): Promise<void>;
  query(filter: MemoryFilter): Promise<StoredMemoryRecord<T>[]>;

  // Batch (Optional)
  createMany?(records: MemoryRecordInput<T>[]): Promise<MemoryId[]>;
  deleteMany?(ids: MemoryId[]): Promise<void>;

  // Maintenance (Optional)
  consolidate?(): Promise<void>;
  clear?(): Promise<void>;
}

// =============================================================================
// Memory Types
// =============================================================================

/**
 * Verification proof for memory selection.
 */
export type VerificationProof = Record<string, unknown>;

/**
 * Memory selection constraints.
 */
export interface SelectionConstraints {
  readonly requireVerified?: boolean;
  readonly limit?: number;
  readonly minConfidence?: number;
}

/**
 * Selected memory entry.
 */
export interface SelectedMemory {
  readonly ref: { readonly worldId: string };
  readonly reason: string;
  readonly confidence: number;
  readonly verified: boolean;
  readonly proof?: VerificationProof;
}

/**
 * Memory trace for recall.
 */
export interface MemoryTrace {
  readonly query: string;
  readonly atWorldId: WorldId;
  readonly selector: ActorRef;
  readonly selectedAt: number;
  readonly selected: readonly SelectedMemory[];
}

/**
 * Memory selection result.
 */
export interface SelectionResult {
  readonly selected: readonly SelectedMemory[];
  readonly trace?: MemoryTrace;
}

/**
 * Backfill configuration.
 *
 * @see SPEC §14.2
 */
export interface BackfillConfig {
  /**
   * Backfill mode.
   * - 'off': No backfill
   * - 'onCheckout': Backfill on checkout
   * - 'onRecall': Backfill when needed for recall
   *
   * @default 'off'
   */
  mode?: "off" | "onCheckout" | "onRecall";

  /** Maximum backfill depth (number of Worlds). @default 100 */
  maxDepth?: number;
}

/**
 * Memory hub configuration.
 *
 * @see SPEC §14.2
 */
export interface MemoryHubConfig {
  providers: Record<string, MemoryProvider>;
  defaultProvider: string;

  routing?: {
    /** Determine target providers for ingest. Default: all providers */
    ingestTo?: (event: { worldId: string; schemaHash: string }) => readonly string[];
  };

  backfill?: BackfillConfig;
}

/**
 * Recall request.
 *
 * @see SPEC §14.5
 */
export type RecallRequest =
  | string
  | {
      query: string;
      provider?: string;
      constraints?: SelectionConstraints;
    };

/**
 * Recall result.
 *
 * @see SPEC §14.5
 */
export interface RecallResult {
  readonly attachments: readonly {
    provider: string;
    trace: MemoryTrace;
  }[];
  readonly selected: readonly SelectedMemory[];
  readonly views: readonly MemorySelectionView[];
}

/**
 * Projected memory content for UI/display.
 *
 * @see SPEC Appendix A.3
 */
export interface MemorySelectionView {
  readonly ref: { readonly worldId: string };
  readonly summary: string;
  readonly relevance: number;
}

/**
 * World event for memory ingestion.
 *
 * @see SPEC Appendix A.3
 */
export interface MemoryIngestEntry {
  readonly worldId: string;
  readonly schemaHash: string;
  readonly snapshot: Readonly<AppState<unknown>>;
  readonly parentWorldId?: string;
  readonly createdAt: number;
  readonly createdBy: ActorRef;
}

/**
 * Prove result from verifier.
 *
 * @see SPEC §14.3
 */
export interface ProveResult {
  readonly valid: boolean;
  readonly proof?: VerificationProof;
  readonly error?: string;
}

/**
 * Memory verifier interface.
 *
 * @see SPEC §14.3
 */
export interface MemoryVerifier {
  /** PURE: Generate proof for memory */
  prove(
    memory: { readonly worldId: string },
    world: World
  ): ProveResult;

  /** PURE: Verify proof */
  verifyProof(proof: VerificationProof): boolean;
}

/**
 * Memory provider interface.
 *
 * @see SPEC §14.3
 */
export interface MemoryProvider {
  /** Ingest World events (optional) */
  ingest?: (entry: MemoryIngestEntry) => Promise<void>;

  /** Select memories (REQUIRED) */
  select: (req: {
    readonly query: string;
    readonly atWorldId: string;
    readonly selector: ActorRef;
    readonly constraints?: SelectionConstraints;
  }) => Promise<SelectionResult>;

  /** Verifier (optional; NoneVerifier used if absent) */
  verifier?: MemoryVerifier;

  /**
   * Maintain memories (optional).
   *
   * @see SPEC §17.5 MEM-MAINT-1~10
   * @since v0.4.8
   */
  maintain?: (
    op: MemoryMaintenanceOp,
    ctx: MemoryMaintenanceContext
  ) => Promise<MemoryMaintenanceResult>;

  meta?: {
    name?: string;
    version?: string;
    capabilities?: readonly ("ingest" | "select" | "verify" | "maintain")[];
  };
}

// =============================================================================
// Memory Maintenance Types (v0.4.8+)
// =============================================================================

/**
 * Memory reference for maintenance operations.
 *
 * @see SPEC §17.5.1
 * @since v0.4.8
 */
export interface MemoryRef {
  readonly worldId: string;
}

/**
 * Memory maintenance operation.
 *
 * @see SPEC §17.5.1 MEM-MAINT-2~5
 * @since v0.4.8
 */
export interface MemoryMaintenanceOp {
  /**
   * Operation kind. Currently only 'forget' is supported.
   *
   * MEM-MAINT-2: Forget MUST NOT modify Cold Store
   * MEM-MAINT-3: Forget applies tombstone markers to indexes
   */
  readonly kind: "forget";

  /** Reference to the memory to operate on */
  readonly ref: MemoryRef;

  /**
   * Scope of the operation.
   * - 'actor': Only affects current actor's view (MEM-MAINT-8)
   * - 'global': Affects all actors (MEM-MAINT-9, requires elevated Authority)
   *
   * @default 'actor'
   */
  readonly scope?: "actor" | "global";

  /** Human-readable reason for the operation */
  readonly reason?: string;

  /**
   * Tombstone expiry in milliseconds.
   * If provided, the tombstone will be removed after this duration.
   */
  readonly ttl?: number;
}

/**
 * Context for memory maintenance operations.
 *
 * CRITICAL: actor MUST come from Proposal.actorId, NOT from user input.
 *
 * @see SPEC §17.5.1 MEM-MAINT-10
 * @since v0.4.9
 */
export interface MemoryMaintenanceContext {
  /**
   * Actor performing the operation.
   *
   * MEM-MAINT-10: This MUST be derived from Proposal.actorId,
   * NOT from user-provided input.
   */
  readonly actor: ActorRef;

  /**
   * Effective scope of the operation.
   */
  readonly scope: "actor" | "global";
}

/**
 * Result of a single memory maintenance operation.
 *
 * @see SPEC §17.5.1
 * @since v0.4.8
 */
export interface MemoryMaintenanceResult {
  readonly success: boolean;
  readonly op: MemoryMaintenanceOp;
  readonly tombstoneId?: string;
  readonly error?: string;
}

/**
 * Input for system.memory.maintain action.
 *
 * @see SPEC §17.5
 * @since v0.4.8
 */
export interface MemoryMaintenanceInput {
  readonly ops: readonly MemoryMaintenanceOp[];
}

/**
 * Options for system.memory.maintain facade.
 *
 * @see SPEC §15.2
 */
export interface MemoryMaintenanceOptions {
  readonly operations: readonly MemoryMaintenanceOp[];
  readonly actorId?: ActorId;
}

/**
 * Output for system.memory.maintain action.
 *
 * @see SPEC §17.5
 * @since v0.4.8
 */
export interface MemoryMaintenanceOutput {
  readonly results: readonly MemoryMaintenanceResult[];
  readonly trace?: MemoryHygieneTrace;
}

/**
 * Trace for memory hygiene operations.
 *
 * @see SPEC §17.5.1 MEM-MAINT-6
 * @since v0.4.8
 */
export interface MemoryHygieneTrace {
  readonly traceId: string;
  readonly timestamp: number;
  readonly actor: ActorRef;
  readonly ops: readonly MemoryMaintenanceOp[];
  readonly results: readonly MemoryMaintenanceResult[];
  readonly durationMs: number;
}
