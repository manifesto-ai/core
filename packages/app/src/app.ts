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
 * - AppExecutor: v2 action execution
 * - HostInitializer: Host component initialization
 *
 * @see SPEC §5-6
 * @module
 */

import type { DomainSchema, Snapshot } from "@manifesto-ai/core";
import { compileMelDomain } from "@manifesto-ai/compiler";
import type {
  App,
  ActionHandle,
  ActOptions,
  AppConfig,
  AppHooks,
  AppRef,
  AppState,
  AppStatus,
  Branch,
  DisposeOptions,
  Effects,
  ErrorValue,
  ForkOptions,
  Hookable,
  Host,
  HostResult,
  MemoryFacade,
  MigrationLink,
  PolicyService,
  Proposal,
  ProposalId,
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
import { createInternalHost } from "./execution/internal-host.js";
import type { WorldId } from "@manifesto-ai/world";
import { createWorldId } from "@manifesto-ai/world";

import {
  AppNotReadyError,
  AppDisposedError,
  MissingDefaultActorError,
  LivenessError,
  PluginInitError,
  DomainCompileError,
} from "./errors/index.js";

import { ActionHandleImpl } from "./execution/action/index.js";
import { BranchManager } from "./storage/branch/index.js";
import { SessionImpl } from "./runtime/session/index.js";
import { SubscriptionStore } from "./runtime/subscription/index.js";
import { createMemoryFacade, freezeRecallResult } from "./runtime/memory/index.js";
import { SystemRuntime, createSystemFacade } from "./runtime/system/index.js";
import type { SystemActionType } from "./constants.js";
import { RESERVED_EFFECT_TYPE } from "./constants.js";
import { createAppRef, type AppRefCallbacks } from "./hooks/index.js";
import type { AppHostExecutor } from "./execution/host-executor/index.js";
import { createDefaultPolicyService, createSilentPolicyService } from "./runtime/policy/index.js";
import {
  createActionQueue,
  createLivenessGuard,
  createAppExecutor,
  appStateToSnapshot,
  computeSnapshotHash,
  createProposalManager,
  createHostInitializer,
  createSystemActionExecutor,
  type ActionQueue,
  type LivenessGuard,
  type AppExecutor,
  type ProposalManager,
  type SystemActionExecutor,
} from "./execution/index.js";
import {
  createLifecycleManager,
  type LifecycleManager,
} from "./core/lifecycle/index.js";
import { createInitialAppState } from "./core/state/index.js";
import {
  createSchemaManager,
  type SchemaManager,
} from "./core/schema/index.js";
import {
  createWorldHeadTracker,
  type WorldHeadTracker,
} from "./storage/world/index.js";
import {
  validateSchemaCompatibilityWithEffects,
  SchemaIncompatibleError,
} from "./storage/branch/schema-compatibility.js";

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
  private _appRef: AppRef;

  // Config
  private _config: AppConfig;

  // Actor
  private _defaultActorId: string = "anonymous";

  // State
  private _currentState: AppState<unknown> | null = null;

  // Branch management
  private _branchManager: BranchManager | null = null;

  // Subscription store
  private _subscriptionStore: SubscriptionStore = new SubscriptionStore();

  // System Runtime
  private _systemRuntime: SystemRuntime | null = null;
  private _systemFacade: SystemFacade | null = null;
  private _memoryFacade: MemoryFacade | null = null;
  private _migrationLinks: MigrationLink[] = [];

  // v2.3.0 Components
  private _host: Host | null = null;
  private _worldStore: WorldStore;
  private _policyService: PolicyService;
  private _hostExecutor: AppHostExecutor | null = null;
  private _executor: AppExecutor | null = null;
  private _systemActionExecutor: SystemActionExecutor | null = null;
  // Effects for internal Host creation
  private _effects: Effects;

  constructor(config: AppConfig, worldStore: WorldStore) {
    this._config = config;
    this._effects = config.effects;
    this._worldStore = worldStore;

    // Initialize modules
    this._lifecycleManager = createLifecycleManager();
    this._schemaManager = createSchemaManager(config.schema);
    this._proposalManager = createProposalManager();
    this._actionQueue = createActionQueue();
    this._livenessGuard = createLivenessGuard();
    this._worldHeadTracker = createWorldHeadTracker();
    this._appRef = this._createAppRef();
    this._lifecycleManager.setAppRef(this._appRef);
    this._registerConfiguredHooks();

    // PolicyService: use provided or create default
    if (config.policyService) {
      this._policyService = config.policyService;
    } else {
      const isTest = typeof globalThis !== "undefined" &&
        (globalThis as unknown as { process?: { env?: { NODE_ENV?: string } } }).process?.env?.NODE_ENV === "test";

      this._policyService = isTest
        ? createSilentPolicyService(config.executionKeyPolicy)
        : createDefaultPolicyService({ executionKeyPolicy: config.executionKeyPolicy });
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

    // 6. Initialize state
    await this._initializeState();

    // 7. Validate effects (strict mode)
    this._validateEffects();

    // 8. Initialize plugins
    await this._initializePlugins();

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
    let resolvedOpts = opts;

    if (opts?.domain) {
      const resolvedSchema = await this._resolveForkSchema(opts.domain);
      this._schemaManager.cacheSchema(resolvedSchema);
      resolvedOpts = { ...opts, domain: resolvedSchema };
    }

    return this._branchManager!.fork(currentBranch.id, resolvedOpts);
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
    if (runtime === "domain") {
      this._livenessGuard.checkReinjection(runtime);
    }

    if (runtime === "system") {
      this._actionQueue.enqueueSystem(async () => {
        await this._systemActionExecutor!.execute(handle, type as SystemActionType, input, opts);
      });
    } else {
      this._actionQueue.enqueueDomain(async () => {
        await this._executor!.execute(handle, type, input, opts);
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

    const head = this._worldHeadTracker.getCurrentHead();
    if (head) {
      return head;
    }

    const headStr = this._branchManager?.currentBranch()?.head() ?? "genesis";
    return createWorldId(String(headStr));
  }

  async getSnapshot(worldId: WorldId): Promise<Snapshot> {
    this._lifecycleManager.ensureReady("getSnapshot");
    return this._worldStore.restore(worldId);
  }

  async getWorld(worldId: WorldId): Promise<World> {
    this._lifecycleManager.ensureReady("getWorld");
    const world = await this._worldStore.getWorld(worldId);
    if (!world) {
      throw new Error(`World not found: ${worldId}`);
    }
    return world;
  }

  async submitProposal(proposal: Proposal): Promise<ProposalResult> {
    this._lifecycleManager.ensureReady("submitProposal");

    const runtime = proposal.intentType.startsWith("system.") ? "system" : "domain";
    const handle = this._proposalManager.createHandle(proposal.proposalId, runtime);

    await new Promise<void>((resolve) => {
      this._actionQueue.enqueueDomain(async () => {
        await this._executor!.execute(
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
      const world = await this._worldStore!.getWorld(worldId);
      return { status: "completed", world: world! };
    } else if (result.status === "failed") {
      const worldId = createWorldId(result.worldId);
      const world = await this._worldStore!.getWorld(worldId);
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

  private _createAppRef(): AppRef {
    const queue = this._lifecycleManager.getHookableImpl().getJobQueue();
    const callbacks: AppRefCallbacks = {
      getStatus: () => this.status,
      getState: <T>() => this.getState<T>(),
      getDomainSchema: () => this.getDomainSchema(),
      getCurrentHead: () => this.getCurrentHead(),
      currentBranch: () => this.currentBranch(),
      generateProposalId: () => this._proposalManager.generateProposalId(),
    };

    return createAppRef(
      callbacks,
      queue,
      (proposalId, type, input, opts) => {
        this._enqueueActionFromHook(proposalId, type, input, opts);
      }
    );
  }

  private _enqueueActionFromHook(
    proposalId: ProposalId,
    type: string,
    input?: unknown,
    opts?: ActOptions
  ): void {
    this._lifecycleManager.ensureReady("enqueueAction");

    const runtime = type.startsWith("system.") ? "system" : "domain";
    const handle = this._proposalManager.createHandle(proposalId, runtime);

    if (runtime === "domain") {
      this._livenessGuard.checkReinjection(runtime);
    }

    if (runtime === "system") {
      this._actionQueue.enqueueSystem(async () => {
        await this._systemActionExecutor!.execute(handle, type as SystemActionType, input, opts);
      });
    } else {
      this._actionQueue.enqueueDomain(async () => {
        await this._executor!.execute(handle, type, input, opts);
      });
    }
  }

  private async _resolveForkSchema(domain: string | DomainSchema): Promise<DomainSchema> {
    if (typeof domain !== "string") {
      return domain;
    }

    const result = compileMelDomain(domain, { mode: "domain" });

    if (result.errors.length > 0) {
      const errorMessages = result.errors
        .map((e) => `[${e.code}] ${e.message}`)
        .join("; ");
      throw new DomainCompileError(`MEL compilation failed: ${errorMessages}`);
    }

    if (!result.schema) {
      throw new DomainCompileError("MEL compilation produced no schema");
    }

    return result.schema as DomainSchema;
  }

  private _getCurrentSchemaHash(): string {
    if (this._branchManager) {
      return this._branchManager.currentBranch().schemaHash;
    }
    return this._schemaManager.getCurrentSchemaHash();
  }

  private _validateActorPolicy(): void {
    const policy = this._config.actorPolicy;

    if (policy?.mode === "require" && !policy.defaultActor) {
      throw new MissingDefaultActorError();
    }

    if (policy?.defaultActor) {
      this._defaultActorId = policy.defaultActor.actorId;
    } else {
      this._defaultActorId = "anonymous";
    }
  }

  private _validateEffects(): void {
    const mode = this._config.validation?.effects ?? "off";
    if (mode === "off") {
      return;
    }

    const schema = this._schemaManager.getSchema();
    const result = validateSchemaCompatibilityWithEffects(schema, this._effects);

    if (result.compatible) {
      return;
    }

    if (mode === "warn") {
      console.warn(
        `[Manifesto] Missing effect handlers: ${result.missingEffects?.join(", ") ?? ""}`
      );
      return;
    }

    throw new SchemaIncompatibleError(result.missingEffects ?? []);
  }

  private async _initializePlugins(): Promise<void> {
    const plugins = this._config.plugins;
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

  private _registerConfiguredHooks(): void {
    const hooks = this._config.hooks;
    if (!hooks) return;

    const hookable = this._lifecycleManager.hooks;
    for (const [name, handler] of Object.entries(hooks)) {
      if (typeof handler !== "function") continue;
      hookable.on(name as keyof AppHooks, handler as AppHooks[keyof AppHooks]);
    }
  }

  private async _initializeState(): Promise<void> {
    const schemaHash = this._schemaManager.getCurrentSchemaHash();
    const initialData = this._config.initialData;

    this._currentState = createInitialAppState(schemaHash, initialData);

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
      getRegisteredEffectTypes: () => [
        ...Object.keys(this._effects),
        RESERVED_EFFECT_TYPE,
      ],
    });

    this._memoryFacade = createMemoryFacade(
      this._config.memory,
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
      memoryFacade: this._memoryFacade,
    });

    this._systemActionExecutor = createSystemActionExecutor({
      config: this._config,
      lifecycleManager: this._lifecycleManager,
      systemRuntime: this._systemRuntime,
      defaultActorId: this._defaultActorId,
    });

    this._systemFacade = createSystemFacade({
      act: (type, input, actOpts) => this.act(type, input, actOpts),
    });

    await this._initializeComponents();
  }

  private async _initializeComponents(): Promise<void> {
    if (!this._worldStore || !this._policyService) {
      throw new Error("v2 mode requires WorldStore and PolicyService");
    }

    const schema = this._schemaManager.getSchema();
    const internalHost = createInternalHost({
      schema,
      effects: this._effects,
      initialData: this._config.initialData,
    });

    // Adapt ManifestoHost to App's Host interface
    this._host = {
      dispatch: async (intent): Promise<HostResult> => {
        const result = await internalHost.dispatch(intent);
        return {
          // Map ManifestoHost status to App's HostResult status
          status: result.status === "complete" ? "complete" : "error",
          snapshot: result.snapshot as Snapshot,
          error: result.error as ErrorValue | undefined,
        };
      },
      registerEffect: (_type, _handler) => {
        // Effects are pre-registered via createInternalHost.
        console.warn(
          "[Manifesto] registerEffect() is deprecated. " +
          "Provide effects via createApp({ effects }) instead."
        );
      },
      getRegisteredEffectTypes: () => internalHost.getEffectTypes(),
      reset: async (data) => {
        internalHost.reset(data);
      },
    };

    // Use HostInitializer for genesis world
    const hostInitializer = createHostInitializer({
      host: this._host,
      worldStore: this._worldStore,
      policyService: this._policyService,
      domainSchema: schema,
      options: this._config,
      worldHeadTracker: this._worldHeadTracker,
      branchManager: this._branchManager,
      currentState: this._currentState!,
    });

    const { hostExecutor } = hostInitializer.initialize();
    this._hostExecutor = hostExecutor;

    await hostInitializer.initializeGenesisWorld();

    // Create AppExecutor
    this._executor = createAppExecutor({
      domainSchema: this._schemaManager.getSchema(),
      defaultActorId: this._defaultActorId,
      policyService: this._policyService,
      hostExecutor: this._hostExecutor,
      worldStore: this._worldStore,
      lifecycleManager: this._lifecycleManager,
      proposalManager: this._proposalManager,
      livenessGuard: this._livenessGuard,
      worldHeadTracker: this._worldHeadTracker,
      memoryFacade: this._memoryFacade!,
      branchManager: this._branchManager!,
      subscriptionStore: this._subscriptionStore,
      schedulerOptions: this._config.scheduler,
      getCurrentState: () => this._currentState!,
      setCurrentState: (state) => { this._currentState = state; },
    });
  }

  // Note: Legacy _executeActionLifecycle method removed in v2.3.0
  // All domain actions now go through _executor.execute()
  // System actions now go through _systemActionExecutor.execute() (ADR-004 Phase 2)
}
