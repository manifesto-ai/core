/**
 * Execution Module
 *
 * This module provides the bridge between @manifesto-ai/app and @manifesto-ai/host.
 *
 * @module
 */

// Adapter
export {
  adaptServiceToEffect,
  adaptServiceMap,
  createPatchHelpers,
  normalizeServiceReturn,
  snapshotToServiceSnapshot,
  type AdapterContextValues,
  type AdapterOptions,
} from "./adapter.js";

// Result Mapper
export {
  mapHostResultToActionResult,
  hostErrorToErrorValue,
  errorToErrorValue,
  calculateStats,
  extractSnapshotError,
  type MapResultOptions,
} from "./result-mapper.js";

// Domain Executor
export {
  DomainExecutor,
  createDomainExecutor,
  type ExecuteActionInput,
  type ExecuteActionOutput,
  type DomainExecutorOptions,
} from "./domain-executor.js";
