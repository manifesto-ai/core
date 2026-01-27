/**
 * @fileoverview Decompose Layer Exports (ADR-003)
 *
 * Optional preprocessing layer for splitting complex inputs
 * into manageable chunks before translation.
 *
 * Pipeline:
 * 1. decompose(text) -> chunks
 * 2. translate(chunk) for each chunk
 * 3. merge(translatedChunks) -> final graph
 */

// Types
export type {
  DecomposeStrategy,
  DecomposeResult,
  MergeOptions,
  MergeResult,
} from "./types.js";

// Implementations
export { DeterministicDecompose } from "./implementations/deterministic.js";
export {
  ShallowLLMDecompose,
  type ShallowLLMConfig,
} from "./implementations/shallow-llm.js";

// Merge
export { conservativeMerge } from "./merge/conservative.js";
