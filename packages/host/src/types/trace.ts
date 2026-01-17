/**
 * Trace Event Types for Host v2.0.1
 *
 * These trace events are used for debugging, compliance testing,
 * and replay functionality.
 *
 * @see host-SPEC-v2.0.1.md §11.5 Deterministic Replay
 */

import type { ExecutionKey } from "./execution.js";

/**
 * Trace events emitted during Host execution.
 * Used to verify SPEC compliance rules and enable trace replay.
 */
export type TraceEvent =
  // Runner lifecycle events (RUN-1~4, LIVE-1~4)
  | { t: "runner:kick"; key: ExecutionKey; timestamp: number }
  | { t: "runner:start"; key: ExecutionKey; timestamp: number }
  | { t: "runner:end"; key: ExecutionKey; timestamp: number }
  | {
      t: "runner:recheck";
      key: ExecutionKey;
      queueEmpty: boolean;
      kickRequested: boolean;
    }

  // Job lifecycle events (JOB-1~5)
  | { t: "job:start"; key: ExecutionKey; jobType: string; jobId: string }
  | { t: "job:end"; key: ExecutionKey; jobType: string; jobId: string }

  // Core computation events (COMP-REQ-INTERLOCK-1~2)
  | {
      t: "core:compute";
      key: ExecutionKey;
      intentId: string;
      iteration: number;
    }
  | { t: "core:apply"; key: ExecutionKey; patchCount: number; source: string }

  // Effect execution events (FULFILL-0~4, ERR-FE-1~5, REQ-CLEAR-1)
  | {
      t: "effect:dispatch";
      key: ExecutionKey;
      requirementId: string;
      effectType: string;
    }
  | {
      t: "effect:fulfill:drop";
      key: ExecutionKey;
      requirementId: string;
      reason: "stale" | "duplicate";
    }
  | {
      t: "effect:fulfill:apply";
      key: ExecutionKey;
      requirementId: string;
      patchCount: number;
    }
  | {
      t: "effect:fulfill:error";
      key: ExecutionKey;
      requirementId: string;
      phase: "apply" | "clear" | "error-patch";
      error?: string;
    }

  // Requirement lifecycle events (REQ-CLEAR-1, INV-RL-2)
  | { t: "requirement:clear"; key: ExecutionKey; requirementId: string }

  // Continue compute events (FULFILL-3)
  | { t: "continue:enqueue"; key: ExecutionKey; intentId: string }

  // Context events (CTX-1~5)
  | {
      t: "context:frozen";
      key: ExecutionKey;
      jobId: string;
      now: number;
      randomSeed: string;
    }

  // Fatal error events (ERR-FE-3)
  | {
      t: "fatal:escalate";
      key: ExecutionKey;
      intentId: string;
      error: string;
    };
