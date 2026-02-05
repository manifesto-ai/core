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
 * - AppInitializer: App initialization
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
  CreateAppOptions,
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
import { ServiceRegistry } from "./runtime/services/index.js";
import { createMemoryFacade, freezeRecallResult } from "./runtime/memory/index.js";
import { SystemRuntime, createSystemFacade } from "./runtime/system/index.js";
import type { SystemActionType } from "./constants.js";
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
  type ActionQueue,
  type LivenessGuard,
  type AppExecutor,
  type ProposalManager,
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

  // v2.0.0/v2.2.0 Components
  private _host: Host | null = null;
  private _worldStore: WorldStore | null = null;
  private _policyService: PolicyService | null = null;
  private _hostExecutor: AppHostExecutor | null = null;
  private _initialized: boolean = false;
  private _executor: AppExecutor | null = null;
  // v2.2.0: Effects for internal Host creation
  private _effects: Effects | null = null;

  constructor(domain: string | DomainSchema, opts?: CreateAppOptions) {
    this._options = opts ?? {};

    // Initialize modules
    this._lifecycleManager = createLifecycleManager();
    this._schemaManager = createSchemaManager(domain);
    this._proposalManager = createProposalManager();
    this._actionQueue = createActionQueue();
    this._livenessGuard = createLivenessGuard();
    this._worldHeadTracker = createWorldHeadTracker();
    this._appRef = this._createAppRef();
    this._lifecycleManager.setAppRef(this._appRef);
    this._registerConfiguredHooks();

    // v2.0.0/v2.2.0: Detect v2 mode from _internalConfig
    const internalConfig = opts?._internalConfig;

    // v2.2.0 path: effects-first (Host created internally)
    if (internalConfig && "effects" in internalConfig && internalConfig.effects && internalConfig.worldStore) {
      this._initialized = true;
      this._effects = internalConfig.effects as Effects;
      this._worldStore = internalConfig.worldStore;
      // Host will be created in _initializeComponents after schema compilation

      // PolicyService: use provided or create default
      if (internalConfig.policyService) {
        this._policyService = internalConfig.policyService;
      } else {
        const isTest = typeof globalThis !== "undefined" &&
          (globalThis as unknown as { process?: { env?: { NODE_ENV?: string } } }).process?.env?.NODE_ENV === "test";

        this._policyService = isTest
          ? createSilentPolicyService(internalConfig.executionKeyPolicy)
          : createDefaultPolicyService({ executionKeyPolicy: internalConfig.executionKeyPolicy });
      }
    }
    // Legacy v2.0.0 path: host-first (Host injected)
    else if (internalConfig && "host" in internalConfig && internalConfig.host && internalConfig.worldStore) {
      this._initialized = true;
      this._host = internalConfig.host as Host;
      this._worldStore = internalConfig.worldStore;

      // PolicyService: use provided or create default
      if (internalConfig.policyService) {
        this._policyService = internalConfig.policyService;
      } else {
        const isTest = typeof globalThis !== "undefined" &&
          (globalThis as unknown as { process?: { env?: { NODE_ENV?: string } } }).process?.env?.NODE_ENV === "test";

        this._policyService = isTest
          ? createSilentPolicyService(internalConfig.executionKeyPolicy)
          : createDefaultPolicyService({ executionKeyPolicy: internalConfig.executionKeyPolicy });
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
    await this._initializeState();

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
    if (this._initialized && runtime === "domain") {
      this._livenessGuard.checkReinjection(runtime);
    }

    const singleWriter = this._options.scheduler?.singleWriterPerBranch !== false;

    if (runtime === "system") {
      this._actionQueue.enqueueSystem(async () => {
        await this._executeSystemAction(handle, type as SystemActionType, input, opts);
      });
    } else if (this._initialized) {
      this._actionQueue.enqueueDomain(async () => {
        await this._executor!.execute(handle, type, input, opts);
      });
    } else {
      // v2.3.0: Legacy path removed
      throw new Error(
        "Legacy createApp() signature is no longer supported. " +
        "Use createApp({ schema, effects }) instead."
      );
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

    if (this._initialized && this._worldHeadTracker.getCurrentHead()) {
      return this._worldHeadTracker.getCurrentHead()!;
    }

    const headStr = this._branchManager?.currentBranch()?.head() ?? "genesis";
    return createWorldId(String(headStr));
  }

  async getSnapshot(worldId: WorldId): Promise<Snapshot> {
    this._lifecycleManager.ensureReady("getSnapshot");

    if (!this._initialized || !this._worldStore) {
      return appStateToSnapshot(this._currentState!);
    }

    return this._worldStore.restore(worldId);
  }

  async getWorld(worldId: WorldId): Promise<World> {
    this._lifecycleManager.ensureReady("getWorld");

    if (!this._initialized || !this._worldStore) {
      const snapshot = appStateToSnapshot(this._currentState!);
      return {
        worldId,
        schemaHash: this._schemaManager.getCurrentSchemaHash(),
        snapshotHash: computeSnapshotHash(snapshot),
        createdAt: Date.now(),
        createdBy: null,
      };
    }

    const world = await this._worldStore.getWorld(worldId);
    if (!world) {
      throw new Error(`World not found: ${worldId}`);
    }
    return world;
  }

  async submitProposal(proposal: Proposal): Promise<ProposalResult> {
    this._lifecycleManager.ensureReady("submitProposal");

    if (!this._initialized) {
      return {
        status: "rejected",
        reason: "submitProposal requires v2 mode with Host and WorldStore",
      };
    }

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

    if (this._initialized && runtime === "domain") {
      this._livenessGuard.checkReinjection(runtime);
    }

    const singleWriter = this._options.scheduler?.singleWriterPerBranch !== false;

    if (runtime === "system") {
      this._actionQueue.enqueueSystem(async () => {
        await this._executeSystemAction(handle, type as SystemActionType, input, opts);
      });
    } else if (this._initialized) {
      this._actionQueue.enqueueDomain(async () => {
        await this._executor!.execute(handle, type, input, opts);
      });
    } else {
      // v2.3.0: Legacy path removed
      throw new Error(
        "Legacy createApp() signature is no longer supported. " +
        "Use createApp({ schema, effects }) instead."
      );
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

  private _registerConfiguredHooks(): void {
    const hooks = this._options.hooks;
    if (!hooks) return;

    const hookable = this._lifecycleManager.hooks;
    for (const [name, handler] of Object.entries(hooks)) {
      if (typeof handler !== "function") continue;
      hookable.on(name as keyof AppHooks, handler as AppHooks[keyof AppHooks]);
    }
  }

  private async _initializeState(): Promise<void> {
    const schemaHash = this._schemaManager.getCurrentSchemaHash();
    const initialData = this._options.initialData;

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
      getRegisteredEffectTypes: this._initialized
        ? () => this._hostExecutor?.getRegisteredEffectTypes() ?? []
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

    if (this._initialized) {
      await this._initializeComponents();
    } else {
      // v2.3.0: Legacy DomainExecutor path removed
      throw new Error(
        "Legacy createApp() signature is no longer supported. " +
        "Use createApp({ schema, effects }) instead."
      );
    }
  }

  private async _initializeComponents(): Promise<void> {
    if (!this._worldStore || !this._policyService) {
      throw new Error("v2 mode requires WorldStore and PolicyService");
    }

    // v2.2.0: Create Host internally if effects are provided
    if (this._effects && !this._host) {
      const schema = this._schemaManager.getSchema();
      const internalHost = createInternalHost({
        schema,
        effects: this._effects,
        initialData: this._options.initialData,
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
          // v2.2.0: Effects are pre-registered via createInternalHost.
          // This method is a no-op for backward compatibility.
          console.warn(
            "[Manifesto] registerEffect() is deprecated in v2.2.0. " +
            "Provide effects via createApp({ effects }) instead."
          );
        },
        getRegisteredEffectTypes: () => internalHost.getEffectTypes(),
        reset: async (data) => {
          internalHost.reset(data);
        },
      };
    }

    if (!this._host) {
      throw new Error("v2 mode requires Host (via effects or direct injection)");
    }

    // Use HostInitializer for genesis world (effects already registered if using v2.2.0)
    const hostInitializer = createHostInitializer({
      host: this._host,
      worldStore: this._worldStore,
      policyService: this._policyService,
      domainSchema: this._schemaManager.getSchema(),
      options: this._options,
      worldHeadTracker: this._worldHeadTracker,
      branchManager: this._branchManager,
      defaultActorId: this._defaultActorId,
      currentState: this._currentState!,
      getCurrentWorldId: () => this._worldHeadTracker.getCurrentHead()?.toString() ?? "genesis",
      getCurrentBranchId: () => this._branchManager?.currentBranchId ?? "main",
      // Skip effect registration for v2.2.0 (already done in createInternalHost)
      skipEffectRegistration: !!this._effects,
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

  // Note: Legacy _executeActionLifecycle method removed in v2.3.0
  // All domain actions now go through _executor.execute()
}
