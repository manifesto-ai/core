/**
 * @fileoverview translate() Implementation (SPEC Section 10.1)
 *
 * Transforms natural language into an Intent Graph.
 */

import type {
  IntentGraph,
  TranslateOptions,
  TranslateResult,
  TranslateWarning,
} from "../types/index.js";
import type { LLMProvider } from "../llm/provider.js";
import { validateStructural } from "../validate/structural.js";
import { validateWithLexicon } from "../validate/lexicon.js";
import { TranslatorError } from "../types/errors.js";
import { translateWithLLM } from "./translate-with-llm.js";
import { createOpenAIProvider, createStubProvider } from "../llm/openai-provider.js";

// =============================================================================
// translate
// =============================================================================

/**
 * Transform natural language into an Intent Graph.
 *
 * Per SPEC Section 10.1:
 * - Returns TranslateResult with IntentGraph and warnings
 * - Returned graph passes Structural Validation (MUST)
 * - If validateWith provided, also passes Lexicon-Verified Validation (MUST)
 *
 * @param text - Natural language input
 * @param options - Translation options
 * @returns TranslateResult with graph and warnings
 */
export async function translate(
  text: string,
  options?: TranslateOptions
): Promise<TranslateResult> {
  // Get or create LLM provider
  const provider = getProvider(options);

  // If provider is available and configured, use LLM translation
  if (provider && provider.isConfigured()) {
    return translateWithLLM(text, provider, options);
  }

  // Otherwise, fall back to stub implementation
  return translateStub(text, options);
}

/**
 * Get the LLM provider from options or environment.
 */
function getProvider(options?: TranslateOptions): LLMProvider | null {
  // Use provided provider
  if (options?.llm?.provider) {
    return options.llm.provider;
  }

  // Try to create OpenAI provider from environment
  const openaiProvider = createOpenAIProvider();
  if (openaiProvider.isConfigured()) {
    return openaiProvider;
  }

  // No provider available
  return null;
}

/**
 * Stub implementation that returns an empty graph.
 *
 * Used when no LLM provider is configured.
 */
async function translateStub(
  text: string,
  options?: TranslateOptions
): Promise<TranslateResult> {
  const warnings: TranslateWarning[] = [];

  // Return empty graph with metadata
  const graph: IntentGraph = {
    nodes: [],
    meta: {
      sourceText: text,
      translatedAt: new Date().toISOString(),
    },
  };

  // Add warning that this is a stub
  warnings.push({
    code: "STUB_IMPLEMENTATION",
    message:
      "translate() is running in stub mode. Set OPENAI_API_KEY or provide an LLM provider for full functionality.",
  });

  // Validate structural (always)
  const structuralResult = validateStructural(graph);
  if (!structuralResult.result.valid) {
    throw new TranslatorError(
      `Structural validation failed: ${structuralResult.result.details ?? structuralResult.result.error}`,
      {
        code: structuralResult.result.error,
        nodeId: structuralResult.result.nodeId,
      }
    );
  }

  // Add structural warnings
  for (const warning of structuralResult.warnings) {
    warnings.push({
      code: "STRUCTURAL_WARNING",
      message: warning,
    });
  }

  // Validate with Lexicon if provided
  if (options?.validateWith) {
    const lexiconResult = validateWithLexicon(graph, {
      lexicon: options.validateWith,
    });
    if (!lexiconResult.valid) {
      throw new TranslatorError(
        `Lexicon validation failed: ${lexiconResult.details ?? lexiconResult.error}`,
        {
          code: lexiconResult.error,
          nodeId: lexiconResult.nodeId,
        }
      );
    }
  }

  return {
    graph,
    warnings,
  };
}
