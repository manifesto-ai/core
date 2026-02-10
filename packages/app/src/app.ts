/**
 * Manifesto App Implementation (Thin Facade)
 *
 * Delegates all operations to AppBootstrap (assembly) and AppRuntime (operations).
 *
 * @see ADR-004 Phase 4 — FACADE-1~5
 * @see SPEC §5-6
 * @module
 */

import type { DomainSchema, Snapshot } from "@manifesto-ai/core";
import type {
  App,
  ActionHandle,
  ActOptions,
  AppConfig,
  AppHooks,
  AppState,
  AppStatus,
  Branch,
  DisposeOptions,
  ForkOptions,
  Hookable,
  MemoryFacade,
  MigrationLink,
  PolicyService,
  Proposal,
  ProposalResult,
  Session,
  SessionOptions,
  SubscribeOptions,
  SystemFacade,
  Unsubscribe,
  World,
  WorldStore,
} from "./core/types/index.js";
import type { WorldId, WorldHead } from "@manifesto-ai/world";

import { AppDisposedError } from "./errors/index.js";

import {
  createActionQueue,
  createLivenessGuard,
  createProposalManager,
} from "./execution/index.js";
import {
  createLifecycleManager,
  type LifecycleManager,
} from "./core/lifecycle/index.js";
import { createSchemaManager } from "./core/schema/index.js";
import { createWorldHeadTracker } from "./storage/world/index.js";
import { SubscriptionStore } from "./runtime/subscription/index.js";
import { createDefaultPolicyService, createSilentPolicyService } from "./runtime/policy/index.js";

import { AppBootstrap } from "./bootstrap/index.js";
import type { AppRuntime } from "./runtime/app-runtime.js";

// =============================================================================
// ManifestoApp Implementation (Thin Facade)
// =============================================================================

/**
 * Manifesto App — Thin Facade (FACADE-1~5)
 *
 * Only contains lifecycle management and delegation to AppRuntime.
 *
 * @see ADR-004 Phase 4
 */
export class ManifestoApp implements App {
  private _lifecycleManager: LifecycleManager;
  private _bootstrap: AppBootstrap;
  private _runtime: AppRuntime | null = null;

  constructor(config: AppConfig, worldStore: WorldStore) {
    this._lifecycleManager = createLifecycleManager();

    // PolicyService: use provided or create default
    let policyService: PolicyService;
    if (config.policyService) {
      policyService = config.policyService;
    } else {
      const isTest = typeof globalThis !== "undefined" &&
        (globalThis as unknown as { process?: { env?: { NODE_ENV?: string } } }).process?.env?.NODE_ENV === "test";

      policyService = isTest
        ? createSilentPolicyService(config.executionKeyPolicy)
        : createDefaultPolicyService({ executionKeyPolicy: config.executionKeyPolicy });
    }

    this._bootstrap = new AppBootstrap({
      config,
      worldStore,
      policyService,
      lifecycleManager: this._lifecycleManager,
      schemaManager: createSchemaManager(config.schema),
      proposalManager: createProposalManager(),
      actionQueue: createActionQueue(),
      livenessGuard: createLivenessGuard(),
      worldHeadTracker: createWorldHeadTracker(),
      subscriptionStore: new SubscriptionStore(),
      effects: config.effects,
    });
  }

  // ===========================================================================
  // Lifecycle
  // ===========================================================================

  get status(): AppStatus {
    return this._lifecycleManager.status;
  }

  get hooks(): Hookable<AppHooks> {
    return this._lifecycleManager.hooks;
  }

  async ready(): Promise<void> {
    if (this._lifecycleManager.status === "ready") {
      return;
    }

    if (this._lifecycleManager.isDisposed()) {
      throw new AppDisposedError("ready");
    }

    // Bootstrap assembles all components (steps 1-10)
    this._runtime = await this._bootstrap.assemble(this);

    // Initialize plugins (after _runtime is set so plugins can access app APIs)
    await this._bootstrap.initializePlugins(this);

    // Mark as ready
    this._lifecycleManager.transitionTo("ready");

    // Emit app:ready
    await this._lifecycleManager.emitHook(
      "app:ready",
      this._lifecycleManager.createHookContext()
    );
  }

