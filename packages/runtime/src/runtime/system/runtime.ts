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
  SystemActionType,
} from "@manifesto-ai/shared";
import type { ActorRef } from "@manifesto-ai/world";
import { createSystemSchema, createInitialSystemState } from "./schema.js";
import { SYSTEM_ACTION_TYPES } from "@manifesto-ai/shared";

/**
 * System Runtime configuration.
 */
export interface SystemRuntimeConfig {
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
  private _memoryFacade?: MemoryFacade;

  constructor(config?: SystemRuntimeConfig) {
    // SYSRT-2: System Runtime has its own schema
    this._schema = createSystemSchema();

    // SYSRT-3: Initialize state
    this._state = createInitialSystemState();

    // Create genesis world
    this._currentWorldId = this._generateWorldId();
    this._worldLineage.push(this._currentWorldId);

    // Store memory facade for maintain operations (v0.4.8+)
    if (config?.memoryFacade) {
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

  // ===========================================================================
  // Private Methods
  // ===========================================================================

  /**
   * Execute a system action and return state updates.
   */
  private async _executeAction(
    actionType: SystemActionType,
    input: Record<string, unknown>,
    ctx: SystemExecutionContext
  ): Promise<Partial<SystemRuntimeState>> {
    switch (actionType) {
      case "system.memory.maintain":
        return await this._memoryMaintain(input, ctx);
      default:
        throw new Error(`Unknown system action: ${actionType}`);
    }
  }

  // ===========================================================================
  // Memory Operations
  // ===========================================================================

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
      case "system.memory.maintain":
        return `Maintained memory (${(input.ops as unknown[])?.length ?? 0} ops)`;
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

}
