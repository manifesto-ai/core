/**
 * Manifesto App Implementation
 *
 * @see SPEC §5-6
 * @module
 */

import type { DomainSchema } from "@manifesto-ai/core";
import { compileMelDomain } from "@manifesto-ai/compiler";
import { DomainExecutor } from "./execution/index.js";
import type {
  App,
  ActionHandle,
  ActOptions,
  AppHooks,
  AppState,
  AppStatus,
  Branch,
  CreateAppOptions,
  DisposeOptions,
  ForkOptions,
  Hookable,
  MemoryFacade,
  MigrationLink,
  Session,
  SessionOptions,
  SubscribeOptions,
  SystemFacade,
  Unsubscribe,
} from "./types/index.js";

import {
  AppNotReadyError,
  AppDisposedError,
  MissingDefaultActorError,
  ReservedNamespaceError,
  ReservedEffectTypeError,
  DomainCompileError,
  PluginInitError,
  ActionNotFoundError,
  SystemActionDisabledError,
} from "./errors/index.js";

import { RESERVED_EFFECT_TYPE, RESERVED_NAMESPACE_PREFIX } from "./constants.js";
import { createInitialAppState } from "./state/index.js";
import { ActionHandleImpl } from "./action/index.js";
import { BranchManager } from "./branch/index.js";
import { SessionImpl } from "./session/index.js";
import { HookableImpl, createHookContext } from "./hooks/index.js";
import { SubscriptionStore } from "./subscription/index.js";
import { ServiceRegistry } from "./services/index.js";
import { createMemoryFacade } from "./memory/index.js";
import { SystemRuntime, createSystemFacade } from "./system/index.js";
import type { SystemActionType } from "./constants.js";

// =============================================================================
// ManifestoApp Implementation
// =============================================================================

/**
 * Internal App implementation.
 */
export class ManifestoApp implements App {
  private _status: AppStatus = "created";
  private _hooks: HookableImpl<AppHooks> = new HookableImpl();

  // Domain
  private _domain: string | DomainSchema;
  private _domainSchema: DomainSchema | null = null;

  // Schema cache for referential identity (SCHEMA-4)
  private _schemaCache: Map<string, DomainSchema> = new Map();

  // Tracks if schema is resolved (for SCHEMA-2, READY-6)
  private _schemaResolved: boolean = false;

  // Options
  private _options: CreateAppOptions;

  // Actor
  private _defaultActorId: string = "anonymous";

  // Action handles registry
  private _actionHandles: Map<string, ActionHandle> = new Map();

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

  // Domain Executor (Host integration)
  private _domainExecutor: DomainExecutor | null = null;

  // Domain Action FIFO Queue (SCHED-1~4)
  // All domain actions are serialized via single queue.
  // NOTE: Per-branch parallelism requires per-branch Host instances,
  // which is a future architectural improvement.
  private _domainQueue: Promise<void> = Promise.resolve();

  // System Runtime FIFO Queue
  // All system actions are serialized in a single queue
  private _systemQueue: Promise<void> = Promise.resolve();

  constructor(domain: string | DomainSchema, opts?: CreateAppOptions) {
    this._domain = domain;
    this._options = opts ?? {};
  }

  // ===========================================================================
  // Lifecycle
  // ===========================================================================

  get status(): AppStatus {
    return this._status;
  }

  get hooks(): Hookable<AppHooks> {
    return this._hooks;
  }

  async ready(): Promise<void> {
    if (this._status === "ready") {
      return;
    }

    if (this._status === "disposing" || this._status === "disposed") {
      throw new AppDisposedError("ready");
    }

    // Emit app:ready:before
    await this._hooks.emit("app:ready:before", this._createHookContext());

    // 1. Validate actor policy
    this._validateActorPolicy();

    // 2. Compile domain if MEL text
    await this._compileDomain();

    // 3. Validate reserved namespaces (NS-ACT-2) - BEFORE cache
    this._validateReservedNamespaces();

    // 4. Cache schema (READY-6: before plugins)
    this._cacheSchema(this._domainSchema!);
    this._schemaResolved = true;

    // 5. Emit domain:resolved hook (only after validation passes)
    await this._hooks.emit(
      "domain:resolved",
      {
        schemaHash: this._domainSchema!.hash,
        schema: this._domainSchema!,
      },
      this._createHookContext()
    );

    // 6. Validate services
    this._validateServices();

    // 7. Initialize plugins (can now call getDomainSchema())
    await this._initializePlugins();

    // 8. Initialize state
    this._initializeState();

    // Mark as ready
    this._status = "ready";

    // Emit app:ready
    await this._hooks.emit("app:ready", this._createHookContext());
  }

