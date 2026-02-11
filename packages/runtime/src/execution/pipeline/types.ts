/**
 * Pipeline Types
 *
 * Typed stage inputs/outputs for the executor pipeline.
 *
 * @see ADR-004 Phase 3
 * @module
 */

import type { Snapshot, DomainSchema } from "@manifesto-ai/core";
import type { WorldId } from "@manifesto-ai/world";
import type {
  ActOptions,
  ActionResult,
  AppState,
  ErrorValue,
  ExecutionKey,
  Intent,
  HostExecutionResult,
  MemoryFacade,
  PolicyService,
  Proposal,
  RecallRequest,
  World,
  WorldDelta,
  WorldStore,
} from "@manifesto-ai/shared";
import type { ActionHandleImpl } from "../action/index.js";
import type { AppHostExecutor } from "../host-executor/index.js";
import type { LifecycleManager } from "../../core/lifecycle/index.js";
import type { ProposalManager } from "../proposal/index.js";
import type { LivenessGuard } from "../liveness-guard.js";
import type { WorldHeadTracker } from "../../storage/world/index.js";
import type { BranchManager } from "../../storage/branch/index.js";
import type { SubscriptionStore } from "../../runtime/subscription/index.js";

// =============================================================================
// Pipeline Context
// =============================================================================

/**
 * Immutable pipeline inputs — set once at pipeline creation.
 *
 * @see ADR-004 PIPE-CTX-1
 */
export type PipelineInput = {
  readonly handle: ActionHandleImpl;
  readonly actionType: string;
  readonly input: unknown;
  readonly opts?: ActOptions;
  readonly actorId: string;
  readonly branchId: string;
};

/**
 * Output from the Prepare stage.
 */
export type PrepareOutput = {
  readonly proposal: Proposal;
  readonly baseWorldId: WorldId;
  readonly baseWorldIdStr: string;
};

/**
 * Output from the Authorize stage.
 */
export type AuthorizeOutput = {
  readonly decision: { approved: true; scope?: unknown; reason?: string; timestamp: number };
  readonly executionKey: ExecutionKey;
};

/**
 * Output from the Execute stage.
 */
export type ExecuteOutput = {
  readonly execResult: HostExecutionResult;
  readonly baseSnapshot: Snapshot;
  readonly intent: Intent;
};

/**
 * Output from the Persist stage.
 */
export type PersistOutput = {
  readonly newWorldId: WorldId;
  readonly newWorldIdStr: string;
  readonly newWorld: World;
  readonly delta: WorldDelta;
  readonly decisionId: string;
};

/**
 * Pipeline context accumulates typed outputs from each stage.
 *
 * @see ADR-004 PIPE-CTX-2
 */
export type PipelineContext = PipelineInput & {
  prepare?: PrepareOutput;
  authorize?: AuthorizeOutput;
  execute?: ExecuteOutput;
  persist?: PersistOutput;
};

/**
 * Stage result: continue or halt with terminal result.
 *
 * @see ADR-004 PIPE-CTX-3
 */
export type StageResult =
  | { halted: false }
  | { halted: true; result: ActionResult };

// =============================================================================
// Stage Dependency Subsets
// =============================================================================

/**
 * Dependencies for the Prepare stage.
 */
export type PrepareDeps = {
  readonly domainSchema: DomainSchema;
  readonly lifecycleManager: LifecycleManager;
  readonly worldHeadTracker: WorldHeadTracker;
  readonly branchManager: BranchManager;
  readonly subscriptionStore: SubscriptionStore;
};

/**
 * Dependencies for the Authorize stage.
 */
export type AuthorizeDeps = {
  readonly policyService: PolicyService;
  readonly lifecycleManager: LifecycleManager;
  readonly subscriptionStore: SubscriptionStore;
};

/**
 * Dependencies for the Execute stage.
 */
export type ExecuteDeps = {
  readonly worldStore: WorldStore;
  readonly memoryFacade: MemoryFacade;
  readonly hostExecutor: AppHostExecutor;
  readonly policyService: PolicyService;
  readonly schedulerOptions?: { defaultTimeoutMs?: number };
  readonly getCurrentState: () => AppState<unknown>;
};

/**
 * Dependencies for the Persist stage.
 */
export type PersistDeps = {
  readonly domainSchema: DomainSchema;
  readonly worldStore: WorldStore;
  readonly subscriptionStore: SubscriptionStore;
  readonly worldHeadTracker: WorldHeadTracker;
  readonly branchManager: BranchManager;
  readonly proposalManager: ProposalManager;
  readonly lifecycleManager: LifecycleManager;
  readonly getCurrentState: () => AppState<unknown>;
  readonly setCurrentState: (state: AppState<unknown>) => void;
};

/**
 * Dependencies for the Finalize stage.
 */
export type FinalizeDeps = {
  readonly lifecycleManager: LifecycleManager;
  readonly subscriptionStore: SubscriptionStore;
  readonly proposalManager: ProposalManager;
  readonly livenessGuard: LivenessGuard;
  readonly getCurrentState: () => AppState<unknown>;
  readonly setCurrentState: (state: AppState<unknown>) => void;
};
