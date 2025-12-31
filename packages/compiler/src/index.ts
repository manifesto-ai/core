/**
 * @manifesto-ai/compiler v1.1
 *
 * Natural language to Manifesto DomainSchema compiler.
 *
 * v1.1 introduces the Fragment Pipeline architecture:
 * Plan → Generate → Lower → Link → Verify → Emit
 *
 * @example Using Anthropic (built-in)
 * ```typescript
 * import { createCompiler } from '@manifesto-ai/compiler';
 *
 * const compiler = createCompiler({
 *   anthropic: { apiKey: process.env.ANTHROPIC_API_KEY },
 * });
 *
 * compiler.subscribe((snapshot) => {
 *   if (snapshot.status === 'success') {
 *     console.log('Compiled schema:', snapshot.domainSpec);
 *   }
 * });
 *
 * await compiler.start({
 *   text: 'Track user name and email. Allow users to update their profile.',
 * });
 * ```
 */

// ════════════════════════════════════════════════════════════════════════════
// Main API
// ════════════════════════════════════════════════════════════════════════════

export { createCompiler } from "./api/factory.js";
export { ManifestoCompiler } from "./api/compiler.js";

// ════════════════════════════════════════════════════════════════════════════
// Core Types
// ════════════════════════════════════════════════════════════════════════════

export type {
  // Compiler interface
  Compiler,
  CompilerOptions,
  CompilerSnapshot,
  CompilerState,
  CompileInput,
  CompilerStatus,
  Unsubscribe,

  // Resolution policy
  ResolutionPolicy,
  ResolutionOption,
  ResolutionRequest,
  ResolutionResponse,
  ResolutionRecord,

  // Telemetry
  CompilerTelemetry,

  // LLM types
  LLMAdapter,
  LLMResult,
  RawPlanOutput,
  RawChunkOutput,
  RawDraftOutput,
  RawInterpretationOutput,
} from "./domain/types.js";

// ════════════════════════════════════════════════════════════════════════════
// Pipeline Types (v1.1)
// ════════════════════════════════════════════════════════════════════════════

export type {
  // Input
  SourceInput,
  SourceInputType,

  // Plan phase
  Plan,
  PlanStrategy,
  Chunk,
  ChunkDependency,

  // Generate phase
  FragmentDraft,
  FragmentType,
  FragmentInterpretation,

  // Pipeline phase
  Fragment,
  FragmentContent,
  Provenance,
  DomainDraft,
  DependencyGraph,
  Issue,
  IssueSeverity,

  // Output
  DomainSpec,
  DomainSpecProvenance,
  DomainSpecVerification,

  // Conflicts
  Conflict,
  ConflictType,
} from "./domain/types.js";

// ════════════════════════════════════════════════════════════════════════════
// Domain (for advanced usage)
// ════════════════════════════════════════════════════════════════════════════

export { CompilerDomain, INITIAL_STATE } from "./domain/domain.js";
export { CompilerStateSchema } from "./domain/schema.js";

// ════════════════════════════════════════════════════════════════════════════
// Pipeline Components (v1.1)
// ════════════════════════════════════════════════════════════════════════════

export {
  createPassLayer,
  PASS_LAYER_VERSION,
  type PassLayer,
  type PassContext,
  type PassResult,
} from "./pipeline/index.js";

export {
  createLinker,
  LINKER_VERSION,
  type Linker,
  type LinkContext,
  type LinkResult,
} from "./pipeline/index.js";

export {
  createVerifier,
  VERIFIER_VERSION,
  type Verifier,
  type VerifyContext,
  type VerifyResult,
} from "./pipeline/index.js";

export {
  createEmitter,
  EMITTER_VERSION,
  COMPILER_VERSION,
  type Emitter,
  type EmitContext,
  type EmitResult,
} from "./pipeline/index.js";

// ════════════════════════════════════════════════════════════════════════════
// LLM Adapters
// ════════════════════════════════════════════════════════════════════════════

export {
  createAnthropicAdapter,
  AnthropicAdapter,
  type AnthropicAdapterOptions,
} from "./effects/llm/anthropic-adapter.js";

export {
  createOpenAIAdapter,
  OpenAIAdapter,
  type OpenAIAdapterOptions,
} from "./effects/llm/openai-adapter.js";

export { DEFAULT_LLM_CONFIG, type LLMAdapterConfig } from "./effects/llm/adapter.js";

// ════════════════════════════════════════════════════════════════════════════
// Effect Handlers (for custom integration)
// ════════════════════════════════════════════════════════════════════════════

export {
  createLLMEffectHandlers,
  createPlanHandler,
  createGenerateHandler,
  DEFAULT_RESOLUTION_POLICY,
  type LLMEffectHandler,
  type EffectHandlerResult,
} from "./effects/llm/handlers.js";

export {
  createBuilderValidateHandler,
  type BuilderValidateHandler,
  type ValidateResult,
} from "./effects/builder/validate-handler.js";

// ════════════════════════════════════════════════════════════════════════════
// Prompt Utilities (for customization)
// ════════════════════════════════════════════════════════════════════════════

export { createPlanPrompt } from "./effects/llm/prompts/plan.js";
export { createGeneratePrompt } from "./effects/llm/prompts/generate.js";

// ════════════════════════════════════════════════════════════════════════════
// Parser Utilities (for testing)
// ════════════════════════════════════════════════════════════════════════════

export {
  parseJSONResponse,
  extractAmbiguity,
  validatePlanResponse,
  validateFragmentDraftResponse,
  type ParseResult,
  type AmbiguityInfo,
  type RawPlan,
  type RawChunk,
  type RawFragmentDraft,
} from "./effects/llm/parser.js";
