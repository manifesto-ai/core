/**
 * @fileoverview Types Module Exports
 *
 * Re-exports all Translator App types.
 */

// Error types
export {
  type PipelineStage,
  type TranslatorErrorCode,
  type TranslatorError,
  createError,
  isTranslatorError,
} from "./errors.js";

// Lexicon types
export {
  type MappingSource,
  type PendingMapping,
  type LearnedAliasEntry,
  type LearnedCloneEntry,
  type LearnedEntry,
  isAliasEntry,
  isCloneEntry,
} from "./lexicon.js";

// Action body types
export {
  type PathSegment,
  type PathNode,
  type ExprNode,
  type PatchStmt,
  type EffectStmt,
  type NestedGuardedBlock,
  type ActionStmt,
  type ActionGuard,
  type GuardedBlock,
  type ActionBody,
  type ActionBodyViolation,
  isPatchStmt,
  isEffectStmt,
  isNestedBlock,
  isWhenGuard,
  isOnceGuard,
  isSysExpr,
  isValidMarkerValue,
} from "./action-body.js";

// State types
export {
  type SimKeyHex,
  type PathKeyHex,
  type TranslatorConfig,
  DEFAULT_CONFIG,
  type LexiconSource,
  type FieldMapping,
  type ResolutionRecord,
  type LoweringEvidence,
  type MissingInfo,
  type AmbiguityReason,
  type AmbiguityCandidate,
  type ResolvedResult,
  type AmbiguousResult,
  type UnresolvedResult,
  type LoweringResult,
  type TranslateSuccessResult,
  type TranslateAmbiguousResult,
  type TranslateUnresolvedResult,
  type TranslateErrorResult,
  type TranslateResult,
  type TranslateInput,
  type TranslateRequest,
  type TranslatorState,
  createInitialState,
  isSuccessResult,
  isAmbiguousResult,
  isUnresolvedResult,
  isErrorResult,
  isResolvedLoweringResult,
} from "./state.js";

// Action types
export {
  type TranslateOutput,
  type LowerInput,
  type LowerOutput,
  type SelectResolution,
  type ProvideResolution,
  type CancelResolution,
  type Resolution,
  type ResolveInput,
  type ResolveSuccessOutput,
  type ResolveStillAmbiguousOutput,
  type ResolveStillUnresolvedOutput,
  type ResolveCancelledOutput,
  type ResolveErrorOutput,
  type ResolveOutput,
  type ConfirmMapping,
  type DirectMapping,
  type LearnInput,
  type LearnSuccessOutput,
  type LearnConflictOutput,
  type LearnErrorOutput,
  type LearnOutput,
  isSelectResolution,
  isProvideResolution,
  isCancelResolution,
  isConfirmMapping,
  isDirectMapping,
} from "./actions.js";
