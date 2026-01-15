/**
 * @fileoverview Translator App Public API
 *
 * Transforms natural language (PF) into IntentBody via IntentIR.
 *
 * v0.2.0: MEL Domain + ServiceMap architecture
 * - MEL Domain definition for Translator
 * - Service handlers for 7-stage pipeline
 * - App factory for integration
 *
 * @packageDocumentation
 * @module @manifesto-ai/translator
 * @version 0.2.0
 */

// =============================================================================
// v0.2.0 MEL Domain & App
// =============================================================================

// MEL Domain (text)
import TranslatorMel from "./domain/translator.mel";
export { TranslatorMel };

// Services
export {
  type TranslatorServicesOptions,
  type HandlerContext,
  createTranslatorServices,
  createTranslatorHandlers,
} from "./services/index.js";

// App Factory
import { createApp } from "@manifesto-ai/app";
import type { App, CreateAppOptions } from "@manifesto-ai/app";
import { createTranslatorServices, type TranslatorServicesOptions } from "./services/index.js";
import type { LLMClient } from "./pipeline/llm-client.js";

/**
 * Options for creating Translator App
 */
export type TranslatorAppOptions = {
  /** LLM client for S2 Propose stage */
  llmClient?: LLMClient;
  /** Schema for project lexicon derivation */
  schema?: unknown;
  /** Schema hash for intentKey derivation */
  schemaHash?: string;
  /** Additional App options */
  appOptions?: Partial<CreateAppOptions>;
};

/**
 * Initial state data matching MEL domain defaults
 */
const INITIAL_STATE_DATA = {
  // Pipeline state (all null initially)
  currentInput: null,
  normalized: null,
  intentIR: null,
  canonicalIR: null,
  simKey: null,
  featureCheckPassed: null,
  resolvedIR: null,
  resolutions: [],
  loweringResult: null,
  actionBodyValid: null,
  result: null,
  currentStage: "pending",
  error: null,

  // Learned lexicon (persistent)
  learnedLexicon: {},

  // Config
  config: {
    resolverContextDepth: 5,
    defaultLang: "en",
    strict: false,
  },

  // Once markers
  initMarker: null,
  normalizeMarker: null,
  proposeMarker: null,
  canonicalizeMarker: null,
  featureCheckMarker: null,
  resolveRefsMarker: null,
  lowerMarker: null,
  validateMarker: null,
  completeMarker: null,
  learnMarker: null,
};

/**
 * Create Translator App with MEL domain
 *
 * @example
 * ```typescript
 * import { createTranslatorApp, createMockLLMClient } from '@manifesto-ai/translator';
 *
 * const llmClient = createMockLLMClient();
 * const app = createTranslatorApp({ llmClient });
 * await app.ready();
 *
 * // Translate natural language to IntentBody
 * const handle = app.act('translate', {
 *   text: 'Add a task called "Buy groceries"',
 *   lang: 'en',
 *   strict: false,
 * });
 * await handle.done();
 *
 * // Get result from state
 * const state = app.getState();
 * console.log(state.data.result);
 * ```
 */
export function createTranslatorApp(options: TranslatorAppOptions = {}): App {
  const services = createTranslatorServices({
    llmClient: options.llmClient,
    schema: options.schema,
    schemaHash: options.schemaHash,
  });

  return createApp(TranslatorMel, {
    services,
    validation: { services: "lazy" },
    initialData: INITIAL_STATE_DATA,
    ...options.appOptions,
  });
}

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

// OpenAI Client
export {
  type OpenAIClientOptions,
  OpenAIClient,
  createOpenAIClient,
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
