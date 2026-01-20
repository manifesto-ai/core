/**
 * Manifesto App Implementation (Thin Facade)
 *
 * This is a facade that coordinates the extracted modules:
 * - LifecycleManager: App lifecycle state
 * - SchemaManager: Domain schema compilation/caching
 * - ProposalManager: ActionHandle management
 * - ActionQueue: FIFO queue management
 * - LivenessGuard: Re-entry prevention
 * - WorldHeadTracker: v2 World head tracking
 * - V2Executor: v2 action execution
 * - AppInitializer: App initialization
 * - V2Initializer: v2 component initialization
 *
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
  CreateAppOptions,
  DisposeOptions,
  ForkOptions,
  Hookable,
  Host,
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
} from "./core/types/index.js";
import type { WorldId } from "@manifesto-ai/world";
import { createWorldId } from "@manifesto-ai/world";

import {
  AppNotReadyError,
  AppDisposedError,
  MissingDefaultActorError,
  LivenessError,
  PluginInitError,
} from "./errors/index.js";

import { ActionHandleImpl } from "./execution/action/index.js";
import { BranchManager } from "./storage/branch/index.js";
import { SessionImpl } from "./runtime/session/index.js";
import { SubscriptionStore } from "./runtime/subscription/index.js";
import { ServiceRegistry } from "./runtime/services/index.js";
import { createMemoryFacade, freezeRecallResult } from "./runtime/memory/index.js";
import { SystemRuntime, createSystemFacade } from "./runtime/system/index.js";
import type { SystemActionType } from "./constants.js";
import type { AppHostExecutor } from "./execution/host-executor/index.js";
import { createDefaultPolicyService, createSilentPolicyService } from "./runtime/policy/index.js";
import {
  DomainExecutor,
  createActionQueue,
  createLivenessGuard,
  createV2Executor,
  appStateToSnapshot,
  computeSnapshotHash,
  createProposalManager,
  createV2Initializer,
  type ActionQueue,
  type LivenessGuard,
  type V2Executor,
  type ProposalManager,
} from "./execution/index.js";
import {
  createLifecycleManager,
  type LifecycleManager,
} from "./core/lifecycle/index.js";
import {
  createSchemaManager,
  type SchemaManager,
} from "./core/schema/index.js";
import {
  createWorldHeadTracker,
  type WorldHeadTracker,
} from "./storage/world/index.js";

// =============================================================================
// ManifestoApp Implementation (Thin Facade)
// =============================================================================

/**
 * Manifesto App - Thin Facade
 *
 * Coordinates modules to provide the App interface.
 */
export class ManifestoApp implements App {
  // Core modules
  private _lifecycleManager: LifecycleManager;
  private _schemaManager: SchemaManager;
  private _proposalManager: ProposalManager;
  private _actionQueue: ActionQueue;
  private _livenessGuard: LivenessGuard;
  private _worldHeadTracker: WorldHeadTracker;

  // Options
  private _options: CreateAppOptions;

  // Actor
  private _defaultActorId: string = "anonymous";

  // State
  private _currentState: AppState<unknown> | null = null;

  // Branch management
  private _branchManager: BranchManager | null = null;

  // Subscription store
  private _subscriptionStore: SubscriptionStore = new SubscriptionStore();

  // Service registry
  private _serviceRegistry: ServiceRegistry | null = null;

  // System Runtime
  private _systemRuntime: SystemRuntime | null = null;
  private _systemFacade: SystemFacade | null = null;
  private _memoryFacade: MemoryFacade | null = null;
  private _migrationLinks: MigrationLink[] = [];

  // Domain Executor (Host integration) - Legacy v0.4.x
  private _domainExecutor: DomainExecutor | null = null;

  // v2.0.0 Components
  private _v2Host: Host | null = null;
  private _v2WorldStore: WorldStore | null = null;
  private _v2PolicyService: PolicyService | null = null;
  private _v2HostExecutor: AppHostExecutor | null = null;
  private _v2Enabled: boolean = false;
  private _v2Executor: V2Executor | null = null;

