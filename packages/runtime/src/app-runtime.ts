/**
 * App Runtime
 *
 * Non-null dependency holder for operational state (after ready()).
 * All public API methods are delegated here from ManifestoApp.
 *
 * @see ADR-004 Phase 4
 * @module
 */

import type { DomainSchema, Snapshot } from "@manifesto-ai/core";
import type { WorldId, WorldHead } from "@manifesto-ai/world";
import { createWorldId } from "@manifesto-ai/world";
import { compileMelDomain } from "@manifesto-ai/compiler";

import type {
  ActionHandle,
  ActOptions,
  AppConfig,
  AppHooks,
  AppRef,
  AppState,
  Branch,
  Effects,
  ForkOptions,
  Host,
  Hookable,
  MemoryFacade,
  MigrationLink,
  PolicyService,
  Proposal,
  ProposalResult,
  RecallRequest,
  Session,
  SessionOptions,
  SubscribeOptions,
  SystemFacade,
  Unsubscribe,
  World,
  WorldStore,
} from "./types/index.js";
import type { AppHostExecutor } from "./execution/host-executor/index.js";
import type { LifecycleManager } from "./lifecycle/index.js";
import type { SchemaManager } from "./schema/index.js";
import type {
  ActionQueue,
  LivenessGuard,
  AppExecutor,
  ProposalManager,
  SystemActionExecutor,
} from "./execution/index.js";
import type { WorldHeadTracker } from "./storage/world/index.js";
import { BranchManager } from "./storage/branch/index.js";
import { SubscriptionStore } from "./subscription/index.js";
import { SessionImpl } from "./session/index.js";
import { SystemRuntime } from "./system/index.js";
import { DomainCompileError } from "./errors/index.js";
import { withDxAliases } from "./state/index.js";
import type { SystemActionType } from "./constants.js";

// =============================================================================
// Types
// =============================================================================

/**
 * All assembled dependencies passed from AppBootstrap → AppRuntime.
 */
export interface AppRuntimeDeps {
  readonly lifecycleManager: LifecycleManager;
  readonly schemaManager: SchemaManager;
  readonly proposalManager: ProposalManager;
  readonly actionQueue: ActionQueue;
  readonly livenessGuard: LivenessGuard;
  readonly worldHeadTracker: WorldHeadTracker;
  readonly subscriptionStore: SubscriptionStore;
  readonly config: AppConfig;
  readonly defaultActorId: string;
  readonly effects: Effects;
  readonly migrationLinks: MigrationLink[];
  readonly branchManager: BranchManager;
  readonly memoryFacade: MemoryFacade;
  readonly systemRuntime: SystemRuntime;
  readonly systemFacade: SystemFacade;
  readonly systemActionExecutor: SystemActionExecutor;
  readonly host: Host;
  readonly hostExecutor: AppHostExecutor;
  readonly executor: AppExecutor;
  readonly worldStore: WorldStore;
  readonly policyService: PolicyService;
  readonly appRef: AppRef;
  readonly initialState: AppState<unknown>;
}

// =============================================================================
// Implementation
// =============================================================================

/**
 * App Runtime — holds all assembled, non-null dependencies.
 *
 * @see ADR-004 Phase 4
 */
export class AppRuntime {
  // All dependencies (non-null)
  private readonly _lifecycleManager: LifecycleManager;
  private readonly _schemaManager: SchemaManager;
  private readonly _proposalManager: ProposalManager;
  private readonly _actionQueue: ActionQueue;
  private readonly _livenessGuard: LivenessGuard;
  private readonly _worldHeadTracker: WorldHeadTracker;
  private readonly _subscriptionStore: SubscriptionStore;
  private readonly _config: AppConfig;
  private readonly _defaultActorId: string;
  private readonly _effects: Effects;
  private readonly _migrationLinks: MigrationLink[];
  private readonly _branchManager: BranchManager;
  private readonly _memoryFacade: MemoryFacade;
  private readonly _systemFacade: SystemFacade;
  private readonly _systemActionExecutor: SystemActionExecutor;
  private readonly _executor: AppExecutor;
  private readonly _worldStore: WorldStore;
  private readonly _appRef: AppRef;

  private _currentState: AppState<unknown>;

  constructor(deps: AppRuntimeDeps) {
    this._lifecycleManager = deps.lifecycleManager;
    this._schemaManager = deps.schemaManager;
    this._proposalManager = deps.proposalManager;
    this._actionQueue = deps.actionQueue;
    this._livenessGuard = deps.livenessGuard;
    this._worldHeadTracker = deps.worldHeadTracker;
    this._subscriptionStore = deps.subscriptionStore;
    this._config = deps.config;
    this._defaultActorId = deps.defaultActorId;
    this._effects = deps.effects;
    this._migrationLinks = deps.migrationLinks;
    this._branchManager = deps.branchManager;
    this._memoryFacade = deps.memoryFacade;
    this._systemFacade = deps.systemFacade;
    this._systemActionExecutor = deps.systemActionExecutor;
    this._executor = deps.executor;
    this._worldStore = deps.worldStore;
    this._appRef = deps.appRef;
    this._currentState = deps.initialState;
  }

