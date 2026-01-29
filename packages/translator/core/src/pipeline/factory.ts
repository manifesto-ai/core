/**
 * @fileoverview Pipeline Factory Functions (SPEC Section 7.3)
 *
 * Factory functions for creating pre-configured pipelines.
 *
 * @module pipeline/factory
 */

import type { LLMPort } from "../core/interfaces/llm-port.js";
import type { PipelinePlugin } from "../plugins/types.js";
import { TranslatorPipeline, type PipelineOptions } from "./pipeline.js";
import { SlidingWindowDecomposer } from "../strategies/decompose/sliding-window.js";
import { SentenceBasedDecomposer } from "../strategies/decompose/sentence-based.js";
import { LLMTranslator } from "../strategies/translate/llm-translator.js";
import { DeterministicTranslator } from "../strategies/translate/deterministic.js";
import { ConservativeMerger } from "../strategies/merge/conservative.js";
import { orDetectorPlugin } from "../plugins/or-detector.js";
import { coverageCheckerPlugin } from "../plugins/coverage-checker.js";

// =============================================================================
// createDefaultPipeline
// =============================================================================

/**
 * Create default pipeline (non-overlap, safe).
 *
 * Per SPEC Section 7.3:
 * - Uses SentenceBasedDecomposer (no overlap)
 * - Uses LLMTranslator
 * - Uses ConservativeMerger
 * - Includes orDetector and coverageChecker plugins
 *
 * @param llm - LLM port for translation
 * @param options - Optional pipeline options
 * @returns Configured TranslatorPipeline
 */
export function createDefaultPipeline(
  llm: LLMPort,
  options?: Partial<PipelineOptions>
): TranslatorPipeline {
  return new TranslatorPipeline(
    new SentenceBasedDecomposer(options?.maxChunkSize ?? 4000),
    new LLMTranslator(llm),
    new ConservativeMerger(),
    {
      concurrency: 5,
      errorPolicy: "fail-fast",
      linkStrategy: "conservative",
      ...options,
    },
    [orDetectorPlugin, coverageCheckerPlugin]
  );
}

// =============================================================================
// createContextOverlapPipeline
// =============================================================================

/**
 * Create pipeline with context overlap.
 *
 * Per SPEC Section 7.3:
 * - Uses SlidingWindowDecomposer with overlap
 * - Overlap is auto-detected from spans; dedup is forced
 * - Good for long documents where context helps
 *
 * @param llm - LLM port for translation
 * @param options - Optional pipeline options
 * @returns Configured TranslatorPipeline
 */
export function createContextOverlapPipeline(
  llm: LLMPort,
  options?: Partial<PipelineOptions> & { overlapSize?: number }
): TranslatorPipeline {
  const chunkSize = options?.maxChunkSize ?? 4000;
  const overlapSize = options?.overlapSize ?? Math.floor(chunkSize * 0.1); // 10% overlap

  return new TranslatorPipeline(
    new SlidingWindowDecomposer(chunkSize, overlapSize),
    new LLMTranslator(llm),
    new ConservativeMerger(),
    {
      concurrency: 5,
      deduplicate: true, // Forced for overlap
      errorPolicy: "fail-fast",
      linkStrategy: "conservative",
      ...options,
    },
    [orDetectorPlugin, coverageCheckerPlugin]
  );
}

// =============================================================================
// createFastPipeline
// =============================================================================

/**
 * Create high-throughput pipeline (best-effort errors).
 *
 * Per SPEC Section 7.3:
 * - Uses higher concurrency
 * - Uses best-effort error policy
 * - Continues on chunk failures
 *
 * @param llm - LLM port for translation
 * @param options - Optional pipeline options
 * @returns Configured TranslatorPipeline
 */
export function createFastPipeline(
  llm: LLMPort,
  options?: Partial<PipelineOptions>
): TranslatorPipeline {
  return new TranslatorPipeline(
    new SlidingWindowDecomposer(options?.maxChunkSize ?? 8000, 0),
    new LLMTranslator(llm),
    new ConservativeMerger(),
    {
      concurrency: 10,
      errorPolicy: "best-effort",
      linkStrategy: "conservative",
      ...options,
    },
    [coverageCheckerPlugin] // Skip orDetector for speed
  );
}

// =============================================================================
// createTestPipeline
// =============================================================================

/**
 * Create pipeline for testing (no LLM).
 *
 * Uses DeterministicTranslator for predictable results.
 *
 * @param options - Optional pipeline options
 * @param plugins - Optional plugins
 * @returns Configured TranslatorPipeline
 */
export function createTestPipeline(
  options?: Partial<PipelineOptions>,
  plugins?: readonly PipelinePlugin[]
): TranslatorPipeline {
  return new TranslatorPipeline(
    new SentenceBasedDecomposer(options?.maxChunkSize ?? 1000),
    new DeterministicTranslator(),
    new ConservativeMerger(),
    {
      concurrency: 1,
      errorPolicy: "fail-fast",
      linkStrategy: "conservative",
      ...options,
    },
    plugins ?? [coverageCheckerPlugin]
  );
}

// =============================================================================
// createCustomPipeline
// =============================================================================

/**
 * Create fully custom pipeline.
 *
 * @param config - Full configuration
 * @returns Configured TranslatorPipeline
 */
export interface CustomPipelineConfig {
  decomposer?: "sliding-window" | "sentence-based";
  translator?: "llm" | "deterministic";
  merger?: "conservative" | "aggressive";
  llm?: LLMPort;
  options?: PipelineOptions;
  plugins?: readonly PipelinePlugin[];
}

export function createCustomPipeline(
  config: CustomPipelineConfig
): TranslatorPipeline {
  const { SlidingWindowDecomposer: SW } = require("../strategies/decompose/sliding-window.js");
  const { SentenceBasedDecomposer: SB } = require("../strategies/decompose/sentence-based.js");
  const { LLMTranslator: LT } = require("../strategies/translate/llm-translator.js");
  const { DeterministicTranslator: DT } = require("../strategies/translate/deterministic.js");
  const { ConservativeMerger: CM } = require("../strategies/merge/conservative.js");
  const { AggressiveMerger: AM } = require("../strategies/merge/aggressive.js");

  const decomposer =
    config.decomposer === "sliding-window"
      ? new SW(config.options?.maxChunkSize ?? 4000)
      : new SB(config.options?.maxChunkSize ?? 4000);

  const translator =
    config.translator === "deterministic"
      ? new DT()
      : config.llm
        ? new LT(config.llm)
        : new DT();

  const merger =
    config.merger === "aggressive" ? new AM() : new CM();

  return new TranslatorPipeline(
    decomposer,
    translator,
    merger,
    config.options,
    config.plugins
  );
}
