/**
 * @fileoverview Core Interfaces Module Exports
 *
 * All strategy interfaces for Translator v1.0.
 * Per SPEC Section 6.
 *
 * @module core/interfaces
 */

// =============================================================================
// DecomposeStrategy (SPEC 6.1)
// =============================================================================

export { type DecomposeOptions, type DecomposeStrategy } from "./decomposer.js";

// =============================================================================
// TranslateStrategy (SPEC 6.2)
// =============================================================================

export { type TranslateOptions, type TranslateStrategy } from "./translator.js";

// =============================================================================
// MergeStrategy (SPEC 6.3)
// =============================================================================

export { type MergeOptions, type MergeStrategy } from "./merger.js";

// =============================================================================
// LLMPort (SPEC 9)
// =============================================================================

export {
  type LLMCallOptions,
  type LLMMessage,
  type LLMRequest,
  type LLMUsage,
  type LLMResponse,
  type LLMPort,
} from "./llm-port.js";

// =============================================================================
// TargetExporter (SPEC 10)
// =============================================================================

export { type ExportInput, type TargetExporter, exportTo } from "./exporter-port.js";
