/**
 * Execution Module
 *
 * This module provides the bridge between @manifesto-ai/app and @manifesto-ai/host.
 *
 * @module
 */

// Result Mapper
export {
  mapHostResultToActionResult,
  hostErrorToErrorValue,
  errorToErrorValue,
  calculateStats,
  extractSnapshotError,
  type MapResultOptions,
} from "./result-mapper.js";

// State Converter
export {
  snapshotToAppState,
  appStateToSnapshot,
  computePatches,
  computeSnapshotHash,
} from "./state-converter.js";

// Action Queue
export {
  type ActionJob,
  type ActionQueue,
  ActionQueueImpl,
  createActionQueue,
} from "./action-queue.js";

// Liveness Guard
export {
  type RuntimeKind,
  type LivenessGuard,
  LivenessGuardImpl,
  createLivenessGuard,
} from "./liveness-guard.js";

// App Executor
export {
  type AppExecutorDependencies,
  type AppExecutor,
  AppExecutorImpl,
  createAppExecutor,
} from "./executor.js";

// Action
export * from "./action/index.js";

// Host Executor
export * from "./host-executor/index.js";

// Initializer
export * from "./initializer/index.js";

// Proposal
export * from "./proposal/index.js";
