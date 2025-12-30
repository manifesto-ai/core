/**
 * @manifesto-ai/compiler
 *
 * Natural language to Manifesto DomainSchema compiler.
 *
 * Implemented as a Manifesto Application (dogfooding per FDR-C001).
 *
 * @example Using Anthropic (built-in)
 * ```typescript
 * import { createCompiler } from '@manifesto-ai/compiler';
 *
 * const compiler = createCompiler({
 *   anthropic: { apiKey: process.env.ANTHROPIC_API_KEY },
 * });
 *
 * compiler.subscribe((state) => {
 *   if (state.status === 'success') {
 *     console.log('Compiled schema:', state.result);
 *   }
 * });
 *
 * await compiler.start({
 *   text: 'Track user name and email. Allow users to update their profile.',
 * });
 * ```
 *
 * @example Using custom LLM adapter (e.g., OpenAI)
 * ```typescript
 * import { createCompiler, type LLMAdapter } from '@manifesto-ai/compiler';
 * import OpenAI from 'openai';
 *
 * // Implement your own adapter
 * const openaiAdapter: LLMAdapter = {
 *   async segment({ text }) {
 *     const openai = new OpenAI();
 *     const response = await openai.chat.completions.create({ ... });
 *     return { ok: true, data: { segments: [...] } };
 *   },
 *   async normalize({ segments, schema, context }) {
 *     // ...
 *   },
 *   async propose({ schema, intents, history, context, resolution }) {
 *     // ...
 *   },
 * };
 *
 * const compiler = createCompiler({
 *   llmAdapter: openaiAdapter,  // Inject custom adapter
 * });
 * ```
 */

// ════════════════════════════════════════════════════════════════════════════
// Main API
// ════════════════════════════════════════════════════════════════════════════

export { createCompiler } from "./api/factory.js";
export { ManifestoCompiler } from "./api/compiler.js";

// ════════════════════════════════════════════════════════════════════════════
// Types
// ════════════════════════════════════════════════════════════════════════════

export type {
  // Core types
  Compiler,
  CompilerOptions,
  CompilerSnapshot,
  CompilerState,
  CompileInput,
  CompilerStatus,
  Unsubscribe,

  // Resolution
  CompilerResolutionPolicy,
  ResolutionOption,
  DiscardReason,

  // Pipeline types
  CompilerContext,
  NormalizedIntent,
  AttemptRecord,
  CompilerDiagnostics,
  CompilerDiagnostic,

  // Telemetry (SPEC §15.2)
  CompilerTelemetry,

  // LLM types
  LLMAdapter,
  LLMResult,
  SegmentResult,
  NormalizeResult,
  ProposeResult,
} from "./domain/types.js";

// ════════════════════════════════════════════════════════════════════════════
// Domain (for advanced usage)
// ════════════════════════════════════════════════════════════════════════════

export { CompilerDomain, INITIAL_STATE } from "./domain/domain.js";
export { CompilerStateSchema } from "./domain/schema.js";

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
  createSegmentHandler,
  createNormalizeHandler,
  createProposeHandler,
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

export {
  createSegmentPrompt,
  createNormalizePrompt,
  createProposePrompt,
} from "./effects/llm/prompts/index.js";

// ════════════════════════════════════════════════════════════════════════════
// Parser Utilities (for testing)
// ════════════════════════════════════════════════════════════════════════════

export {
  parseJSONResponse,
  extractResolutionRequest,
  validateSegmentsResponse,
  validateIntentsResponse,
  validateDraftResponse,
  type ParseResult,
  type ResolutionRequest,
} from "./effects/llm/parser.js";
