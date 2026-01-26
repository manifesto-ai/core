/**
 * @fileoverview Error Recovery for LLM Output
 *
 * Handles malformed or invalid LLM responses.
 */

import type { LLMIntentNode } from "./provider.js";
import { parseLLMOutput, validateNodeDependencies } from "./output-schema.js";

// =============================================================================
// Types
// =============================================================================

export type RecoveryResult = {
  readonly success: boolean;
  readonly nodes: readonly LLMIntentNode[];
  readonly error?: string;
  readonly warnings: readonly string[];
};

// =============================================================================
// Recovery Strategies
// =============================================================================

/**
 * Try to extract JSON from a response that may contain extra text.
 */
function extractJSON(text: string): string | null {
  // Try to find JSON object or array
  const jsonStartPatterns = ["{", "["];
  const jsonEndPatterns = ["}", "]"];

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (jsonStartPatterns.includes(char)) {
      const endChar = char === "{" ? "}" : "]";
      let depth = 0;
      let inString = false;
      let escape = false;

      for (let j = i; j < text.length; j++) {
        const c = text[j];

        if (escape) {
          escape = false;
          continue;
        }

        if (c === "\\") {
          escape = true;
          continue;
        }

        if (c === '"') {
          inString = !inString;
          continue;
        }

        if (inString) continue;

        if (c === char) depth++;
        if (c === endChar) depth--;

        if (depth === 0) {
          return text.substring(i, j + 1);
        }
      }
    }
  }

  return null;
}

/**
 * Try to fix common JSON issues.
 */
function fixCommonJSONIssues(json: string): string {
  let fixed = json;

  // Remove trailing commas before ] or }
  fixed = fixed.replace(/,(\s*[}\]])/g, "$1");

  // Fix single quotes to double quotes (simple cases)
  // This is risky but helps with some LLM outputs
  fixed = fixed.replace(/'/g, '"');

  // Remove comments (// style)
  fixed = fixed.replace(/\/\/[^\n]*/g, "");

  return fixed;
}

/**
 * Create fallback empty node for unparseable input.
 */
function createFallbackNode(input: string): LLMIntentNode {
  return {
    tempId: "fallback",
    ir: {
      v: "0.1",
      force: "DO",
      event: { lemma: "UNKNOWN", class: "CONTROL" },
      args: {},
    },
    dependsOnTempIds: [],
    ambiguityIndicators: {
      hasUnresolvedRef: false,
      missingRequiredRoles: [],
      multipleInterpretations: true,
      confidenceScore: 0.1,
    },
  };
}

// =============================================================================
// Main Recovery Function
// =============================================================================

/**
 * Attempt to recover valid nodes from potentially malformed LLM output.
 *
 * Recovery strategies:
 * 1. Direct parse
 * 2. Extract JSON from surrounding text
 * 3. Fix common JSON issues and retry
 * 4. Fallback to empty/unknown node
 */
export function recoverFromMalformedOutput(
  rawOutput: string,
  originalInput: string
): RecoveryResult {
  const warnings: string[] = [];

  // Strategy 1: Direct parse
  const directResult = parseLLMOutput(rawOutput);
  if (directResult.nodes.length > 0 && !directResult.error) {
    // Add normalization warnings
    for (const w of directResult.warnings) {
      warnings.push(`[${w.nodeId}] ${w.field}: ${w.reason}`);
    }
    const validation = validateNodeDependencies(directResult.nodes);
    if (!validation.valid) {
      warnings.push(`Dependency validation failed: ${validation.error}`);
    }
    return {
      success: true,
      nodes: directResult.nodes,
      warnings,
    };
  }

  // Strategy 2: Extract JSON from text
  const extractedJSON = extractJSON(rawOutput);
  if (extractedJSON) {
    const extractedResult = parseLLMOutput(extractedJSON);
    if (extractedResult.nodes.length > 0 && !extractedResult.error) {
      warnings.push("Extracted JSON from surrounding text");
      // Add normalization warnings
      for (const w of extractedResult.warnings) {
        warnings.push(`[${w.nodeId}] ${w.field}: ${w.reason}`);
      }
      const validation = validateNodeDependencies(extractedResult.nodes);
      if (!validation.valid) {
        warnings.push(`Dependency validation failed: ${validation.error}`);
      }
      return {
        success: true,
        nodes: extractedResult.nodes,
        warnings,
      };
    }
  }

  // Strategy 3: Fix common issues
  const fixedJSON = fixCommonJSONIssues(extractedJSON || rawOutput);
  if (fixedJSON !== rawOutput) {
    const fixedResult = parseLLMOutput(fixedJSON);
    if (fixedResult.nodes.length > 0 && !fixedResult.error) {
      warnings.push("Applied JSON fixes to parse output");
      // Add normalization warnings
      for (const w of fixedResult.warnings) {
        warnings.push(`[${w.nodeId}] ${w.field}: ${w.reason}`);
      }
      const validation = validateNodeDependencies(fixedResult.nodes);
      if (!validation.valid) {
        warnings.push(`Dependency validation failed: ${validation.error}`);
      }
      return {
        success: true,
        nodes: fixedResult.nodes,
        warnings,
      };
    }
  }

  // Strategy 4: Fallback
  warnings.push("All recovery strategies failed, using fallback node");
  return {
    success: false,
    nodes: [createFallbackNode(originalInput)],
    error: directResult.error || "Unable to parse LLM output",
    warnings,
  };
}

// =============================================================================
// Retry Logic
// =============================================================================

export type RetryConfig = {
  /** Maximum number of retries */
  readonly maxRetries: number;
  /** Base delay between retries in ms */
  readonly baseDelayMs: number;
  /** Whether to use exponential backoff */
  readonly exponentialBackoff: boolean;
};

export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 2,
  baseDelayMs: 1000,
  exponentialBackoff: true,
};

/**
 * Calculate delay for retry attempt.
 */
export function calculateRetryDelay(attempt: number, config: RetryConfig): number {
  if (config.exponentialBackoff) {
    return config.baseDelayMs * Math.pow(2, attempt);
  }
  return config.baseDelayMs;
}

/**
 * Determine if an error is retryable.
 */
export function isRetryableError(error: unknown): boolean {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();

    // Rate limiting
    if (message.includes("rate limit") || message.includes("429")) {
      return true;
    }

    // Temporary server errors
    if (message.includes("500") || message.includes("502") || message.includes("503")) {
      return true;
    }

    // Timeout
    if (message.includes("timeout") || message.includes("timed out")) {
      return true;
    }

    // Network errors
    if (message.includes("network") || message.includes("econnreset")) {
      return true;
    }
  }

  return false;
}
