/**
 * Translator type exports
 */

// Common types
export type { SemanticPath, LanguageCode, FallbackBehavior } from "./common.js";

// Token types
export type { Token } from "./token.js";

// Glossary types
export type { GlossaryEntry, GlossaryHit } from "./glossary.js";

// Type system types
export type {
  ObjectTypeField,
  TypeExpr,
  ResolvedType,
  TypeIndex,
  PathNode,
  ExprNode,
} from "./type-system.js";

// Fragment types
export type {
  FragmentPatch,
  FragmentConstraint,
  FragmentAddField,
  FragmentRemoveField,
  FragmentAddComputed,
  FragmentAddType,
  FragmentSetFieldType,
  FragmentChange,
  PatchFragment,
} from "./fragment.js";

// Request types
export type { TranslationOptions, TranslationRequest } from "./request.js";
export { DEFAULT_TRANSLATION_OPTIONS } from "./request.js";

// Normalization types
export type {
  ProtectedSpanKind,
  ProtectedSpan,
  NormalizationResult,
} from "./normalization.js";

// Fast path types
export type { FastPathPatternName, FastPathResult } from "./fast-path.js";

// Retrieval types
export type {
  RetrievalTier,
  MatchType,
  AnchorCandidate,
  RetrievalResult,
} from "./retrieval.js";

// Proposal types
export type {
  AmbiguityKind,
  ResolutionOption,
  AmbiguityReport,
  ProposalResult,
  ResolutionDecision,
  ResolutionSelection,
} from "./proposal.js";

// Result types
export type {
  TranslationResultFragment,
  TranslationResultAmbiguity,
  TranslationResultDiscarded,
  TranslationResult,
} from "./result.js";

// State types
export type { TranslatorState, PipelineStage } from "./state.js";
