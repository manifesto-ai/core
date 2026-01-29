/**
 * @fileoverview Pipeline Module Exports
 *
 * Pipeline orchestration for Translator v1.0.
 * Per SPEC Section 7.
 *
 * @module pipeline
 */

// =============================================================================
// TranslatorPipeline
// =============================================================================

export {
  TranslatorPipeline,
  type PipelineOptions,
  type PipelineResult,
} from "./pipeline.js";

// =============================================================================
// ParallelExecutor
// =============================================================================

export {
  ParallelExecutor,
  type ParallelExecutorOptions,
  createParallelExecutor,
} from "./parallel-executor.js";

// =============================================================================
// DiagnosticsBag Implementation
// =============================================================================

export { DiagnosticsBagImpl, createDiagnosticsBag } from "./diagnostics-bag.js";

// =============================================================================
// Factory Functions
// =============================================================================

export {
  createDefaultPipeline,
  createContextOverlapPipeline,
  createFastPipeline,
  createTestPipeline,
  createCustomPipeline,
  type CustomPipelineConfig,
} from "./factory.js";
