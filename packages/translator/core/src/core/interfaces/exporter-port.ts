/**
 * @fileoverview TargetExporter Interface (SPEC Section 10)
 *
 * Target-specific output generator.
 * Implements Ports & Adapters pattern for output.
 *
 * Per SPEC Section 10.1:
 * - TargetExporter is the output adapter interface
 * - Concrete implementations are in separate target packages
 *
 * @module core/interfaces/exporter-port
 */

import type { Chunk } from "../types/chunk.js";
import type { IntentGraph } from "../types/intent-graph.js";
import type { DiagnosticsReadonly } from "../types/diagnostics.js";

// =============================================================================
// ExportInput
// =============================================================================

/**
 * Input to exporter.
 *
 * Per SPEC Section 10.1
 */
export interface ExportInput {
  /** Final merged graph */
  readonly graph: IntentGraph;

  /** Pipeline diagnostics (optional) */
  readonly diagnostics?: DiagnosticsReadonly;

  /** Source information (optional, for traceback) */
  readonly source?: Readonly<{
    text?: string;
    chunks?: readonly Chunk[];
  }>;
}

// =============================================================================
// TargetExporter
// =============================================================================

/**
 * Target-specific output generator.
 * Implements Ports & Adapters pattern for output.
 *
 * Per SPEC Section 10.1:
 * - TOut: Output type (target-specific)
 * - TCtx: Context type (target-specific, e.g., Lexicon/Resolver)
 *
 * Exporter packages:
 * - @manifesto-ai/translator-target-manifesto
 * - @manifesto-ai/translator-target-json
 * - @manifesto-ai/translator-target-openapi
 *
 * Invariants (EXP-*):
 * - EXP-3: Exporters SHALL treat ExportInput.graph as immutable
 */
export interface TargetExporter<TOut, TCtx = void> {
  /** Exporter identifier */
  readonly id: string;

  /**
   * Export Intent Graph to target-specific output.
   *
   * @param input - Pipeline result
   * @param ctx - Target-specific context
   * @returns Target-specific output
   */
  export(input: ExportInput, ctx: TCtx): Promise<TOut>;
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Convenience helper for exporting.
 *
 * Per SPEC Section 10.1
 *
 * @example
 * ```typescript
 * const bundle = await exportTo(
 *   manifestoExporter,
 *   { graph: result.graph, diagnostics: result.diagnostics },
 *   { lexicon: myLexicon, resolver: myResolver }
 * );
 * ```
 */
export async function exportTo<TOut, TCtx>(
  exporter: TargetExporter<TOut, TCtx>,
  input: ExportInput,
  ctx: TCtx
): Promise<TOut> {
  return exporter.export(input, ctx);
}
