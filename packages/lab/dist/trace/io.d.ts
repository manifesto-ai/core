/**
 * Trace I/O
 *
 * Save and load Lab trace artifacts.
 * Added in v1.1.
 */
import type { LabTrace, TraceSaveOptions } from "../types.js";
/**
 * Save a trace to a file.
 *
 * @param trace - The trace to save
 * @param filePath - Path to save to
 * @param options - Save options
 */
export declare function saveTrace(trace: LabTrace, filePath: string, options?: TraceSaveOptions): Promise<void>;
/**
 * Load a trace from a file.
 *
 * @param filePath - Path to the trace file
 * @returns The loaded trace
 * @throws Error if file is invalid or corrupted
 */
export declare function loadTrace(filePath: string): Promise<LabTrace>;
/**
 * Load multiple traces matching a glob pattern.
 *
 * @param pattern - Glob pattern (e.g., "./traces/*.trace.json")
 * @returns Array of loaded traces
 */
export declare function loadAllTraces(pattern: string): Promise<LabTrace[]>;
/**
 * Load all traces from a directory.
 *
 * @param dir - Directory path
 * @returns Array of loaded traces
 */
export declare function loadDirTraces(dir: string): Promise<LabTrace[]>;
/**
 * LabTrace static methods for I/O operations.
 */
export declare const LabTraceIO: {
    /**
     * Load a single trace from file.
     */
    load: typeof loadTrace;
    /**
     * Load multiple traces matching glob pattern.
     */
    loadAll: typeof loadAllTraces;
    /**
     * Load all traces from directory.
     */
    loadDir: typeof loadDirTraces;
    /**
     * Save a trace to file.
     */
    save: typeof saveTrace;
};
//# sourceMappingURL=io.d.ts.map