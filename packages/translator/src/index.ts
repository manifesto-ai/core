/**
 * @fileoverview Translator App Public API
 *
 * Transforms natural language (PF) into IntentBody via IntentIR.
 *
 * @packageDocumentation
 * @module @manifesto-ai/translator
 * @version 0.1.0
 */

// =============================================================================
// Types
// =============================================================================

// State & Request Types
export type {
  SimKeyHex,
  PathKeyHex,
  TranslatorState,
  TranslatorConfig,
  TranslateRequest,
  TranslateResult,
  TranslateSuccessResult,
  TranslateAmbiguousResult,
  TranslateUnresolvedResult,
  TranslateErrorResult,
  LoweringResult,
  ResolvedResult,
  AmbiguousResult,
  UnresolvedResult,
  LoweringEvidence,
  MissingInfo,
  FieldMapping,
  ResolutionRecord,
  LexiconSource,
  AmbiguityCandidate,
  AmbiguityReason,
} from "./types/index.js";

// Action Types
export type {
  TranslateInput,
  TranslateOutput,
  LowerInput,
  LowerOutput,
  ResolveInput,
  ResolveOutput,
  LearnInput,
  LearnOutput,
  Resolution,
  SelectResolution,
  ProvideResolution,
  CancelResolution,
  ConfirmMapping,
  DirectMapping,
} from "./types/index.js";

// Lexicon Types
export type {
  LearnedEntry,
  LearnedAliasEntry,
  LearnedCloneEntry,
  PendingMapping,
  MappingSource,
} from "./types/index.js";

// Error Types
export type {
  TranslatorErrorCode,
  TranslatorError,
} from "./types/index.js";

// Action Body Types
export type {
  ActionBody,
  GuardedBlock,
  ActionStmt,
  ExprNode,
  ActionBodyViolation,
} from "./types/index.js";

// Error Factory
export { createError } from "./types/index.js";

// Type Guards
export {
  isOnceGuard,
  isWhenGuard,
  isPatchStmt,
  isEffectStmt,
  isNestedBlock,
  isValidMarkerValue,
  isSysExpr,
  isSuccessResult,
  isAmbiguousResult,
  isUnresolvedResult,
  isErrorResult,
  isResolvedLoweringResult,
  isSelectResolution,
  isProvideResolution,
  isCancelResolution,
  isConfirmMapping,
  isDirectMapping,
  isAliasEntry,
  isCloneEntry,
} from "./types/index.js";

// State Factory
export {
  createInitialState,
  DEFAULT_CONFIG,
} from "./types/index.js";

// =============================================================================
// Keys
// =============================================================================

export {
  serializeSimKey,
  deserializeSimKey,
  isValidSimKeyHex,
} from "./keys/index.js";

// =============================================================================
// Lexicon
// =============================================================================

export {
  createBuiltinLexicon,
  deriveProjectLexicon,
  createLearnedLexicon,
  createCompositeLexicon,
  determineLexiconSource,
} from "./lexicon/index.js";

// =============================================================================
// Pipeline
// =============================================================================

// S1: Normalize
export {
  type NormalizeResult,
  type NormalizeTrace,
  normalize,
  createNormalizeTrace,
} from "./pipeline/index.js";

// S2: Propose
export {
  type ProposeInput,
  type ProposeResult,
  type ProposeTrace,
  propose,
  createProposeTrace,
} from "./pipeline/index.js";

// LLM Client
export {
  type ProposeRequest,
  type ProposeResponse,
  type LLMClient,
  MockLLMClient,
  createMockLLMClient,
} from "./pipeline/index.js";

// S3: Canonicalize
export {
  type CanonicalizeResult,
  type CanonicalizeTrace,
  canonicalize,
  createCanonicalizeTrace,
  areSemanticallySame,
} from "./pipeline/index.js";

// S4: Feature Check
export {
  type FeatureCheckResult,
  type FeatureCheck,
  type FeatureCheckTrace,
  featureCheck,
  createFeatureCheckTrace,
} from "./pipeline/index.js";

// S5: Resolve References
export {
  type ResolveStageOutput,
  type ResolutionContext,
  type ResolveStageTrace,
  buildResolutionContext,
  resolveReferences,
  createResolveStageTrace,
  countSymbolicRefs,
} from "./pipeline/index.js";

// S6: Lower
export {
  type LowerStageResult,
  type LowerTrace,
  lowerIR,
  createLowerTrace,
  isResolved,
} from "./pipeline/index.js";

// S7: Validate Action Body
export {
  type ValidateActionBodyResult,
  type ValidateActionBodyTrace,
  isActionRelatedLemma,
  validateActionBody,
  extractActionBody,
  createValidateActionBodyTrace,
} from "./pipeline/index.js";

// =============================================================================
// Actions
// =============================================================================

// Translate Action
export {
  type TranslateContext,
  translate,
} from "./actions/index.js";

// Lower Action
export {
  type LowerContext,
  lower,
} from "./actions/index.js";

// Resolve Action
export {
  type ResolveContext,
  resolve,
  findRequest,
  findAmbiguousRequests,
  findUnresolvedRequests,
} from "./actions/index.js";

// Learn Action
export {
  type LearnContext,
  type LearnActionResult,
  learn,
  findLearnedEntry,
  findEntriesByTargetLemma,
  removeLearnedEntry,
  listLearnedEntries,
  findPendingMapping,
  listPendingMappings,
} from "./actions/index.js";
