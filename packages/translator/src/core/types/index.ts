/**
 * @fileoverview Core Types Module Exports
 *
 * All type definitions for Translator v1.0.
 * Per SPEC Section 5.
 *
 * @module core/types
 */

// =============================================================================
// Chunk Types (SPEC 5.1)
// =============================================================================

export {
  type Span,
  type Chunk,
  createChunk,
  spansOverlap,
  hasOverlappingChunks,
} from "./chunk.js";

// =============================================================================
// Intent Graph Types (SPEC 5.2)
// =============================================================================

export {
  type Role,
  type ResolutionStatus,
  type Resolution,
  type IntentNode,
  type IntentGraph,
  isResolved,
  isAbstract,
  getNodeIds,
  buildNodeMap,
} from "./intent-graph.js";

// =============================================================================
// ExecutionPlan Types (SPEC 5.3)
// =============================================================================

export {
  type ExecutionStep,
  type DependencyEdge,
  type ExecutionPlan,
} from "./execution-plan.js";

// =============================================================================
// Validation Types (SPEC 5.4)
// =============================================================================

export {
  type ValidationErrorCode,
  type ValidationErrorInfo,
  type ValidationWarning,
  type ValidationResult,
  validResult,
  invalidResult,
  isValid,
} from "./validation.js";

// =============================================================================
// Diagnostics Types (SPEC 5.5)
// =============================================================================

export {
  type Diagnostic,
  type DiagnosticsBag,
  type DiagnosticsReadonly,
  calculateObservationStats,
} from "./diagnostics.js";

// =============================================================================
// ExtensionCandidate Types (SPEC 5.6)
// =============================================================================

export {
  type ExtensionCandidateKind,
  type ExtensionCandidate,
  type MelCandidatePayload,
  isMelCandidate,
} from "./extension-candidate.js";

// =============================================================================
// Error Types (SPEC 13)
// =============================================================================

export {
  type PipelinePhase,
  type LLMErrorCode,
  TranslatorError,
  PipelineError,
  ValidationException,
  LLMError,
  OverlapSafetyError,
  InspectorGraphReturnError,
} from "./errors.js";