  constructor(domain: string | DomainSchema, opts?: CreateAppOptions) {
    this._options = opts ?? {};

    // Initialize modules
    this._lifecycleManager = createLifecycleManager();
    this._schemaManager = createSchemaManager(domain);
    this._proposalManager = createProposalManager();
    this._actionQueue = createActionQueue();
    this._livenessGuard = createLivenessGuard();
    this._worldHeadTracker = createWorldHeadTracker();

    // v2.0.0: Detect v2 mode from _v2Config
    const v2Config = opts?._v2Config;
    if (v2Config?.host && v2Config?.worldStore) {
      this._v2Enabled = true;
      this._v2Host = v2Config.host;
      this._v2WorldStore = v2Config.worldStore;

      // PolicyService: use provided or create default
      if (v2Config.policyService) {
        this._v2PolicyService = v2Config.policyService;
      } else {
        const isTest = typeof globalThis !== "undefined" &&
          (globalThis as unknown as { process?: { env?: { NODE_ENV?: string } } }).process?.env?.NODE_ENV === "test";

        this._v2PolicyService = isTest
          ? createSilentPolicyService(v2Config.executionKeyPolicy)
          : createDefaultPolicyService({ executionKeyPolicy: v2Config.executionKeyPolicy });
      }
    }
  }

  // ===========================================================================
  // Lifecycle (delegated to LifecycleManager)
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

    // Emit app:ready:before
    await this._lifecycleManager.emitHook(
      "app:ready:before",
      this._lifecycleManager.createHookContext()
    );

    // 1. Validate actor policy
    this._validateActorPolicy();

    // 2. Compile domain if MEL text
    await this._schemaManager.compile();

    // 3. Validate reserved namespaces (NS-ACT-2) - BEFORE cache
    this._schemaManager.validateReservedNamespaces();

    // 4. Cache schema (READY-6: before plugins)
    const schema = this._schemaManager.getSchema();
    this._schemaManager.cacheSchema(schema);
    this._schemaManager.markResolved();

    // 5. Emit domain:resolved hook
    await this._lifecycleManager.emitHook(
      "domain:resolved",
      { schemaHash: schema.hash, schema },
      {}
    );

    // 6. Validate services
    this._validateServices();

    // 7. Initialize plugins
    await this._initializePlugins();

    // 8. Initialize state
    this._initializeState();

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

    // Emit app:dispose:before
    await this._lifecycleManager.emitHook(
      "app:dispose:before",
      this._lifecycleManager.createHookContext()
    );

    this._lifecycleManager.transitionTo("disposed");

