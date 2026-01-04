/**
 * Trace Recorder
 *
 * Records Lab trace events during experiment execution.
 */
import { writeTrace } from "./writer.js";
/**
 * Create a trace recorder.
 *
 * @param options - Lab options containing trace configuration
 * @returns A new trace recorder instance
 */
export function createTraceRecorder(options) {
    const startTime = Date.now();
    // Initialize trace state
    const state = {
        header: {
            specVersion: "lab/1.1",
            runId: options.runId,
            necessityLevel: options.necessityLevel,
            schemaHash: "", // Will be set from World
            createdAt: new Date().toISOString(),
            environment: options.environment,
        },
        events: [],
        isComplete: false,
        outcome: undefined,
    };
    return {
        record(event) {
            if (state.isComplete) {
                console.warn("[TraceRecorder] Cannot record event after trace is complete");
                return;
            }
            state.events.push(event);
        },
        getTrace() {
            const header = { ...state.header };
            if (state.isComplete) {
                header.completedAt = new Date().toISOString();
                header.durationMs = Date.now() - startTime;
            }
            return {
                header,
                events: [...state.events],
                outcome: state.outcome,
            };
        },
        get eventCount() {
            return state.events.length;
        },
        setSchemaHash(hash) {
            state.header.schemaHash = hash;
        },
        async flush() {
            const trace = this.getTrace();
            const format = options.traceFormat ?? "json";
            try {
                const filePath = await writeTrace(trace, {
                    outputPath: options.outputPath,
                    format,
                    runId: options.runId,
                });
                console.log(`[TraceRecorder] Trace written to: ${filePath}`);
            }
            catch (error) {
                console.error("[TraceRecorder] Failed to write trace:", error);
                throw error;
            }
        },
        complete(outcome) {
            state.isComplete = true;
            state.outcome = outcome;
            // Update header with completion info
            state.header.completedAt = new Date().toISOString();
            state.header.durationMs = Date.now() - startTime;
            // Add termination event if not already present
            const hasTermination = state.events.some((e) => e.type === "termination");
            if (!hasTermination) {
                state.events.push({
                    type: "termination",
                    seq: state.events.length,
                    timestamp: new Date().toISOString(),
                    outcome: outcome === "aborted" ? "failure" : outcome,
                });
            }
        },
    };
}
//# sourceMappingURL=recorder.js.map