/**
 * @manifesto-ai/translator v1.0
 *
 * Semantic compiler from natural language to Intent Graph.
 *
 * Architecture (SPEC v1.0.3):
 * - Natural Language -> Intent Graph -> Target Output
 * - Clean Architecture with Strategy Pattern + Ports & Adapters
 * - Composes with @manifesto-ai/intent-ir v0.2
 * - No runtime dependency on Core/Host/World/App
 *
 * Key Principles:
 * 1. Independence is sacred - no runtime coupling
 * 2. Composition over replacement - Intent IR is wrapped, not superseded
 * 3. Measurement is pure - ambiguity is scored, not judged
 * 4. Lowering is target-specific - Core produces graphs; exporters produce execution plans
 * 5. Graphs are acyclic - cycles are errors, not features
 *
 * @packageDocumentation
 */

// =============================================================================
// Version
// =============================================================================

export { TRANSLATOR_VERSION, TRANSLATOR_SPEC_VERSION } from "./constants.js";

// =============================================================================
// Core Types (SPEC Section 5)
// =============================================================================

// Chunk types (5.1)
export type { Span, Chunk } from "./core/types/chunk.js";
export { createChunk, spansOverlap, hasOverlappingChunks } from "./core/types/chunk.js";

// Intent Graph types (5.2)
export type {
  IntentNodeId,
  Role,
  ResolutionStatus,
  Resolution,
  IntentNode,
  GraphMeta,
  IntentGraph,
} from "./core/types/intent-graph.js";
export {
  createNodeId,
  isResolved,
  isAbstract,
  getNodeIds,
  buildNodeMap,
} from "./core/types/intent-graph.js";

// ExecutionPlan types (5.3)
export type {
  ExecutionStep,
  DependencyEdge,
  ExecutionPlan,
} from "./core/types/execution-plan.js";

// Validation types (5.4)
export type {
  ValidationErrorCode,
  ValidationErrorInfo,
  ValidationWarning,
  ValidationResult,
} from "./core/types/validation.js";
export { validResult, invalidResult, isValid } from "./core/types/validation.js";

// Diagnostics types (5.5)
export type {
  Diagnostic,
  DiagnosticsBag,
  DiagnosticsReadonly,
} from "./core/types/diagnostics.js";
export { calculateObservationStats } from "./core/types/diagnostics.js";

// ExtensionCandidate types (5.6)
export type {
  ExtensionCandidateKind,
  ExtensionCandidate,
  MelCandidatePayload,
} from "./core/types/extension-candidate.js";
export { isMelCandidate } from "./core/types/extension-candidate.js";

// Error types (Section 13)
export type { PipelinePhase, LLMErrorCode } from "./core/types/errors.js";
export {
  TranslatorError,
  PipelineError,
  ValidationException,
  LLMError,
  OverlapSafetyError,
  InspectorGraphReturnError,
} from "./core/types/errors.js";

// =============================================================================
// Core Interfaces (SPEC Section 6)
// =============================================================================

// DecomposeStrategy (6.1)
export type {
  DecomposeOptions,
  DecomposeStrategy,
} from "./core/interfaces/decomposer.js";

// TranslateStrategy (6.2)
export type {
  TranslateOptions,
  TranslateStrategy,
} from "./core/interfaces/translator.js";

// MergeStrategy (6.3)
export type { MergeOptions, MergeStrategy } from "./core/interfaces/merger.js";

// LLMPort (Section 9)
export type {
  LLMCallOptions,
  LLMMessage,
  LLMRequest,
  LLMUsage,
  LLMResponse,
  LLMPort,
} from "./core/interfaces/llm-port.js";

// TargetExporter (Section 10)
export type {
  ExportInput,
  TargetExporter,
} from "./core/interfaces/exporter-port.js";
export { exportTo } from "./core/interfaces/exporter-port.js";

// =============================================================================
// Pipeline (SPEC Section 7)
// =============================================================================

export {
  TranslatorPipeline,
  type PipelineOptions,
  type PipelineResult,
  ParallelExecutor,
  type ParallelExecutorOptions,
  createParallelExecutor,
  DiagnosticsBagImpl,
  createDiagnosticsBag,
} from "./pipeline/index.js";

// Factory Functions (7.3)
export {
  createDefaultPipeline,
  createContextOverlapPipeline,
  createFastPipeline,
  createTestPipeline,
  createCustomPipeline,
  type CustomPipelineConfig,
} from "./pipeline/factory.js";

// =============================================================================
// Plugin System (SPEC Section 8)
// =============================================================================

export type {
  ReadonlyPipelineContext,
  ChunkHookContext,
  StandardHook,
  ChunkHook,
  TransformerHook,
  PipelineHooks,
  PipelinePlugin,
} from "./plugins/types.js";
export { isInspector, isTransformer } from "./plugins/types.js";

// Built-in Plugins (8.4)
export {
  orDetectorPlugin,
  coverageCheckerPlugin,
  dependencyRepairPlugin,
  taskEnumerationPlugin,
} from "./plugins/index.js";

// =============================================================================
// Built-in Strategies
// =============================================================================

// Decompose Strategies
export {
  SlidingWindowDecomposer,
  SentenceBasedDecomposer,
} from "./strategies/decompose/index.js";

// Translate Strategies
export {
  LLMTranslator,
  type LLMTranslatorConfig,
  DeterministicTranslator,
  type DeterministicTranslatorConfig,
  type PatternExtractor,
} from "./strategies/translate/index.js";

// Merge Strategies
export {
  ConservativeMerger,
  AggressiveMerger,
} from "./strategies/merge/index.js";

// =============================================================================
// Validation Helpers (SPEC Section 12)
// =============================================================================

export { validateChunks, assertValidChunks } from "./helpers/validate-chunks.js";
export {
  validateGraph,
  assertValidGraph,
  type ValidateGraphOptions,
} from "./helpers/validate-graph.js";
export { buildExecutionPlan } from "./helpers/build-execution-plan.js";

// =============================================================================
// Invariants
// =============================================================================

export {
  checkCausalIntegrity,
  hasCycle,
  type CycleCheckResult,
  checkReferentialIdentity,
  isReferentialIdentityValid,
  checkEntityTypeConsistency,
  type ReferentialIdentityCheckResult,
  type EntityTypeConflict,
  type EntityTypeConsistencyResult,
  checkCompleteness,
  isCompletenessValid,
  type CompletenessCheckResult,
  checkStatefulness,
  isStatefulnessValid,
  type StatefulnessCheckResult,
  type StatefulnessWarning,
  checkAbstractDependency,
  isAbstractDependencyValid,
  type AbstractDependencyCheckResult,
} from "./invariants/index.js";
