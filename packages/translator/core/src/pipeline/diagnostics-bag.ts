/**
 * @fileoverview DiagnosticsBag Implementation (SPEC Section 5.5)
 *
 * Concrete implementation of DiagnosticsBag for pipeline operations.
 *
 * @module pipeline/diagnostics-bag
 */

import type {
  DiagnosticsBag,
  Diagnostic,
} from "../core/types/diagnostics.js";

// =============================================================================
// DiagnosticsBagImpl
// =============================================================================

/**
 * Concrete implementation of DiagnosticsBag.
 *
 * Thread-safe for parallel operations via atomic operations.
 */
export class DiagnosticsBagImpl implements DiagnosticsBag {
  private readonly _warnings: Diagnostic[] = [];
  private readonly _infos: Diagnostic[] = [];
  private readonly _metrics: Map<string, number> = new Map();
  private readonly _metricObservations: Map<string, number[]> = new Map();

  /**
   * Add warning.
   */
  warn(code: string, message: string, nodeId?: string): void {
    this._warnings.push({
      code,
      message,
      nodeId,
      timestamp: Date.now(),
    });
  }

  /**
   * Add info.
   */
  info(code: string, message: string, nodeId?: string): void {
    this._infos.push({
      code,
      message,
      nodeId,
      timestamp: Date.now(),
    });
  }

  /**
   * Record metric (last-write-wins).
   *
   * Per PLG-10: Non-deterministic in parallel chunk hooks.
   */
  metric(name: string, value: number): void {
    this._metrics.set(name, value);
  }

  /**
   * Accumulate metric (sum aggregation).
   * Safe for parallel chunk hooks.
   */
  metricAdd(name: string, delta: number): void {
    const current = this._metrics.get(name) ?? 0;
    this._metrics.set(name, current + delta);
  }

  /**
   * Observe metric (histogram/average).
   *
   * Per DIAG-OBS-1: May grow unbounded.
   */
  metricObserve(name: string, value: number): void {
    let observations = this._metricObservations.get(name);
    if (!observations) {
      observations = [];
      this._metricObservations.set(name, observations);
    }
    observations.push(value);
  }

  /**
   * Read-only access to warnings.
   */
  get warnings(): readonly Diagnostic[] {
    return this._warnings;
  }

  /**
   * Read-only access to infos.
   */
  get infos(): readonly Diagnostic[] {
    return this._infos;
  }

  /**
   * Read-only access to metrics.
   */
  get metrics(): ReadonlyMap<string, number> {
    return this._metrics;
  }

  /**
   * Read-only access to metric observations.
   */
  get metricObservations(): ReadonlyMap<string, readonly number[]> {
    // Return a view with readonly arrays
    const result = new Map<string, readonly number[]>();
    for (const [key, value] of this._metricObservations) {
      result.set(key, value);
    }
    return result;
  }

  /**
   * Create a snapshot for read-only access.
   */
  toReadonly(): DiagnosticsBag {
    return this;
  }

  /**
   * Clear all diagnostics.
   */
  clear(): void {
    this._warnings.length = 0;
    this._infos.length = 0;
    this._metrics.clear();
    this._metricObservations.clear();
  }
}

/**
 * Create a new DiagnosticsBag.
 */
export function createDiagnosticsBag(): DiagnosticsBagImpl {
  return new DiagnosticsBagImpl();
}
