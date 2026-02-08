/**
 * Manifesto App — App Interface & Plugin Types
 *
 * @see SPEC v2.0.0 §6.2, §15.1
 * @see ADR-004 Phase 1
 * @module
 */

import type { DomainSchema, Snapshot } from "@manifesto-ai/core";
import type { World, WorldId, WorldHead } from "@manifesto-ai/world";
import type { AppStatus, Unsubscribe } from "./identifiers.js";
import type { AppState, ErrorValue } from "./state.js";
import type { Proposal } from "./authority.js";
import type { ActionHandle } from "./action.js";
import type { MemoryFacade, SystemFacade } from "./facades.js";
import type { MigrationLink } from "./migration.js";
import type { Hookable, AppHooks } from "./hooks.js";
import type { DisposeOptions, ActOptions, ForkOptions, SessionOptions, SubscribeOptions } from "./config.js";
import type { Branch } from "./branch.js";
import type { Session } from "./session.js";

// =============================================================================
// v2.0.0 ProposalResult
// =============================================================================

/**
 * Result from submitProposal().
 *
 * @see SPEC v2.0.0 §6.5
 */
export type ProposalResult =
  | { readonly status: "completed"; readonly world: World }
  | { readonly status: "failed"; readonly world: World; readonly error?: ErrorValue }
  | { readonly status: "rejected"; readonly reason: string };

// =============================================================================
// Plugin Type
// =============================================================================

/**
 * App plugin.
 *
 * @see SPEC §15.1
 */
export type AppPlugin = (app: App) => void | Promise<void>;

// =============================================================================
// App Interface
// =============================================================================

/**
 * App interface.
 *
 * @see SPEC v2.0.0 §6.2
 */
export interface App {
  // ═══════════════════════════════════════════════════════════════════
  // Lifecycle
  // ═══════════════════════════════════════════════════════════════════

  /** Current app status */
  readonly status: AppStatus;

  /** Hook registry */
  readonly hooks: Hookable<AppHooks>;

  /**
   * Initialize the App.
   *
   * MUST be called before any mutation/read APIs.
   * Compiles MEL if schema is string, initializes plugins.
   */
  ready(): Promise<void>;

  /**
   * Dispose the App.
   *
   * Drains executing actions, cleans up resources.
   */
  dispose(opts?: DisposeOptions): Promise<void>;

  // ═══════════════════════════════════════════════════════════════════
  // Schema Access
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Returns the DomainSchema for the current branch's schemaHash.
   *
   * This provides synchronous pull-based access to the domain schema,
   * enabling plugins and user code to reliably obtain schema without
   * timing dependencies on the 'domain:resolved' hook.
   *
   * NOTE: In multi-schema scenarios (schema-changing fork), this returns
   * the schema for the CURRENT branch's schemaHash, which may differ from
   * the initial domain's schema.
   *
   * @throws AppNotReadyError if called before schema is resolved (READY-6)
   * @throws AppDisposedError if called after dispose()
   * @returns DomainSchema for current branch's schemaHash
   * @see SPEC v2.0.0 §13 SCHEMA-1~6
   */
  getDomainSchema(): DomainSchema;

  // ═══════════════════════════════════════════════════════════════════
  // State Access
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Get current state.
   */
  getState<T = unknown>(): AppState<T>;

  /**
   * Subscribe to state changes.
   */
  subscribe<TSelected>(
    selector: (state: AppState<unknown>) => TSelected,
    listener: (selected: TSelected) => void,
    opts?: SubscribeOptions<TSelected>
  ): Unsubscribe;

  // ═══════════════════════════════════════════════════════════════════
  // Action Execution (High-Level API)
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Execute an action.
   *
   * This is the primary API for action execution.
   * Returns an ActionHandle for tracking.
   *
   * @param type - Action type (e.g., 'todo:add')
   * @param input - Action input payload
   * @param opts - Execution options
   */
  act(type: string, input?: unknown, opts?: ActOptions): ActionHandle;

  /**
   * Get an existing ActionHandle by proposalId.
   *
   * @throws ActionNotFoundError if proposalId is unknown
   */
  getActionHandle(proposalId: string): ActionHandle;

  // ═══════════════════════════════════════════════════════════════════
  // Proposal Execution (Low-Level API) - v2.0.0
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Submit a proposal for execution.
   *
   * Low-level API. Prefer act() for most use cases.
   *
   * @see SPEC v2.0.0 §6.2 APP-API-4
   */
  submitProposal(proposal: Proposal): Promise<ProposalResult>;

  // ═══════════════════════════════════════════════════════════════════
  // Session
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Create a session for an actor.
   *
   * Session provides actor-scoped action execution.
   */
  session(actorId: string, opts?: SessionOptions): Session;

  // ═══════════════════════════════════════════════════════════════════
  // Branch Management
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Get current branch.
   */
  currentBranch(): Branch;

  /**
   * List all branches.
   */
  listBranches(): readonly Branch[];

  /**
   * Switch to a different branch.
   */
  switchBranch(branchId: string): Promise<Branch>;

  /**
   * Create a new branch (fork).
   */
  fork(opts?: ForkOptions): Promise<Branch>;

  // ═══════════════════════════════════════════════════════════════════
  // System Runtime
  // ═══════════════════════════════════════════════════════════════════

  /** System operations facade */
  readonly system: SystemFacade;

  // ═══════════════════════════════════════════════════════════════════
  // Memory
  // ═══════════════════════════════════════════════════════════════════

  /** Memory operations facade */
  readonly memory: MemoryFacade;

  // ═══════════════════════════════════════════════════════════════════
  // World Query (v2.0.0)
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Get current head WorldId.
   *
   * @see SPEC v2.0.0 §6.2
   */
  getCurrentHead?(): WorldId;

  /**
   * Get snapshot for a World.
   *
   * @see SPEC v2.0.0 §6.2
   */
  getSnapshot?(worldId: WorldId): Promise<Snapshot>;

  /**
   * Get World metadata.
   *
   * @see SPEC v2.0.0 §6.2
   */
  getWorld?(worldId: WorldId): Promise<World>;

  /**
   * Get all Heads (one per Branch), ordered by createdAt descending.
   *
   * Delegates to World query. QUERY-HEAD-1: MUST delegate without transformation.
   *
   * @see App SPEC v2.3.1 §3
   */
  getHeads?(): Promise<WorldHead[]>;

  /**
   * Get the most recent Head across all Branches.
   *
   * Returns null if no branches exist.
   * Delegates to World query. QUERY-HEAD-2: MUST delegate without transformation.
   *
   * @see App SPEC v2.3.1 §3
   */
  getLatestHead?(): Promise<WorldHead | null>;

  // ═══════════════════════════════════════════════════════════════════
  // Audit
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Get migration links (schema migrations).
   */
  getMigrationLinks(): readonly MigrationLink[];
}
