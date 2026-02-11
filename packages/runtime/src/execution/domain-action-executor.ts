/**
 * Domain Action Executor
 *
 * Orchestrates domain action execution lifecycle via pipeline stages.
 *
 * @see SPEC v2.0.0 §5-10
 * @see ADR-004 Phase 3
 * @module
 */

import type { DomainSchema } from "@manifesto-ai/core";
import type {
  ActOptions,
  AppState,
  ErrorValue,
  PolicyService,
  WorldStore,
  MemoryFacade,
} from "@manifesto-ai/shared";
import type { AppHostExecutor } from "./host-executor/index.js";
import type { LifecycleManager } from "../core/lifecycle/index.js";
import type { ProposalManager } from "./proposal/index.js";
import type { LivenessGuard } from "./liveness-guard.js";
import type { WorldHeadTracker } from "../storage/world/index.js";
import type { BranchManager } from "../storage/branch/index.js";
import type { SubscriptionStore } from "../runtime/subscription/index.js";
import { ActionHandleImpl } from "./action/index.js";
import { generateWorldId } from "../storage/branch/index.js";
import type {
  PipelineContext,
  PrepareDeps,
  AuthorizeDeps,
  ExecuteDeps,
  PersistDeps,
  FinalizeDeps,
} from "./pipeline/types.js";
import { prepare } from "./pipeline/prepare.js";
import { authorize } from "./pipeline/authorize.js";
import { executeHost } from "./pipeline/execute.js";
import { persist } from "./pipeline/persist.js";
import { finalize } from "./pipeline/finalize.js";

// =============================================================================
// Types
// =============================================================================

/**
 * App Executor dependencies.
 */
export interface AppExecutorDependencies {
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
 * App Executor interface.
 */
export interface AppExecutor {
  /**
   * Execute a action.
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
 * App Executor implementation.
 *
 * Orchestrates the complete action execution lifecycle
 * via a 5-stage pipeline (ADR-004 Phase 3).
 */
export class AppExecutorImpl implements AppExecutor {
  private _deps: AppExecutorDependencies;
  private _prepareDeps: PrepareDeps;
  private _authorizeDeps: AuthorizeDeps;
  private _executeDeps: ExecuteDeps;
  private _persistDeps: PersistDeps;
  private _finalizeDeps: FinalizeDeps;

  constructor(deps: AppExecutorDependencies) {
    this._deps = deps;

    // Construct stage dependency subsets once
    this._prepareDeps = {
      domainSchema: deps.domainSchema,
      lifecycleManager: deps.lifecycleManager,
      worldHeadTracker: deps.worldHeadTracker,
      branchManager: deps.branchManager,
      subscriptionStore: deps.subscriptionStore,
    };

    this._authorizeDeps = {
      policyService: deps.policyService,
      lifecycleManager: deps.lifecycleManager,
      subscriptionStore: deps.subscriptionStore,
    };

    this._executeDeps = {
      worldStore: deps.worldStore,
      memoryFacade: deps.memoryFacade,
      hostExecutor: deps.hostExecutor,
      policyService: deps.policyService,
      schedulerOptions: deps.schedulerOptions,
      getCurrentState: deps.getCurrentState,
    };

    this._persistDeps = {
      domainSchema: deps.domainSchema,
      worldStore: deps.worldStore,
      subscriptionStore: deps.subscriptionStore,
      worldHeadTracker: deps.worldHeadTracker,
      branchManager: deps.branchManager,
      proposalManager: deps.proposalManager,
      lifecycleManager: deps.lifecycleManager,
      getCurrentState: deps.getCurrentState,
      setCurrentState: deps.setCurrentState,
    };

    this._finalizeDeps = {
      lifecycleManager: deps.lifecycleManager,
      subscriptionStore: deps.subscriptionStore,
      proposalManager: deps.proposalManager,
      livenessGuard: deps.livenessGuard,
      getCurrentState: deps.getCurrentState,
      setCurrentState: deps.setCurrentState,
    };
  }

  /**
   * Execute action lifecycle via pipeline stages.
   *
   * @see ADR-004 Phase 3
   */
  async execute(
    handle: ActionHandleImpl,
    actionType: string,
    input: unknown,
    opts?: ActOptions
  ): Promise<void> {
    const { subscriptionStore, livenessGuard, defaultActorId, branchManager } = this._deps;

    // Start transaction for subscription batching
    subscriptionStore.startTransaction();

    const actorId = opts?.actorId ?? defaultActorId;
    const branchId = opts?.branchId ?? branchManager?.currentBranchId ?? "main";

    // Liveness Guard: Track current executing proposal
    livenessGuard.enterExecution(handle.proposalId);

    const ctx: PipelineContext = { handle, actionType, input, opts, actorId, branchId };

    try {
      // Stage 1: Prepare
      const prepResult = await prepare(ctx, this._prepareDeps);
      if (prepResult.halted) return;

      // Stage 2: Authorize
      const authResult = await authorize(ctx, this._authorizeDeps);
      if (authResult.halted) return;

      // Stage 3: Execute
      await executeHost(ctx, this._executeDeps);

      // Stage 4: Persist
      await persist(ctx, this._persistDeps);

      // Stage 5: Finalize
      await finalize(ctx, this._finalizeDeps);
    } catch (error) {
      // Unexpected error — catch-all handler
      await this._handleExecutionError(handle, error, actionType, opts);
    } finally {
      // Liveness Guard: Clear current executing proposal
      livenessGuard.exitExecution();
    }
  }

  /**
   * Handle unexpected execution error (catch-all).
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

    handle._setResult(result);
  }
}

// =============================================================================
// Factory
// =============================================================================

/**
 * Create a new AppExecutor instance.
 *
 * @param deps - The executor dependencies
 */
export function createAppExecutor(deps: AppExecutorDependencies): AppExecutor {
  return new AppExecutorImpl(deps);
}
