/**
 * System Action Executor
 *
 * Extracted from ManifestoApp._executeSystemAction() per ADR-004 Phase 2.
 * Handles the full lifecycle of system.* actions.
 *
 * @see SPEC §16 System Runtime Model
 * @see ADR-004 §2.3
 * @module
 */

import type {
  ActOptions,
  AppConfig,
  SystemActionType,
} from "@manifesto-ai/shared";
import type { ActionHandleImpl } from "./action/index.js";
import type { SystemRuntime } from "../runtime/system/index.js";
import type { LifecycleManager } from "../core/lifecycle/index.js";

// =============================================================================
// Dependencies
// =============================================================================

/**
 * SystemActionExecutor dependencies.
 */
export interface SystemActionExecutorDeps {
  config: Pick<AppConfig, "systemActions">;
  lifecycleManager: LifecycleManager;
  systemRuntime: SystemRuntime;
  defaultActorId: string;
}

// =============================================================================
// Interface
// =============================================================================

/**
 * System Action Executor interface.
 *
 * @see SPEC §16 SYSRT-1
 */
export interface SystemActionExecutor {
  execute(
    handle: ActionHandleImpl,
    actionType: SystemActionType,
    input: unknown,
    opts?: ActOptions
  ): Promise<void>;
}

// =============================================================================
// Implementation
// =============================================================================

/**
 * System Action Executor implementation.
 *
 * Orchestrates system action lifecycle:
 * 1. Configuration validation (disabled check)
 * 2. Hook emission & phase transitions
 * 3. SystemRuntime execution
 * 4. Result handling & completion
 * 5. Exception handling
 *
 * @see ADR-004 §2.3
 */
export class SystemActionExecutorImpl implements SystemActionExecutor {
  private _deps: SystemActionExecutorDeps;

  constructor(deps: SystemActionExecutorDeps) {
    this._deps = deps;
  }

  async execute(
    handle: ActionHandleImpl,
    actionType: SystemActionType,
    input: unknown,
    opts?: ActOptions
  ): Promise<void> {
    const actorId = opts?.actorId ?? this._deps.defaultActorId;

    if (this._deps.config.systemActions?.enabled === false) {
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

    const disabledActions = this._deps.config.systemActions?.disabled ?? [];
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
      await this._deps.lifecycleManager.emitHook("action:preparing", {
        proposalId: handle.proposalId,
        actorId: this._deps.defaultActorId,
        type: actionType,
        runtime: "system",
      }, {});

      handle._transitionTo("preparing");
      handle._transitionTo("submitted");
      handle._transitionTo("evaluating");
      handle._transitionTo("approved");
      handle._transitionTo("executing");

      const result = await this._deps.systemRuntime.execute(
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

        await this._deps.lifecycleManager.emitHook("system:world", {
          type: actionType,
          proposalId: handle.proposalId,
          actorId,
          systemWorldId: result.worldId,
          status: "completed",
        }, {});
      } else if (result.status === "failed") {
        handle._transitionTo("failed", { kind: "failed", error: result.error });
        handle._setResult(result);

        await this._deps.lifecycleManager.emitHook("system:world", {
          type: actionType,
          proposalId: handle.proposalId,
          actorId,
          systemWorldId: result.worldId,
          status: "failed",
        }, {});
      }

      await this._deps.lifecycleManager.emitHook("action:completed", {
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
        worldId: this._deps.systemRuntime.head(),
        runtime: "system" as const,
      };

      handle._setResult(result);

      await this._deps.lifecycleManager.emitHook("action:completed", {
        proposalId: handle.proposalId,
        result,
      }, {});
    }
  }
}

// =============================================================================
// Factory
// =============================================================================

/**
 * Create a SystemActionExecutor.
 */
export function createSystemActionExecutor(
  deps: SystemActionExecutorDeps
): SystemActionExecutor {
  return new SystemActionExecutorImpl(deps);
}
