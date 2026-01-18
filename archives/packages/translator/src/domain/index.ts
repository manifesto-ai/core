/**
 * Domain Types for Translator (SPEC-1.1.1v §6)
 *
 * Re-exports all domain types from the translator package.
 */

// =============================================================================
// Core Primitives (§6.1)
// =============================================================================

export {
  // Types
  type ActorKind,
  type ActorRef,
  type SemanticPath,
  type WorldId,
  type IntentId,
  type PrimitiveValue,
  type JsonValue,
  // Schemas
  ActorKind as ActorKindSchema,
  ActorRef as ActorRefSchema,
  PrimitiveValueSchema,
  JsonValueSchema,
  SemanticPathSchema,
  WorldIdSchema,
  IntentIdSchema,
} from "./types.js";

// =============================================================================
// Expression IR (§6.2)
// =============================================================================

export {
  // Types
  type PathSegment,
  type PathNode,
  type SystemPath,
  type ExprLit,
  type ExprVar,
  type ExprSys,
  type ExprGet,
  type ExprCall,
  type ObjField,
  type ExprObj,
  type ExprArr,
  type ExprNode,
  // Schemas
  PathSegmentSchema,
  PathNodeSchema,
  SystemPathSchema,
  ExprNodeSchema,
  // Helpers
  lit,
  varItem,
  sys,
  get,
  call,
  obj,
  arr,
} from "./expr-node.js";

// =============================================================================
// Type System (§6.3)
// =============================================================================

export {
  // TypeExpr types
  type TypeExprPrimitive,
  type TypeExprLiteral,
  type TypeExprRef,
  type TypeExprArray,
  type TypeExprRecord,
  type TypeExprUnion,
  type TypeExprObjectField,
  type TypeExprObject,
  type TypeExpr,
  // ResolvedType types
  type ResolvedTypePrimitive,
  type ResolvedTypeLiteral,
  type ResolvedTypeArray,
  type ResolvedTypeRecord,
  type ResolvedTypeUnion,
  type ResolvedTypeObjectField,
  type ResolvedTypeObject,
  type ResolvedType,
  // TypeIndex
  type TypeIndex,
  // Schemas
  TypeExprSchema,
  ResolvedTypeSchema,
  TypeIndexSchema,
  // Helpers
  primitiveType,
  literalType,
  refType,
  arrayType,
  recordType,
  unionType,
  objectType,
} from "./type-expr.js";

// =============================================================================
// Patch Fragment and PatchOp (§6.6-6.7)
// =============================================================================

export {
  // Action types
  type ActionParamSpec,
  type ActionGuardWhen,
  type ActionGuardOnce,
  type ActionGuard,
  type ActionStmtPatch,
  type ActionStmtEffect,
  type ActionStmtNested,
  type ActionStmt,
  type GuardedBlock,
  type ActionBody,
  // PatchOp types
  type PatchOpDefineType,
  type PatchOpAddField,
  type PatchOpAddConstraint,
  type PatchOpSetDefaultValue,
  type PatchOpWidenFieldType,
  type PatchOpAddComputed,
  type PatchOpAddAction,
  type PatchOpAddActionParam,
  type PatchOpAddActionAvailable,
  type PatchOpAddActionGuard,
  type PatchOp,
  // PatchFragment
  type PatchFragment,
  // Schemas
  ActionParamSpecSchema,
  ActionGuardSchema,
  ActionStmtSchema,
  GuardedBlockSchema,
  ActionBodySchema,
  PatchOpSchema,
  PatchFragmentSchema,
} from "./patch-fragment.js";

// =============================================================================
// Ambiguity Types (§6.8-6.9)
// =============================================================================

export {
  // Types
  type AmbiguityKind,
  type AmbiguityCandidate,
  type ResolutionPrompt,
  type AmbiguityReport,
  type ResolutionChoice,
  type EscalationMetadata,
  type AmbiguityResolution,
  // Schemas
  AmbiguityKindSchema,
  AmbiguityCandidateSchema,
  ResolutionPromptSchema,
  AmbiguityReportSchema,
  ResolutionChoiceSchema,
  EscalationMetadataSchema,
  AmbiguityResolutionSchema,
  // Constants
  OPT_CANCEL,
  // Helpers
  createOptCancelCandidate,
  isOptCancel,
} from "./ambiguity.js";

