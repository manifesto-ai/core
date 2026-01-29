/**
 * @fileoverview Strategies Module Exports
 *
 * Built-in strategy implementations for Translator v1.0.
 *
 * @module strategies
 */

// =============================================================================
// Decompose Strategies
// =============================================================================

export {
  SlidingWindowDecomposer,
  SentenceBasedDecomposer,
} from "./decompose/index.js";

// =============================================================================
// Translate Strategies
// =============================================================================

export {
  LLMTranslator,
  type LLMTranslatorConfig,
  DeterministicTranslator,
  type DeterministicTranslatorConfig,
  type PatternExtractor,
} from "./translate/index.js";

// =============================================================================
// Merge Strategies
// =============================================================================

export { ConservativeMerger, AggressiveMerger } from "./merge/index.js";
