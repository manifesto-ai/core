/**
 * @manifesto-ai/compiler
 *
 * Manifestify Compiler - Transform code and natural language into Manifesto Fragments
 *
 * This compiler transforms various inputs (code, natural language, existing fragments)
 * into composable Manifesto Fragments, then links them into valid Manifesto Domains
 * with deterministic verification and patch-first editing support.
 */

// ============================================================================
// Types
// ============================================================================

// Re-export all types
export * from './types/index.js';

// ============================================================================
// Fragment Module
// ============================================================================

export {
  // Stable ID generation
  generateStableFragmentId,
  generateRandomFragmentId,
  generateOriginHash,
  fragmentIdMatchesKind,
  extractKindFromFragmentId,
  regenerateFragmentIdIfNeeded,
  // Fragment creation
  COMPILER_VERSION,
  createSchemaFragment,
  createSourceFragment,
  createExpressionFragment,
  createDerivedFragment,
  createPolicyFragment,
  createEffectFragment,
  createActionFragment,
  createStatementFragment,
  cloneFragment,
  updateFragmentRequires,
  addEvidence,
  setConfidence,
  // Types
  type CreateFragmentOptions,
  type CreateSchemaFragmentOptions,
  type CreateSourceFragmentOptions,
  type CreateExpressionFragmentOptions,
  type CreateDerivedFragmentOptions,
  type CreatePolicyFragmentOptions,
  type CreateEffectFragmentOptions,
  type CreateActionFragmentOptions,
  type CreateStatementFragmentOptions,
} from './fragment/index.js';

// ============================================================================
// Utils Module (to be implemented)
// ============================================================================

// export * from './utils/index.js';

// ============================================================================
// Pass Module (Phase 1)
// ============================================================================

export {
  // Finding types
  type FindingKind,
  type Finding,
  type FindingData,
  type VariableDeclarationData,
  type FunctionDeclarationData,
  type FunctionCallData,
  type AssignmentData,
  type IfStatementData,
  type BinaryExpressionData,
  type TypeAnnotationData,
  type NLEntityData,
  type NLActionData,
  type NLConditionData,
  type UnknownData,
  // Context
  type PassContext,
  // Pass interfaces
  type Pass,
  type NLPass,
  type PassResult,
  // Registry
  PassRegistry,
  PassExecutor,
  type ExecutePassOptions,
  type ExecuteResult,
  // Helpers
  isNLPass,
  createFindingId,
  createPassContext,
  createPassRegistry,
  createPassExecutor,
} from './pass/index.js';

// ============================================================================
// Linker Module
// ============================================================================

// Re-export linker (some types may override types/index.ts definitions)
export * from './linker/index.js';

// ============================================================================
// Verifier Module
// ============================================================================

// Re-export verifier (some types may override types/index.ts definitions)
export * from './verifier/index.js';

// ============================================================================
// Patch Module
// ============================================================================

export * from './patch/index.js';

// ============================================================================
// Runtime Module
// ============================================================================

export {
  compilerDomain,
  getInitialCompilerData,
  getInitialCompilerState,
  type CompilerData,
  type CompilerState,
} from './runtime/index.js';

// ============================================================================
// Session Module
// ============================================================================

export { createCompilerSession } from './session.js';

// ============================================================================
// LLM Module (P1-B)
// ============================================================================

export {
  // Adapters
  createAnthropicAdapter,
  createOpenAIAdapter,
  // Utilities
  hashPrompt,
  RateLimiter,
  withRetry,
  parseJSON,
  parseJSONArray,
  RetryableError,
  // Prompts
  buildSystemPrompt,
  buildUserPrompt,
  buildMessages,
  // Types
  type AnthropicAdapterConfig,
  type OpenAIAdapterConfig,
  type BaseLLMConfig,
  type RateLimiterConfig,
  type RetryConfig,
  type ParseResult,
} from './llm/index.js';

// ============================================================================
// Safety Module (PRD 6.9)
// ============================================================================

export {
  // HITL Gate
  HITLGate,
  createHITLGate,
  checkFragmentsForHITL,
  generateHITLIssues,
  compareRiskLevels,
  isRiskAtLeast,
  // Allowlist Validator
  validateAllowlist,
  generateAllowlistIssues,
  hasAllowlistViolations,
  type AllowlistViolation,
} from './safety/index.js';

// ============================================================================
// Pipeline Module (TRD 1.5)
// ============================================================================

export {
  // Fragment compilation
  compileFragmentsFromArtifacts,
  type CompileFragmentsOptions,
  type CompileFragmentsResult,
  // Full pipeline
  runCompilePipeline,
  type PipelineOptions,
  type PipelineResult,
  // Provenance
  buildProvenanceMap,
  type ProvenanceMap,
} from './pipeline/index.js';

// ============================================================================
// Main Compiler
// ============================================================================

export { createCompiler } from './compiler.js';
