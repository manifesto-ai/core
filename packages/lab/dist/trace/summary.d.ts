/**
 * Trace Summary
 *
 * Aggregates statistics across one or more Lab traces.
 * Added in v1.1.
 */
import type { LabTrace, TraceSummary } from "../types.js";
/**
 * Summarize one or more traces.
 *
 * @param traces - Single trace or array of traces
 * @returns Aggregated summary statistics
 */
export declare function summarize(traces: LabTrace | LabTrace[]): TraceSummary;
/**
 * Format summary as a human-readable string.
 *
 * @param summary - The summary to format
 * @returns Formatted string
 */
export declare function formatSummary(summary: TraceSummary): string;
//# sourceMappingURL=summary.d.ts.map