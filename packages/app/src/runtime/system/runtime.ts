/**
 * System Runtime Implementation
 *
 * The System Runtime is a separate runtime that handles system.* actions.
 * It maintains its own World lineage, distinct from the Domain Runtime.
 *
 * @see SPEC §16 System Runtime Model
 * @module
 */

import type { DomainSchema } from "@manifesto-ai/core";
import type {
  SystemRuntimeState,
  LineageOptions,
  ActionResult,
  ErrorValue,
  MemoryMaintenanceInput,
  MemoryMaintenanceOutput,
  MemoryMaintenanceContext,
  MemoryFacade,
} from "../../core/types/index.js";
import type { ActorRef } from "@manifesto-ai/world";
import { createSystemSchema, createInitialSystemState } from "./schema.js";
import { SYSTEM_ACTION_TYPES, type SystemActionType } from "../../constants.js";

/**
 * System Runtime configuration.
 */
export interface SystemRuntimeConfig {
  /** Initial actors to register */
  initialActors?: Array<{
    actorId: string;
    kind: "human" | "agent" | "system";
    name?: string;
    meta?: Record<string, unknown>;
  }>;

  /** Memory provider names (for initial config) */
  memoryProviders?: string[];

  /** Default memory provider */
  defaultMemoryProvider?: string;

  /**
   * Memory facade for maintain operations.
   * @since v0.4.8
   */
  memoryFacade?: MemoryFacade;
}

/**
 * System Runtime execution context.
 */
export interface SystemExecutionContext {
  actorId: string;
  proposalId: string;
  timestamp: number;
}

/**
 * System Runtime class.
 *
 * Manages the System World lineage and executes system.* actions.
 *
 * @see SPEC §16.1 SYSRT-1
 */
export class SystemRuntime {
  private readonly _schema: DomainSchema;
  private _state: SystemRuntimeState;
  private _worldLineage: string[] = [];
  private _currentWorldId: string;
  private _subscribers: Set<(state: SystemRuntimeState) => void> = new Set();
  private _memoryFacade?: MemoryFacade;

  constructor(config?: SystemRuntimeConfig) {
    // SYSRT-2: System Runtime has its own schema
    this._schema = createSystemSchema();

    // SYSRT-3: Initialize state
    this._state = createInitialSystemState();

    // Create genesis world
    this._currentWorldId = this._generateWorldId();
    this._worldLineage.push(this._currentWorldId);

    // Apply initial configuration
    if (config) {
      this._applyInitialConfig(config);
      // Store memory facade for maintain operations (v0.4.8+)
      this._memoryFacade = config.memoryFacade;
    }
  }

  /**
   * Set the memory facade for maintain operations.
   *
   * @since v0.4.8
   * @internal
   */
  setMemoryFacade(facade: MemoryFacade): void {
    this._memoryFacade = facade;
  }

  /**
   * Get the System Runtime schema.
   *
   * @see SPEC §16.2 SYSRT-2
   */
  get schema(): DomainSchema {
    return this._schema;
  }

  /**
   * Get the current System Runtime state.
   *
   * @see SPEC §16.3
   */
  getState(): SystemRuntimeState {
    return this._state;
  }

  /**
   * Get the current head worldId.
   *
   * @see SPEC §16.4 SYSRT-4
   */
  head(): string {
    return this._currentWorldId;
  }

  /**
   * Get the System World lineage.
   *
   * @see SPEC §16.4 SYSRT-5
   */
  lineage(opts?: LineageOptions): readonly string[] {
    const limit = opts?.limit ?? this._worldLineage.length;
    const untilWorldId = opts?.untilWorldId;

    if (untilWorldId) {
      const index = this._worldLineage.indexOf(untilWorldId);
      if (index === -1) {
        return this._worldLineage.slice(-limit);
      }
      return this._worldLineage.slice(index, index + limit);
    }

    return this._worldLineage.slice(-limit);
  }

  /**
   * Check if an action type is a system action.
   *
   * @see SPEC §16.5 SYSRT-6
   */
  isSystemAction(actionType: string): boolean {
    return (SYSTEM_ACTION_TYPES as readonly string[]).includes(actionType);
  }

