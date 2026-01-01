/**
 * Trace System
 *
 * Provides trace recording, mapping, and file output.
 */

export { createTraceRecorder } from "./recorder.js";
export { mapWorldEventToTraceEvent } from "./mapper.js";
export { writeTrace, getTraceFilePath } from "./writer.js";
export {
  saveTrace,
  loadTrace,
  loadAllTraces,
  loadDirTraces,
  LabTraceIO,
} from "./io.js";

// v1.1: Summary
export { summarize, formatSummary } from "./summary.js";

// v1.1: Diff
export { diffTraces, formatDiff, areTracesIdentical } from "./diff.js";

// v1.1: Replay
export { replay, replayPartial, findFirstDivergence } from "./replay.js";

export type { TraceRecorder, TraceWriterOptions, TraceState } from "./types.js";
