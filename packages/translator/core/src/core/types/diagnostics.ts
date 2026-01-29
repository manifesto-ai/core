/**
 * @fileoverview Diagnostics Types (SPEC Section 5.5)
 *
 * Diagnostic information collector for pipeline operations.
 *
 * Per SPEC Section 11.10 (DIAG-*):
 * - DIAG-OBS-1: metricObserve() implementations should consider sample limits
 *
 * @module core/types/diagnostics
 */

// =============================================================================
// Diagnostic
// =============================================================================

/**
 * A single diagnostic entry.
 */
export interface Diagnostic {
  readonly code: string;
  readonly message: string;
  readonly nodeId?: string;
  readonly timestamp: number;
}

// =============================================================================
// DiagnosticsBag
// =============================================================================

/**
 * Diagnostic information collector.
 *
 * Per SPEC Section 5.5:
 * - warn/info: Add diagnostic entries
 * - metric: Record metric (last-write-wins)
 * - metricAdd: Accumulate metric (sum aggregation, parallel-safe)
 * - metricObserve: Observe metric for histogram/average
 */
export interface DiagnosticsBag {
  /**
   * Add warning.
   */
  warn(code: string, message: string, nodeId?: string): void;

  /**
   * Add info.
   */
  info(code: string, message: string, nodeId?: string): void;

  /**
   * Record metric (last-write-wins).
   * Overwrites if name already exists.
   *
   * Per PLG-10: Non-deterministic in parallel chunk hooks.
   */
  metric(name: string, value: number): void;

  /**
   * Accumulate metric (sum aggregation).
   * Safe for parallel chunk hooks.
   */
  metricAdd(name: string, delta: number): void;

  /**
   * Observe metric (histogram/average).
   * Stores all observations for later min/max/avg calculation.
   *
   * Per DIAG-OBS-1: May grow unbounded.
   */
  metricObserve(name: string, value: number): void;

  /** Read-only access to warnings */
  readonly warnings: readonly Diagnostic[];

  /** Read-only access to infos */
  readonly infos: readonly Diagnostic[];

  /** Read-only access to metrics */
  readonly metrics: ReadonlyMap<string, number>;

  /** Read-only access to metric observations */
  readonly metricObservations: ReadonlyMap<string, readonly number[]>;
}

// =============================================================================
// DiagnosticsReadonly
// =============================================================================

/**
 * Read-only diagnostics view.
 * Used in ExportInput.
 */
export type DiagnosticsReadonly = Pick<
  DiagnosticsBag,
  "warnings" | "infos" | "metrics" | "metricObservations"
>;

// =============================================================================
// Helpers
// =============================================================================

/**
 * Calculate statistics from metric observations.
 */
export function calculateObservationStats(
  observations: readonly number[]
): { min: number; max: number; avg: number; count: number } | null {
  if (observations.length === 0) {
    return null;
  }

  let min = observations[0];
  let max = observations[0];
  let sum = 0;

  for (const value of observations) {
    if (value < min) min = value;
    if (value > max) max = value;
    sum += value;
  }

  return {
    min,
    max,
    avg: sum / observations.length,
    count: observations.length,
  };
}