  async dispose(opts?: DisposeOptions): Promise<void> {
    if (this._status === "disposed") {
      return;
    }

    if (this._status === "disposing") {
      // Wait for dispose to complete
      // TODO: Implement proper waiting mechanism
      return;
    }

    this._status = "disposing";

    // Emit app:dispose:before
    await this._hooks.emit("app:dispose:before", this._createHookContext());

    // TODO: Cancel pending actions if force
    // TODO: Wait for in-progress actions if not force

    this._status = "disposed";

    // Emit app:dispose
    await this._hooks.emit("app:dispose", this._createHookContext());
  }

  // ===========================================================================
  // Domain Schema Access (v0.4.10)
  // ===========================================================================

  /**
   * Returns the DomainSchema for the current branch's schemaHash.
   *
   * @see SPEC §6.2 SCHEMA-1~6
   * @since v0.4.10
   */
  getDomainSchema(): DomainSchema {
    // SCHEMA-2: Check if schema is resolved (NOT ready status!)
    if (!this._schemaResolved) {
      throw new AppNotReadyError("getDomainSchema");
    }

    // Check for disposed
    if (this._status === "disposed" || this._status === "disposing") {
      throw new AppDisposedError("getDomainSchema");
    }

    // SCHEMA-1, SCHEMA-6: Get current branch's schemaHash
    const currentSchemaHash = this._getCurrentSchemaHash();

    // SCHEMA-4: Return cached instance
    const schema = this._schemaCache.get(currentSchemaHash);

    // SCHEMA-3: Must NOT return undefined
    if (!schema) {
      throw new Error(`Schema not found for hash: ${currentSchemaHash}`);
    }

    return schema;
  }

  // ===========================================================================
  // Branch Management
  // ===========================================================================

  currentBranch(): Branch {
    this._ensureReady("currentBranch");
    return this._branchManager!.currentBranch();
  }

  listBranches(): readonly Branch[] {
    this._ensureReady("listBranches");
    return this._branchManager!.listBranches();
  }

  async switchBranch(branchId: string): Promise<Branch> {
    this._ensureReady("switchBranch");
    return this._branchManager!.switchBranch(branchId);
  }

  async fork(opts?: ForkOptions): Promise<Branch> {
    this._ensureReady("fork");
    const currentBranch = this._branchManager!.currentBranch();
    return this._branchManager!.fork(currentBranch.id, opts);
  }

  // ===========================================================================
  // Action Execution
  // ===========================================================================

