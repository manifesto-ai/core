/**
 * Hook Context Implementation
 *
 * @see SPEC §11.2
 * @module
 */

import type { EnqueueOptions, EnqueuedJob, HookContext } from "../types/index.js";
import type { JobQueue } from "./queue.js";

/**
 * Internal HookContext implementation.
 *
 * @see SPEC §11.2
 */
export class HookContextImpl implements HookContext {
  private _queue: JobQueue;

  constructor(
    queue: JobQueue,
    public readonly actorId?: string,
    public readonly branchId?: string,
    public readonly worldId?: string
  ) {
    this._queue = queue;
  }

  /**
   * Enqueue a job for safe execution after hook completes.
   *
   * Direct mutations during hook execution are FORBIDDEN.
   * Use enqueue() to schedule mutations safely.
   *
   * @see SPEC §11.3
   */
  enqueue(job: EnqueuedJob, opts?: EnqueueOptions): void {
    this._queue.enqueue(job, opts);
  }
}

/**
 * Create a HookContext with the given parameters.
 */
export function createHookContext(
  queue: JobQueue,
  params?: {
    actorId?: string;
    branchId?: string;
    worldId?: string;
  }
): HookContext {
  return new HookContextImpl(
    queue,
    params?.actorId,
    params?.branchId,
    params?.worldId
  );
}
