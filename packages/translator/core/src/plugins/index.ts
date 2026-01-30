/**
 * @fileoverview Plugins Module Exports
 *
 * Plugin system for Translator v1.0.
 * Per SPEC Section 8.
 *
 * @module plugins
 */

// =============================================================================
// Plugin Types
// =============================================================================

export {
  type ReadonlyPipelineContext,
  type ChunkHookContext,
  type StandardHook,
  type ChunkHook,
  type TransformerHook,
  type PipelineHooks,
  type PipelinePlugin,
  isInspector,
  isTransformer,
} from "./types.js";

// =============================================================================
// Built-in Plugins
// =============================================================================

export { orDetectorPlugin } from "./or-detector.js";
export { coverageCheckerPlugin } from "./coverage-checker.js";
export { dependencyRepairPlugin } from "./dependency-repair.js";
export { taskEnumerationPlugin } from "./task-enumeration.js";
