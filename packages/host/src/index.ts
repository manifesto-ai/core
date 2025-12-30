/**
 * @manifesto-ai/host
 *
 * Manifesto Host - Effect execution runtime for @manifesto-ai/core
 *
 * The Host orchestrates the execution of Manifesto intents,
 * handling effects and managing the compute-effect-resume cycle.
 */

// Host
export { ManifestoHost, createHost, type HostOptions, type HostResult } from "./host.js";

// Loop
export { runHostLoop, type HostLoopOptions, type HostLoopResult } from "./loop.js";

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

// Persistence
export {
  type SnapshotStore,
  type SnapshotStoreWithHistory,
  MemorySnapshotStore,
  createMemoryStore,
} from "./persistence/index.js";

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