  act(type: string, input?: unknown, opts?: ActOptions): ActionHandle {
    this._ensureReady("act");

    // Create action context
    const ctx = {
      schema: this._domainSchema!,
      getState: () => this._currentState!,
      setState: (state: AppState<unknown>) => {
        this._currentState = state;
        // Notify subscribers of state change (within transaction)
        this._subscriptionStore.notify(state);
      },
      services: this._options.services ?? {},
      defaultActorId: opts?.actorId ?? this._defaultActorId,
    };

    // Create handle immediately (returns synchronously)
    const proposalId = `prop_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
    const runtime = type.startsWith("system.") ? "system" : "domain";
    const handle = new ActionHandleImpl(proposalId, runtime as "domain" | "system");

    // Register handle for getActionHandle()
    this._actionHandles.set(proposalId, handle);

    // Check if FIFO serialization is enabled (default: true)
    const singleWriter = this._options.scheduler?.singleWriterPerBranch !== false;

    if (runtime === "system") {
      // SYSRT-6: Route system.* actions to System Runtime
      // System actions always use single FIFO queue (SCHED-4)
      this._enqueueSystem(async () => {
        await this._executeSystemAction(handle, type as SystemActionType, input, opts);
      });
    } else if (singleWriter) {
      // Domain actions: FIFO serialization (SCHED-1)
      // All domain actions share single queue because current
      // architecture has single Host per App
      this._enqueueDomain(async () => {
        await this._executeActionLifecycle(ctx, handle, type, input, opts);
      });
    } else {
      // singleWriterPerBranch disabled: execute concurrently (risky)
      queueMicrotask(() => {
        void this._executeActionLifecycle(ctx, handle, type, input, opts);
      });
    }

    return handle;
  }

  /**
   * Execute a system action via System Runtime.
   *
   * @see SPEC §16.6 SYSRT-7
   * @internal
   */
  private async _executeSystemAction(
    handle: ActionHandleImpl,
    actionType: SystemActionType,
    input: unknown,
    opts?: ActOptions
  ): Promise<void> {
    const actorId = opts?.actorId ?? this._defaultActorId;

    // SYS-5: Check if System Actions are disabled globally
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

    // SYS-5a: Check if specific action type is disabled
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
      // Emit action:preparing hook
      await this._hooks.emit("action:preparing", {
        proposalId: handle.proposalId,
        actorId: this._defaultActorId,
        type: actionType,
        runtime: "system",
      }, this._createHookContext());

      // Phase: preparing
      handle._transitionTo("preparing");

      // Phase: submitted
      handle._transitionTo("submitted");

      // Phase: evaluating
      handle._transitionTo("evaluating");

      // Phase: approved
      handle._transitionTo("approved");

      // Phase: executing
      handle._transitionTo("executing");

      // Execute via System Runtime
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
        handle._transitionTo("completed", {
          kind: "completed",
          worldId: result.worldId,
        });
        handle._setResult(result);

        // Emit system:world hook
        await this._hooks.emit("system:world", {
          type: actionType,
          proposalId: handle.proposalId,
          actorId,
          systemWorldId: result.worldId,
          status: "completed",
        });
      } else if (result.status === "failed") {
        handle._transitionTo("failed", {
          kind: "failed",
          error: result.error,
        });
        handle._setResult(result);

        // Emit system:world hook
        await this._hooks.emit("system:world", {
          type: actionType,
          proposalId: handle.proposalId,
          actorId,
          systemWorldId: result.worldId,
          status: "failed",
        });
      }

      // Emit action:completed hook
      await this._hooks.emit("action:completed", {
        proposalId: handle.proposalId,
        result,
      }, this._createHookContext());
    } catch (error) {
      const errorValue = {
        code: "SYSTEM_ACTION_ERROR",
        message: error instanceof Error ? error.message : String(error),
        source: { actionId: handle.proposalId, nodePath: "" },
        timestamp: Date.now(),
      };

      handle._transitionTo("failed", {
        kind: "failed",
        error: errorValue,
      });

      const result = {
        status: "failed" as const,
        proposalId: handle.proposalId,
        decisionId: `dec_sys_${Date.now().toString(36)}`,
        error: errorValue,
        worldId: this._systemRuntime!.head(),
        runtime: "system" as const,
      };

      handle._setResult(result);

      await this._hooks.emit("action:completed", {
        proposalId: handle.proposalId,
        result,
      }, this._createHookContext());
    }
  }

  /**
   * Execute action lifecycle.
   * @internal
   */
  private async _executeActionLifecycle(
    ctx: {
      schema: DomainSchema;
      getState: () => AppState<unknown>;
      setState: (state: AppState<unknown>) => void;
      services: Record<string, unknown>;
      defaultActorId: string;
    },
    handle: ActionHandleImpl,
    actionType: string,
    input: unknown,
    opts?: ActOptions
  ): Promise<void> {
    // Start transaction for subscription batching
    this._subscriptionStore.startTransaction();

    try {
      // Emit action:preparing hook
      await this._hooks.emit("action:preparing", {
        proposalId: handle.proposalId,
        actorId: opts?.actorId ?? ctx.defaultActorId,
        type: actionType,
        runtime: handle.runtime,
      }, this._createHookContext());

      // Phase: preparing
      // Validate action type exists
      const actionDef = ctx.schema.actions[actionType];
      if (!actionDef) {
        const error = {
          code: "ACTION_NOT_FOUND",
          message: `Action type '${actionType}' not found in schema`,
          source: { actionId: handle.proposalId, nodePath: "" },
          timestamp: Date.now(),
        };
        handle._transitionTo("preparation_failed", {
          kind: "preparation_failed",
          error,
        });
        handle._setResult({
          status: "preparation_failed",
          proposalId: handle.proposalId,
          error,
          runtime: handle.runtime,
        });

        // End transaction before returning
        this._subscriptionStore.endTransaction();

        await this._hooks.emit("action:completed", {
          proposalId: handle.proposalId,
          result: {
            status: "preparation_failed",
            proposalId: handle.proposalId,
            error,
            runtime: handle.runtime,
          },
        }, this._createHookContext());
        return;
      }

      // Phase: submitted
      handle._transitionTo("submitted");

      // Phase: evaluating (Authority evaluation - auto-approve for now)
      handle._transitionTo("evaluating");

      // Phase: approved
      handle._transitionTo("approved");

      // Phase: executing
      handle._transitionTo("executing");

      // Generate worldId and decisionId for this execution
      const worldId = `world_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
      const branchId = opts?.branchId ?? this._branchManager?.currentBranchId ?? "main";

      // Execute via DomainExecutor (Host integration)
      const execResult = await this._domainExecutor!.execute({
        actionType,
        input: (input as Record<string, unknown>) ?? {},
        proposalId: handle.proposalId,
        actorId: opts?.actorId ?? ctx.defaultActorId,
        worldId,
        branchId,
        signal: new AbortController().signal,
      });

      // Update state with result from Host
      ctx.setState(execResult.newState);

      // Determine outcome based on execution result
      if (execResult.result.status === "completed") {
        // Phase: completed
        handle._transitionTo("completed", {
          kind: "completed",
          worldId: execResult.result.worldId,
        });

        handle._setResult(execResult.result);
      } else if (execResult.result.status === "failed") {
        // Phase: failed
        handle._transitionTo("failed", {
          kind: "failed",
          error: execResult.result.error,
        });

        // Update system.lastError
        const newState = ctx.getState();
        ctx.setState({
          ...newState,
          system: {
            ...newState.system,
            lastError: execResult.result.error,
            errors: [...newState.system.errors, execResult.result.error],
          },
        });

        handle._setResult(execResult.result);
      } else {
        // Handle other statuses (preparation_failed, rejected)
        handle._setResult(execResult.result);
      }

      // End transaction and notify subscribers
      this._subscriptionStore.endTransaction();

      // Emit action:completed hook
      await this._hooks.emit("action:completed", {
        proposalId: handle.proposalId,
        result: execResult.result,
      }, this._createHookContext());
    } catch (error) {
      // Unexpected error
      const errorValue = {
        code: "EXECUTION_ERROR",
        message: error instanceof Error ? error.message : String(error),
        source: { actionId: handle.proposalId, nodePath: "" },
        timestamp: Date.now(),
      };

      const worldId = `world_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
      const decisionId = `dec_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

      handle._transitionTo("failed", {
        kind: "failed",
        error: errorValue,
      });

      const result = {
        status: "failed" as const,
        proposalId: handle.proposalId,
        decisionId,
        error: errorValue,
        worldId,
        runtime: handle.runtime,
      };

      handle._setResult(result);

      // End transaction and notify subscribers (even on error)
      this._subscriptionStore.endTransaction();

      await this._hooks.emit("action:completed", {
        proposalId: handle.proposalId,
        result,
      }, this._createHookContext());
    }
  }

  getActionHandle(proposalId: string): ActionHandle {
    this._ensureReady("getActionHandle");
    const handle = this._actionHandles.get(proposalId);
    if (!handle) {
      throw new ActionNotFoundError(proposalId);
    }
    return handle;
  }

  session(actorId: string, opts?: SessionOptions): Session {
    this._ensureReady("session");

    // Determine branch context
    const branchId = opts?.branchId ?? this._branchManager!.currentBranchId ?? "main";

    // Create session with callbacks
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
    this._ensureReady("getState");
    return this._currentState as AppState<T>;
  }

  subscribe<TSelected>(
    selector: (state: AppState<unknown>) => TSelected,
    listener: (selected: TSelected) => void,
    opts?: SubscribeOptions<TSelected>
  ): Unsubscribe {
    this._ensureReady("subscribe");
    return this._subscriptionStore.subscribe(selector, listener, opts);
  }

  // ===========================================================================
  // System & Memory Facades
  // ===========================================================================

  get system(): SystemFacade {
    this._ensureReady("system");
    return this._systemFacade!;
  }

  get memory(): MemoryFacade {
    this._ensureReady("memory");
    return this._memoryFacade!;
  }

  getMigrationLinks(): readonly MigrationLink[] {
    this._ensureReady("getMigrationLinks");
    return this._migrationLinks;
  }

  // ===========================================================================
  // Internal Methods
  // ===========================================================================

  /**
   * Ensure app is ready before API calls.
   * @see SPEC §5.6 READY-1, READY-2
   */
  private _ensureReady(apiName: string): void {
    if (this._status === "disposed" || this._status === "disposing") {
      throw new AppDisposedError(apiName);
    }
    if (this._status !== "ready") {
      throw new AppNotReadyError(apiName);
    }
  }

  /**
   * Get current schema hash (from branch or domain schema).
   *
   * @see SPEC §6.2 SCHEMA-1, SCHEMA-6
   */
  private _getCurrentSchemaHash(): string {
    // If BranchManager initialized, use current branch's schemaHash
    if (this._branchManager) {
      return this._branchManager.currentBranch().schemaHash;
    }
    // Before BranchManager (during ready()), use _domainSchema
    return this._domainSchema!.hash;
  }

  /**
   * Cache schema for referential identity.
   *
   * @see SPEC §6.2 SCHEMA-4
   */
  private _cacheSchema(schema: DomainSchema): void {
    if (!this._schemaCache.has(schema.hash)) {
      this._schemaCache.set(schema.hash, schema);

      // Emit domain:schema:added for new schemas (only after initial ready)
      if (this._status === "ready") {
        void this._hooks.emit(
          "domain:schema:added",
          {
            schemaHash: schema.hash,
            schema,
          },
          this._createHookContext()
        );
      }
    }
  }

  /**
   * Enqueue a domain action execution.
   *
   * All domain actions are serialized via single FIFO queue,
   * preventing version conflicts from concurrent snapshot modifications.
   *
   * Key design decisions:
   * 1. Previous rejection doesn't block queue (.catch(() => {}))
   * 2. Tail always resolves (wrap in .catch)
   *
   * NOTE: Per-branch parallelism would require per-branch Host instances.
   * Current architecture uses single Host per App.
   *
   * @see SPEC §SCHED-1~4
   */
  private _enqueueDomain(job: () => Promise<void>): void {
    const prev = this._domainQueue;
    const next = prev
      .catch(() => {}) // Previous failure doesn't block queue
      .then(job);
    this._domainQueue = next.catch(() => {}); // Tail always resolves
  }

  /**
   * Enqueue a system action execution on the system queue.
   *
   * All system actions share a single FIFO queue for serialization.
   *
   * @see SPEC §SCHED-4
   */
  private _enqueueSystem(job: () => Promise<void>): void {
    const prev = this._systemQueue;
    const next = prev
      .catch(() => {}) // Previous failure doesn't block queue
      .then(job);
    this._systemQueue = next.catch(() => {}); // Tail always resolves
  }

  /**
   * Validate actor policy configuration.
   * @see SPEC §5.3 ACTOR-1, ACTOR-2, ACTOR-3
   */
  private _validateActorPolicy(): void {
    const policy = this._options.actorPolicy;

    if (policy?.mode === "require" && !policy.defaultActor) {
      throw new MissingDefaultActorError();
    }

    if (policy?.defaultActor) {
      this._defaultActorId = policy.defaultActor.actorId;
    } else {
      // ACTOR-2: anonymous actor
      this._defaultActorId = "anonymous";
    }
  }

  /**
   * Compile domain if provided as MEL text.
   * @see SPEC §5.6 ready() step 2
   */
  private async _compileDomain(): Promise<void> {
    if (typeof this._domain === "string") {
      try {
        // Use compiler to compile MEL text to DomainSchema
        const result = compileMelDomain(this._domain, { mode: "domain" });

        // Check for compilation errors
        if (result.errors.length > 0) {
          const errorMessages = result.errors
            .map((e) => `[${e.code}] ${e.message}`)
            .join("; ");
          throw new DomainCompileError(`MEL compilation failed: ${errorMessages}`);
        }

        if (!result.schema) {
          throw new DomainCompileError("MEL compilation produced no schema");
        }

        // Cast compiler's DomainSchema to core's DomainSchema (they are structurally compatible)
        this._domainSchema = result.schema as DomainSchema;
      } catch (error) {
        if (error instanceof DomainCompileError) {
          throw error;
        }
        throw new DomainCompileError(
          error instanceof Error ? error.message : String(error),
          { cause: error }
        );
      }
    } else {
      this._domainSchema = this._domain;
    }

  }

  /**
   * Validate reserved namespace usage.
   *
   * @see SPEC §18 NS-ACT-1~4
   */
  private _validateReservedNamespaces(): void {
    if (!this._domainSchema) return;

    // NS-ACT-2: Check action types for reserved namespace
    const actions = this._domainSchema.actions || {};
    for (const actionType of Object.keys(actions)) {
      if (actionType.startsWith(RESERVED_NAMESPACE_PREFIX)) {
        throw new ReservedNamespaceError(actionType, "action");
      }
    }

    // Note: Effect types are defined in services, not in DomainSchema
    // Effect namespace validation happens at service registration time
  }

  /**
   * Validate and initialize services.
   * @see SPEC §13.3 SVC-1~5
   * @see SPEC §18.5 READY-5, SYSGET-2, SYSGET-3
   */
  private _validateServices(): void {
    const services = this._options.services ?? {};
    const validationMode = this._options.validation?.services ?? "lazy";

    // Extract effect types from schema (if available)
    const effectTypes = this._extractEffectTypes();

    // Create service registry with validation mode
    this._serviceRegistry = new ServiceRegistry(services, {
      validationMode: validationMode === "strict" ? "strict" : "lazy",
      knownEffectTypes: effectTypes,
    });

    // Validate services (throws on errors)
    // SVC-2/3: strict mode validation
    // SYSGET-2/3: reserved effect type check
    this._serviceRegistry.validate(effectTypes);
  }

  /**
   * Extract effect types from domain schema.
   */
  private _extractEffectTypes(): string[] {
    // Effect types are determined by services registration, not schema
    // Schema flows reference effect types, but don't declare them
    return [];
  }

  /**
   * Initialize plugins.
   * @see SPEC §15.2
   */
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

  /**
   * Initialize application state.
   * @see SPEC §7 State Model
   */
  private _initializeState(): void {
    const schemaHash = this._domainSchema?.hash ?? "unknown";
    const initialData = this._options.initialData;
    this._currentState = createInitialAppState(schemaHash, initialData);

    // Initialize subscription store with initial state
    this._subscriptionStore.setState(this._currentState);

    // Initialize branch manager
    this._branchManager = new BranchManager({
      schemaHash,
      initialState: this._currentState,
      callbacks: {
        executeAction: (branchId, type, input, opts) => {
          return this.act(type, input, { ...opts, branchId });
        },
        getStateForBranch: (branchId) => {
          // For now, return current state for any branch
          // Will be enhanced when World integration is complete
          return this._currentState!;
        },
      },
    });

    // Initialize memory facade
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

    // Initialize System Runtime
    // SYSRT-1: System Runtime is separate from Domain Runtime
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
            (this._options.memory as { providers?: Record<string, unknown> })
              .providers ?? {}
          )
        : [],
      defaultMemoryProvider:
        this._options.memory && typeof this._options.memory === "object"
          ? (this._options.memory.defaultProvider ?? "")
          : "",
    });

    // Create System Facade
    this._systemFacade = createSystemFacade(this._systemRuntime);

    // Wire memory facade to System Runtime for maintain operations (v0.4.8+)
    // MEM-MAINT-1~10: System Runtime needs memory facade for system.memory.maintain
    this._systemRuntime.setMemoryFacade(this._memoryFacade);

    // Initialize Domain Executor (Host integration)
    this._domainExecutor = new DomainExecutor({
      schema: this._domainSchema!,
      services: this._options.services ?? {},
      initialState: this._currentState,
    });
  }

  /**
   * Create a hook context.
   */
  private _createHookContext() {
    return createHookContext(this._hooks.getJobQueue(), {
      actorId: this._defaultActorId,
      branchId: this._branchManager?.currentBranchId ?? undefined,
      worldId: this._branchManager?.currentBranch()?.head() ?? undefined,
    });
  }
}
