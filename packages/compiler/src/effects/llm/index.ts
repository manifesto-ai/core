// Adapter
export type {
  LLMAdapter,
  LLMAdapterConfig,
  LLMResult,
  SegmentResult,
  NormalizeResult,
  ProposeResult,
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
  createSegmentHandler,
  createNormalizeHandler,
  createProposeHandler,
  createLLMEffectHandlers,
  type LLMEffectHandler,
  type EffectHandlerResult,
} from "./handlers.js";

// Parser
export {
  parseJSONResponse,
  extractResolutionRequest,
  validateSegmentsResponse,
  validateIntentsResponse,
  validateDraftResponse,
  type ParseResult,
  type ResolutionRequest,
} from "./parser.js";

// Prompts
export { createSegmentPrompt, createNormalizePrompt, createProposePrompt } from "./prompts/index.js";