  /**
   * Execute a system action.
   *
   * @see SPEC §16.6 SYSRT-7
   */
  async execute(
    actionType: SystemActionType,
    input: Record<string, unknown>,
    ctx: SystemExecutionContext
  ): Promise<ActionResult> {
    // Validate action type
    if (!this.isSystemAction(actionType)) {
      return this._createFailedResult(ctx, {
        code: "INVALID_SYSTEM_ACTION",
        message: `'${actionType}' is not a valid system action`,
      });
    }

    try {
      // Execute the action and get state updates
      const updates = await this._executeAction(actionType, input, ctx);

      // Apply state updates
      this._state = { ...this._state, ...updates };

      // Add audit log entry
      this._addAuditEntry(actionType, input, ctx);

      // Create new world
      const newWorldId = this._generateWorldId();
      this._worldLineage.push(newWorldId);
      this._currentWorldId = newWorldId;

      // Notify subscribers
      this._notifySubscribers();

      // Return completed result
      return {
        status: "completed",
        worldId: newWorldId,
        proposalId: ctx.proposalId,
        decisionId: `dec_sys_${Date.now().toString(36)}`,
        stats: {
          durationMs: Date.now() - ctx.timestamp,
          effectCount: 0,
          patchCount: 1,
        },
        runtime: "system",
      };
    } catch (error) {
      return this._createFailedResult(ctx, {
        code: "SYSTEM_ACTION_ERROR",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Subscribe to state changes.
   */
  subscribe(listener: (state: SystemRuntimeState) => void): () => void {
    this._subscribers.add(listener);
    return () => {
      this._subscribers.delete(listener);
    };
  }

  // ===========================================================================
  // Private Methods
  // ===========================================================================

  /**
   * Apply initial configuration.
   */
  private _applyInitialConfig(config: SystemRuntimeConfig): void {
    // Register initial actors
    if (config.initialActors) {
      for (const actor of config.initialActors) {
        this._state.actors[actor.actorId] = {
          actorId: actor.actorId,
          kind: actor.kind,
          name: actor.name,
          meta: actor.meta,
          enabled: true,
        };
      }
    }

    // Set initial memory config
    if (config.memoryProviders || config.defaultMemoryProvider) {
      this._state.memoryConfig = {
        providers: config.memoryProviders ?? [],
        defaultProvider: config.defaultMemoryProvider ?? "",
      };
    }
  }

  /**
   * Execute a system action and return state updates.
   */
  private async _executeAction(
    actionType: SystemActionType,
    input: Record<string, unknown>,
    ctx: SystemExecutionContext
  ): Promise<Partial<SystemRuntimeState>> {
    switch (actionType) {
      // Actor Management
      case "system.actor.register":
        return this._actorRegister(input, ctx);
      case "system.actor.disable":
        return this._actorDisable(input);
      case "system.actor.updateMeta":
        return this._actorUpdateMeta(input);
      case "system.actor.bindAuthority":
        return this._actorBindAuthority(input);

      // Branch Management
      case "system.branch.create":
        return this._branchCreate(input, ctx);
      case "system.branch.checkout":
        return this._branchCheckout(input, ctx);
      case "system.schema.migrate":
        return this._schemaMigrate(input, ctx);

      // Services Management
      case "system.service.register":
        return this._serviceRegister(input, ctx);
      case "system.service.unregister":
        return this._serviceUnregister(input);
      case "system.service.replace":
        return this._serviceReplace(input, ctx);

      // Memory Operations
      case "system.memory.configure":
        return this._memoryConfigure(input);
      case "system.memory.backfill":
        return this._memoryBackfill(input);
      case "system.memory.maintain":
        return await this._memoryMaintain(input, ctx);

      // Workflow
      case "system.workflow.enable":
        return this._workflowEnable(input);
      case "system.workflow.disable":
        return this._workflowDisable(input);
      case "system.workflow.setPolicy":
        return this._workflowSetPolicy(input);

      default:
        throw new Error(`Unknown system action: ${actionType}`);
    }
  }

  // ===========================================================================
  // Actor Management Actions
  // ===========================================================================

  private _actorRegister(
    input: Record<string, unknown>,
    ctx: SystemExecutionContext
  ): Partial<SystemRuntimeState> {
    const actorId = input.actorId as string;
    const kind = input.kind as "human" | "agent" | "system";
    const name = input.name as string | undefined;
    const meta = input.meta as Record<string, unknown> | undefined;

    return {
      actors: {
        ...this._state.actors,
        [actorId]: {
          actorId,
          kind,
          name,
          meta,
          enabled: true,
        },
      },
    };
  }

  private _actorDisable(
    input: Record<string, unknown>
  ): Partial<SystemRuntimeState> {
    const actorId = input.actorId as string;
    const actor = this._state.actors[actorId];

    if (!actor) {
      throw new Error(`Actor '${actorId}' not found`);
    }

    return {
      actors: {
        ...this._state.actors,
        [actorId]: {
          ...actor,
          enabled: false,
        },
      },
    };
  }

  private _actorUpdateMeta(
    input: Record<string, unknown>
  ): Partial<SystemRuntimeState> {
    const actorId = input.actorId as string;
    const meta = input.meta as Record<string, unknown>;
    const actor = this._state.actors[actorId];

    if (!actor) {
      throw new Error(`Actor '${actorId}' not found`);
    }

    return {
      actors: {
        ...this._state.actors,
        [actorId]: {
          ...actor,
          meta: { ...actor.meta, ...meta },
        },
      },
    };
  }

  private _actorBindAuthority(
    input: Record<string, unknown>
  ): Partial<SystemRuntimeState> {
    const actorId = input.actorId as string;
    const authorityIds = input.authorityIds as string[];
    const actor = this._state.actors[actorId];

    if (!actor) {
      throw new Error(`Actor '${actorId}' not found`);
    }

    return {
      actors: {
        ...this._state.actors,
        [actorId]: {
          ...actor,
          authorityBindings: authorityIds,
        },
      },
    };
  }

  // ===========================================================================
  // Branch Management Actions
  // ===========================================================================

  private _branchCreate(
    input: Record<string, unknown>,
    ctx: SystemExecutionContext
  ): Partial<SystemRuntimeState> {
    const branchId = input.branchId as string;
    const fromWorldId = (input.fromWorldId as string) ?? this._currentWorldId;

    return {
      branchPointers: {
        ...this._state.branchPointers,
        [branchId]: {
          branchId,
          headWorldId: fromWorldId,
          updatedAt: ctx.timestamp,
          updatedBy: ctx.actorId,
        },
      },
    };
  }

  private _branchCheckout(
    input: Record<string, unknown>,
    ctx: SystemExecutionContext
  ): Partial<SystemRuntimeState> {
    const branchId = input.branchId as string;
    const worldId = input.worldId as string;

    const branch = this._state.branchPointers[branchId];
    if (!branch) {
      throw new Error(`Branch '${branchId}' not found`);
    }

    return {
      branchPointers: {
        ...this._state.branchPointers,
        [branchId]: {
          ...branch,
          headWorldId: worldId,
          updatedAt: ctx.timestamp,
          updatedBy: ctx.actorId,
        },
      },
    };
  }

  private _schemaMigrate(
    input: Record<string, unknown>,
    _ctx: SystemExecutionContext
  ): Partial<SystemRuntimeState> {
    // Schema migration is recorded in audit log
    // Actual migration happens in Domain Runtime
    return {};
  }

  // ===========================================================================
  // Services Management Actions
  // ===========================================================================

  private _serviceRegister(
    input: Record<string, unknown>,
    ctx: SystemExecutionContext
  ): Partial<SystemRuntimeState> {
    const effectType = input.effectType as string;
    const handlerRef = input.handlerRef as string;

    return {
      services: {
        ...this._state.services,
        [effectType]: {
          effectType,
          handlerRef,
          registeredAt: ctx.timestamp,
          registeredBy: ctx.actorId,
        },
      },
    };
  }

  private _serviceUnregister(
    input: Record<string, unknown>
  ): Partial<SystemRuntimeState> {
    const effectType = input.effectType as string;
    const { [effectType]: _, ...rest } = this._state.services;

    return {
      services: rest,
    };
  }

  private _serviceReplace(
    input: Record<string, unknown>,
    ctx: SystemExecutionContext
  ): Partial<SystemRuntimeState> {
    const effectType = input.effectType as string;
    const handlerRef = input.handlerRef as string;

    return {
      services: {
        ...this._state.services,
        [effectType]: {
          effectType,
          handlerRef,
          registeredAt: ctx.timestamp,
          registeredBy: ctx.actorId,
        },
      },
    };
  }

  // ===========================================================================
  // Memory Operations Actions
  // ===========================================================================

  private _memoryConfigure(
    input: Record<string, unknown>
  ): Partial<SystemRuntimeState> {
    const providers = input.providers as string[] | undefined;
    const defaultProvider = input.defaultProvider as string | undefined;
    const routing = input.routing;
    const backfill = input.backfill;

    return {
      memoryConfig: {
        providers: providers ?? this._state.memoryConfig.providers,
        defaultProvider:
          defaultProvider ?? this._state.memoryConfig.defaultProvider,
        routing: routing ?? this._state.memoryConfig.routing,
        backfill: backfill ?? this._state.memoryConfig.backfill,
      },
    };
  }

  private _memoryBackfill(
    _input: Record<string, unknown>
  ): Partial<SystemRuntimeState> {
    // Backfill is a side-effectful operation
    // The actual backfill happens through Memory Hub
    // This just records the intent in audit log
    return {};
  }

  /**
   * Execute memory maintenance (forget) operations.
   *
   * MEM-MAINT-1: Requires Authority approval (handled externally)
   * MEM-MAINT-10: actor MUST come from ctx.actorId (Proposal.actorId), NOT user input
   *
   * @see SPEC §17.5 MEM-MAINT-1~10
   * @since v0.4.8
   */
  private async _memoryMaintain(
    input: Record<string, unknown>,
    ctx: SystemExecutionContext
  ): Promise<Partial<SystemRuntimeState>> {
    if (!this._memoryFacade) {
      throw new Error("Memory facade not configured for maintain operations");
    }

    if (!this._memoryFacade.enabled()) {
      throw new Error("Memory is disabled; cannot perform maintain operations");
    }

    const maintainInput = input as unknown as MemoryMaintenanceInput;

    // MEM-MAINT-10: CRITICAL - actor MUST come from ctx (Proposal.actorId)
    // NOT from user-provided input to prevent actor spoofing
    const actor: ActorRef = { actorId: ctx.actorId, kind: "human" };

    // Determine scope from first op (or default to 'actor')
    const scope = maintainInput.ops[0]?.scope ?? "actor";

    // MEM-MAINT-9: scope: 'global' requires elevated Authority
    // Authority check is handled by System Runtime's authority policy

    const maintenanceCtx: MemoryMaintenanceContext = {
      actor,
      scope,
    };

    // Execute maintain operations
    const output = await this._memoryFacade.maintain(
      maintainInput.ops,
      maintenanceCtx
    );

    // Record trace in audit log (MEM-MAINT-6)
    if (output.trace) {
      const entry = {
        timestamp: ctx.timestamp,
        actorId: ctx.actorId,
        actionType: "system.memory.maintain",
        proposalId: ctx.proposalId,
        worldId: this._currentWorldId,
        summary: this._createMaintainAuditSummary(maintainInput, output),
      };

      this._state = {
        ...this._state,
        auditLog: [...this._state.auditLog, entry],
      };
    }

    // State updates are minimal - just recording the operation occurred
    return {};
  }

  /**
   * Create audit summary for maintain operation.
   */
  private _createMaintainAuditSummary(
    input: MemoryMaintenanceInput,
    output: MemoryMaintenanceOutput
  ): string {
    const successCount = output.results.filter(r => r.success).length;
    const totalCount = input.ops.length;
    const worldIds = input.ops.map(op => op.ref.worldId).join(", ");

    return `Memory maintenance: ${successCount}/${totalCount} ops succeeded (worldIds: ${worldIds})`;
  }

  // ===========================================================================
  // Workflow Actions
  // ===========================================================================

  private _workflowEnable(
    input: Record<string, unknown>
  ): Partial<SystemRuntimeState> {
    const workflowId = input.workflowId as string;

    const existing = this._state.workflows[workflowId];

    return {
      workflows: {
        ...this._state.workflows,
        [workflowId]: {
          workflowId,
          enabled: true,
          policy: existing?.policy,
        },
      },
    };
  }

  private _workflowDisable(
    input: Record<string, unknown>
  ): Partial<SystemRuntimeState> {
    const workflowId = input.workflowId as string;

    const existing = this._state.workflows[workflowId];
    if (!existing) {
      throw new Error(`Workflow '${workflowId}' not found`);
    }

    return {
      workflows: {
        ...this._state.workflows,
        [workflowId]: {
          ...existing,
          enabled: false,
        },
      },
    };
  }

  private _workflowSetPolicy(
    input: Record<string, unknown>
  ): Partial<SystemRuntimeState> {
    const workflowId = input.workflowId as string;
    const policy = input.policy;

    const existing = this._state.workflows[workflowId];

    return {
      workflows: {
        ...this._state.workflows,
        [workflowId]: {
          workflowId,
          enabled: existing?.enabled ?? true,
          policy,
        },
      },
    };
  }

  // ===========================================================================
  // Helper Methods
  // ===========================================================================

  /**
   * Add an audit log entry.
   */
  private _addAuditEntry(
    actionType: string,
    input: Record<string, unknown>,
    ctx: SystemExecutionContext
  ): void {
    const entry = {
      timestamp: ctx.timestamp,
      actorId: ctx.actorId,
      actionType,
      proposalId: ctx.proposalId,
      worldId: this._currentWorldId,
      summary: this._createAuditSummary(actionType, input),
    };

    this._state = {
      ...this._state,
      auditLog: [...this._state.auditLog, entry],
    };
  }

  /**
   * Create audit summary for an action.
   */
  private _createAuditSummary(
    actionType: string,
    input: Record<string, unknown>
  ): string {
    switch (actionType) {
      case "system.actor.register":
        return `Registered actor '${input.actorId}' (${input.kind})`;
      case "system.actor.disable":
        return `Disabled actor '${input.actorId}'`;
      case "system.actor.updateMeta":
        return `Updated meta for actor '${input.actorId}'`;
      case "system.actor.bindAuthority":
        return `Bound authorities to actor '${input.actorId}'`;
      case "system.branch.create":
        return `Created branch '${input.branchId}'`;
      case "system.branch.checkout":
        return `Checked out branch '${input.branchId}' to world '${input.worldId}'`;
      case "system.schema.migrate":
        return `Migrated schema from '${input.fromSchemaHash}' to '${input.toSchemaHash}'`;
      case "system.service.register":
        return `Registered service for '${input.effectType}'`;
      case "system.service.unregister":
        return `Unregistered service for '${input.effectType}'`;
      case "system.service.replace":
        return `Replaced service for '${input.effectType}'`;
      case "system.memory.configure":
        return `Configured memory settings`;
      case "system.memory.backfill":
        return `Backfilled memory for world '${input.worldId}'`;
      case "system.memory.maintain":
        return `Maintained memory (${(input.ops as unknown[])?.length ?? 0} ops)`;
      case "system.workflow.enable":
        return `Enabled workflow '${input.workflowId}'`;
      case "system.workflow.disable":
        return `Disabled workflow '${input.workflowId}'`;
      case "system.workflow.setPolicy":
        return `Set policy for workflow '${input.workflowId}'`;
      default:
        return `Executed ${actionType}`;
    }
  }

  /**
   * Generate a unique world ID.
   */
  private _generateWorldId(): string {
    return `sysworld_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  }

  /**
   * Create a failed action result.
   */
  private _createFailedResult(
    ctx: SystemExecutionContext,
    error: { code: string; message: string }
  ): ActionResult {
    const errorValue: ErrorValue = {
      code: error.code,
      message: error.message,
      source: { actionId: ctx.proposalId, nodePath: "" },
      timestamp: Date.now(),
    };

    return {
      status: "failed",
      proposalId: ctx.proposalId,
      decisionId: `dec_sys_${Date.now().toString(36)}`,
      error: errorValue,
      worldId: this._currentWorldId,
      runtime: "system",
    };
  }

  /**
   * Notify all subscribers of state change.
   */
  private _notifySubscribers(): void {
    for (const listener of this._subscribers) {
      try {
        listener(this._state);
      } catch {
        // Ignore subscriber errors
      }
    }
  }
}
