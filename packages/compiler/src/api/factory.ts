import { ManifestoCompiler } from "./compiler.js";
import type { Compiler, CompilerOptions, LLMAdapter, CompilerResolutionPolicy } from "../domain/types.js";
import { createAnthropicAdapter, type AnthropicAdapterOptions } from "../effects/llm/anthropic-adapter.js";
import { createOpenAIAdapter, type OpenAIAdapterOptions } from "../effects/llm/openai-adapter.js";

/**
 * Default resolution policy
 *
 * Per FDR-C005: Default MUST be 'discard' (safe default).
 */
const DEFAULT_POLICY: CompilerResolutionPolicy = {
  onResolutionRequired: "discard",
};

/**
 * Create the appropriate LLM adapter based on options
 */
function createAdapter(options: CompilerOptions): LLMAdapter {
  // 1. Use explicitly provided adapter
  if (options.llmAdapter) {
    return options.llmAdapter;
  }

  // 2. Use OpenAI if configured
  if (options.openai) {
    return createOpenAIAdapter(options.openai as OpenAIAdapterOptions);
  }

  // 3. Default to Anthropic
  return createAnthropicAdapter(options.anthropic as AnthropicAdapterOptions);
}

/**
 * Create a new Compiler instance
 *
 * @param options - Compiler configuration options
 * @returns Compiler instance
 *
 * @example
 * ```typescript
 * // With Anthropic (default)
 * const compiler = createCompiler({
 *   anthropic: { apiKey: process.env.ANTHROPIC_API_KEY },
 * });
 *
 * // With OpenAI
 * const compiler = createCompiler({
 *   openai: { apiKey: process.env.OPENAI_API_KEY },
 * });
 *
 * // With custom LLM adapter
 * const compiler = createCompiler({
 *   llmAdapter: myCustomAdapter,
 * });
 * ```
 */
export function createCompiler(options: CompilerOptions = {}): Compiler {
  const adapter = createAdapter(options);

  return new ManifestoCompiler(adapter, {
    maxRetries: options.maxRetries ?? 5,
    traceDrafts: options.traceDrafts ?? false,
    resolutionPolicy: options.resolutionPolicy ?? DEFAULT_POLICY,
    telemetry: options.telemetry,
  });
}
