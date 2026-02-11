/**
 * ActionHandle Implementation
 *
 * @see SPEC §8 Action Execution
 * @module
 */

import type {
  ActionHandle,
  ActionPhase,
  ActionResult,
  ActionUpdate,
  ActionUpdateDetail,
  CompletedActionResult,
  DoneOptions,
  RuntimeKind,
  Unsubscribe,
} from "@manifesto-ai/shared";

import {
  ActionRejectedError,
  ActionFailedError,
  ActionPreparationError,
  ActionTimeoutError,
  HandleDetachedError,
} from "@manifesto-ai/shared";

/**
 * Internal ActionHandle implementation.
 *
 * @see SPEC §8.1
 */
export class ActionHandleImpl implements ActionHandle {
  private _phase: ActionPhase = "preparing";
  private _result: ActionResult | null = null;
  private _detached = false;
  private _listeners: Set<(update: ActionUpdate) => void> = new Set();

  // Promise resolution for done() and result()
  private _doneResolvers: Array<{
    resolve: (result: CompletedActionResult) => void;
    reject: (error: Error) => void;
  }> = [];
  private _resultResolvers: Array<{
    resolve: (result: ActionResult) => void;
    reject: (error: Error) => void;
  }> = [];

  constructor(
    public readonly proposalId: string,
    public readonly runtime: RuntimeKind
  ) {}

  get phase(): ActionPhase {
    return this._phase;
  }

  /**
   * Wait for successful completion.
   *
   * @throws ActionRejectedError - Authority rejected
   * @throws ActionFailedError - Execution failed
   * @throws ActionPreparationError - Preparation failed
   * @throws ActionTimeoutError - Timeout exceeded
   * @throws HandleDetachedError - Handle was detached
   *
   * @see SPEC §8.5 DONE-1~6
   */
  done(opts?: DoneOptions): Promise<CompletedActionResult> {
    this._ensureNotDetached();

    // DONE-3: If already terminal, return/throw immediately
    if (this._result) {
      return this._resolveOrThrowForDone(this._result);
    }

    // DONE-4: Wait for completion with optional timeout
    return new Promise((resolve, reject) => {
      const timeoutMs = opts?.timeoutMs;

      let timeoutId: ReturnType<typeof setTimeout> | undefined;
      if (timeoutMs !== undefined && timeoutMs !== Infinity) {
        timeoutId = setTimeout(() => {
          // Remove this resolver
          const index = this._doneResolvers.findIndex(
            (r) => r.resolve === resolve
          );
          if (index !== -1) {
            this._doneResolvers.splice(index, 1);
          }
          reject(new ActionTimeoutError(this.proposalId, timeoutMs));
        }, timeoutMs);
      }

      this._doneResolvers.push({
        resolve: (result) => {
          if (timeoutId) clearTimeout(timeoutId);
          resolve(result);
        },
        reject: (error) => {
          if (timeoutId) clearTimeout(timeoutId);
          reject(error);
        },
      });
    });
  }

  /**
   * Wait for any result (no throw except timeout).
   *
   * @throws ActionTimeoutError - Timeout exceeded
   * @throws HandleDetachedError - Handle was detached
   *
   * @see SPEC §8.5
   */
  result(opts?: DoneOptions): Promise<ActionResult> {
    this._ensureNotDetached();

    // If already terminal, return immediately
    if (this._result) {
      return Promise.resolve(this._result);
    }

    // Wait for result with optional timeout
    return new Promise((resolve, reject) => {
      const timeoutMs = opts?.timeoutMs;

      let timeoutId: ReturnType<typeof setTimeout> | undefined;
      if (timeoutMs !== undefined && timeoutMs !== Infinity) {
        timeoutId = setTimeout(() => {
          // Remove this resolver
          const index = this._resultResolvers.findIndex(
            (r) => r.resolve === resolve
          );
          if (index !== -1) {
            this._resultResolvers.splice(index, 1);
          }
          reject(new ActionTimeoutError(this.proposalId, timeoutMs));
        }, timeoutMs);
      }

      this._resultResolvers.push({
        resolve: (result) => {
          if (timeoutId) clearTimeout(timeoutId);
          resolve(result);
        },
        reject: (error) => {
          if (timeoutId) clearTimeout(timeoutId);
          reject(error);
        },
      });
    });
  }

