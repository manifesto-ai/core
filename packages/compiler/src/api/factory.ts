/**
 * @manifesto-ai/compiler v1.1 Factory
 *
 * Factory function for creating Compiler instances.
 */

import { ManifestoCompiler } from "./compiler.js";
import type { Compiler, CompilerOptions, LLMAdapter, ResolutionPolicy } from "../domain/types.js";
import { createAnthropicAdapter, type AnthropicAdapterOptions } from "../effects/llm/anthropic-adapter.js";
import { createOpenAIAdapter, type OpenAIAdapterOptions } from "../effects/llm/openai-adapter.js";
import { DEFAULT_RESOLUTION_POLICY } from "../effects/llm/handlers.js";

// ═══════════════════════════════════════════════════════════════════════════════
// §1 Default Configuration
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Default resolution policy
 *
 * Per FDR-C005: Default MUST be 'await' for plan decisions (human review).
 */
const DEFAULT_POLICY: ResolutionPolicy = DEFAULT_RESOLUTION_POLICY;

// ═══════════════════════════════════════════════════════════════════════════════
// §2 Adapter Factory
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Create the appropriate LLM adapter based on options
 */
function createAdapter(options: CompilerOptions): LLMAdapter {
  // 1. Use explicitly provided adapter
  if (options.llmAdapter) {
    return options.llmAdapter;
  }

  // 2. Use OpenAI if openai options provided
  if (options.openai) {
    return createOpenAIAdapter(options.openai as OpenAIAdapterOptions);
  }

  // 3. Default to Anthropic
  return createAnthropicAdapter(options.anthropic as AnthropicAdapterOptions);
}

// ═══════════════════════════════════════════════════════════════════════════════
// §3 Compiler Factory
// ═══════════════════════════════════════════════════════════════════════════════

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
 * // With custom LLM adapter
 * const compiler = createCompiler({
 *   llmAdapter: myCustomAdapter,
 * });
 *
 * // With custom resolution policy
 * const compiler = createCompiler({
 *   resolutionPolicy: {
 *     onPlanDecision: 'auto-accept',
 *     onDraftDecision: 'auto-accept',
 *     onConflictResolution: 'await',
 *   },
 * });
 * ```
 */
export function createCompiler(options: CompilerOptions = {}): Compiler {
  const adapter = createAdapter(options);

  return new ManifestoCompiler(adapter, {
    resolutionPolicy: options.resolutionPolicy ?? DEFAULT_POLICY,
    telemetry: options.telemetry,
    config: options.config,
  });
}
