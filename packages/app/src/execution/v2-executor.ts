/**
 * V2 Executor Module
 *
 * Orchestrates v2 action execution lifecycle.
 *
 * @see SPEC v2.0.0 §5-10
 * @module
 */

import type { DomainSchema, Snapshot, Patch } from "@manifesto-ai/core";
import type { WorldId } from "@manifesto-ai/world";
import { createWorldId, createProposalId } from "@manifesto-ai/world";
import type {
  ActOptions,
  AppState,
  ErrorValue,
  Intent,
  PolicyService,
  Proposal,
  RecallRequest,
  World,
  WorldDelta,
  WorldStore,
} from "../core/types/index.js";
import type { AppHostExecutor } from "./host-executor/index.js";
import type { LifecycleManager } from "../core/lifecycle/index.js";
import type { ProposalManager } from "./proposal/index.js";
import type { LivenessGuard } from "./liveness-guard.js";
import type { WorldHeadTracker } from "../storage/world/index.js";
import type { MemoryFacade } from "../core/types/index.js";
import type { BranchManager } from "../storage/branch/index.js";
import type { SubscriptionStore } from "../runtime/subscription/index.js";
import { ActionHandleImpl } from "./action/index.js";
import { generateWorldId } from "../storage/branch/index.js";
import { freezeRecallResult } from "../runtime/memory/index.js";
import {
  snapshotToAppState,
  appStateToSnapshot,
  computePatches,
  computeSnapshotHash,
} from "./state-converter.js";

// =============================================================================
// Types
// =============================================================================

/**
 * V2 Executor dependencies.
 */
export interface V2ExecutorDependencies {
  domainSchema: DomainSchema;
  defaultActorId: string;
  policyService: PolicyService;
  hostExecutor: AppHostExecutor;
  worldStore: WorldStore;
  lifecycleManager: LifecycleManager;
  proposalManager: ProposalManager;
  livenessGuard: LivenessGuard;
  worldHeadTracker: WorldHeadTracker;
  memoryFacade: MemoryFacade;
  branchManager: BranchManager;
  subscriptionStore: SubscriptionStore;
  schedulerOptions?: { defaultTimeoutMs?: number };
  getCurrentState: () => AppState<unknown>;
  setCurrentState: (state: AppState<unknown>) => void;
}

/**
 * V2 Executor interface.
 */
export interface V2Executor {
  /**
   * Execute a v2 action.
   *
   * @param handle - The action handle
   * @param actionType - The action type
   * @param input - The action input
   * @param opts - Execution options
   */
  execute(
    handle: ActionHandleImpl,
    actionType: string,
    input: unknown,
    opts?: ActOptions
  ): Promise<void>;
}

// =============================================================================
// Implementation
// =============================================================================

/**
 * V2 Executor implementation.
 *
 * Orchestrates the complete v2 action execution lifecycle.
 */
export class V2ExecutorImpl implements V2Executor {
  private _deps: V2ExecutorDependencies;

