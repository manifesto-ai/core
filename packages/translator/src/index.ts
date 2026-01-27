/**
 * @manifesto-ai/translator
 *
 * Semantic bridge from natural language to Intent Graph.
 *
 * Architecture:
 * - Natural Language → Intent Graph → ManifestoBundle
 * - Composes with @manifesto-ai/intent-ir v0.1
 * - No runtime dependency on Core/Host/World/App
 *
 * Key Principles:
 * 1. Independence is sacred - no runtime coupling
 * 2. Composition over replacement - Intent IR is wrapped, not superseded
 * 3. Measurement is pure - ambiguity is scored, not judged
 * 4. Lowering is deferrable - discourse refs may resolve at execution time
 * 5. Graphs are acyclic - cycles are errors, not features
 *
 * @packageDocumentation
 */

// =============================================================================
// Version
// =============================================================================

export { TRANSLATOR_VERSION, TRANSLATOR_SPEC_VERSION } from "./constants.js";

// =============================================================================
// Types
// =============================================================================

export * from "./types/index.js";

// =============================================================================
// Public API
// =============================================================================

// translate() - Natural Language → Intent Graph
export { translate } from "./translate/index.js";

// validate() - Lexicon-verified validation
export { validateWithLexicon as validate } from "./validate/index.js";

// emitForManifesto() - Intent Graph → ManifestoBundle
export { emitForManifesto } from "./emit/index.js";

// =============================================================================
// Validation Utilities
// =============================================================================

export {
  validateStructural,
  isStructurallyValid,
  type StructuralValidationResult,
} from "./validate/index.js";

// =============================================================================
// Invariant Checks
// =============================================================================

export {
  // I1: Causal Integrity
  checkCausalIntegrity,
  hasCycle,
  type CycleCheckResult,
  // I2: Referential Identity
  checkReferentialIdentity,
  isReferentialIdentityValid,
  checkEntityTypeConsistency,
  type ReferentialIdentityCheckResult,
  type EntityTypeConflict,
  type EntityTypeConsistencyResult,
  // I3: Conceptual Completeness
  checkCompleteness,
  isCompletenessValid,
  type CompletenessCheckResult,
  // I4: Intent Statefulness
  checkStatefulness,
  isStatefulnessValid,
  type StatefulnessCheckResult,
  type StatefulnessWarning,
  // C-ABS-1: Abstract Dependency Constraint
  checkAbstractDependency,
  isAbstractDependencyValid,
  type AbstractDependencyCheckResult,
} from "./invariants/index.js";

// =============================================================================
// Emit Utilities
// =============================================================================

export { topologicalSort, type TopologicalSortResult } from "./emit/index.js";

// =============================================================================
// LLM Providers
// =============================================================================

export {
  createOpenAIProvider,
  createStubProvider,
  type LLMProvider,
  type LLMProviderConfig,
  type LLMTranslateRequest,
  type LLMTranslateResponse,
  type LLMIntentNode,
  type LLMMetrics,
  type AmbiguityIndicators,
} from "./llm/index.js";

// =============================================================================
// Decompose Layer (ADR-003)
// =============================================================================

export {
  type DecomposeStrategy,
  type DecomposeResult,
  type MergeOptions,
  type MergeResult,
  type ShallowLLMConfig,
  DeterministicDecompose,
  ShallowLLMDecompose,
  conservativeMerge,
} from "./decompose/index.js";
