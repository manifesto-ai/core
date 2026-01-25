/**
 * System Facade Implementation
 *
 * Provides read-only access to System Runtime state.
 *
 * @see SPEC §16.5
 * @module
 */

import type {
  SystemFacade,
  SystemRuntimeState,
  LineageOptions,
  Unsubscribe,
} from "../../core/types/index.js";
import type { SystemRuntime } from "./runtime.js";

/**
 * System Facade implementation.
 *
 * Wraps SystemRuntime to provide read-only access to system state.
 *
 * @see SPEC §16.5 SYSRT-8
 */
export class SystemFacadeImpl implements SystemFacade {
  private readonly _runtime: SystemRuntime;

  constructor(runtime: SystemRuntime) {
    this._runtime = runtime;
  }

  /**
   * Get current System Runtime state.
   *
   * @see SPEC §16.5
   */
  getState(): SystemRuntimeState {
    return this._runtime.getState();
  }

  /**
   * Get System Runtime's current head worldId.
   *
   * @see SPEC §16.5
   */
  head(): string {
    return this._runtime.head();
  }

  /**
   * Get System Runtime's worldline (audit trail).
   *
   * @see SPEC §16.5
   */
  lineage(opts?: LineageOptions): readonly string[] {
    return this._runtime.lineage(opts);
  }

  /**
   * Subscribe to System Runtime state changes.
   *
   * @see SPEC §16.5
   */
  subscribe(listener: (state: SystemRuntimeState) => void): Unsubscribe {
    return this._runtime.subscribe(listener);
  }
}

/**
 * Create a System Facade.
 */
export function createSystemFacade(runtime: SystemRuntime): SystemFacade {
  return new SystemFacadeImpl(runtime);
}
