/**
 * @manifesto-ai/translator
 *
 * Translator 1.1.1v - Natural language to semantic change proposals
 *
 * Per SPEC-1.1.1v:
 * - Translator is a Compiler Frontend with Deterministic Contracts
 * - 6-stage pipeline: Chunking → Normalization → Fast Path → Retrieval → Memory → Proposer → Assembly
 * - Output: PatchFragment[] | AmbiguityReport | TranslationError
 *
 * Three Architectural Pillars:
 * 1. World is the Premise - cannot operate without World
 * 2. Memory is Default - absence triggers graceful degradation
 * 3. Human Escalation is Constitutional - agent auto-resolve forbidden
 *
 * @example
 * ```typescript
 * import { createTranslator, deriveContext } from "@manifesto-ai/translator";
 *
 * // Create translator with configuration
 * const translator = createTranslator({
 *   slmModel: "gpt-4o-mini",
 *   retrievalTier: 0,
 *   fastPathEnabled: true,
 * });
 *
 * // Derive context from World (required)
 * const context = await deriveContext(worldId, { stores });
 *
 * // Translate natural language to semantic changes
 * const result = await translator.translate("Add email field to user profile", context);
 *
 * if (result.kind === "fragment") {
 *   console.log("Fragments:", result.fragments);
 * } else if (result.kind === "ambiguity") {
 *   console.log("Requires Human decision:", result.report);
 * } else {
 *   console.log("Error:", result.error);
 * }
 * ```
 */

// =============================================================================
// Domain Types (SPEC-1.1.1v §6)
// =============================================================================

export * from "./domain/index.js";

// =============================================================================
// Public API (to be implemented)
// =============================================================================

// TODO: Export from ./api/index.js when implemented
// export { createTranslator, translate, resolve } from "./api/index.js";
// export { deriveContext } from "./api/derive-context.js";

// =============================================================================
// Bridge Integration
// =============================================================================

export {
  // TranslatorBridge
  TranslatorBridge,
  createTranslatorBridge,
  type TranslatorBridgeConfig,
  // Projections
  createTranslateProjection,
  createResolveProjection,
  type TranslatePayload,
  type ResolvePayload,
  // Source Events
  createTranslateSourceEvent,
  createResolveSourceEvent,
  createCLISourceEvent,
  createAgentSourceEvent,
  isTranslatePayload,
  isResolvePayload,
  type TranslateEventPayload,
  type ResolveEventPayload,
  type CLIEventPayload,
  type AgentEventPayload,
} from "./bridge/index.js";

// =============================================================================
// LLM Providers
// =============================================================================

export {
  // Provider interface
  type LLMProvider,
  type ProposeRequest,
  type ProposeResponse,
  type ProviderResult,
  type ProviderMetrics,
  type TranslationExample,
  type BaseProviderConfig,
  type OpenAIProviderConfig,
  type AnthropicProviderConfig,
  // Schemas
  ProposeRequestSchema,
  ProposeResponseSchema,
  ProviderMetricsSchema,
  TranslationExampleSchema,
  // Providers
  OpenAIProvider,
  createOpenAIProvider,
  AnthropicProvider,
  createAnthropicProvider,
  // Factory
  createLLMProvider,
  createAutoProvider,
  getAvailableProviders,
  type ProviderType,
  type ProviderConfig,
} from "./llm/index.js";

// =============================================================================
// Pipeline
// =============================================================================

export {
  // Pipeline
  createPipeline,
  // Stage types
  type PipelineState,
  type PipelineConfig,
  type PipelineStage,
  type TranslatorPipeline,
  type PipelineTelemetry,
  type StageResult,
  // Stage functions
  executeChunking,
  createChunkingTrace,
  executeNormalization,
  createNormalizationTrace,
  executeFastPath,
  createFastPathTrace,
  executeAssembly,
  createAssemblyTrace,
  buildTranslationResult,
  // Pattern registry
  createPatternRegistry,
  type FastPathPattern,
  type AssemblyResult,
} from "./pipeline/index.js";

// =============================================================================
// Utilities
// =============================================================================

export {
  // Canonicalization
  canonicalize,
  validateNoDuplicateKeys,
  parseAndCanonicalize,
  // Fragment ID
  computeFragmentId,
  verifyFragmentId,
  generateIntentId,
  generateTraceId,
  generateReportId,
  computeInputHash,
  // Type Index
  deriveTypeIndex,
  getResolvedType,
  hasPath,
  getAllPaths,
  getPathsByPrefix,
} from "./utils/index.js";

// =============================================================================
// Effect Handlers (Host Integration)
// =============================================================================

export {
  createTranslatorEffectHandlers,
  registerTranslatorEffects,
  type TranslatorEffectDependencies,
  type TranslatorEffectRegistry,
} from "./effects/index.js";

// =============================================================================
// TranslatorHost (Complete Runtime)
// =============================================================================

export {
  TranslatorHost,
  createTranslatorHost,
  type TranslatorHostConfig,
  type TranslatorHostResult,
} from "./host/index.js";
