/**
 * Trace File Writer
 *
 * Writes Lab traces to files in various formats.
 */
import type { LabTrace } from "../types.js";
import type { TraceWriterOptions } from "./types.js";
/**
 * Get the trace file path based on options.
 */
export declare function getTraceFilePath(options: TraceWriterOptions): string;
/**
 * Write trace to file.
 */
export declare function writeTrace(trace: LabTrace, options: TraceWriterOptions): Promise<string>;
//# sourceMappingURL=writer.d.ts.map