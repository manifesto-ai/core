/**
 * @fileoverview Plugin Types (SPEC Section 8)
 *
 * Plugin system for extending pipeline behavior.
 *
 * Per SPEC Section 11.8 (PLG-*):
 * - PLG-1: Plugins create run-scope hooks via createRunHooks()
 * - PLG-2: Inspector plugins may only modify diagnostics
 * - PLG-3: Transformer plugins must explicitly return modified graph
 * - PLG-14: Inspector afterMerge returning IntentGraph is an error
 *
 * @module plugins/types
 */

import type { Chunk } from "../core/types/chunk.js";
import type { IntentGraph } from "../core/types/intent-graph.js";
import type { DiagnosticsBag } from "../core/types/diagnostics.js";
import type { ValidationResult } from "../core/types/validation.js";

// =============================================================================
// ReadonlyPipelineContext
// =============================================================================

/**
 * Read-only context for plugins.
 *
 * Per SPEC Section 8.2:
 * All plugins receive this read-only view.
 */
export interface ReadonlyPipelineContext {
  readonly input: string;
  readonly chunks?: readonly Chunk[];
  readonly graphs?: readonly IntentGraph[];
  readonly merged?: IntentGraph;
  readonly structuralValidation?: ValidationResult;
  readonly lexiconValidation?: ValidationResult;
  readonly diagnostics: DiagnosticsBag;
}

// =============================================================================
// ChunkHookContext
// =============================================================================

/**
 * Per-chunk hook context (parallel-safe).
 *
 * Per SPEC Section 8.2:
 * Includes chunk-specific information.
 */
export interface ChunkHookContext extends ReadonlyPipelineContext {
  /** Current chunk index */
  readonly chunkIndex: number;

  /** Current chunk */
  readonly chunk: Chunk;

  /** Chunk translation result (afterTranslateChunk only) */
  readonly chunkGraph?: IntentGraph;
}

// =============================================================================
// Hook Types
// =============================================================================

/**
 * Standard hook (Inspector/Transformer, no return).
 *
 * Per SPEC Section 8.3
 */
export type StandardHook = (
  ctx: ReadonlyPipelineContext
) => void | Promise<void>;

/**
 * Chunk hook (parallel execution, chunk-local context).
 *
 * Per SPEC Section 8.3
 */
export type ChunkHook = (ctx: ChunkHookContext) => void | Promise<void>;

/**
 * Transformer hook (afterMerge only).
 * Returns modified graph; pipeline re-validates.
 *
 * Per SPEC Section 8.3:
 * - Returns void to skip modification
 * - Returns IntentGraph to replace merged graph
 * - Per PLG-14: Inspector plugins MUST NOT return IntentGraph
 */
export type TransformerHook = (
  ctx: ReadonlyPipelineContext
) => void | IntentGraph | Promise<void | IntentGraph>;

// =============================================================================
// PipelineHooks
// =============================================================================

/**
 * Pipeline hooks definition.
 *
 * Per SPEC Section 8.3
 */
export interface PipelineHooks {
  beforeDecompose?: StandardHook;
  afterDecompose?: StandardHook;
  beforeTranslateChunk?: ChunkHook;
  afterTranslateChunk?: ChunkHook;
  beforeMerge?: StandardHook;
  afterMerge?: TransformerHook;
  afterStructuralValidate?: StandardHook;
  afterLexiconValidate?: StandardHook;
}

// =============================================================================
// PipelinePlugin
// =============================================================================

/**
 * Pipeline plugin.
 *
 * Per SPEC Section 8.1:
 * Plugins extend pipeline behavior without modifying core logic.
 * Two kinds: Inspector (observe) and Transformer (modify).
 *
 * Invariants (PLG-*):
 * - PLG-1: Plugins create run-scope hooks via createRunHooks()
 * - PLG-2: Inspector plugins may only modify diagnostics
 * - PLG-3: Transformer plugins must explicitly return modified graph
 * - PLG-14: If plugin.kind === "inspector" and afterMerge returns IntentGraph,
 *           Pipeline SHALL throw error
 */
export interface PipelinePlugin {
  /** Plugin name (for debugging) */
  readonly name: string;

  /** Plugin kind */
  readonly kind: "inspector" | "transformer";

  /**
   * Create run-scoped hooks.
   * Called once per pipeline.process() invocation.
   *
   * @returns Hooks for this run
   */
  createRunHooks(): PipelineHooks;
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Type guard for inspector plugins.
 */
export function isInspector(plugin: PipelinePlugin): boolean {
  return plugin.kind === "inspector";
}

/**
 * Type guard for transformer plugins.
 */
export function isTransformer(plugin: PipelinePlugin): boolean {
  return plugin.kind === "transformer";
}
