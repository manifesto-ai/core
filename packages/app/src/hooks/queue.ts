/**
 * Job Queue Implementation
 *
 * Manages enqueued jobs with priority support.
 *
 * @see SPEC §11.3 ENQ-1~6
 * @module
 */

import type { EnqueueOptions, EnqueuedJob } from "../types/index.js";

/**
 * Internal job representation.
 */
interface QueuedJob {
  job: EnqueuedJob;
  priority: "immediate" | "normal" | "defer";
  label?: string;
  enqueuedAt: number;
}

/**
 * Job Queue for managing enqueued jobs.
 *
 * @see SPEC §11.3
 */
export class JobQueue {
  private _immediateJobs: QueuedJob[] = [];
  private _normalJobs: QueuedJob[] = [];
  private _deferredJobs: QueuedJob[] = [];
  private _isProcessing = false;
  private _processScheduled = false;

  /**
   * Enqueue a job with optional priority.
   *
   * ENQ-1: Jobs are executed after the current hook completes
   * ENQ-2: Priority ordering: immediate > normal > defer
   * ENQ-3: Within same priority, FIFO ordering
   *
   * @see SPEC §11.3
   */
  enqueue(job: EnqueuedJob, opts?: EnqueueOptions): void {
    const priority = opts?.priority ?? "normal";
    const queuedJob: QueuedJob = {
      job,
      priority,
      label: opts?.label,
      enqueuedAt: Date.now(),
    };

    switch (priority) {
      case "immediate":
        this._immediateJobs.push(queuedJob);
        break;
      case "defer":
        this._deferredJobs.push(queuedJob);
        break;
      case "normal":
      default:
        this._normalJobs.push(queuedJob);
        break;
    }

    // Schedule processing if not already scheduled
    this._scheduleProcess();
  }

  /**
   * Process all pending jobs.
   *
   * ENQ-4: Jobs are processed in priority order
   * ENQ-5: Errors in jobs are caught and logged (don't break queue)
   * ENQ-6: New jobs enqueued during processing are handled
   *
   * @see SPEC §11.3
   */
  async processAll(): Promise<void> {
    if (this._isProcessing) {
      return;
    }

    this._isProcessing = true;
    this._processScheduled = false;

    try {
      // Process until all queues are empty
      while (this._hasJobs()) {
        // Process in priority order: immediate > normal > defer
        const job = this._dequeueNext();
        if (job) {
          try {
            await job.job();
          } catch (error) {
            // ENQ-5: Log error but continue processing
            console.error(
              `[JobQueue] Error in job${job.label ? ` "${job.label}"` : ""}:`,
              error
            );
          }
        }
      }
    } finally {
      this._isProcessing = false;
    }
  }

  /**
   * Check if queue has pending jobs.
   */
  hasPendingJobs(): boolean {
    return this._hasJobs();
  }

  /**
   * Get count of pending jobs.
   */
  pendingCount(): number {
    return (
      this._immediateJobs.length +
      this._normalJobs.length +
      this._deferredJobs.length
    );
  }

  /**
   * Clear all pending jobs.
   */
  clear(): void {
    this._immediateJobs = [];
    this._normalJobs = [];
    this._deferredJobs = [];
  }

  // ===========================================================================
  // Private Methods
  // ===========================================================================

  private _hasJobs(): boolean {
    return (
      this._immediateJobs.length > 0 ||
      this._normalJobs.length > 0 ||
      this._deferredJobs.length > 0
    );
  }

  private _dequeueNext(): QueuedJob | undefined {
    // Priority order: immediate > normal > defer
    if (this._immediateJobs.length > 0) {
      return this._immediateJobs.shift();
    }
    if (this._normalJobs.length > 0) {
      return this._normalJobs.shift();
    }
    if (this._deferredJobs.length > 0) {
      return this._deferredJobs.shift();
    }
    return undefined;
  }

  private _scheduleProcess(): void {
    if (this._processScheduled || this._isProcessing) {
      return;
    }

    this._processScheduled = true;

    // Use queueMicrotask for immediate scheduling
    queueMicrotask(() => {
      void this.processAll();
    });
  }
}
