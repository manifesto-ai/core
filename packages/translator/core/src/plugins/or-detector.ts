/**
 * @fileoverview OR Detector Plugin (SPEC Section 8.4)
 *
 * Detects OR patterns in input text and emits warnings.
 *
 * Per PLG-*:
 * - PLG-1: Creates run-scope hooks
 * - PLG-2: Inspector may only modify diagnostics
 *
 * @module plugins/or-detector
 */

import type {
  PipelinePlugin,
  PipelineHooks,
  ReadonlyPipelineContext,
} from "./types.js";

// =============================================================================
// OR Pattern Regex
// =============================================================================

/**
 * Patterns that indicate alternatives/OR conditions.
 */
const OR_PATTERNS = [
  /\bor\b/gi, // "or"
  /\beither\b.*?\bor\b/gi, // "either...or"
  /\b(?:one|any)\s+of\b/gi, // "one of", "any of"
  /\balternatively\b/gi, // "alternatively"
  /\binstead\b/gi, // "instead"
  /\b\/\b/g, // "foo/bar" style
];

// =============================================================================
// orDetectorPlugin
// =============================================================================

/**
 * Detects OR patterns, emits warnings.
 *
 * Per SPEC Section 8.4:
 * - Inspector plugin (observe only)
 * - Emits warnings for detected OR patterns
 * - Helps identify potential branching in intent
 */
export const orDetectorPlugin: PipelinePlugin = {
  name: "orDetector",
  kind: "inspector",

  createRunHooks(): PipelineHooks {
    return {
      afterDecompose(ctx: ReadonlyPipelineContext): void {
        const { input, diagnostics, chunks } = ctx;

        // Check each chunk for OR patterns
        if (chunks) {
          for (const chunk of chunks) {
            const detections = detectOrPatterns(chunk.text);

            for (const detection of detections) {
              diagnostics.warn(
                "OR_PATTERN_DETECTED",
                `Potential OR pattern found in chunk ${chunk.index}: "${detection.match}" ` +
                  `at position ${detection.position}. ` +
                  `This may indicate branching logic that could affect intent extraction.`
              );
            }
          }

          // Aggregate metric
          const totalDetections = chunks.reduce((sum, chunk) => {
            return sum + detectOrPatterns(chunk.text).length;
          }, 0);

          diagnostics.metric("or_pattern_count", totalDetections);
        } else {
          // Check full input
          const detections = detectOrPatterns(input);
          diagnostics.metric("or_pattern_count", detections.length);

          for (const detection of detections) {
            diagnostics.warn(
              "OR_PATTERN_DETECTED",
              `Potential OR pattern found: "${detection.match}" at position ${detection.position}`
            );
          }
        }
      },
    };
  },
};

// =============================================================================
// Detection Logic
// =============================================================================

interface OrPatternDetection {
  match: string;
  position: number;
  pattern: string;
}

/**
 * Detect OR patterns in text.
 */
function detectOrPatterns(text: string): OrPatternDetection[] {
  const detections: OrPatternDetection[] = [];

  for (const pattern of OR_PATTERNS) {
    // Reset regex state
    pattern.lastIndex = 0;

    let match: RegExpExecArray | null;
    while ((match = pattern.exec(text)) !== null) {
      detections.push({
        match: match[0],
        position: match.index,
        pattern: pattern.source,
      });
    }
  }

  // Sort by position
  detections.sort((a, b) => a.position - b.position);

  return detections;
}
