/**
 * Action Queue Module
 *
 * Manages FIFO queues for domain and system action execution.
 *
 * @see SPEC §SCHED-1~4
 * @module
 */

// =============================================================================
// Types
// =============================================================================

/**
 * Action job function.
 */
export type ActionJob = () => Promise<void>;

/**
 * Action Queue interface.
 *
 * Provides FIFO serialization for domain and system actions.
 */
export interface ActionQueue {
  /**
   * Enqueue a domain action for execution.
   *
   * All domain actions are serialized via single FIFO queue,
   * preventing version conflicts from concurrent snapshot modifications.
   *
   * @see SPEC §SCHED-1
   * @param job - The action job to execute
   */
  enqueueDomain(job: ActionJob): void;

  /**
   * Enqueue a system action for execution.
   *
   * All system actions share a single FIFO queue for serialization.
   *
   * @see SPEC §SCHED-4
   * @param job - The action job to execute
   */
  enqueueSystem(job: ActionJob): void;
}

// =============================================================================
// Implementation
// =============================================================================

/**
 * FIFO Action Queue implementation.
 *
 * Key design decisions:
 * 1. Previous rejection doesn't block queue (.catch(() => {}))
 * 2. Tail always resolves (wrap in .catch)
 *
 * NOTE: Per-branch parallelism would require per-branch Host instances.
 * Current architecture uses single Host per App.
 */
export class ActionQueueImpl implements ActionQueue {
  /**
   * Domain action FIFO queue.
   * All domain actions are serialized via single queue.
   */
  private _domainQueue: Promise<void> = Promise.resolve();

  /**
   * System action FIFO queue.
   * All system actions are serialized in a single queue.
   */
  private _systemQueue: Promise<void> = Promise.resolve();

  enqueueDomain(job: ActionJob): void {
    const prev = this._domainQueue;
    const next = prev
      .catch(() => {}) // Previous failure doesn't block queue
      .then(job);
    this._domainQueue = next.catch(() => {}); // Tail always resolves
  }

  enqueueSystem(job: ActionJob): void {
    const prev = this._systemQueue;
    const next = prev
      .catch(() => {}) // Previous failure doesn't block queue
      .then(job);
    this._systemQueue = next.catch(() => {}); // Tail always resolves
  }
}

// =============================================================================
// Factory
// =============================================================================

/**
 * Create a new ActionQueue instance.
 */
export function createActionQueue(): ActionQueue {
  return new ActionQueueImpl();
}