  // ===========================================================================
  // State Accessors (used by executor via closure)
  // ===========================================================================

  getCurrentState(): AppState<unknown> {
    return this._currentState;
  }

  setCurrentState(state: AppState<unknown>): void {
    this._currentState = withDxAliases(state);
  }

  // ===========================================================================
  // Domain Schema Access
  // ===========================================================================

  getDomainSchema(): DomainSchema {
    const currentSchemaHash = this._getCurrentSchemaHash();
    const schema = this._schemaManager.getCachedSchema(currentSchemaHash);

    if (!schema) {
      throw new Error(`Schema not found for hash: ${currentSchemaHash}`);
    }

    return schema;
  }

  // ===========================================================================
  // Branch Management
  // ===========================================================================

  currentBranch(): Branch {
    return this._branchManager.currentBranch();
  }

  listBranches(): readonly Branch[] {
    return this._branchManager.listBranches();
  }

  async switchBranch(branchId: string): Promise<Branch> {
    return this._branchManager.switchBranch(branchId);
  }

  async fork(opts?: ForkOptions): Promise<Branch> {
    const currentBranch = this._branchManager.currentBranch();
    let resolvedOpts = opts;

    if (opts?.domain) {
      const resolvedSchema = await this._resolveForkSchema(opts.domain);
      this._schemaManager.cacheSchema(resolvedSchema);
      resolvedOpts = { ...opts, domain: resolvedSchema };
    }

    return this._branchManager.fork(currentBranch.id, resolvedOpts);
  }

  // ===========================================================================
  // Action Execution
  // ===========================================================================

  act(type: string, input?: unknown, opts?: ActOptions): ActionHandle {
    const proposalId = this._proposalManager.generateProposalId();
    const runtime = type.startsWith("system.") ? "system" : "domain";
    const handle = this._proposalManager.createHandle(proposalId, runtime);

    // Liveness Guard (PUB-LIVENESS-2~3)
    if (runtime === "domain") {
      this._livenessGuard.checkReinjection(runtime);
    }

    if (runtime === "system") {
      this._actionQueue.enqueueSystem(async () => {
        await this._systemActionExecutor.execute(handle, type as SystemActionType, input, opts);
      });
    } else {
      this._actionQueue.enqueueDomain(async () => {
        await this._executor.execute(handle, type, input, opts);
      });
    }

    return handle;
  }

  getActionHandle(proposalId: string): ActionHandle {
    return this._proposalManager.getHandle(proposalId);
  }

  session(actorId: string, opts?: SessionOptions): Session {
    const branchId = opts?.branchId ?? this._branchManager.currentBranchId ?? "main";

    return new SessionImpl(actorId, branchId, {
      executeAction: (actorId, branchId, type, input, actOpts) => {
        return this.act(type, input, { ...actOpts, actorId, branchId });
      },
      getStateForBranch: (branchId) => {
        return this._branchManager.getStateForBranch(branchId);
      },
      recall: async (req, ctx) => {
        return this._memoryFacade.recall(req, ctx);
      },
      isMemoryEnabled: () => {
        return this._memoryFacade.enabled();
      },
    }, opts);
  }

  // ===========================================================================
  // State Access
  // ===========================================================================

  getState<T = unknown>(): AppState<T> {
    return this._currentState as AppState<T>;
  }

  /**
   * No-arg overload: returns same value as getState() (API-DX-1).
   */
  getAppSnapshot<T = unknown>(): AppState<T> {
    return this._currentState as AppState<T>;
  }

  subscribe<TSelected>(
    selector: (state: AppState<unknown>) => TSelected,
    listener: (selected: TSelected) => void,
    opts?: SubscribeOptions<TSelected>
  ): Unsubscribe {
    return this._subscriptionStore.subscribe(selector, listener, opts);
  }

  // ===========================================================================
  // System & Memory Facades
  // ===========================================================================

  get system(): SystemFacade {
    return this._systemFacade;
  }

  get memory(): MemoryFacade {
    return this._memoryFacade;
  }

  getMigrationLinks(): readonly MigrationLink[] {
    return this._migrationLinks;
  }

  // ===========================================================================
  // World Query APIs
  // ===========================================================================

  getCurrentHead(): WorldId {
    const head = this._worldHeadTracker.getCurrentHead();
    if (head) {
      return head;
    }

    const headStr = this._branchManager.currentBranch()?.head() ?? "genesis";
    return createWorldId(String(headStr));
  }

