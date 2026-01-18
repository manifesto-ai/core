/**
 * @manifesto-ai/host v2.0.2
 *
 * Manifesto Host - Effect execution runtime for @manifesto-ai/core
 *
 * The Host orchestrates the execution of Manifesto intents using
 * the event-loop execution model with Mailbox + Runner + Job architecture.
 *
 * @see host-SPEC-v2.0.2.md
 */

// Host
export { ManifestoHost, createHost, type HostOptions, type HostResult } from "./host.js";

// v2.0.2 Execution Model
export type {
  ExecutionKey,
  Runtime,
  ExecutionContext,
  ExecutionContextOptions,
} from "./types/execution.js";
export { defaultRuntime } from "./types/execution.js";

export type {
  JobType,
  Job,
  StartIntentJob,
  ContinueComputeJob,
  FulfillEffectJob,
  ApplyPatchesJob,
} from "./types/job.js";
export {
  generateJobId,
  createStartIntentJob,
  createContinueComputeJob,
  createFulfillEffectJob,
  createApplyPatchesJob,
} from "./types/job.js";

export type { TraceEvent } from "./types/trace.js";

// Host-owned state namespace (v2.0.2)
export type { HostOwnedState, IntentSlot } from "./types/host-state.js";
export { getHostState, getIntentSlot } from "./types/host-state.js";

// Mailbox
export {
  type ExecutionMailbox,
  DefaultExecutionMailbox,
  createMailbox,
  MailboxManager,
  createMailboxManager,
} from "./mailbox.js";

// Runner
export {
  type RunnerState,
  createRunnerState,
  processMailbox,
  kickRunner,
  enqueueAndKick,
  isRunnerActive,
  isKickPending,
} from "./runner.js";

// Context Provider
export {
  type HostContextProviderOptions,
  type HostContextProvider,
  DefaultHostContextProvider,
  createHostContextProvider,
  createTestHostContextProvider,
} from "./context-provider.js";

// Execution Context
export {
  type ExecutionContextImplOptions,
  ExecutionContextImpl,
  createExecutionContext,
} from "./execution-context.js";

// Job Handlers
export {
  runJob,
  handleStartIntent,
  handleContinueCompute,
  handleFulfillEffect,
  handleApplyPatches,
} from "./job-handlers/index.js";

// Effects
export {
  // Types
  type EffectHandler,
  type EffectHandlerOptions,
  type EffectContext,
  type EffectResult,
  type RegisteredHandler,
  // Registry
  EffectHandlerRegistry,
  createEffectRegistry,
  // Executor
  EffectExecutor,
  createEffectExecutor,
} from "./effects/index.js";

// Errors
export { HostError, createHostError, isHostError, type HostErrorCode } from "./errors.js";

// Re-export commonly used types from core for convenience
export {
  createIntent,
  createSnapshot,
  type Intent,
  type Snapshot,
  type DomainSchema,
  type Patch,
  type ComputeResult,
  type Requirement,
  type TraceGraph,
} from "@manifesto-ai/core";