  /**
   * Subscribe to phase changes.
   *
   * @see SPEC §8.6
   */
  subscribe(listener: (update: ActionUpdate) => void): Unsubscribe {
    this._ensureNotDetached();
    this._listeners.add(listener);
    return () => {
      this._listeners.delete(listener);
    };
  }

  /**
   * Detach from this handle.
   *
   * The proposal continues in World Protocol.
   *
   * @see SPEC §8.7 DETACH-1~5
   */
  detach(): void {
    if (this._detached) return;

    // DETACH-2: Clear listeners
    this._listeners.clear();

    // DETACH-3: Reject pending done()/result() calls
    const detachError = new HandleDetachedError(this.proposalId);
    for (const resolver of this._doneResolvers) {
      resolver.reject(detachError);
    }
    for (const resolver of this._resultResolvers) {
      resolver.reject(detachError);
    }
    this._doneResolvers = [];
    this._resultResolvers = [];

    this._detached = true;
  }

  // ===========================================================================
  // Internal Methods (called by App/Executor)
  // ===========================================================================

  /**
   * Transition to a new phase.
   * @internal
   */
  _transitionTo(newPhase: ActionPhase, detail?: ActionUpdateDetail): void {
    if (this._phase === newPhase) return;

    const previousPhase = this._phase;
    this._phase = newPhase;

    const update: ActionUpdate = {
      phase: newPhase,
      previousPhase,
      detail,
      timestamp: Date.now(),
    };

    // Notify subscribers (unless detached)
    if (!this._detached) {
      for (const listener of this._listeners) {
        try {
          listener(update);
        } catch {
          // Ignore listener errors
        }
      }
    }
  }

  /**
   * Set terminal result and resolve pending promises.
   * @internal
   */
  _setResult(result: ActionResult): void {
    this._result = result;

    // Resolve result() calls
    for (const resolver of this._resultResolvers) {
      resolver.resolve(result);
    }
    this._resultResolvers = [];

    // Resolve/reject done() calls based on result status
    if (result.status === "completed") {
      for (const resolver of this._doneResolvers) {
        resolver.resolve(result);
      }
    } else if (result.status === "rejected") {
      const error = new ActionRejectedError(
        this.proposalId,
        result.reason ?? "Authority rejected the action"
      );
      for (const resolver of this._doneResolvers) {
        resolver.reject(error);
      }
    } else if (result.status === "failed") {
      const error = new ActionFailedError(
        this.proposalId,
        result.error.code,
        result.error.message
      );
      for (const resolver of this._doneResolvers) {
        resolver.reject(error);
      }
    } else if (result.status === "preparation_failed") {
      const error = new ActionPreparationError(
        this.proposalId,
        result.error.code,
        result.error.message
      );
      for (const resolver of this._doneResolvers) {
        resolver.reject(error);
      }
    }
    this._doneResolvers = [];
  }

  /**
   * Check if handle is detached.
   * @internal
   */
  get _isDetached(): boolean {
    return this._detached;
  }

  // ===========================================================================
  // Private Methods
  // ===========================================================================

  private _ensureNotDetached(): void {
    if (this._detached) {
      throw new HandleDetachedError(this.proposalId);
    }
  }

  private _resolveOrThrowForDone(
    result: ActionResult
  ): Promise<CompletedActionResult> {
    if (result.status === "completed") {
      return Promise.resolve(result);
    } else if (result.status === "rejected") {
      return Promise.reject(
        new ActionRejectedError(
          this.proposalId,
          result.reason ?? "Authority rejected the action"
        )
      );
    } else if (result.status === "failed") {
      return Promise.reject(
        new ActionFailedError(
          this.proposalId,
          result.error.code,
          result.error.message
        )
      );
    } else {
      // preparation_failed
      return Promise.reject(
        new ActionPreparationError(
          this.proposalId,
          result.error.code,
          result.error.message
        )
      );
    }
  }
}

/**
 * Generate a unique proposal ID.
 */
export function generateProposalId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 10);
  return `prop_${timestamp}_${random}`;
}