  constructor(deps: V2ExecutorDependencies) {
    this._deps = deps;
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
   */
  async execute(
    handle: ActionHandleImpl,
    actionType: string,
    input: unknown,
    opts?: ActOptions
  ): Promise<void> {
    const {
      lifecycleManager,
      proposalManager,
      livenessGuard,
      worldHeadTracker,
      subscriptionStore,
      domainSchema,
      defaultActorId,
      policyService,
      hostExecutor,
      worldStore,
      memoryFacade,
      branchManager,
      schedulerOptions,
      getCurrentState,
      setCurrentState,
    } = this._deps;

    // Start transaction for subscription batching
    subscriptionStore.startTransaction();

    const actorId = opts?.actorId ?? defaultActorId;
    const branchId = opts?.branchId ?? branchManager?.currentBranchId ?? "main";

    // ==== Liveness Guard: Track current executing proposal ====
    livenessGuard.enterExecution(handle.proposalId);

    try {
      // ==== Phase 1: preparing ====
      await lifecycleManager.emitHook(
        "action:preparing",
        {
          proposalId: handle.proposalId,
          actorId,
          branchId,
          type: actionType,
          runtime: "domain" as const,
        },
        { actorId, branchId }
      );

      handle._transitionTo("preparing");

      // Validate action type exists
      const actionDef = domainSchema?.actions[actionType];
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
      const baseWorldIdStr = worldHeadTracker.getCurrentHead() ?? branchManager?.currentBranch()?.head() ?? "genesis";
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
      await lifecycleManager.emitHook(
        "action:submitted",
        {
          proposalId: handle.proposalId,
          actorId,
          branchId,
          type: actionType,
          input,
          runtime: "domain" as const,
        },
        { actorId, branchId }
      );

      // ==== Phase 3: evaluating ====
      handle._transitionTo("evaluating");

      // Derive ExecutionKey
      const executionKey = policyService.deriveExecutionKey(proposal);

      // Request approval from PolicyService
      const decision = await policyService.requestApproval(proposal);

      // ==== Phase 4: approved/rejected ====
      if (!decision.approved) {
        handle._transitionTo("rejected", {
          kind: "rejected",
          reason: decision.reason,
        });

        // Emit audit:rejected
        await lifecycleManager.emitHook(
          "audit:rejected",
          {
            operation: actionType,
            reason: decision.reason,
            proposalId: handle.proposalId,
          },
          { actorId, branchId }
        );

        const result = {
          status: "rejected" as const,
          proposalId: handle.proposalId,
          decisionId: `dec_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
          reason: decision.reason,
          runtime: "domain" as const,
        };

        handle._setResult(result);
        subscriptionStore.endTransaction();

        await lifecycleManager.emitHook(
          "action:completed",
          { proposalId: handle.proposalId, result },
          { actorId, branchId }
        );

        return;
      }

      // Approved
      handle._transitionTo("approved");

      // ==== Phase 5: executing ====
      handle._transitionTo("executing");

      // Restore base snapshot from WorldStore
      let baseSnapshot: Snapshot;
      try {
        baseSnapshot = await worldStore.restore(baseWorldId);
      } catch (error) {
        // Fallback to current state if WorldStore fails
        baseSnapshot = appStateToSnapshot(getCurrentState());
      }

      // Handle memory recall if requested
      if (opts?.recall) {
        try {
          const recallRequests = Array.isArray(opts.recall) ? opts.recall : [opts.recall];
          const recallResult = await memoryFacade.recall(
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
      const execResult = await hostExecutor.execute(
        executionKey,
        baseSnapshot,
        intent,
        {
          approvedScope: decision.scope,
          timeoutMs: schedulerOptions?.defaultTimeoutMs,
        }
      );

      // ==== Phase 6: post-validate (optional) ====
      if (decision.scope && policyService.validateResultScope) {
        const scopeValidation = policyService.validateResultScope(
          baseSnapshot,
          execResult.terminalSnapshot,
          decision.scope
        );

        if (!scopeValidation.valid) {
          // Scope violation - treat as failure
          console.warn("[Manifesto] Result scope validation failed:", scopeValidation.errors);
        }
      }

      // ==== Phase 7: store ====
      const newWorldIdStr = generateWorldId();
      const newWorldId = createWorldId(newWorldIdStr);
      const decisionId = `dec_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

      // Compute snapshot hash for the terminal snapshot
      const snapshotHash = computeSnapshotHash(execResult.terminalSnapshot);

      // Create World object
      const newWorld: World = {
        worldId: newWorldId,
        schemaHash: domainSchema?.hash ?? "unknown",
        snapshotHash,
        createdAt: Date.now(),
        createdBy: createProposalId(handle.proposalId),
      };

      // Create WorldDelta
      const delta: WorldDelta = {
        fromWorld: baseWorldId,
        toWorld: newWorldId,
        patches: computePatches(baseSnapshot, execResult.terminalSnapshot),
        createdAt: Date.now(),
      };

      // Store in WorldStore
      try {
        await worldStore.store(newWorld, delta);
      } catch (storeError) {
        console.error("[Manifesto] Failed to store World:", storeError);
        // Continue - execution was successful even if storage failed
      }

      // ==== Phase 8: update ====
      // Update state with terminal snapshot
      const newState = snapshotToAppState(execResult.terminalSnapshot);
      setCurrentState(newState);
      subscriptionStore.notify(newState);

      // BRANCH-7: Only advance head if completed (not failed)
      if (execResult.outcome === "completed") {
        worldHeadTracker.advanceHead(newWorldId);
        branchManager?.appendWorldToBranch(branchId, newWorldId);
      }

      // ==== Phase 8.5: state:publish (exactly once per proposal tick) ====
      if (!proposalManager.wasPublished(handle.proposalId)) {
        proposalManager.markPublished(handle.proposalId);

        const publishSnapshot: Snapshot = {
          data: execResult.terminalSnapshot.data,
          computed: execResult.terminalSnapshot.computed ?? {},
          system: execResult.terminalSnapshot.system ?? {
            status: "idle",
            pendingRequirements: [],
            errors: [],
          },
          input: {},
          meta: execResult.terminalSnapshot.meta ?? {
            version: 0,
            timestamp: new Date().toISOString(),
            hash: "",
          },
        };

        await lifecycleManager.emitHook(
          "state:publish",
          {
            snapshot: publishSnapshot,
            worldId: String(newWorldId),
          },
          { actorId, branchId, worldId: String(newWorldId) }
        );
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
        const currentState = getCurrentState();
        setCurrentState({
          ...currentState,
          system: {
            ...currentState.system,
            lastError: execResult.error ?? null,
            errors: [
              ...currentState.system.errors,
              ...(execResult.error ? [execResult.error] : []),
            ],
          },
        });

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
        await lifecycleManager.emitHook(
          "audit:failed",
          {
            operation: actionType,
            error: execResult.error ?? {
              code: "EXECUTION_FAILED",
              message: "Execution failed",
              source: { actionId: handle.proposalId, nodePath: "" },
              timestamp: Date.now(),
            },
            proposalId: handle.proposalId,
          },
          { actorId, branchId }
        );
      }

      // End transaction
      subscriptionStore.endTransaction();

      // Emit action:completed
      const completedResult = await handle.result();
      await lifecycleManager.emitHook(
        "action:completed",
        { proposalId: handle.proposalId, result: completedResult },
        { actorId, branchId }
      );

      // Cleanup proposal tracking state
      proposalManager.cleanup(handle.proposalId);
      livenessGuard.cleanup(handle.proposalId);

    } catch (error) {
      // Unexpected error
      await this._handleExecutionError(handle, error, actionType, opts);
    } finally {
      // ==== Liveness Guard: Clear current executing proposal ====
      livenessGuard.exitExecution();
    }
  }

  /**
   * Handle preparation failure.
   */
  private async _handlePreparationFailure(
    handle: ActionHandleImpl,
    errorInfo: { code: string; message: string }
  ): Promise<void> {
    const { lifecycleManager, subscriptionStore } = this._deps;

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
    subscriptionStore.endTransaction();

    await lifecycleManager.emitHook(
      "action:completed",
      { proposalId: handle.proposalId, result },
      {}
    );
  }

  /**
   * Handle unexpected execution error.
   */
  private async _handleExecutionError(
    handle: ActionHandleImpl,
    error: unknown,
    actionType: string,
    opts?: ActOptions
  ): Promise<void> {
    const { lifecycleManager, subscriptionStore, defaultActorId, branchManager } = this._deps;

    const actorId = opts?.actorId ?? defaultActorId;
    const branchId = opts?.branchId ?? branchManager?.currentBranchId ?? "main";

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
    subscriptionStore.endTransaction();

    await lifecycleManager.emitHook(
      "audit:failed",
      {
        operation: actionType,
        error: errorValue,
        proposalId: handle.proposalId,
      },
      { actorId, branchId }
    );

    await lifecycleManager.emitHook(
      "action:completed",
      { proposalId: handle.proposalId, result },
      { actorId, branchId }
    );
  }
}

// =============================================================================
// Factory
// =============================================================================

/**
 * Create a new V2Executor instance.
 *
 * @param deps - The executor dependencies
 */
export function createV2Executor(deps: V2ExecutorDependencies): V2Executor {
  return new V2ExecutorImpl(deps);
}
