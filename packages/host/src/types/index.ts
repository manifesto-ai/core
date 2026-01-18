/**
 * Type exports for Host v2.0.2
 */

export type {
  ExecutionKey,
  Runtime,
  ExecutionContext,
  ExecutionContextOptions,
} from "./execution.js";
export { defaultRuntime } from "./execution.js";

export type {
  JobType,
  Job,
  StartIntentJob,
  ContinueComputeJob,
  FulfillEffectJob,
  ApplyPatchesJob,
} from "./job.js";
export {
  generateJobId,
  createStartIntentJob,
  createContinueComputeJob,
  createFulfillEffectJob,
  createApplyPatchesJob,
} from "./job.js";

export type { TraceEvent } from "./trace.js";

// Host-owned state namespace (v2.0.2)
export type { HostOwnedState, IntentSlot } from "./host-state.js";
export { getHostState, getIntentSlot } from "./host-state.js";