    // Emit app:dispose
    await this._lifecycleManager.emitHook(
      "app:dispose",
      this._lifecycleManager.createHookContext()
    );
  }

  // ===========================================================================
  // Domain Schema Access (delegated to SchemaManager)
  // ===========================================================================

  getDomainSchema(): DomainSchema {
    if (!this._schemaManager.isResolved) {
      throw new AppNotReadyError("getDomainSchema");
    }

    if (this._lifecycleManager.isDisposed()) {
      throw new AppDisposedError("getDomainSchema");
    }

    const currentSchemaHash = this._getCurrentSchemaHash();
    const schema = this._schemaManager.getCachedSchema(currentSchemaHash);

    if (!schema) {
      throw new Error(`Schema not found for hash: ${currentSchemaHash}`);
    }

    return schema;
  }

  // ===========================================================================
  // Branch Management (delegated to BranchManager)
  // ===========================================================================

  currentBranch(): Branch {
    this._lifecycleManager.ensureReady("currentBranch");
    return this._branchManager!.currentBranch();
  }

  listBranches(): readonly Branch[] {
    this._lifecycleManager.ensureReady("listBranches");
    return this._branchManager!.listBranches();
  }

  async switchBranch(branchId: string): Promise<Branch> {
    this._lifecycleManager.ensureReady("switchBranch");
    return this._branchManager!.switchBranch(branchId);
  }

  async fork(opts?: ForkOptions): Promise<Branch> {
    this._lifecycleManager.ensureReady("fork");
    const currentBranch = this._branchManager!.currentBranch();
    return this._branchManager!.fork(currentBranch.id, opts);
  }

  // ===========================================================================
  // Action Execution
  // ===========================================================================

  act(type: string, input?: unknown, opts?: ActOptions): ActionHandle {
    this._lifecycleManager.ensureReady("act");

    // Create handle immediately
    const proposalId = this._proposalManager.generateProposalId();
    const runtime = type.startsWith("system.") ? "system" : "domain";
    const handle = this._proposalManager.createHandle(proposalId, runtime);

    // ==== Liveness Guard (PUB-LIVENESS-2~3) ====
    if (this._v2Enabled && runtime === "domain") {
      this._livenessGuard.checkReinjection(runtime);
    }

    const singleWriter = this._options.scheduler?.singleWriterPerBranch !== false;

    if (runtime === "system") {
      this._actionQueue.enqueueSystem(async () => {
        await this._executeSystemAction(handle, type as SystemActionType, input, opts);
      });
    } else if (this._v2Enabled) {
      this._actionQueue.enqueueDomain(async () => {
        await this._v2Executor!.execute(handle, type, input, opts);
      });
    } else if (singleWriter) {
      this._actionQueue.enqueueDomain(async () => {
        await this._executeActionLifecycle(handle, type, input, opts);
      });
    } else {
      queueMicrotask(() => {
        void this._executeActionLifecycle(handle, type, input, opts);
      });
    }

    return handle;
  }

  getActionHandle(proposalId: string): ActionHandle {
    this._lifecycleManager.ensureReady("getActionHandle");
    return this._proposalManager.getHandle(proposalId);
  }

  session(actorId: string, opts?: SessionOptions): Session {
    this._lifecycleManager.ensureReady("session");

    const branchId = opts?.branchId ?? this._branchManager!.currentBranchId ?? "main";

    return new SessionImpl(actorId, branchId, {
      executeAction: (actorId, branchId, type, input, actOpts) => {
        return this.act(type, input, { ...actOpts, actorId, branchId });
      },
      getStateForBranch: (branchId) => {
        return this._branchManager!.getStateForBranch(branchId);
      },
      recall: async (req, ctx) => {
        return this._memoryFacade!.recall(req, ctx);
      },
      isMemoryEnabled: () => {
        return this._memoryFacade!.enabled();
      },
    }, opts);
  }

  // ===========================================================================
  // State Access
  // ===========================================================================

  getState<T = unknown>(): AppState<T> {
    this._lifecycleManager.ensureReady("getState");
    return this._currentState as AppState<T>;
  }

  subscribe<TSelected>(
    selector: (state: AppState<unknown>) => TSelected,
    listener: (selected: TSelected) => void,
    opts?: SubscribeOptions<TSelected>
  ): Unsubscribe {
    this._lifecycleManager.ensureReady("subscribe");
    return this._subscriptionStore.subscribe(selector, listener, opts);
  }

  // ===========================================================================
  // System & Memory Facades
  // ===========================================================================

  get system(): SystemFacade {
    this._lifecycleManager.ensureReady("system");
    return this._systemFacade!;
  }

  get memory(): MemoryFacade {
    this._lifecycleManager.ensureReady("memory");
    return this._memoryFacade!;
  }

  getMigrationLinks(): readonly MigrationLink[] {
    this._lifecycleManager.ensureReady("getMigrationLinks");
    return this._migrationLinks;
  }

  // ===========================================================================
  // v2.0.0 World Query APIs
  // ===========================================================================

  getCurrentHead(): WorldId {
    this._lifecycleManager.ensureReady("getCurrentHead");

    if (this._v2Enabled && this._worldHeadTracker.getCurrentHead()) {
      return this._worldHeadTracker.getCurrentHead()!;
    }

    const headStr = this._branchManager?.currentBranch()?.head() ?? "genesis";
    return createWorldId(String(headStr));
  }

  async getSnapshot(worldId: WorldId): Promise<Snapshot> {
    this._lifecycleManager.ensureReady("getSnapshot");

    if (!this._v2Enabled || !this._v2WorldStore) {
      return appStateToSnapshot(this._currentState!);
    }

    return this._v2WorldStore.restore(worldId);
  }

  async getWorld(worldId: WorldId): Promise<World> {
    this._lifecycleManager.ensureReady("getWorld");

    if (!this._v2Enabled || !this._v2WorldStore) {
      const snapshot = appStateToSnapshot(this._currentState!);
      return {
        worldId,
        schemaHash: this._schemaManager.getCurrentSchemaHash(),
        snapshotHash: computeSnapshotHash(snapshot),
        createdAt: Date.now(),
        createdBy: null,
      };
    }

    const world = await this._v2WorldStore.getWorld(worldId);
    if (!world) {
      throw new Error(`World not found: ${worldId}`);
    }
    return world;
  }

  async submitProposal(proposal: Proposal): Promise<ProposalResult> {
    this._lifecycleManager.ensureReady("submitProposal");

    if (!this._v2Enabled) {
      return {
        status: "rejected",
        reason: "submitProposal requires v2 mode with Host and WorldStore",
      };
    }

    const runtime = proposal.intentType.startsWith("system.") ? "system" : "domain";
    const handle = this._proposalManager.createHandle(proposal.proposalId, runtime);

    await new Promise<void>((resolve) => {
      this._actionQueue.enqueueDomain(async () => {
        await this._v2Executor!.execute(
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
      const world = await this._v2WorldStore!.getWorld(worldId);
      return { status: "completed", world: world! };
    } else if (result.status === "failed") {
      const worldId = createWorldId(result.worldId);
      const world = await this._v2WorldStore!.getWorld(worldId);
      return { status: "failed", world: world!, error: result.error };
    } else if (result.status === "rejected") {
      return { status: "rejected", reason: result.reason ?? "Proposal rejected by authority" };
    } else {
      return { status: "rejected", reason: result.error?.message ?? "Proposal preparation failed" };
    }
  }

  // ===========================================================================
  // Internal Methods
  // ===========================================================================

  private _getCurrentSchemaHash(): string {
    if (this._branchManager) {
      return this._branchManager.currentBranch().schemaHash;
    }
    return this._schemaManager.getCurrentSchemaHash();
  }

  private _validateActorPolicy(): void {
    const policy = this._options.actorPolicy;

    if (policy?.mode === "require" && !policy.defaultActor) {
      throw new MissingDefaultActorError();
    }

    if (policy?.defaultActor) {
      this._defaultActorId = policy.defaultActor.actorId;
    } else {
      this._defaultActorId = "anonymous";
    }
  }

  private _validateServices(): void {
    const services = this._options.services ?? {};
    const validationMode = this._options.validation?.services ?? "lazy";

    this._serviceRegistry = new ServiceRegistry(services, {
      validationMode: validationMode === "strict" ? "strict" : "lazy",
      knownEffectTypes: [],
    });

    this._serviceRegistry.validate([]);
  }

  private async _initializePlugins(): Promise<void> {
    const plugins = this._options.plugins;
    if (!plugins) return;

    for (let i = 0; i < plugins.length; i++) {
      const plugin = plugins[i];
      try {
        await plugin(this);
      } catch (error) {
        throw new PluginInitError(
          i,
          error instanceof Error ? error.message : String(error),
          { cause: error }
        );
      }
    }
  }

  private _initializeState(): void {
    const schemaHash = this._schemaManager.getCurrentSchemaHash();
    const initialData = this._options.initialData;

    this._currentState = {
      data: initialData ?? {},
      computed: {},
      system: {
        status: "idle",
        lastError: null,
        errors: [],
        pendingRequirements: [],
        currentAction: null,
      },
      meta: {
        version: 0,
        timestamp: Date.now(),
        randomSeed: "",
        schemaHash,
      },
    };

    this._subscriptionStore.setState(this._currentState);

    this._branchManager = new BranchManager({
      schemaHash,
      initialState: this._currentState,
      callbacks: {
        executeAction: (branchId, type, input, opts) => {
          return this.act(type, input, { ...opts, branchId });
        },
        getStateForBranch: () => this._currentState!,
      },
      getRegisteredEffectTypes: this._v2Enabled
        ? () => this._v2HostExecutor?.getRegisteredEffectTypes() ?? []
        : undefined,
    });

    this._memoryFacade = createMemoryFacade(
      this._options.memory,
      schemaHash,
      {
        getDefaultActorId: () => this._defaultActorId,
        getCurrentBranchId: () => this._branchManager?.currentBranchId ?? "main",
        getBranchHead: (branchId) => {
          try {
            const branches = this._branchManager?.listBranches() ?? [];
            const branch = branches.find((b) => b.id === branchId);
            return branch?.head();
          } catch {
            return undefined;
          }
        },
        branchExists: (branchId) => {
          try {
            const branches = this._branchManager?.listBranches() ?? [];
            return branches.some((b) => b.id === branchId);
          } catch {
            return false;
          }
        },
      }
    );

    this._systemRuntime = new SystemRuntime({
      initialActors: this._options.actorPolicy?.defaultActor
        ? [
            {
              actorId: this._options.actorPolicy.defaultActor.actorId,
              kind: this._options.actorPolicy.defaultActor.kind ?? "human",
              name: this._options.actorPolicy.defaultActor.name,
              meta: this._options.actorPolicy.defaultActor.meta,
            },
          ]
        : [],
      memoryProviders: this._options.memory
        ? Object.keys(
            (this._options.memory as { providers?: Record<string, unknown> }).providers ?? {}
          )
        : [],
      defaultMemoryProvider:
        this._options.memory && typeof this._options.memory === "object"
          ? (this._options.memory.defaultProvider ?? "")
          : "",
    });

    this._systemFacade = createSystemFacade(this._systemRuntime);
    this._systemRuntime.setMemoryFacade(this._memoryFacade);

    if (this._v2Enabled) {
      this._initializeV2Components();
    } else {
      this._domainExecutor = new DomainExecutor({
        schema: this._schemaManager.getSchema(),
        services: this._options.services ?? {},
        initialState: this._currentState,
      });
    }
  }

  private _initializeV2Components(): void {
    if (!this._v2Host || !this._v2WorldStore || !this._v2PolicyService) {
      throw new Error("v2 mode requires Host, WorldStore, and PolicyService");
    }

    // Use V2Initializer for effect registration and genesis world
    const v2Initializer = createV2Initializer({
      host: this._v2Host,
      worldStore: this._v2WorldStore,
      policyService: this._v2PolicyService,
      domainSchema: this._schemaManager.getSchema(),
      options: this._options,
      worldHeadTracker: this._worldHeadTracker,
      branchManager: this._branchManager,
      defaultActorId: this._defaultActorId,
      currentState: this._currentState!,
      getCurrentWorldId: () => this._worldHeadTracker.getCurrentHead()?.toString() ?? "genesis",
      getCurrentBranchId: () => this._branchManager?.currentBranchId ?? "main",
    });

    const { hostExecutor } = v2Initializer.initialize();
    this._v2HostExecutor = hostExecutor;

    // Create V2Executor
    this._v2Executor = createV2Executor({
      domainSchema: this._schemaManager.getSchema(),
      defaultActorId: this._defaultActorId,
      policyService: this._v2PolicyService,
      hostExecutor: this._v2HostExecutor,
      worldStore: this._v2WorldStore,
      lifecycleManager: this._lifecycleManager,
      proposalManager: this._proposalManager,
      livenessGuard: this._livenessGuard,
      worldHeadTracker: this._worldHeadTracker,
      memoryFacade: this._memoryFacade!,
      branchManager: this._branchManager!,
      subscriptionStore: this._subscriptionStore,
      schedulerOptions: this._options.scheduler,
      getCurrentState: () => this._currentState!,
      setCurrentState: (state) => { this._currentState = state; },
    });
  }

  private async _executeSystemAction(
    handle: ActionHandleImpl,
    actionType: SystemActionType,
    input: unknown,
    opts?: ActOptions
  ): Promise<void> {
    const actorId = opts?.actorId ?? this._defaultActorId;

    if (this._options.systemActions?.enabled === false) {
      const error = {
        code: "SYSTEM_ACTION_DISABLED",
        message: `System Actions are disabled`,
        source: { actionId: handle.proposalId, nodePath: "" },
        timestamp: Date.now(),
      };
      handle._transitionTo("preparation_failed", { kind: "preparation_failed", error });
      handle._setResult({
        status: "preparation_failed",
        proposalId: handle.proposalId,
        error,
        runtime: "system",
      });
      return;
    }

    const disabledActions = this._options.systemActions?.disabled ?? [];
    if (disabledActions.includes(actionType)) {
      const error = {
        code: "SYSTEM_ACTION_DISABLED",
        message: `System Action '${actionType}' is disabled`,
        source: { actionId: handle.proposalId, nodePath: "" },
        timestamp: Date.now(),
      };
      handle._transitionTo("preparation_failed", { kind: "preparation_failed", error });
      handle._setResult({
        status: "preparation_failed",
        proposalId: handle.proposalId,
        error,
        runtime: "system",
      });
      return;
    }

    try {
      await this._lifecycleManager.emitHook("action:preparing", {
        proposalId: handle.proposalId,
        actorId: this._defaultActorId,
        type: actionType,
        runtime: "system",
      }, {});

      handle._transitionTo("preparing");
      handle._transitionTo("submitted");
      handle._transitionTo("evaluating");
      handle._transitionTo("approved");
      handle._transitionTo("executing");

      const result = await this._systemRuntime!.execute(
        actionType,
        (input as Record<string, unknown>) ?? {},
        {
          actorId,
          proposalId: handle.proposalId,
          timestamp: Date.now(),
        }
      );

      if (result.status === "completed") {
        handle._transitionTo("completed", { kind: "completed", worldId: result.worldId });
        handle._setResult(result);

        await this._lifecycleManager.emitHook("system:world", {
          type: actionType,
          proposalId: handle.proposalId,
          actorId,
          systemWorldId: result.worldId,
          status: "completed",
        }, {});
      } else if (result.status === "failed") {
        handle._transitionTo("failed", { kind: "failed", error: result.error });
        handle._setResult(result);

        await this._lifecycleManager.emitHook("system:world", {
          type: actionType,
          proposalId: handle.proposalId,
          actorId,
          systemWorldId: result.worldId,
          status: "failed",
        }, {});
      }

      await this._lifecycleManager.emitHook("action:completed", {
        proposalId: handle.proposalId,
        result,
      }, {});
    } catch (error) {
      const errorValue = {
        code: "SYSTEM_ACTION_ERROR",
        message: error instanceof Error ? error.message : String(error),
        source: { actionId: handle.proposalId, nodePath: "" },
        timestamp: Date.now(),
      };

      handle._transitionTo("failed", { kind: "failed", error: errorValue });

      const result = {
        status: "failed" as const,
        proposalId: handle.proposalId,
        decisionId: `dec_sys_${Date.now().toString(36)}`,
        error: errorValue,
        worldId: this._systemRuntime!.head(),
        runtime: "system" as const,
      };

      handle._setResult(result);

      await this._lifecycleManager.emitHook("action:completed", {
        proposalId: handle.proposalId,
        result,
      }, {});
    }
  }

  private async _executeActionLifecycle(
    handle: ActionHandleImpl,
    actionType: string,
    input: unknown,
    opts?: ActOptions
  ): Promise<void> {
    this._subscriptionStore.startTransaction();

    const actorId = opts?.actorId ?? this._defaultActorId;

    try {
      await this._lifecycleManager.emitHook("action:preparing", {
        proposalId: handle.proposalId,
        actorId,
        type: actionType,
        runtime: handle.runtime,
      }, {});

      const schema = this._schemaManager.getSchema();
      const actionDef = schema.actions[actionType];
      if (!actionDef) {
        const error = {
          code: "ACTION_NOT_FOUND",
          message: `Action type '${actionType}' not found in schema`,
          source: { actionId: handle.proposalId, nodePath: "" },
          timestamp: Date.now(),
        };
        handle._transitionTo("preparation_failed", { kind: "preparation_failed", error });
        handle._setResult({
          status: "preparation_failed",
          proposalId: handle.proposalId,
          error,
          runtime: handle.runtime,
        });

        this._subscriptionStore.endTransaction();

        await this._lifecycleManager.emitHook("action:completed", {
          proposalId: handle.proposalId,
          result: {
            status: "preparation_failed",
            proposalId: handle.proposalId,
            error,
            runtime: handle.runtime,
          },
        }, {});
        return;
      }

      handle._transitionTo("submitted");
      handle._transitionTo("evaluating");
      handle._transitionTo("approved");
      handle._transitionTo("executing");

      const worldId = `world_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
      const branchId = opts?.branchId ?? this._branchManager?.currentBranchId ?? "main";

      const execResult = await this._domainExecutor!.execute({
        actionType,
        input: (input as Record<string, unknown>) ?? {},
        proposalId: handle.proposalId,
        actorId,
        worldId,
        branchId,
        signal: new AbortController().signal,
      });

      this._currentState = execResult.newState;
      this._subscriptionStore.notify(this._currentState);

      if (execResult.result.status === "completed" || execResult.result.status === "failed") {
        const publishSnapshot: Snapshot = {
          data: execResult.newState.data as Record<string, unknown>,
          computed: execResult.newState.computed,
          system: {
            status: execResult.newState.system.status,
            lastError: execResult.newState.system.lastError,
            pendingRequirements: [...execResult.newState.system.pendingRequirements],
            currentAction: execResult.newState.system.currentAction,
            errors: [...execResult.newState.system.errors],
          },
          input: {},
          meta: execResult.newState.meta,
        };
        await this._lifecycleManager.emitHook("state:publish", {
          snapshot: publishSnapshot,
          worldId: execResult.result.worldId,
        }, {});
      }

      if (execResult.result.status === "completed") {
        handle._transitionTo("completed", { kind: "completed", worldId: execResult.result.worldId });
        handle._setResult(execResult.result);
      } else if (execResult.result.status === "failed") {
        handle._transitionTo("failed", { kind: "failed", error: execResult.result.error });

        this._currentState = {
          ...this._currentState!,
          system: {
            ...this._currentState!.system,
            lastError: execResult.result.error,
            errors: [...this._currentState!.system.errors, execResult.result.error],
          },
        };

        handle._setResult(execResult.result);
      } else {
        handle._setResult(execResult.result);
      }

      this._subscriptionStore.endTransaction();

      await this._lifecycleManager.emitHook("action:completed", {
        proposalId: handle.proposalId,
        result: execResult.result,
      }, {});
    } catch (error) {
      const errorValue = {
        code: "EXECUTION_ERROR",
        message: error instanceof Error ? error.message : String(error),
        source: { actionId: handle.proposalId, nodePath: "" },
        timestamp: Date.now(),
      };

      const worldId = `world_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
      const decisionId = `dec_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

      handle._transitionTo("failed", { kind: "failed", error: errorValue });

      const result = {
        status: "failed" as const,
        proposalId: handle.proposalId,
        decisionId,
        error: errorValue,
        worldId,
        runtime: handle.runtime,
      };

      handle._setResult(result);
      this._subscriptionStore.endTransaction();

      await this._lifecycleManager.emitHook("action:completed", {
        proposalId: handle.proposalId,
        result,
      }, {});
    }
  }
}
