/**
 * @fileoverview Types Module Exports
 *
 * All type definitions for Translator.
 */

// Node types
export {
  type IntentNodeId,
  type ResolutionStatus,
  type Resolution,
  type IntentNode,
  type MissingRole,
  VALID_MISSING_ROLES,
  createNodeId,
} from "./node.js";

// Graph types
export { type IntentGraph, type GraphMeta } from "./graph.js";

// Lowering types
export {
  type LoweringStatus,
  type LoweringFailureReason,
  type LoweringResult,
  type InvocationStep,
} from "./lowering.js";

// Output types
export {
  type DependencyEdge,
  type InvocationPlan,
  type MelCandidate,
  type BundleMeta,
  type ManifestoBundle,
} from "./output.js";

// Options types
export {
  type SnapshotLike,
  type TranslatorResolver,
  type LLMOptions,
  type DecomposeStrategy,
  type DecomposeOptions,
  type TranslateMode,
  type TranslateOptions,
  type TranslateWarning,
  type TranslateResult,
  type EmitContext,
  type ValidationContext,
} from "./options.js";

// Error types
export {
  type TranslatorErrorCode,
  TranslatorError,
  type ValidationWarning,
  type ValidationResult,
} from "./errors.js";