  async getSnapshot(worldId: WorldId): Promise<Snapshot> {
    return this._worldStore.restore(worldId);
  }

  async getWorld(worldId: WorldId): Promise<World> {
    const world = await this._worldStore.getWorld(worldId);
    if (!world) {
      throw new Error(`World not found: ${worldId}`);
    }
    return world;
  }

  /**
   * Get all Heads (one per Branch), ordered by createdAt descending.
   *
   * HEAD-1: Head = World referenced by Branch.head
   * HEAD-5: Sort by createdAt desc, worldId asc, branchId asc
   *
   * @see World SPEC v2.0.5 §4
   * @see App SPEC v2.3.1 QUERY-HEAD-1
   */
  async getHeads(): Promise<WorldHead[]> {
    const branches = this._branchManager.listBranches();
    const heads: WorldHead[] = [];

    for (const branch of branches) {
      const worldId = createWorldId(branch.head());
      const world = await this._worldStore.getWorld(worldId);

      heads.push({
        worldId,
        branchId: branch.id,
        branchName: branch.name ?? branch.id,
        createdAt: world?.createdAt ?? 0,
        schemaHash: branch.schemaHash,
      });
    }

    // HEAD-5: Sort by createdAt desc, worldId asc, branchId asc
    heads.sort((a, b) => {
      if (a.createdAt !== b.createdAt) return b.createdAt - a.createdAt;
      const aWorldId = String(a.worldId);
      const bWorldId = String(b.worldId);
      if (aWorldId !== bWorldId) return aWorldId < bWorldId ? -1 : 1;
      return String(a.branchId) < String(b.branchId) ? -1 : 1;
    });

    return heads;
  }

  /**
   * Get the most recent Head across all Branches.
   *
   * HEAD-4: Returns max by createdAt (BRANCH-7 guarantees all completed)
   *
   * @see World SPEC v2.0.5 §4
   * @see App SPEC v2.3.1 QUERY-HEAD-2
   */
  async getLatestHead(): Promise<WorldHead | null> {
    const heads = await this.getHeads();
    return heads[0] ?? null;
  }

  async submitProposal(proposal: Proposal): Promise<ProposalResult> {
    const runtime = proposal.intentType.startsWith("system.") ? "system" : "domain";
    const handle = this._proposalManager.createHandle(proposal.proposalId, runtime);

    await new Promise<void>((resolve) => {
      this._actionQueue.enqueueDomain(async () => {
        await this._executor.execute(
          handle,
          proposal.intentType,
          proposal.intentBody,
          {
            actorId: proposal.actorId,
            branchId: proposal.branchId,
          }
        );
        resolve();
      });
    });

    const result = await handle.result();

    if (result.status === "completed") {
      const worldId = createWorldId(result.worldId);
      const world = await this._worldStore.getWorld(worldId);
      return { status: "completed", world: world! };
    } else if (result.status === "failed") {
      const worldId = createWorldId(result.worldId);
      const world = await this._worldStore.getWorld(worldId);
      return { status: "failed", world: world!, error: result.error };
    } else if (result.status === "rejected") {
      return { status: "rejected", reason: result.reason ?? "Proposal rejected by authority" };
    } else {
      return { status: "rejected", reason: result.error?.message ?? "Proposal preparation failed" };
    }
  }

  // ===========================================================================
  // Internal: Hook callback
  // ===========================================================================

  enqueueActionFromHook(
    proposalId: string,
    type: string,
    input?: unknown,
    opts?: ActOptions
  ): void {
    const runtime = type.startsWith("system.") ? "system" : "domain";
    const handle = this._proposalManager.createHandle(proposalId, runtime);

    if (runtime === "domain") {
      this._livenessGuard.checkReinjection(runtime);
    }

    if (runtime === "system") {
      this._actionQueue.enqueueSystem(async () => {
        await this._systemActionExecutor.execute(handle, type as SystemActionType, input, opts);
      });
    } else {
      this._actionQueue.enqueueDomain(async () => {
        await this._executor.execute(handle, type, input, opts);
      });
    }
  }

  // ===========================================================================
  // Private Helpers
  // ===========================================================================

  private _getCurrentSchemaHash(): string {
    return this._branchManager.currentBranch().schemaHash;
  }

  private async _resolveForkSchema(domain: string | DomainSchema): Promise<DomainSchema> {
    if (typeof domain !== "string") {
      return domain;
    }

    const result = compileMelDomain(domain, { mode: "domain" });

    if (result.errors.length > 0) {
      const errorMessages = result.errors
        .map((e: { code: string; message: string }) => `[${e.code}] ${e.message}`)
        .join("; ");
      throw new DomainCompileError(`MEL compilation failed: ${errorMessages}`);
    }

    if (!result.schema) {
      throw new DomainCompileError("MEL compilation produced no schema");
    }

    return result.schema as DomainSchema;
  }
}
