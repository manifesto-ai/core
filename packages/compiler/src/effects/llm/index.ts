/**
 * @manifesto-ai/compiler v1.1 LLM Effects
 *
 * Exports for LLM-related effects: adapters, handlers, parser, prompts.
 */

// Adapter
export type {
  LLMAdapter,
  LLMAdapterConfig,
  LLMResult,
  PlanRequest,
  PlanResult,
  GenerateRequest,
  GenerateResult,
} from "./adapter.js";
export { DEFAULT_LLM_CONFIG } from "./adapter.js";

// Anthropic adapter
export {
  AnthropicAdapter,
  createAnthropicAdapter,
  type AnthropicAdapterOptions,
} from "./anthropic-adapter.js";

// Handlers
export {
  createPlanHandler,
  createGenerateHandler,
  createLLMEffectHandlers,
  DEFAULT_RESOLUTION_POLICY,
  type LLMEffectHandler,
  type EffectHandlerResult,
} from "./handlers.js";

// Parser
export {
  parseJSONResponse,
  extractAmbiguity,
  validatePlanResponse,
  validateFragmentDraftResponse,
  // Legacy exports (deprecated)
  validateSegmentsResponse,
  validateDraftResponse,
  type ParseResult,
  type AmbiguityInfo,
  type RawPlan,
  type RawChunk,
  type RawChunkDependency,
  type RawFragmentDraft,
  type RawFragmentInterpretation,
} from "./parser.js";

// Prompts
export { createPlanPrompt } from "./prompts/plan.js";
export { createGeneratePrompt } from "./prompts/generate.js";
