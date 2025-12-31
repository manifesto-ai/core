/**
 * Trace System Internal Types
 *
 * Internal types for the trace recording system.
 */

import type {
  LabOptions,
  LabTrace,
  LabTraceEvent,
  LabTraceHeader,
  TraceOutcome,
} from "../types.js";

/**
 * Trace recorder interface.
 */
export interface TraceRecorder {
  /** Record a trace event */
  record(event: LabTraceEvent): void;

  /** Get the current trace */
  getTrace(): LabTrace;

  /** Get the number of recorded events */
  readonly eventCount: number;

  /** Set the schema hash (from World) */
  setSchemaHash(hash: string): void;

  /** Flush trace to file */
  flush(): Promise<void>;

  /** Mark trace as complete */
  complete(outcome: TraceOutcome): void;
}

/**
 * Trace writer options.
 */
export interface TraceWriterOptions {
  outputPath: string;
  format: "json" | "jsonl" | "json.gz";
  runId: string;
}

/**
 * Internal trace state.
 */
export interface TraceState {
  header: LabTraceHeader;
  events: LabTraceEvent[];
  isComplete: boolean;
  outcome?: TraceOutcome;
}
