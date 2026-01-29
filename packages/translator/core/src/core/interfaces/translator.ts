/**
 * @fileoverview TranslateStrategy Interface (SPEC Section 6.2)
 *
 * Translates text into an Intent Graph.
 *
 * Per SPEC Section 6.2:
 * - translate() returns Promise<IntentGraph>
 * - Each chunk is translated independently
 *
 * @module core/interfaces/translator
 */

import type { IntentGraph } from "../types/intent-graph.js";

// =============================================================================
// TranslateOptions
// =============================================================================

/**
 * Options for translation.
 *
 * Per SPEC Section 6.2
 */
export interface TranslateOptions {
  /** Maximum nodes to extract per chunk */
  maxNodes?: number;

  /** Domain hint (e.g., "project-management", "calendar") */
  domain?: string;

  /** Language hint */
  language?: string;

  /** Allowed event types (whitelist) */
  allowedEvents?: string[];
}

// =============================================================================
// TranslateStrategy
// =============================================================================

/**
 * Translates text into an Intent Graph.
 *
 * Per SPEC Section 6.2:
 * - translate() returns Promise<IntentGraph>
 * - Result graph must satisfy G-INV-* invariants
 *
 * Built-in implementations:
 * - LLMTranslator: LLM-based semantic extraction
 * - DeterministicTranslator: Rule-based extraction (testing)
 *
 * Invariants (G-INV-* per output):
 * - G-INV-1: Node IDs are unique within graph
 * - G-INV-2: All dependsOn IDs exist in graph
 * - G-INV-3: Graph is a DAG (no cycles)
 * - G-INV-4: Non-abstract nodes SHALL NOT depend on abstract nodes
 */
export interface TranslateStrategy {
  /**
   * Strategy name for debugging and logging.
   */
  readonly name: string;

  /**
   * Translate text to Intent Graph.
   *
   * @param text - Input text (chunk or full)
   * @param options - Translation options
   * @returns Intent Graph with nodes
   */
  translate(text: string, options?: TranslateOptions): Promise<IntentGraph>;
}
