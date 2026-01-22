/**
 * Result Mapper
 *
 * Maps HostResult (from @manifesto-ai/host) to ActionResult (from @manifesto-ai/app).
 *
 * Host Status → App Status:
 * - "complete" → "completed"
 * - "pending" → "failed"
 * - "error" → "failed"
 *
 * @see Plan: lucky-splashing-curry.md
 */

import type { HostResult, HostError } from "@manifesto-ai/host";
import type {
  ActionResult,
  CompletedActionResult,
  FailedActionResult,
  ErrorValue,
  ExecutionStats,
  RuntimeKind,
} from "../core/types/index.js";

// =============================================================================
// Types
// =============================================================================

/**
 * Options for mapping host result to action result
 */
export interface MapResultOptions {
  /** Proposal ID for this action */
  proposalId: string;

  /** Decision ID (can be same as proposalId or unique) */
  decisionId: string;

  /** World ID for the resulting world */
  worldId: string;

  /** Runtime kind */
  runtime: RuntimeKind;

  /** Execution start time (for stats) */
  startTime: number;

  /** Number of effects executed */
  effectCount: number;

  /** Number of patches applied */
  patchCount: number;
}

// =============================================================================
// Error Conversion
// =============================================================================

/**
 * Convert HostError to ErrorValue.
 */
export function hostErrorToErrorValue(
  error: HostError,
  options: { actionId: string }
): ErrorValue {
  return {
    code: error.code ?? "HOST_ERROR",
    message: error.message,
    source: {
      actionId: options.actionId,
      nodePath: "host",
    },
    timestamp: Date.now(),
    context: error.details,
  };
}

/**
 * Create an ErrorValue from a generic Error.
 */
export function errorToErrorValue(
  error: Error | unknown,
  options: { actionId: string; nodePath?: string }
): ErrorValue {
  const message = error instanceof Error ? error.message : String(error);
  const code =
    error instanceof Error && "code" in error
      ? String((error as Error & { code?: string }).code)
      : "UNKNOWN_ERROR";

  return {
    code,
    message,
    source: {
      actionId: options.actionId,
      nodePath: options.nodePath ?? "unknown",
    },
    timestamp: Date.now(),
    context:
      error instanceof Error
        ? { stack: error.stack }
        : { rawError: String(error) },
  };
}

// =============================================================================
// Stats Calculation
// =============================================================================

/**
 * Calculate execution stats.
 */
export function calculateStats(options: {
  startTime: number;
  effectCount: number;
  patchCount: number;
}): ExecutionStats {
  return {
    durationMs: Date.now() - options.startTime,
    effectCount: options.effectCount,
    patchCount: options.patchCount,
  };
}

// =============================================================================
// Main Mapper
// =============================================================================

/**
 * Map HostResult to ActionResult.
 *
 * Status mapping:
 * - Host "complete" → App "completed"
 * - Host "pending" → App "failed" (requirements remain)
 * - Host "error" → App "failed"
 */
export function mapHostResultToActionResult(
  hostResult: HostResult,
  options: MapResultOptions
): ActionResult {
  const stats = calculateStats({
    startTime: options.startTime,
    effectCount: options.effectCount,
    patchCount: options.patchCount,
  });

  switch (hostResult.status) {
    case "complete": {
      const completedResult: CompletedActionResult = {
        status: "completed",
        worldId: options.worldId,
        proposalId: options.proposalId,
        decisionId: options.decisionId,
        stats,
        runtime: options.runtime,
      };
      return completedResult;
    }

    case "pending":
    case "error": {
      const snapshotError = extractSnapshotError(hostResult.snapshot, {
        actionId: options.proposalId,
      });
      const fallbackError: ErrorValue = hostResult.error
        ? hostErrorToErrorValue(hostResult.error, {
            actionId: options.proposalId,
          })
        : {
            code: hostResult.status === "pending" ? "HOST_PENDING" : "HOST_ERROR",
            message: hostResult.status === "pending"
              ? "Host returned pending status"
              : "Unknown host error",
            source: { actionId: options.proposalId, nodePath: "host" },
            timestamp: Date.now(),
          };
      const errorValue: ErrorValue = snapshotError ?? fallbackError;

      const failedResult: FailedActionResult = {
        status: "failed",
        proposalId: options.proposalId,
        decisionId: options.decisionId,
        error: errorValue,
        worldId: options.worldId,
        runtime: options.runtime,
      };
      return failedResult;
    }

    default: {
      // Exhaustive check
      const _exhaustive: never = hostResult.status;
      throw new Error(`Unknown host status: ${_exhaustive}`);
    }
  }
}

// =============================================================================
// Snapshot Extraction
// =============================================================================

/**
 * Extract error from snapshot's system.lastError if present.
 */
export function extractSnapshotError(
  snapshot: HostResult["snapshot"],
  options: { actionId: string }
): ErrorValue | null {
  const lastError = snapshot.system?.lastError;
  if (!lastError) {
    return null;
  }

  // If it's already an ErrorValue shape
  if (
    typeof lastError === "object" &&
    "code" in lastError &&
    "message" in lastError
  ) {
    return lastError as ErrorValue;
  }

  // Convert to ErrorValue
  return {
    code: "SNAPSHOT_ERROR",
    message: String(lastError),
    source: {
      actionId: options.actionId,
      nodePath: "snapshot",
    },
    timestamp: Date.now(),
  };
}
