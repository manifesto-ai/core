/**
 * Trace System
 *
 * Provides trace recording, mapping, and file output.
 */
export { createTraceRecorder } from "./recorder.js";
export { mapWorldEventToTraceEvent } from "./mapper.js";
export { writeTrace, getTraceFilePath } from "./writer.js";
export { saveTrace, loadTrace, loadAllTraces, loadDirTraces, LabTraceIO, } from "./io.js";
export { summarize, formatSummary } from "./summary.js";
export { diffTraces, formatDiff, areTracesIdentical } from "./diff.js";
export { replay, replayPartial, findFirstDivergence } from "./replay.js";
export type { TraceRecorder, TraceWriterOptions, TraceState } from "./types.js";
//# sourceMappingURL=index.d.ts.map