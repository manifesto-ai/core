/**
 * @manifesto-ai/llm-babybench
 *
 * LLM-BabyBench: Manifesto-based BabyAI Benchmark
 *
 * Uses Manifesto World for governance and Host for effect execution.
 *
 * @example
 * ```typescript
 * import { createTask, runTask, loadDataset } from '@manifesto-ai/llm-babybench';
 * import { createBFSActor } from '@manifesto-ai/llm-babybench/actors';
 *
 * const rows = await loadDataset('plan', { limit: 10 });
 * const actor = createBFSActor();
 *
 * for (const row of rows) {
 *   const task = createTask(row, 'plan');
 *   const result = await runTask(task, actor);
 *   console.log(result);
 * }
 * ```
 */

// =============================================================================
// Domain
// =============================================================================

export { BabyAIDomain } from "./domain/index.js";
export type { BabyAIState, BabyAIAction } from "./domain/index.js";
export {
  BabyAIStateSchema,
  BabyAIActionSchema,
  GridSchema,
  AgentSchema,
  WorldObjectSchema,
} from "./domain/index.js";
export type { Grid, Agent, WorldObject, CellType } from "./domain/index.js";

// =============================================================================
// Bench
// =============================================================================

export {
  createBenchWorld,
  createTaskSnapshot,
  registerActor,
  runTask,
  createTask,
  effectHandlers,
} from "./bench/index.js";
export type {
  BenchWorld,
  BenchTask,
  TaskResult,
  Actor,
  ActorProposal,
  TaskContext,
} from "./bench/index.js";

// =============================================================================
// Actors
// =============================================================================

export {
  createBFSActor,
  createLLMActor,
  createHybridActor,
} from "./actors/index.js";
export type {
  BFSActorOptions,
  LLMActorOptions,
  HybridActorOptions,
} from "./actors/index.js";

// =============================================================================
// Dataset
// =============================================================================

export {
  loadDataset,
  loadRow,
  getDatasetMetadata,
  clearCache,
  isCached,
  downloadDataset,
  parseInitialState,
  parseEnvDescription,
  parseActionSequence,
  isValidAction,
  directionToNumber,
} from "./dataset/index.js";
export type {
  DatasetConfig,
  BabyBenchRow,
  DatasetLoadOptions,
  DatasetMetadata,
  ParsedEnvironment,
  ParsedInitialState,
} from "./dataset/index.js";