  async dispose(opts?: DisposeOptions): Promise<void> {
    if (this._lifecycleManager.status === "disposed") {
      return;
    }

    if (this._lifecycleManager.status === "disposing") {
      return;
    }

    this._lifecycleManager.transitionTo("disposing");

    await this._lifecycleManager.emitHook(
      "app:dispose:before",
      this._lifecycleManager.createHookContext()
    );

    this._lifecycleManager.transitionTo("disposed");

    await this._lifecycleManager.emitHook(
      "app:dispose",
      this._lifecycleManager.createHookContext()
    );
  }

  // ===========================================================================
  // Public API — all delegation to _getRuntime()
  // ===========================================================================

  getDomainSchema(): DomainSchema {
    if (this._lifecycleManager.isDisposed()) {
      throw new AppDisposedError("getDomainSchema");
    }
    // Special case: getDomainSchema is accessible during plugin initialization
    // (status is "created" but _runtime is already assembled).
    // Original code checked schemaManager.isResolved instead of ensureReady().
    if (this._runtime) {
      return this._runtime.getDomainSchema();
    }
    return this._getRuntime("getDomainSchema").getDomainSchema();
  }

  currentBranch(): Branch {
    return this._getRuntime("currentBranch").currentBranch();
  }

  listBranches(): readonly Branch[] {
    return this._getRuntime("listBranches").listBranches();
  }

  async switchBranch(branchId: string): Promise<Branch> {
    return this._getRuntime("switchBranch").switchBranch(branchId);
  }

  async fork(opts?: ForkOptions): Promise<Branch> {
    return this._getRuntime("fork").fork(opts);
  }

  act(type: string, input?: unknown, opts?: ActOptions): ActionHandle {
    return this._getRuntime("act").act(type, input, opts);
  }

  getActionHandle(proposalId: string): ActionHandle {
    return this._getRuntime("getActionHandle").getActionHandle(proposalId);
  }

  session(actorId: string, opts?: SessionOptions): Session {
    return this._getRuntime("session").session(actorId, opts);
  }

  getState<T = unknown>(): AppState<T> {
    return this._getRuntime("getState").getState<T>();
  }

  subscribe<TSelected>(
    selector: (state: AppState<unknown>) => TSelected,
    listener: (selected: TSelected) => void,
    opts?: SubscribeOptions<TSelected>
  ): Unsubscribe {
    return this._getRuntime("subscribe").subscribe(selector, listener, opts);
  }

  get system(): SystemFacade {
    return this._getRuntime("system").system;
  }

  get memory(): MemoryFacade {
    return this._getRuntime("memory").memory;
  }

  getMigrationLinks(): readonly MigrationLink[] {
    return this._getRuntime("getMigrationLinks").getMigrationLinks();
  }

  getCurrentHead(): WorldId {
    return this._getRuntime("getCurrentHead").getCurrentHead();
  }

  getSnapshot<T = unknown>(): AppState<T>;
  getSnapshot(worldId: WorldId): Promise<Snapshot>;
  getSnapshot<T = unknown>(worldId?: WorldId): AppState<T> | Promise<Snapshot> {
    if (worldId !== undefined) {
      return this._getRuntime("getSnapshot").getSnapshot(worldId);
    }
    return this._getRuntime("getSnapshot").getState<T>();
  }

  async getWorld(worldId: WorldId): Promise<World> {
    return this._getRuntime("getWorld").getWorld(worldId);
  }

  async getHeads(): Promise<WorldHead[]> {
    return this._getRuntime("getHeads").getHeads();
  }

  async getLatestHead(): Promise<WorldHead | null> {
    return this._getRuntime("getLatestHead").getLatestHead();
  }

  async submitProposal(proposal: Proposal): Promise<ProposalResult> {
    return this._getRuntime("submitProposal").submitProposal(proposal);
  }

  // ===========================================================================
  // Private: Runtime Guard (FACADE-5)
  // ===========================================================================

  private _getRuntime(apiName: string): AppRuntime {
    this._lifecycleManager.ensureReady(apiName);
    return this._runtime!;
  }
}