// =============================================================================
// Stage Results (§6.5)
// =============================================================================

export {
  // Chunking
  type Section,
  SectionSchema,
  // Normalization
  type ProtectedToken,
  type GlossaryHit,
  type NormalizationResult,
  ProtectedTokenSchema,
  GlossaryHitSchema,
  NormalizationResultSchema,
  // Fast Path
  type FastPathCandidate,
  type FastPathResult,
  FastPathCandidateSchema,
  FastPathResultSchema,
  // Retrieval
  type AnchorCandidate,
  type RetrievalResult,
  AnchorCandidateSchema,
  RetrievalResultSchema,
  // Memory
  type MemoryContent,
  type TranslationExample,
  type SchemaSnapshot,
  type GlossaryTermEntry,
  type ResolutionRecord,
  type MemoryStageResult,
  MemoryContentSchema,
  TranslationExampleSchema,
  SchemaSnapshotSchema,
  GlossaryTermEntrySchema,
  ResolutionRecordSchema,
  MemoryStageResultSchema,
  // Proposer
  type ProposalResultFragments,
  type ProposalResultAmbiguity,
  type ProposalResultEmpty,
  type ProposalResult,
  ProposalResultSchema,
} from "./stage-results.js";

// =============================================================================
// Translation Result (§6.10)
// =============================================================================

export {
  type TranslationResultFragment,
  type TranslationResultAmbiguity,
  type TranslationResultError,
  type TranslationResult,
  TranslationResultSchema,
  isFragmentResult,
  isAmbiguityResult,
  isErrorResult,
  isNoOpResult,
} from "./result.js";

// =============================================================================
// Errors (§6.11)
// =============================================================================

export {
  type TranslationStage,
  type ErrorCode,
  type TranslationError,
  TranslationStageSchema,
  ErrorCodeSchema,
  TranslationErrorSchema,
  createError,
  invalidInput,
  invalidContext,
  schemaNotFound,
  fastPathMiss,
  typeError,
  proposerFailure,
  proposerTimeout,
  memoryUnavailable,
  noFragmentsProduced,
  fragmentConflict,
  confidenceTooLow,
} from "./errors.js";

// =============================================================================
// Trace Types (§6.13-6.15)
// =============================================================================

export {
  // Stage traces
  type ChunkingTrace,
  type NormalizationTrace,
  type FastPathTrace,
  type RetrievalTrace,
  type MemoryContentSummary,
  type MemoryStageTrace,
  type ProposerTrace,
  type AssemblyTrace,
  type StageTraces,
  // Escalation
  type EscalationTrace,
  // Translation trace
  type TraceRequest,
  type TraceTiming,
  type TranslationTrace,
  // Schemas
  ChunkingTraceSchema,
  NormalizationTraceSchema,
  FastPathTraceSchema,
  RetrievalTraceSchema,
  MemoryContentSummarySchema,
  MemoryStageTraceSchema,
  ProposerTraceSchema,
  AssemblyTraceSchema,
  StageTracesSchema,
  EscalationTraceSchema,
  TraceRequestSchema,
  TraceTimingSchema,
  TranslationTraceSchema,
} from "./trace.js";

// =============================================================================
// Context (§6.16)
// =============================================================================

export {
  type DomainSchema,
  type Snapshot,
  type TranslationContext,
  DomainSchemaSchema,
  SnapshotSchema,
  TranslationContextSchema,
} from "./context.js";

// =============================================================================
// Glossary (§7)
// =============================================================================

export {
  type GlossaryEntry,
  type Glossary,
  GlossaryEntrySchema,
  GlossarySchema,
  createEmptyGlossary,
  addGlossaryEntry,
  lookupTerm,
} from "./glossary.js";

// =============================================================================
// Configuration (§6.18)
// =============================================================================

export {
  type MemoryPolicy,
  type ConfidencePolicy,
  type TraceConfig,
  type WorldStore,
  type SchemaStore,
  type SnapshotStore,
  type MemorySelector,
  type TranslatorConfig,
  MemoryPolicySchema,
  ConfidencePolicySchema,
  TraceConfigSchema,
  TranslatorConfigSchema,
  DEFAULT_CONFIG,
  createConfig,
} from "./config.js";
