/**
 * Action Executor
 *
 * Orchestrates the action lifecycle from act() through completion.
 *
 * @see SPEC §8 Action Execution
 * @module
 */

import type { DomainSchema } from "@manifesto-ai/core";
import type {
  ActOptions,
  ActionPhase,
  AppState,
  CompletedActionResult,
  FailedActionResult,
  PreparationFailedActionResult,
  RejectedActionResult,
  RuntimeKind,
  ErrorValue,
} from "../../core/types/index.js";

import { ActionHandleImpl, generateProposalId } from "./handle.js";

/**
 * Action execution context.
 */
export interface ActionContext {
  /** Domain schema */
  schema: DomainSchema;
  /** Current state getter */
  getState: () => AppState<unknown>;
  /** State setter for updates */
  setState: (state: AppState<unknown>) => void;
  /** Effect map for effect handlers */
  effects: Record<string, unknown>;
  /** Default actor ID */
  defaultActorId: string;
}

/**
 * Execute an action through its lifecycle.
 *
 * @see SPEC §8 ACT-PREP-1~5
 */
export async function executeAction(
  ctx: ActionContext,
  actionType: string,
  input: unknown,
  opts?: ActOptions
): Promise<ActionHandleImpl> {
  const proposalId = generateProposalId();
  const runtime: RuntimeKind = actionType.startsWith("system.") ? "system" : "domain";
  const handle = new ActionHandleImpl(proposalId, runtime);

  // Start execution asynchronously
  queueMicrotask(() => {
    void runActionLifecycle(ctx, handle, actionType, input, opts);
  });

  return handle;
}

/**
 * Run the full action lifecycle.
 *
 * Phases: preparing -> submitted -> approved -> executing -> completed
 *
 * @internal
 */
async function runActionLifecycle(
  ctx: ActionContext,
  handle: ActionHandleImpl,
  actionType: string,
  input: unknown,
  opts?: ActOptions
): Promise<void> {
  try {
    // Phase: preparing
    // ACT-PREP-1: Validate action type exists
    const actionDef = ctx.schema.actions[actionType];
    if (!actionDef) {
      handle._transitionTo("preparation_failed", {
        kind: "preparation_failed",
        error: {
          code: "ACTION_NOT_FOUND",
          message: `Action type '${actionType}' not found in schema`,
          source: { actionId: handle.proposalId, nodePath: "" },
          timestamp: Date.now(),
        },
      });
      handle._setResult(createPreparationFailedResult(handle.proposalId, handle.runtime, {
        code: "ACTION_NOT_FOUND",
        message: `Action type '${actionType}' not found in schema`,
        source: { actionId: handle.proposalId, nodePath: "" },
        timestamp: Date.now(),
      }));
      return;
    }

    // ACT-PREP-2: Validate required effects (check effect types in flow)
    // For now, skip detailed validation - will be enhanced with Host integration

    // ACT-PREP-3~5: Memory recall and trace composition
    // TODO: Implement memory integration in Phase 10

    // Phase: submitted
    handle._transitionTo("submitted");

    // Phase: evaluating (Authority evaluation)
    // For now, auto-approve all actions (Authority integration comes later)
    handle._transitionTo("evaluating");

    // Phase: approved
    handle._transitionTo("approved");

    // Phase: executing
    handle._transitionTo("executing");

    // Execute the action using Host
    // TODO: Full Host integration in later phases
    // For now, simulate successful execution
    const executionResult = await simulateExecution(ctx, actionType, input);

    if (executionResult.success) {
      // Phase: completed
      const worldId = `world_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
      const decisionId = `dec_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

      handle._transitionTo("completed", {
        kind: "completed",
        worldId,
      });

      handle._setResult({
        status: "completed",
        worldId,
        proposalId: handle.proposalId,
        decisionId,
        stats: {
          durationMs: executionResult.durationMs,
          effectCount: executionResult.effectCount,
          patchCount: executionResult.patchCount,
        },
        runtime: handle.runtime,
      } satisfies CompletedActionResult);
    } else {
      // Phase: failed
      handle._transitionTo("failed", {
        kind: "failed",
        error: executionResult.error!,
      });

      const worldId = `world_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
      const decisionId = `dec_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

      handle._setResult({
        status: "failed",
        proposalId: handle.proposalId,
        decisionId,
        error: executionResult.error!,
        worldId,
        runtime: handle.runtime,
      } satisfies FailedActionResult);
    }
  } catch (error) {
    // Unexpected error during execution
    const errorValue: ErrorValue = {
      code: "EXECUTION_ERROR",
      message: error instanceof Error ? error.message : String(error),
      source: { actionId: handle.proposalId, nodePath: "" },
      timestamp: Date.now(),
    };

    handle._transitionTo("failed", {
      kind: "failed",
      error: errorValue,
    });

    const worldId = `world_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    const decisionId = `dec_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

    handle._setResult({
      status: "failed",
      proposalId: handle.proposalId,
      decisionId,
      error: errorValue,
      worldId,
      runtime: handle.runtime,
    } satisfies FailedActionResult);
  }
}

/**
 * Simulate action execution.
 *
 * This is a placeholder until full Host integration.
 * @internal
 */
async function simulateExecution(
  ctx: ActionContext,
  actionType: string,
  input: unknown
): Promise<{
  success: boolean;
  durationMs: number;
  effectCount: number;
  patchCount: number;
  error?: ErrorValue;
}> {
  const startTime = Date.now();

  // Simulate some async work
  await new Promise((resolve) => setTimeout(resolve, 1));

  // For now, all executions succeed
  // Real execution will use Host.runHostLoop()
  return {
    success: true,
    durationMs: Date.now() - startTime,
    effectCount: 0,
    patchCount: 0,
  };
}

/**
 * Create a PreparationFailedActionResult.
 */
function createPreparationFailedResult(
  proposalId: string,
  runtime: RuntimeKind,
  error: ErrorValue
): PreparationFailedActionResult {
  return {
    status: "preparation_failed",
    proposalId,
    error,
    runtime,
  };
}

/**
 * Create a RejectedActionResult.
 */
export function createRejectedResult(
  proposalId: string,
  decisionId: string,
  runtime: RuntimeKind,
  reason?: string
): RejectedActionResult {
  return {
    status: "rejected",
    proposalId,
    decisionId,
    reason,
    runtime,
  };
}
