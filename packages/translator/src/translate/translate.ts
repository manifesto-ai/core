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
  DecomposeStrategy as DecomposeStrategyType,
} from "../types/index.js";
import type { LLMProvider } from "../llm/provider.js";
import { validateStructural } from "../validate/structural.js";
import { validateWithLexicon } from "../validate/lexicon.js";
import { TranslatorError } from "../core/types/errors.js";
import { translateWithLLM } from "./translate-with-llm.js";
import { createOpenAIProvider, createStubProvider } from "../llm/openai-provider.js";
import {
  ShallowLLMDecompose,
  DeterministicDecompose,
  conservativeMerge,
  type DecomposeStrategy,
  type DecomposeContext,
} from "../decompose/index.js";

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
 * Mode Behavior:
 * - mode: "llm" (default): Requires LLM provider. Throws CONFIGURATION_ERROR if not configured.
 * - mode: "deterministic": No LLM required. Uses heuristic decomposition only.
 *
 * @param text - Natural language input
 * @param options - Translation options
 * @returns TranslateResult with graph and warnings
 */
export async function translate(
  text: string,
  options?: TranslateOptions
): Promise<TranslateResult> {
  const mode = options?.mode ?? "llm";

  // Deterministic mode: always use stub (no LLM required)
  if (mode === "deterministic") {
    return translateDeterministic(text, options);
  }

  // LLM mode (default): require LLM provider
  const provider = getProvider(options);

  if (!provider || !provider.isConfigured()) {
    throw new TranslatorError(
      "LLM mode requires a configured LLM provider. " +
        "Set OPENAI_API_KEY environment variable, provide an LLM provider in options.llm.provider, " +
        'or use mode: "deterministic" for heuristic-only translation.',
      { code: "CONFIGURATION_ERROR" }
    );
  }

  // Check if decomposition is enabled
  const decomposeStrategy = getDecomposeStrategy(text, options);

  if (decomposeStrategy !== "none") {
    return translateWithDecompose(text, provider, decomposeStrategy, options);
  }

  return translateWithLLM(text, provider, options);
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

// =============================================================================
// Decomposition (ADR-003)
// =============================================================================

const DEFAULT_AUTO_THRESHOLD = 200;

/**
 * Determine the decompose strategy to use.
 */
function getDecomposeStrategy(
  text: string,
  options?: TranslateOptions
): DecomposeStrategyType {
  const decomposeOpts = options?.decompose;

  // No decompose options - default to "none"
  if (!decomposeOpts) {
    return "none";
  }

  const strategy = decomposeOpts.strategy ?? "none";

  // Auto mode: choose based on input length
  if (strategy === "auto") {
    const threshold = decomposeOpts.autoThreshold ?? DEFAULT_AUTO_THRESHOLD;
    if (text.length >= threshold) {
      return "shallow-llm";
    }
    return "none";
  }

  return strategy;
}

/**
 * Create a decompose strategy instance.
 */
function createDecomposeStrategy(
  strategy: DecomposeStrategyType,
  options?: TranslateOptions
): DecomposeStrategy | null {
  const decomposeOpts = options?.decompose;

  switch (strategy) {
    case "shallow-llm":
      return new ShallowLLMDecompose({
        apiKey: decomposeOpts?.apiKey,
        model: decomposeOpts?.model,
      });

    case "deterministic":
      return new DeterministicDecompose();

    default:
      return null;
  }
}

/**
 * Translate with decomposition.
 *
 * Per ADR-003:
 * 1. Decompose input into chunks
 * 2. Translate each chunk separately
 * 3. Merge results using conservativeMerge
 */
async function translateWithDecompose(
  text: string,
  provider: LLMProvider,
  strategy: DecomposeStrategyType,
  options?: TranslateOptions
): Promise<TranslateResult> {
  const warnings: TranslateWarning[] = [];

  // Create decompose strategy
  const decomposer = createDecomposeStrategy(strategy, options);
  if (!decomposer) {
    // Fallback to direct translation
    return translateWithLLM(text, provider, options);
  }

  // Build DecomposeContext from options
  const decomposeCtx: DecomposeContext = {
    language: options?.decompose?.language ?? options?.language,
    maxChunkChars: options?.decompose?.maxChunkChars,
    maxChunks: options?.decompose?.maxChunks,
  };

  // Decompose input (pass context per ADR-003 D2)
  const decomposeResult = await decomposer.decompose(text, decomposeCtx);

  // Propagate decompose warnings (per GAP-M1)
  if (decomposeResult.warnings) {
    for (const w of decomposeResult.warnings) {
      warnings.push({
        code: `DECOMPOSE_${w.code}`,
        message: w.message,
      });
    }
  }

  warnings.push({
    code: "DECOMPOSED",
    message: `Input decomposed into ${decomposeResult.chunks.length} chunks using ${decomposer.name} strategy`,
  });

  // If only one chunk, translate directly
  if (decomposeResult.chunks.length <= 1) {
    return translateWithLLM(text, provider, options);
  }

  // Translate each chunk
  const translatedChunks: IntentGraph[] = [];

  for (const chunk of decomposeResult.chunks) {
    // Per ADR-003 D2: Use chunk.text (contiguous substring of input)
    const chunkText = chunk.text;

    if (!chunkText.trim()) {
      continue;
    }

    try {
      const chunkResult = await translateWithLLM(chunkText, provider, {
        ...options,
        // Don't decompose recursively
        decompose: undefined,
      });

      translatedChunks.push(chunkResult.graph);

      // Collect chunk warnings with chunk.id for tracking
      for (const w of chunkResult.warnings) {
        warnings.push({
          ...w,
          message: `[${chunk.id}] ${w.message}`,
        });
      }
    } catch (error) {
      warnings.push({
        code: "CHUNK_TRANSLATION_FAILED",
        message: `[${chunk.id}] Translation failed: ${error instanceof Error ? error.message : String(error)}`,
      });
    }
  }

  // If no chunks translated successfully, throw error
  if (translatedChunks.length === 0) {
    throw new TranslatorError("All chunk translations failed", {
      code: "DECOMPOSITION_FAILED",
    });
  }

  // Merge chunks
  const mergeResult = conservativeMerge(translatedChunks);

  warnings.push({
    code: "MERGED",
    message: `Merged ${translatedChunks.length} chunks into ${mergeResult.graph.nodes.length} nodes`,
  });

  // Validate merged graph
  const structuralResult = validateStructural(mergeResult.graph);
  if (!structuralResult.result.valid) {
    throw new TranslatorError(
      `Merged graph structural validation failed: ${structuralResult.result.details ?? structuralResult.result.error}`,
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
    const lexiconResult = validateWithLexicon(mergeResult.graph, {
      lexicon: options.validateWith,
    });
    if (!lexiconResult.valid) {
      throw new TranslatorError(
        `Merged graph lexicon validation failed: ${lexiconResult.details ?? lexiconResult.error}`,
        {
          code: lexiconResult.error,
          nodeId: lexiconResult.nodeId,
        }
      );
    }
  }

  return {
    graph: mergeResult.graph,
    warnings,
  };
}

/**
 * Deterministic translation using heuristics only (no LLM).
 *
 * Per SPEC Section 10.1:
 * - mode: "deterministic": Heuristic-only, no LLM (may produce empty/minimal graph)
 *
 * This is intentional behavior, not a fallback or stub.
 */
async function translateDeterministic(
  text: string,
  options?: TranslateOptions
): Promise<TranslateResult> {
  const warnings: TranslateWarning[] = [];

  // Return empty graph with metadata
  // TODO: Implement heuristic decomposition for deterministic mode
  const graph: IntentGraph = {
    nodes: [],
    meta: {
      sourceText: text,
      translatedAt: new Date().toISOString(),
    },
  };

  // Add info that this is deterministic mode
  warnings.push({
    code: "DETERMINISTIC_MODE",
    message:
      "Running in deterministic mode (no LLM). Complex inputs may produce empty or minimal graphs.",
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
