/**
 * @fileoverview Coverage Checker Plugin (SPEC Section 8.4)
 *
 * Calculates quoted string coverage and reports gaps.
 *
 * Per PLG-*:
 * - PLG-1: Creates run-scope hooks
 * - PLG-2: Inspector may only modify diagnostics
 * - PLG-13: Use metricObserve for parallel aggregation
 *
 * @module plugins/coverage-checker
 */

import type {
  PipelinePlugin,
  PipelineHooks,
  ReadonlyPipelineContext,
} from "./types.js";

// =============================================================================
// coverageCheckerPlugin
// =============================================================================

/**
 * Calculates quoted string coverage.
 *
 * Per SPEC Section 8.4:
 * - Inspector plugin (observe only)
 * - Reports which parts of input are covered by extracted intents
 * - Helps identify missed content
 */
export const coverageCheckerPlugin: PipelinePlugin = {
  name: "coverageChecker",
  kind: "inspector",

  createRunHooks(): PipelineHooks {
    // Track covered spans across chunks
    const coveredSpans: Array<{ start: number; end: number }> = [];
    let totalInputLength = 0;

    return {
      afterDecompose(ctx: ReadonlyPipelineContext): void {
        totalInputLength = ctx.input.length;

        if (ctx.chunks) {
          // Track chunk coverage
          for (const chunk of ctx.chunks) {
            coveredSpans.push({
              start: chunk.span.start,
              end: chunk.span.end,
            });
          }
        }
      },

      afterMerge(ctx: ReadonlyPipelineContext): void {
        const { diagnostics, merged, input } = ctx;

        if (!merged) return;

        // Calculate various coverage metrics
        const nodeCount = merged.nodes.length;
        const resolvedCount = merged.nodes.filter(
          (n) => n.resolution.status === "Resolved"
        ).length;
        const ambiguousCount = merged.nodes.filter(
          (n) => n.resolution.status === "Ambiguous"
        ).length;
        const abstractCount = merged.nodes.filter(
          (n) => n.resolution.status === "Abstract"
        ).length;

        // Record metrics
        diagnostics.metric("node_count", nodeCount);
        diagnostics.metric("resolved_count", resolvedCount);
        diagnostics.metric("ambiguous_count", ambiguousCount);
        diagnostics.metric("abstract_count", abstractCount);

        // Calculate resolution ratio
        const resolutionRatio = nodeCount > 0 ? resolvedCount / nodeCount : 0;
        diagnostics.metric("resolution_ratio", resolutionRatio);

        // Calculate chunk coverage
        const chunkCoverage = calculateCoverage(coveredSpans, totalInputLength);
        diagnostics.metric("chunk_coverage_ratio", chunkCoverage);

        // Report uncovered spans as warnings
        const uncoveredSpans = findUncoveredSpans(
          coveredSpans,
          totalInputLength
        );
        for (const span of uncoveredSpans) {
          if (span.end - span.start > 0) {
            const uncoveredText = input.slice(span.start, span.end);
            if (uncoveredText.trim().length > 0) {
              diagnostics.warn(
                "UNCOVERED_SPAN",
                `Text not covered by chunks: "${uncoveredText.slice(0, 50)}${
                  uncoveredText.length > 50 ? "..." : ""
                }" (positions ${span.start}-${span.end})`
              );
            }
          }
        }

        // Calculate ambiguity summary
        if (nodeCount > 0) {
          const avgAmbiguity =
            merged.nodes.reduce(
              (sum, n) => sum + n.resolution.ambiguityScore,
              0
            ) / nodeCount;
          diagnostics.metric("avg_ambiguity_score", avgAmbiguity);

          if (avgAmbiguity > 0.5) {
            diagnostics.warn(
              "HIGH_AMBIGUITY",
              `Average ambiguity score is ${avgAmbiguity.toFixed(2)} (> 0.5). ` +
                `Consider providing more context or clarification.`
            );
          }
        }

        // Log info about coverage
        diagnostics.info(
          "COVERAGE_SUMMARY",
          `Coverage: ${(chunkCoverage * 100).toFixed(1)}% of input covered. ` +
            `${nodeCount} nodes extracted (${resolvedCount} resolved, ` +
            `${ambiguousCount} ambiguous, ${abstractCount} abstract).`
        );
      },
    };
  },
};

// =============================================================================
// Coverage Calculation
// =============================================================================

/**
 * Calculate coverage ratio from spans.
 */
function calculateCoverage(
  spans: Array<{ start: number; end: number }>,
  totalLength: number
): number {
  if (totalLength === 0) return 1;
  if (spans.length === 0) return 0;

  // Merge overlapping spans
  const merged = mergeSpans(spans);

  // Calculate total covered length
  let coveredLength = 0;
  for (const span of merged) {
    coveredLength += span.end - span.start;
  }

  return Math.min(1, coveredLength / totalLength);
}

/**
 * Find spans not covered by the given spans.
 */
function findUncoveredSpans(
  spans: Array<{ start: number; end: number }>,
  totalLength: number
): Array<{ start: number; end: number }> {
  if (spans.length === 0) {
    return totalLength > 0 ? [{ start: 0, end: totalLength }] : [];
  }

  // Merge overlapping spans
  const merged = mergeSpans(spans);

  // Find gaps
  const uncovered: Array<{ start: number; end: number }> = [];
  let currentPos = 0;

  for (const span of merged) {
    if (currentPos < span.start) {
      uncovered.push({ start: currentPos, end: span.start });
    }
    currentPos = Math.max(currentPos, span.end);
  }

  if (currentPos < totalLength) {
    uncovered.push({ start: currentPos, end: totalLength });
  }

  return uncovered;
}

/**
 * Merge overlapping spans.
 */
function mergeSpans(
  spans: Array<{ start: number; end: number }>
): Array<{ start: number; end: number }> {
  if (spans.length === 0) return [];

  // Sort by start position
  const sorted = [...spans].sort((a, b) => a.start - b.start);

  const merged: Array<{ start: number; end: number }> = [];
  let current = { ...sorted[0] };

  for (let i = 1; i < sorted.length; i++) {
    const span = sorted[i];
    if (span.start <= current.end) {
      // Overlapping - extend current
      current.end = Math.max(current.end, span.end);
    } else {
      // No overlap - save current and start new
      merged.push(current);
      current = { ...span };
    }
  }

  merged.push(current);
  return merged;
}
