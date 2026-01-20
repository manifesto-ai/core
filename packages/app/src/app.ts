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
  AppConfig,
  AppHooks,
  AppState,
  AppStatus,
  ApprovedScope,
  AuthorityDecision,
  Branch,
  CreateAppOptions,
  DisposeOptions,
  ErrorValue,
  ExecutionKey,
  ForkOptions,
  Hookable,
  Host,
  HostExecutor,
  Intent,
  MemoryFacade,
  MigrationLink,
  Patch,
  PolicyService,
  Proposal,
  ProposalId,
  ProposalResult,
  RecallRequest,
  Session,
  SessionOptions,
  Snapshot,
  SubscribeOptions,
  SystemFacade,
  Unsubscribe,
  World,
  WorldDelta,
  WorldStore,
} from "./types/index.js";
import type { WorldId } from "@manifesto-ai/world";
import { createWorldId, createProposalId } from "@manifesto-ai/world";

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
import { createMemoryFacade, freezeRecallResult } from "./memory/index.js";
import { SystemRuntime, createSystemFacade } from "./system/index.js";
import type { SystemActionType } from "./constants.js";
import { AppHostExecutor, createAppHostExecutor } from "./host-executor/index.js";
import { createDefaultPolicyService, createSilentPolicyService } from "./policy/index.js";
import { generateWorldId } from "./branch/index.js";

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

  // Domain Executor (Host integration) - Legacy v0.4.x
  private _domainExecutor: DomainExecutor | null = null;

  // ==========================================================================
  // v2.0.0 Components
  // ==========================================================================

  /** v2 Host instance (injected via AppConfig) */
  private _v2Host: Host | null = null;

  /** v2 WorldStore instance (injected via AppConfig) */
  private _v2WorldStore: WorldStore | null = null;

  /** v2 PolicyService instance (injected or default) */
  private _v2PolicyService: PolicyService | null = null;

  /** v2 HostExecutor (wraps Host for World Protocol) */
  private _v2HostExecutor: AppHostExecutor | null = null;

  /** v2 mode enabled flag */
  private _v2Enabled: boolean = false;

  /** v2 current head WorldId */
  private _v2CurrentHead: WorldId | null = null;

  /** v2 genesis WorldId (for lineage root) */
  private _v2GenesisWorldId: WorldId | null = null;

  // ==========================================================================
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
        // Create default PolicyService with optional executionKeyPolicy
        const isTest = typeof globalThis !== "undefined" &&
          (globalThis as unknown as { process?: { env?: { NODE_ENV?: string } } }).process?.env?.NODE_ENV === "test";

        this._v2PolicyService = isTest
          ? createSilentPolicyService(v2Config.executionKeyPolicy)
          : createDefaultPolicyService({ executionKeyPolicy: v2Config.executionKeyPolicy });
      }
    }
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
    } else if (this._v2Enabled) {
      // v2.0.0 path: HostExecutor + WorldStore + PolicyService
      // All domain actions serialized via FIFO queue (SCHED-1)
      this._enqueueDomain(async () => {
        await this._executeActionV2(handle, type, input, opts);
      });
    } else if (singleWriter) {
      // Legacy v0.4.x path: Domain actions via DomainExecutor
      // FIFO serialization (SCHED-1)
      this._enqueueDomain(async () => {
        await this._executeActionLifecycle(ctx, handle, type, input, opts);
      });
    } else {
      // Legacy: singleWriterPerBranch disabled: execute concurrently (risky)
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

      // Publish state once per proposal tick (terminal snapshot only)
      if (execResult.result.status === "completed" || execResult.result.status === "failed") {
        const publishSnapshot: Snapshot = {
          data: execResult.newState.data,
          computed: execResult.newState.computed,
          system: execResult.newState.system,
          input: {},
          meta: execResult.newState.meta,
        };
        await this._hooks.emit(
          "state:publish",
          {
            snapshot: publishSnapshot,
            worldId: execResult.result.worldId,
          },
          this._createHookContext()
        );
      }

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

  /**
   * Execute action lifecycle for v2.0.0.
   *
   * Flow:
   * 1. preparing      → Emit hook, validate action exists
   * 2. submitted      → Create Proposal
   * 3. evaluating     → PolicyService.deriveExecutionKey() + requestApproval()
   * 4. approved/rejected → If rejected: emit audit:rejected, return
   * 5. executing      → WorldStore.restore() → freeze context → HostExecutor.execute()
   * 6. post-validate  → PolicyService.validateResultScope() (optional)
   * 7. store          → Create World, WorldDelta → WorldStore.store()
   * 8. update         → Advance branch head (only if completed)
   * 9. completed/failed → Emit hooks, set result
   *
   * @see SPEC v2.0.0 §5-10
   * @internal
   */
  private async _executeActionV2(
    handle: ActionHandleImpl,
    actionType: string,
    input: unknown,
    opts?: ActOptions
  ): Promise<void> {
    // Start transaction for subscription batching
    this._subscriptionStore.startTransaction();

    const actorId = opts?.actorId ?? this._defaultActorId;
    const branchId = opts?.branchId ?? this._branchManager?.currentBranchId ?? "main";

    try {
      // ==== Phase 1: preparing ====
      await this._hooks.emit("action:preparing", {
        proposalId: handle.proposalId,
        actorId,
        branchId,
        type: actionType,
        runtime: "domain" as const,
      }, this._createHookContext());

      handle._transitionTo("preparing");

      // Validate action type exists
      const actionDef = this._domainSchema?.actions[actionType];
      if (!actionDef) {
        await this._handlePreparationFailure(handle, {
          code: "ACTION_NOT_FOUND",
          message: `Action type '${actionType}' not found in schema`,
        });
        return;
      }

      // ==== Phase 2: submitted ====
      handle._transitionTo("submitted");

      // Create Proposal
      const baseWorldIdStr = this._v2CurrentHead ?? this._branchManager?.currentBranch()?.head() ?? "genesis";
      const baseWorldId = createWorldId(String(baseWorldIdStr));
      const proposal: Proposal = {
        proposalId: handle.proposalId,
        actorId,
        intentType: actionType,
        intentBody: input,
        baseWorld: baseWorldId,
        branchId,
        createdAt: Date.now(),
      };

      // Emit submitted hook
      await this._hooks.emit("action:submitted", {
        proposalId: handle.proposalId,
        actorId,
        branchId,
        type: actionType,
        input,
        runtime: "domain" as const,
      }, this._createHookContext());

      // ==== Phase 3: evaluating ====
      handle._transitionTo("evaluating");

      // Derive ExecutionKey
      const executionKey = this._v2PolicyService!.deriveExecutionKey(proposal);

      // Request approval from PolicyService
      const decision = await this._v2PolicyService!.requestApproval(proposal);

      // ==== Phase 4: approved/rejected ====
      if (!decision.approved) {
        handle._transitionTo("rejected", {
          kind: "rejected",
          reason: decision.reason,
        });

        // Emit audit:rejected
        await this._hooks.emit("audit:rejected", {
          operation: actionType,
          reason: decision.reason,
          proposalId: handle.proposalId,
        }, this._createHookContext());

        const result = {
          status: "rejected" as const,
          proposalId: handle.proposalId,
          decisionId: `dec_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
          reason: decision.reason,
          runtime: "domain" as const,
        };

        handle._setResult(result);
        this._subscriptionStore.endTransaction();

        await this._hooks.emit("action:completed", {
          proposalId: handle.proposalId,
          result,
        }, this._createHookContext());

        return;
      }

      // Approved
      handle._transitionTo("approved");

      // ==== Phase 5: executing ====
      handle._transitionTo("executing");

      // Restore base snapshot from WorldStore
      let baseSnapshot: Snapshot;
      try {
        baseSnapshot = await this._v2WorldStore!.restore(baseWorldId);
      } catch (error) {
        // Fallback to current state if WorldStore fails
        baseSnapshot = this._appStateToSnapshot(this._currentState!);
      }

      // Handle memory recall if requested
      if (opts?.recall) {
        try {
          const recallRequests = Array.isArray(opts.recall) ? opts.recall : [opts.recall];
          const recallResult = await this._memoryFacade!.recall(
            recallRequests as RecallRequest[],
            { actorId, branchId }
          );
          // MEM-7: Freeze recall context into snapshot
          baseSnapshot = freezeRecallResult(baseSnapshot, recallResult);
        } catch (recallError) {
          // Recall failure doesn't block execution, but we log it
          console.warn("[Manifesto] Memory recall failed:", recallError);
        }
      }

      // Create Intent for execution
      const intent: Intent = {
        type: actionType,
        body: input,
        intentId: `intent_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
      };

      // Execute via HostExecutor
      const execResult = await this._v2HostExecutor!.execute(
        executionKey,
        baseSnapshot,
        intent,
        {
          approvedScope: decision.scope,
          timeoutMs: this._options.scheduler?.defaultTimeoutMs,
        }
      );

      // ==== Phase 6: post-validate (optional) ====
      if (decision.scope && this._v2PolicyService!.validateResultScope) {
        const scopeValidation = this._v2PolicyService!.validateResultScope(
          baseSnapshot,
          execResult.terminalSnapshot,
          decision.scope
        );

        if (!scopeValidation.valid) {
          // Scope violation - treat as failure
          console.warn("[Manifesto] Result scope validation failed:", scopeValidation.errors);
          // Continue with failed outcome
        }
      }

      // ==== Phase 7: store ====
      const newWorldIdStr = generateWorldId();
      const newWorldId = createWorldId(newWorldIdStr);
      const decisionId = `dec_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

      // Compute snapshot hash for the terminal snapshot
      const snapshotHash = this._computeSnapshotHash(execResult.terminalSnapshot);

      // Create World object (matching @manifesto-ai/world schema)
      const newWorld: World = {
        worldId: newWorldId,
        schemaHash: this._domainSchema?.hash ?? "unknown",
        snapshotHash,
        createdAt: Date.now(),
        createdBy: createProposalId(handle.proposalId),
      };

      // Create WorldDelta
      const delta: WorldDelta = {
        fromWorld: baseWorldId,
        toWorld: newWorldId,
        patches: this._computePatches(baseSnapshot, execResult.terminalSnapshot),
        createdAt: Date.now(),
      };

      // Store in WorldStore
      try {
        await this._v2WorldStore!.store(newWorld, delta);
      } catch (storeError) {
        console.error("[Manifesto] Failed to store World:", storeError);
        // Continue - execution was successful even if storage failed
      }

      // ==== Phase 8: update ====
      // Update state with terminal snapshot
      const newState = this._snapshotToAppState(execResult.terminalSnapshot);
      this._currentState = newState;
      this._subscriptionStore.notify(newState);

      // BRANCH-7: Only advance head if completed (not failed)
      if (execResult.outcome === "completed") {
        this._v2CurrentHead = newWorldId;
        this._branchManager?.appendWorldToBranch(branchId, newWorldId);
      }

      // ==== Phase 9: completed/failed ====
      if (execResult.outcome === "completed") {
        handle._transitionTo("completed", {
          kind: "completed",
          worldId: newWorldId,
        });

        const result = {
          status: "completed" as const,
          worldId: newWorldId,
          proposalId: handle.proposalId,
          decisionId,
          stats: {
            durationMs: Date.now() - proposal.createdAt,
            effectCount: 0, // TODO: Track effect count
            patchCount: delta.patches.length,
          },
          runtime: "domain" as const,
        };

        handle._setResult(result);
      } else {
        // Failed
        handle._transitionTo("failed", {
          kind: "failed",
          error: execResult.error ?? {
            code: "EXECUTION_FAILED",
            message: "Execution failed",
            source: { actionId: handle.proposalId, nodePath: "" },
            timestamp: Date.now(),
          },
        });

        // Update system.lastError
        this._currentState = {
          ...this._currentState!,
          system: {
            ...this._currentState!.system,
            lastError: execResult.error ?? null,
            errors: [
              ...this._currentState!.system.errors,
              ...(execResult.error ? [execResult.error] : []),
            ],
          },
        };

        const result = {
          status: "failed" as const,
          proposalId: handle.proposalId,
          decisionId,
          error: execResult.error ?? {
            code: "EXECUTION_FAILED",
            message: "Execution failed",
            source: { actionId: handle.proposalId, nodePath: "" },
            timestamp: Date.now(),
          },
          worldId: newWorldId,
          runtime: "domain" as const,
        };

        handle._setResult(result);

        // Emit audit:failed
        await this._hooks.emit("audit:failed", {
          operation: actionType,
          error: execResult.error ?? {
            code: "EXECUTION_FAILED",
            message: "Execution failed",
            source: { actionId: handle.proposalId, nodePath: "" },
            timestamp: Date.now(),
          },
          proposalId: handle.proposalId,
        }, this._createHookContext());
      }

      // End transaction
      this._subscriptionStore.endTransaction();

      // Emit action:completed
      const completedResult = await handle.result();
      await this._hooks.emit("action:completed", {
        proposalId: handle.proposalId,
        result: completedResult,
      }, this._createHookContext());

    } catch (error) {
      // Unexpected error
      await this._handleExecutionError(handle, error, actionType);
    }
  }

  /**
   * Handle preparation failure in v2 execution.
   *
   * @internal
   */
  private async _handlePreparationFailure(
    handle: ActionHandleImpl,
    errorInfo: { code: string; message: string }
  ): Promise<void> {
    const error: ErrorValue = {
      code: errorInfo.code,
      message: errorInfo.message,
      source: { actionId: handle.proposalId, nodePath: "" },
      timestamp: Date.now(),
    };

    handle._transitionTo("preparation_failed", {
      kind: "preparation_failed",
      error,
    });

    const result = {
      status: "preparation_failed" as const,
      proposalId: handle.proposalId,
      error,
      runtime: handle.runtime,
    };

    handle._setResult(result);
    this._subscriptionStore.endTransaction();

    await this._hooks.emit("action:completed", {
      proposalId: handle.proposalId,
      result,
    }, this._createHookContext());
  }

  /**
   * Handle unexpected execution error in v2.
   *
   * @internal
   */
  private async _handleExecutionError(
    handle: ActionHandleImpl,
    error: unknown,
    actionType: string
  ): Promise<void> {
    const errorValue: ErrorValue = {
      code: "EXECUTION_ERROR",
      message: error instanceof Error ? error.message : String(error),
      source: { actionId: handle.proposalId, nodePath: "" },
      timestamp: Date.now(),
    };

    const worldIdStr = generateWorldId();
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
      worldId: worldIdStr,
      runtime: handle.runtime,
    };

    handle._setResult(result);

    // End transaction and notify subscribers (even on error)
    this._subscriptionStore.endTransaction();

    await this._hooks.emit("audit:failed", {
      operation: actionType,
      error: errorValue,
      proposalId: handle.proposalId,
    }, this._createHookContext());

    await this._hooks.emit("action:completed", {
      proposalId: handle.proposalId,
      result,
    }, this._createHookContext());
  }

  /**
   * Compute patches between two snapshots.
   *
   * @internal
   */
  private _computePatches(from: Snapshot, to: Snapshot): Patch[] {
    const patches: Patch[] = [];

    // Simple diff: compare data fields
    const fromData = from.data as Record<string, unknown>;
    const toData = to.data as Record<string, unknown>;

    // Added/changed keys
    for (const [key, value] of Object.entries(toData)) {
      if (JSON.stringify(fromData[key]) !== JSON.stringify(value)) {
        patches.push({ op: "set", path: `data.${key}`, value });
      }
    }

    // Removed keys
    for (const key of Object.keys(fromData)) {
      if (!(key in toData)) {
        patches.push({ op: "unset", path: `data.${key}` });
      }
    }

    return patches;
  }

  /**
   * Convert Snapshot to AppState format.
   *
   * @internal
   */
  private _snapshotToAppState(snapshot: Snapshot): AppState<unknown> {
    return {
      data: snapshot.data,
      computed: (snapshot.computed ?? {}) as Record<string, unknown>,
      system: {
        status: (snapshot.system?.status as "idle" | "computing" | "pending" | "error") ?? "idle",
        lastError: snapshot.system?.lastError ?? null,
        errors: (snapshot.system?.errors ?? []) as readonly ErrorValue[],
        pendingRequirements: snapshot.system?.pendingRequirements ?? [],
        currentAction: snapshot.system?.currentAction ?? null,
      },
      meta: {
        version: snapshot.meta?.version ?? 0,
        timestamp: snapshot.meta?.timestamp ?? Date.now(),
        randomSeed: snapshot.meta?.randomSeed ?? "",
        schemaHash: snapshot.meta?.schemaHash ?? "unknown",
      },
    };
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
  // v2.0.0 World Query APIs
  // ===========================================================================

  /**
   * Get current head WorldId.
   *
   * @returns Current head WorldId for the active branch
   * @see SPEC v2.0.0 §6.2
   */
  getCurrentHead(): WorldId {
    this._ensureReady("getCurrentHead");

    if (this._v2Enabled && this._v2CurrentHead) {
      return this._v2CurrentHead;
    }

    // Fallback to branch head
    const headStr = this._branchManager?.currentBranch()?.head() ?? "genesis";
    return createWorldId(String(headStr));
  }

  /**
   * Get snapshot for a World.
   *
   * @param worldId - World identifier
   * @returns Snapshot for the specified World
   * @throws WorldNotFoundError if worldId does not exist
   * @see SPEC v2.0.0 §6.2
   */
  async getSnapshot(worldId: WorldId): Promise<Snapshot> {
    this._ensureReady("getSnapshot");

    if (!this._v2Enabled || !this._v2WorldStore) {
      // Legacy mode: return current state as snapshot
      return this._appStateToSnapshot(this._currentState!);
    }

    return this._v2WorldStore.restore(worldId);
  }

  /**
   * Get World metadata.
   *
   * @param worldId - World identifier
   * @returns World object
   * @throws Error if world is not found
   * @see SPEC v2.0.0 §6.2
   */
  async getWorld(worldId: WorldId): Promise<World> {
    this._ensureReady("getWorld");

    if (!this._v2Enabled || !this._v2WorldStore) {
      // Legacy mode: create a synthetic World
      const snapshot = this._appStateToSnapshot(this._currentState!);
      return {
        worldId,
        schemaHash: this._domainSchema?.hash ?? "unknown",
        snapshotHash: this._computeSnapshotHash(snapshot),
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

  /**
   * Submit a proposal for execution.
   *
   * Low-level API. Prefer act() for most use cases.
   *
   * @param proposal - Proposal to submit
   * @returns ProposalResult indicating success, failure, or rejection
   * @see SPEC v2.0.0 §6.2 APP-API-4
   */
  async submitProposal(proposal: Proposal): Promise<ProposalResult> {
    this._ensureReady("submitProposal");

    if (!this._v2Enabled) {
      // Legacy mode: not supported
      return {
        status: "rejected",
        reason: "submitProposal requires v2 mode with Host and WorldStore",
      };
    }

    // Create handle for tracking
    const runtime = proposal.intentType.startsWith("system.") ? "system" : "domain";
    const handle = new ActionHandleImpl(proposal.proposalId, runtime as "domain" | "system");
    this._actionHandles.set(proposal.proposalId, handle);

    // Execute via v2 path
    await new Promise<void>((resolve) => {
      this._enqueueDomain(async () => {
        await this._executeActionV2(
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

    // Get result
    const result = await handle.result();

    if (result.status === "completed") {
      const worldId = createWorldId(result.worldId);
      const world = await this._v2WorldStore!.getWorld(worldId);
      return {
        status: "completed",
        world: world!,
      };
    } else if (result.status === "failed") {
      const worldId = createWorldId(result.worldId);
      const world = await this._v2WorldStore!.getWorld(worldId);
      return {
        status: "failed",
        world: world!,
        error: result.error,
      };
    } else if (result.status === "rejected") {
      return {
        status: "rejected",
        reason: result.reason ?? "Proposal rejected by authority",
      };
    } else {
      // preparation_failed
      return {
        status: "rejected",
        reason: result.error?.message ?? "Proposal preparation failed",
      };
    }
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
      // v2.0.0: Provide effect types for schema compatibility check
      // Uses callback pattern because HostExecutor is created after BranchManager
      getRegisteredEffectTypes: this._v2Enabled
        ? () => this._v2HostExecutor?.getRegisteredEffectTypes() ?? []
        : undefined,
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

    // Initialize execution layer based on mode
    if (this._v2Enabled) {
      // v2.0.0 path: HostExecutor + WorldStore
      this._initializeV2Components();
    } else {
      // Legacy v0.4.x path: DomainExecutor
      this._domainExecutor = new DomainExecutor({
        schema: this._domainSchema!,
        services: this._options.services ?? {},
        initialState: this._currentState,
      });
    }
  }

  /**
   * Initialize v2.0.0 components.
   *
   * Sets up HostExecutor, registers effect handlers, and initializes genesis World.
   *
   * @see SPEC v2.0.0 §8-10
   * @internal
   */
  private _initializeV2Components(): void {
    if (!this._v2Host || !this._v2WorldStore || !this._v2PolicyService) {
      throw new Error("v2 mode requires Host, WorldStore, and PolicyService");
    }

    // 1. Create AppHostExecutor wrapping injected Host
    this._v2HostExecutor = createAppHostExecutor(this._v2Host, {
      defaultTimeoutMs: this._options.scheduler?.defaultTimeoutMs,
      traceEnabled: this._options.devtools?.enabled,
    });

    // 2. Register effect handlers from services
    const services = this._options.services ?? {};
    for (const [effectType, handler] of Object.entries(services)) {
      this._v2Host.registerEffect(effectType, async (type, params, ctx) => {
        const result = await handler(params, {
          snapshot: ctx.snapshot as AppState<unknown>,
          actorId: this._defaultActorId,
          worldId: this._v2CurrentHead ?? "genesis",
          branchId: this._branchManager?.currentBranchId ?? "main",
          patch: this._createPatchHelpers(),
          signal: ctx.signal ?? new AbortController().signal,
        });

        // Normalize result to Patch array
        if (!result) return [];
        if (Array.isArray(result)) return result;
        if ("patches" in result) return result.patches;
        return [result];
      });
    }

    // 3. Initialize genesis World in WorldStore
    this._initializeGenesisWorld();
  }

  /**
   * Initialize genesis World in WorldStore.
   *
   * @internal
   */
  private async _initializeGenesisWorld(): Promise<void> {
    if (!this._v2WorldStore || !this._currentState) {
      return;
    }

    const genesisIdStr = this._branchManager?.currentBranch()?.head() ?? generateWorldId();
    const genesisWorldId = createWorldId(genesisIdStr);
    this._v2GenesisWorldId = genesisWorldId;
    this._v2CurrentHead = genesisWorldId;

    // Convert AppState to Snapshot format
    const genesisSnapshot = this._appStateToSnapshot(this._currentState);

    // Compute snapshot hash (simplified for now)
    const snapshotHash = this._computeSnapshotHash(genesisSnapshot);

    // Create genesis World object (matching @manifesto-ai/world schema)
    const genesisWorld: World = {
      worldId: genesisWorldId,
      schemaHash: this._domainSchema?.hash ?? "unknown",
      snapshotHash,
      createdAt: Date.now(),
      createdBy: null, // Genesis has no proposalId
    };

    // Genesis delta points to itself with empty patches
    const genesisDelta: WorldDelta = {
      fromWorld: genesisWorldId,
      toWorld: genesisWorldId,
      patches: [],
      createdAt: Date.now(),
    };

    // Store genesis in WorldStore
    try {
      await this._v2WorldStore.store(genesisWorld, genesisDelta);
    } catch (error) {
      // Genesis may already exist in WorldStore
      console.warn("[Manifesto] Genesis World already exists or store failed:", error);
    }
  }

  /**
   * Compute a hash for a snapshot.
   *
   * @internal
   */
  private _computeSnapshotHash(snapshot: Snapshot): string {
    // Simple hash computation using JSON serialization
    // In production, use a proper content-addressable hash
    try {
      const content = JSON.stringify({
        data: snapshot.data,
        computed: snapshot.computed,
      });
      // Simple hash - sum of char codes (replace with crypto hash in prod)
      let hash = 0;
      for (let i = 0; i < content.length; i++) {
        hash = (hash << 5) - hash + content.charCodeAt(i);
        hash |= 0; // Convert to 32-bit integer
      }
      return `snap_${Math.abs(hash).toString(36)}`;
    } catch {
      return `snap_${Date.now().toString(36)}`;
    }
  }

  /**
   * Convert AppState to Snapshot format.
   *
   * @internal
   */
  private _appStateToSnapshot(state: AppState<unknown>): Snapshot {
    return {
      data: state.data as Record<string, unknown>,
      computed: state.computed,
      system: {
        status: state.system.status,
        lastError: state.system.lastError,
        pendingRequirements: [...state.system.pendingRequirements],
        currentAction: state.system.currentAction,
        errors: [...state.system.errors],
      },
      input: {},
      meta: {
        version: state.meta.version,
        timestamp: state.meta.timestamp,
        randomSeed: state.meta.randomSeed,
        schemaHash: state.meta.schemaHash,
      },
    };
  }

  /**
   * Create patch helpers for service handlers.
   *
   * @internal
   */
  private _createPatchHelpers() {
    return {
      set: (path: string, value: unknown): Patch => ({ op: "set", path, value }),
      merge: (path: string, value: Record<string, unknown>): Patch => ({ op: "merge", path, value }),
      unset: (path: string): Patch => ({ op: "unset", path }),
      many: (...patches: readonly (Patch | readonly Patch[])[]): Patch[] =>
        patches.flat() as Patch[],
      from: (record: Record<string, unknown>, opts?: { basePath?: string }): Patch[] => {
        const basePath = opts?.basePath ?? "data";
        return Object.entries(record).map(([key, value]) => ({
          op: "set" as const,
          path: `${basePath}.${key}`,
          value,
        }));
      },
    };
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
