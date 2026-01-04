/**
 * Trace Diff
 *
 * Compare two Lab traces and identify divergence points.
 * Added in v1.1.
 */
import type { LabTrace, TraceDiff } from "../types.js";
/**
 * Compare two traces and identify differences.
 *
 * @param traceA - First trace
 * @param traceB - Second trace
 * @returns Comparison result
 */
export declare function diffTraces(traceA: LabTrace, traceB: LabTrace): TraceDiff;
/**
 * Format a trace diff as human-readable text.
 *
 * @param diff - The trace diff
 * @returns Formatted string
 */
export declare function formatDiff(diff: TraceDiff): string;
/**
 * Check if two traces are identical.
 *
 * @param traceA - First trace
 * @param traceB - Second trace
 * @returns true if traces are identical
 */
export declare function areTracesIdentical(traceA: LabTrace, traceB: LabTrace): boolean;
//# sourceMappingURL=diff.d.ts.map