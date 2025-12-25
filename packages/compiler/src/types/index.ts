/**
 * Type Definitions
 *
 * Central export point for all compiler types.
 */

// Result monad (re-exported from @manifesto-ai/core + compiler errors)
export {
  // Core Result utilities
  type Result,
  ok,
  err,
  isOk,
  isErr,
  map,
  mapErr,
  flatMap,
  all,
  // CompilerError types
  type CompilerErrorCode,
  type CompilerError,
  type FragmentNotFoundError,
  type FragmentAlreadyExistsError,
  type InvalidFragmentKindError,
  type PathNotFoundError,
  type InvalidPathError,
  type SelfReferenceError,
  type DepNotFoundError,
  type DepAlreadyExistsError,
  type CycleDetectedError,
  type MissingDependencyError,
  type ConflictNotFoundError,
  type DuplicateProvidesError,
  type CodebookRequiredError,
  type CodebookMismatchError,
  type AliasNotFoundError,
  type AliasConflictError,
  type AliasWrongStateError,
  type SchemaNotFoundError,
  type FieldNotFoundError,
  type UnknownOperationError,
  type InvalidOperationError,
  type InternalError,
  // Error constructors
  fragmentNotFound,
  fragmentAlreadyExists,
  invalidFragmentKind,
  pathNotFound,
  invalidPath,
  selfReference,
  depNotFound,
  depAlreadyExists,
  cycleDetected,
  missingDependency,
  conflictNotFound,
  duplicateProvides,
  codebookRequired,
  codebookMismatch,
  aliasNotFound,
  aliasConflict,
  aliasWrongState,
  schemaNotFound,
  fieldNotFound,
  unknownOperation,
  invalidOperation,
  internalError,
  // Utilities
  isCompilerError,
  getErrorMessage,
  errorToString,
} from './result.js';

// Artifact types
export {
  type ArtifactId,
  type CodeArtifact,
  type TextArtifact,
  type ManifestoArtifact,
  type Artifact,
  type SelectionSpan,
  type ArtifactSelection,
  type CompileInput,
  isCodeArtifact,
  isTextArtifact,
  isManifestoArtifact,
  createArtifactId,
} from './artifact.js';

// Provenance types
export {
  type CodeSpan,
  type TextSpan,
  type OriginLocation,
  type Provenance,
  type EvidenceKind,
  type Evidence,
  codeOrigin,
  textOrigin,
  generatedOrigin,
  patchOrigin,
  llmOrigin,
  createProvenance,
  createEvidence,
} from './provenance.js';

// Fragment types
export {
  type FragmentId,
  type CompilerVersion,
  type FragmentKind,
  type FragmentBase,
  type SchemaFieldType,
  type SchemaField,
  type SchemaFragment,
  type SourceFragment,
  type ExpressionFragment,
  type DerivedFragment,
  type PolicyFragment,
  type EffectRisk,
  type EffectFragment,
  type ActionFragment,
  type StatementType,
  type StatementFragment,
  type Fragment,
  isSchemaFragment,
  isSourceFragment,
  isExpressionFragment,
  isDerivedFragment,
  isPolicyFragment,
  isEffectFragment,
  isActionFragment,
  isStatementFragment,
} from './fragment.js';

// FragmentDraft types (LLM 출력용)
export {
  type DraftStatus,
  type DraftValidation,
  type DraftValidationError,
  type DraftValidationWarning,
  type FragmentDraftBase,
  type SchemaDraft,
  type SourceDraft,
  type ExpressionDraft,
  type DerivedDraft,
  type PolicyDraft,
  type EffectDraft,
  type ActionDraft,
  type StatementDraft,
  type FragmentDraft,
  type DraftLoweringResult,
  isFragmentDraft,
} from './fragment-draft.js';

// Conflict types
export {
  type ConflictId,
  type ConflictType,
  type Conflict,
  createConflictId,
  duplicateProvidesConflict,
  schemaMismatchConflict,
  semanticMismatchConflict,
  isBlockingConflict,
} from './conflict.js';

// Issue types
export {
  type IssueId,
  type IssueSeverity,
  type IssueCode,
  type Issue,
  createIssueId,
  missingDependencyIssue,
  cyclicDependencyIssue,
  invalidPathIssue,
  invalidPreconditionPathIssue,
  actionVerbRequiredIssue,
  missingProvenanceIssue,
  effectRiskTooHighIssue,
  isBlockingIssue,
  filterIssuesBySeverity,
  getErrorIssues,
  getWarningIssues,
} from './issue.js';

// Patch types
export {
  type PatchId,
  type PatchOp,
  type Patch,
  type PatchHint,
  type ApplyPatchResult,
  createPatchId,
  createPatch,
  replaceExprOp,
  addDepOp,
  removeFragmentOp,
  chooseConflictOp,
  renamePathOp,
  addFragmentOp,
  createPatchHint,
  // Alias PatchOp helpers
  applyAliasOp,
  rejectAliasOp,
  addAliasOp,
  removeAliasOp,
} from './patch.js';

// Codebook types (Semantic Path Aliasing)
export {
  type CodebookId,
  type AliasId,
  type AliasStatus,
  type AliasEntry,
  type Codebook,
  type AliasSuggestion,
  type SimilarityType,
  type CodebookAnalysisResult,
  type CodebookAnalysisStats,
  type AliasHintConfig,
  createCodebookId,
  createAliasId,
  createCodebook,
  createAliasEntry,
  createAliasSuggestion,
  DEFAULT_ALIAS_HINT_CONFIG,
} from './codebook.js';

// Session types
// Note: VerifyResult is exported from verifier/index.ts (more complete)
// Note: PathNormalizationRule is exported from linker/normalizer.ts
export {
  type CompilerPhase,
  type DomainDraft,
  type LinkResult,
  // VerifyResult omitted - use from verifier/index.ts
  type CompileResult,
  type Blocker,
  // NextStep discriminated union
  type NextStep,
  type NextStepApplyPatch,
  type NextStepResolveConflict,
  type NextStepFixIssue,
  type NextStepAddFragment,
  type NextStepRecompile,
  type NextStepReviewDraft,
  type NextStepConfirmDomain,
  type NextStepKind,
  isNextStepApplyPatch,
  isNextStepResolveConflict,
  isNextStepFixIssue,
  isNextStepAddFragment,
  isNextStepRecompile,
  isNextStepReviewDraft,
  isNextStepConfirmDomain,
  type LogEntry,
  type CompilerSessionSnapshot,
  type CompileTarget,
  type CompileOptions,
  type EffectPolicy,
  type LLMAdapter,
  type LLMContext,
  type CompilerConfig,
  // PathNormalizationRule omitted - use from linker/normalizer.ts
  createInitialSnapshot,
  createLogEntry,
  generateLinkResultVersion,
} from './session.js';

// Compiler types (main API)
// Note: ApplyPatchResult is exported from patch.js above
export {
  type Compiler,
  type CompilerSession,
  type PathListener,
  type EventListener,
  type Unsubscribe,
  type CompilerEvent,
  type CompilerDomainRuntime,
  type CompilerDomainData,
  type CompilerDomainState,
  type ExtendedCompilerConfig,
} from './compiler.js';
